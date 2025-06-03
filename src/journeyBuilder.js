import { RoutingService } from './routingService.js';
import { t } from './translations.js';

export class JourneyBuilder {
    constructor() {
        this.tracks = []; // Array of uploaded GPX tracks
        this.segments = []; // Array of journey segments (tracks + transportation)
        this.routingService = new RoutingService();
        this.routingServices = {
            car: 'https://api.openrouteservice.org/v2/directions/driving-car',
            walking: 'https://api.openrouteservice.org/v2/directions/foot-walking',
            cycling: 'https://api.openrouteservice.org/v2/directions/cycling-regular'
        };
        this.apiKey = null; // Will need to be set by user or environment
        this.isDrawingRoute = false;
        this.currentDrawnRoute = [];
        
        // Auto-preview functionality
        this.autoPreviewEnabled = true;
        this.previewTimeout = null;
        this.previewDelay = 1000; // 1 second delay for debouncing
        
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Clear tracks button
        document.getElementById('clearTracksBtn')?.addEventListener('click', () => {
            this.clearAllTracks();
        });

        // Transportation mode buttons
        document.querySelectorAll('.transport-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.target.getAttribute('data-mode');
                this.addTransportationSegment(mode);
            });
        });
    }

    // Add a GPX track to the journey
    addTrack(trackData, filename) {
        console.log('JourneyBuilder.addTrack called with:', { trackData, filename });
        
        // Check if trackData has the expected structure
        if (!trackData || !trackData.trackPoints) {
            console.error('Invalid track data - missing trackPoints:', trackData);
            this.showMessage(t('messages.invalidTrackData'), 'error');
            return;
        }
        
        // Convert trackPoints to coordinates format expected by the system
        const coordinates = trackData.trackPoints.map(point => [point.lon, point.lat]);
        console.log(`Converted ${trackData.trackPoints.length} track points to coordinates`);
        
        const track = {
            id: Date.now() + Math.random(),
            name: filename.replace('.gpx', ''),
            filename,
            data: {
                ...trackData,
                coordinates: coordinates
            },
            type: 'gpx',
            startPoint: coordinates[0],
            endPoint: coordinates[coordinates.length - 1],
            stats: trackData.stats
        };

        console.log('Created track object:', track);
        
        this.tracks.push(track);
        console.log(`Total tracks now: ${this.tracks.length}`);
        
        this.renderTracksList();
        this.updateSegments();
        this.showJourneyPlanningSection();
        
        // Auto-preview the journey
        this.autoPreviewJourney();
        
        // Prevent message spam: clear any pending addTrack message
        if (this._addTrackMsgTimeout) {
            clearTimeout(this._addTrackMsgTimeout);
        }
        // Debounce message: only show after a short delay, and only show the latest one
        this._addTrackMsgTimeout = setTimeout(() => {
            // Only show the message if no new addTrack has been called in the last 350ms
            if (this._addTrackMsgTimeout) {
                this._addTrackMsgTimeout = null;
                if (this.tracks.length === 1) {
                    this.showMessage(t('messages.trackAddedAutoPreview'), 'info');
                } else {
                    this.showMessage(t('messages.trackAddedUpdating'), 'info');
                }
            }
        }, 350);
    }

    // Remove a track
    removeTrack(trackId) {
        this.tracks = this.tracks.filter(track => track.id !== trackId);
        this.renderTracksList();
        this.updateSegments();
        
        if (this.tracks.length === 0) {
            this.hideJourneyPlanningSection();
        } else {
            // Auto-preview if there are still tracks
            this.autoPreviewJourney();
        }
    }

    // Clear all tracks
    clearAllTracks() {
        this.tracks = [];
        this.segments = [];
        this.renderTracksList();
        this.renderSegmentsList();
        this.hideJourneyPlanningSection();
    }

    // Render the tracks list UI
    renderTracksList() {
        const tracksItems = document.getElementById('tracksItems');
        if (!tracksItems) return;

        tracksItems.innerHTML = '';

        // Add "Add More Tracks" button if there are existing tracks
        if (this.tracks.length > 0) {
            const addMoreButton = document.createElement('div');
            addMoreButton.className = 'track-item add-more-tracks';
            addMoreButton.innerHTML = `
                <div class="track-icon">➕</div>
                <div class="track-info">
                    <div class="track-name">${t('journeyBuilder.addMoreTracks')}</div>
                    <div class="track-stats">${t('journeyBuilder.clickToUploadAdditionalGPXFiles')}</div>
                </div>
            `;
            addMoreButton.addEventListener('click', () => this.addMoreTracks());
            tracksItems.appendChild(addMoreButton);
        }

        this.tracks.forEach((track, index) => {
            const trackElement = document.createElement('div');
            trackElement.className = 'track-item';
            trackElement.draggable = true;
            trackElement.setAttribute('data-track-id', track.id);

            trackElement.innerHTML = `
                <div class="track-icon">${this.getTrackIcon(track.data.activityType || 'running')}</div>
                <div class="track-info">
                    <div class="track-name">${track.name}</div>
                    <div class="track-stats">
                        ${this.formatDistance(track.stats.totalDistance)} • 
                        ${this.formatElevation(track.stats.elevationGain)} elevation
                    </div>
                </div>
                <div class="track-actions">
                    <button class="track-action-btn" onclick="journeyBuilder.moveTrack(${track.id}, 'up')" title="${t('journeyBuilder.moveUp')}">⬆️</button>
                    <button class="track-action-btn" onclick="journeyBuilder.moveTrack(${track.id}, 'down')" title="${t('journeyBuilder.moveDown')}">⬇️</button>
                    <button class="track-action-btn" onclick="journeyBuilder.removeTrack(${track.id})" title="${t('journeyBuilder.remove')}">🗑️</button>
                </div>
            `;

            // Add drag and drop functionality
            this.setupDragAndDrop(trackElement);
            tracksItems.appendChild(trackElement);
        });
    }

    // Get appropriate icon for track type
    getTrackIcon(activityType) {
        const icons = {
            running: '🏃‍♂️',
            cycling: '🚴‍♂️',
            swimming: '🏊‍♂️',
            hiking: '🥾',
            walking: '🚶‍♂️'
        };
        return icons[activityType] || '🏃‍♂️';
    }

    // Move track up or down in order
    moveTrack(trackId, direction) {
        const index = this.tracks.findIndex(track => track.id === trackId);
        if (index === -1) return;

        if (direction === 'up' && index > 0) {
            [this.tracks[index], this.tracks[index - 1]] = [this.tracks[index - 1], this.tracks[index]];
        } else if (direction === 'down' && index < this.tracks.length - 1) {
            [this.tracks[index], this.tracks[index + 1]] = [this.tracks[index + 1], this.tracks[index]];
        }

        this.renderTracksList();
        this.updateSegments();
        
        // Auto-preview with new track order
        this.autoPreviewJourney();
    }

    // Setup drag and drop for reordering tracks
    setupDragAndDrop(element) {
        element.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', e.target.getAttribute('data-track-id'));
            e.target.classList.add('dragging');
        });

        element.addEventListener('dragend', (e) => {
            e.target.classList.remove('dragging');
        });

        element.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        element.addEventListener('drop', (e) => {
            e.preventDefault();
            const draggedId = parseInt(e.dataTransfer.getData('text/plain'));
            const dropTargetId = parseInt(e.target.closest('.track-item').getAttribute('data-track-id'));
            
            if (draggedId !== dropTargetId) {
                this.reorderTracks(draggedId, dropTargetId);
            }
        });
    }

    // Reorder tracks based on drag and drop
    reorderTracks(draggedId, dropTargetId) {
        const draggedIndex = this.tracks.findIndex(track => track.id === draggedId);
        const dropTargetIndex = this.tracks.findIndex(track => track.id === dropTargetId);
        
        if (draggedIndex === -1 || dropTargetIndex === -1) return;

        const draggedTrack = this.tracks.splice(draggedIndex, 1)[0];
        this.tracks.splice(dropTargetIndex, 0, draggedTrack);

        this.renderTracksList();
        this.updateSegments();
        
        // Auto-preview with new track order
        this.autoPreviewJourney();
    }

    // Update segments based on track order and add transportation options
    updateSegments() {
        this.segments = [];

        for (let i = 0; i < this.tracks.length; i++) {
            // Add track segment
            this.segments.push({
                id: `track_${this.tracks[i].id}`,
                type: 'track',
                data: this.tracks[i],
                startPoint: this.tracks[i].startPoint,
                endPoint: this.tracks[i].endPoint
            });

            // DON'T automatically add transportation segments
            // Only add them when user explicitly chooses a transport mode
        }

        this.renderSegmentsList();
    }

    // Render the segments list UI (with timing summary and configuration)
    renderSegmentsList() {
        const segmentsList = document.getElementById('segmentsList');
        if (!segmentsList) return;

        segmentsList.innerHTML = '';

        // Add timing summary
        const timingSummary = this.calculateJourneyTiming();
        const summaryElement = document.createElement('div');
        summaryElement.className = 'journey-timing-summary';
        summaryElement.innerHTML = `
            <div class="timing-summary-header">
                <span>${t('journeyBuilder.journeyTiming')}</span>
                <span class="total-time">${this.formatDuration(timingSummary.totalDuration)}</span>
            </div>
            <div class="timing-summary-breakdown">
                <span>${t('journeyBuilder.tracks')}: ${this.formatDuration(timingSummary.trackDuration)}</span>
                <span>${t('journeyBuilder.transportation')}: ${this.formatDuration(timingSummary.transportDuration)}</span>
            </div>
        `;
        segmentsList.appendChild(summaryElement);

        // Group segments and add transportation options between tracks
        const trackSegments = this.segments.filter(s => s.type === 'track');
        
        trackSegments.forEach((trackSegment, trackIndex) => {
            // Add track segment
            const estimatedTime = this.calculateTrackTime(trackSegment.data);
            
            const trackElement = document.createElement('div');
            trackElement.className = 'segment-item track';
            trackElement.innerHTML = `
                <div class="segment-icon">${this.getTrackIcon(trackSegment.data.activityType)}</div>
                <div class="segment-content">
                    <div class="segment-title">${trackSegment.data.name}</div>
                    <div class="segment-description">
                        GPX Track • ${this.formatDistance(trackSegment.data.stats.totalDistance)}
                    </div>
                    <div class="segment-timing">
                        <label>${t('journeyBuilder.animationTime')}:</label>
                        <input type="number" class="segment-time-input" 
                               value="${trackSegment.userTime || estimatedTime}" 
                               min="5" max="600" step="5" 
                               onchange="journeyBuilder.updateSegmentTime(${this.segments.indexOf(trackSegment)}, this.value, 'track')">
                        <span>${t('journeyBuilder.seconds')}</span>
                    </div>
                </div>
            `;
            segmentsList.appendChild(trackElement);
            
            // Add transportation between this track and the next (if not last track)
            if (trackIndex < trackSegments.length - 1) {
                // Check if there's already a transport segment between these tracks
                const nextTrackSegment = trackSegments[trackIndex + 1];
                const existingTransport = this.segments.find(s => 
                    s.type === 'transportation' && 
                    s.startPoint === trackSegment.endPoint && 
                    s.endPoint === nextTrackSegment.startPoint
                );
                
                if (existingTransport) {
                    // Show existing transport segment
                    const distance = this.calculateDistance(existingTransport.startPoint, existingTransport.endPoint);
                    let routeInfo = '';
                    let transportTime = 0;
                    
                    if (existingTransport.route) {
                        routeInfo = ` • ${this.formatDistance(existingTransport.route.distance / 1000)} • ${this.formatDuration(existingTransport.route.duration)}`;
                        transportTime = existingTransport.route.userTime || existingTransport.userTime || this.getDefaultTransportTime(existingTransport.mode, distance);
                    } else {
                        routeInfo = ` • ~${distance.toFixed(1)}km`;
                        transportTime = existingTransport.userTime || this.getDefaultTransportTime(existingTransport.mode, distance);
                    }
                    
                    const transportElement = document.createElement('div');
                    transportElement.className = 'segment-item transport';
                    transportElement.innerHTML = `
                        <div class="segment-icon">${this.getTransportIcon(existingTransport.mode)}</div>
                        <div class="segment-content">
                            <div class="segment-title">${t('journeyBuilder.transportation')}: ${existingTransport.mode}</div>
                            <div class="segment-description">
                                ${existingTransport.route ? 'Route via ' + (existingTransport.route.provider || 'roads') : `Distance: ~${distance.toFixed(1)}km`}${routeInfo}
                            </div>
                            <div class="segment-timing">
                                <label>${t('journeyBuilder.animationTime')}:</label>
                                <input type="number" class="segment-time-input" 
                                       value="${transportTime}" 
                                       min="5" max="600" step="5" 
                                       onchange="journeyBuilder.updateSegmentTime(${this.segments.indexOf(existingTransport)}, this.value, 'transport')">
                                <span>${t('journeyBuilder.seconds')}</span>
                            </div>
                        </div>
                        <div class="segment-actions">
                            <button class="track-action-btn" onclick="journeyBuilder.editTransportation(${this.segments.indexOf(existingTransport)})" title="${t('journeyBuilder.edit')}">✏️</button>
                            <button class="track-action-btn" onclick="journeyBuilder.removeTransportation(${this.segments.indexOf(existingTransport)})" title="${t('journeyBuilder.remove')}">🗑️</button>
                        </div>
                    `;
                    segmentsList.appendChild(transportElement);
                } else {
                    // Show "Add Transportation" button
                    const distance = this.calculateDistance(trackSegment.endPoint, nextTrackSegment.startPoint);
                    const addTransportElement = document.createElement('div');
                    addTransportElement.className = 'segment-item transport-add';
                    addTransportElement.innerHTML = `
                        <div class="segment-icon">❓</div>
                        <div class="segment-content">
                            <div class="segment-title">${t('journey.addTransportation')}</div>
                            <div class="segment-description">
                                ${t('journeyBuilder.chooseHowToTravelBetweenTracks')} (~${distance.toFixed(1)}km)
                            </div>
                        </div>
                        <div class="segment-actions">
                            <button class="track-action-btn" onclick="journeyBuilder.showTransportationOptions(${trackIndex})" title="${t('journeyBuilder.addTransport')}">➕</button>
                        </div>
                    `;
                    segmentsList.appendChild(addTransportElement);
                }
            }
        });
    }

    // Render visual timeline editor separately (called from main app)
    renderTimelineEditor(container) {
        if (!container) return;
        
        // Clear existing content
        container.innerHTML = '';
        
        // Create timeline container
        const timelineContainer = document.createElement('div');
        timelineContainer.className = 'timeline-editor';
        timelineContainer.innerHTML = `
            <div class="timeline-header">
                <h4>${t('journeyBuilder.journeyTimeline')}</h4>
                <div class="timeline-controls">
                    <button class="timeline-zoom-btn" onclick="journeyBuilder.zoomTimeline(0.5)">➖</button>
                    <span class="timeline-zoom-level">1x</span>
                    <button class="timeline-zoom-btn" onclick="journeyBuilder.zoomTimeline(2)">➕</button>
                </div>
            </div>
            <div class="timeline-track">
                <div class="timeline-ruler"></div>
                <div class="timeline-segments" id="timelineSegments">
                    <div class="timeline-progress-indicator" id="timelineProgressIndicator"></div>
                </div>
            </div>
        `;
        
        container.appendChild(timelineContainer);
        
        // Render timeline segments
        this.renderTimelineSegments();
    }

    // Render timeline segments as visual blocks
    renderTimelineSegments() {
        const timelineSegments = document.getElementById('timelineSegments');
        if (!timelineSegments) return;
        
        // Store existing event listeners before clearing
        const existingListeners = [];
        const existingSegments = timelineSegments.querySelectorAll('.timeline-segment');
        existingSegments.forEach(segment => {
            const segmentIndex = parseInt(segment.getAttribute('data-segment-index'));
            if (!isNaN(segmentIndex)) {
                existingListeners[segmentIndex] = {
                    element: segment,
                    listeners: segment.cloneNode(false) // Store reference for potential listener transfer
                };
            }
        });
        
        // Clear existing segments but keep progress indicator
        const progressIndicator = document.getElementById('timelineProgressIndicator');
        timelineSegments.innerHTML = '';
        if (progressIndicator) {
            timelineSegments.appendChild(progressIndicator);
        } else {
            // Create progress indicator if it doesn't exist
            const newIndicator = document.createElement('div');
            newIndicator.className = 'timeline-progress-indicator';
            newIndicator.id = 'timelineProgressIndicator';
            timelineSegments.appendChild(newIndicator);
        }
        
        const timingSummary = this.calculateJourneyTiming();
        const totalDuration = timingSummary.totalDuration;
        
        if (totalDuration === 0) return;
        
        // Timeline scale (pixels per second)
        this.timelineScale = this.timelineZoom || 1;
        const pixelsPerSecond = 3 * this.timelineScale; // Base 3px per second
        
        let currentTime = 0;
        
        this.segments.forEach((segment, index) => {
            let segmentDuration = 0;
            
            if (segment.type === 'track') {
                const estimatedTime = this.calculateTrackTime(segment.data);
                segmentDuration = segment.userTime || estimatedTime;
            } else if (segment.mode) {
                // Transportation segment with mode
                if (segment.route && segment.route.userTime) {
                    segmentDuration = segment.route.userTime;
                } else if (segment.startPoint && segment.endPoint) {
                    const distance = this.calculateDistance(segment.startPoint, segment.endPoint);
                    segmentDuration = this.getDefaultTransportTime(segment.mode, distance);
                } else {
                    segmentDuration = 30; // Default fallback
                }
            } else {
                segmentDuration = 10; // Default for unset transportation
            }
            
            const segmentWidth = segmentDuration * pixelsPerSecond;
            const segmentElement = document.createElement('div');
            segmentElement.className = `timeline-segment ${segment.type}`;
            segmentElement.setAttribute('data-segment-index', index);
            segmentElement.style.width = `${segmentWidth}px`;
            segmentElement.style.left = `${currentTime * pixelsPerSecond}px`;
            
            // Add segment content
            if (segment.type === 'track') {
                segmentElement.innerHTML = `
                    <div class="timeline-segment-header">
                        <span class="timeline-segment-icon">${this.getTrackIcon(segment.data.data.activityType)}</span>
                        <span class="timeline-segment-title">${segment.data.name}</span>
                    </div>
                    <div class="timeline-segment-duration">${segmentDuration}s</div>
                    <div class="timeline-segment-resize-handle"></div>
                `;
                segmentElement.style.backgroundColor = '#4CAF50';
            } else if (segment.mode) {
                segmentElement.innerHTML = `
                    <div class="timeline-segment-header">
                        <span class="timeline-segment-icon">${this.getTransportIcon(segment.mode)}</span>
                        <span class="timeline-segment-title">${segment.mode}</span>
                    </div>
                    <div class="timeline-segment-duration">${segmentDuration}s</div>
                    <div class="timeline-segment-resize-handle"></div>
                `;
                const colors = {
                    car: '#ff6b6b', boat: '#4ecdc4', plane: '#ffe66d', 
                    train: '#a8e6cf', walk: '#ff9f43', cycling: '#48cae4'
                };
                segmentElement.style.backgroundColor = colors[segment.mode] || '#ff6b6b';
            } else {
                segmentElement.innerHTML = `
                    <div class="timeline-segment-header">
                        <span class="timeline-segment-icon">❓</span>
                        <span class="timeline-segment-title">${t('journey.addTransportation')}</span>
                    </div>
                    <div class="timeline-segment-duration">${segmentDuration}s</div>
                `;
                segmentElement.style.backgroundColor = '#ccc';
                segmentElement.style.borderStyle = 'dashed';
            }
            
            // ALWAYS add drag and resize functionality - this ensures event listeners are reattached
            this.setupTimelineSegmentInteraction(segmentElement, index);
            
            timelineSegments.appendChild(segmentElement);
            currentTime += segmentDuration;
        });
        
        // Update ruler
        this.updateTimelineRuler(totalDuration, pixelsPerSecond);
        
        // ALWAYS re-setup timeline clicking for scrubbing after re-rendering
        this.setupTimelineScrubbing();
        
        console.log('Timeline segments re-rendered with fresh event listeners');
    }

    // Setup timeline clicking for scrubbing
    setupTimelineScrubbing() {
        const timelineSegments = document.getElementById('timelineSegments');
        if (!timelineSegments) return;
        
        // Remove existing click listener
        if (this.timelineClickListener) {
            timelineSegments.removeEventListener('click', this.timelineClickListener);
        }
        
        this.timelineClickListener = (e) => {
            // Don't interfere with segment interactions
            if (e.target.closest('.timeline-segment') && !e.target.classList.contains('timeline-segments')) {
                return;
            }
            
            const rect = timelineSegments.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const pixelsPerSecond = 3 * (this.timelineScale || 1);
            const clickTime = clickX / pixelsPerSecond;
            const totalDuration = this.calculateJourneyTiming().totalDuration;
            
            if (totalDuration <= 0) {
                console.warn('Invalid total duration for timeline seeking:', totalDuration);
                return;
            }
            
            const progress = Math.max(0, Math.min(1, clickTime / totalDuration));
            
            console.log('Timeline click calculation:', {
                clickX,
                pixelsPerSecond,
                clickTime,
                totalDuration,
                progress: progress.toFixed(3)
            });
            
            // Dispatch event to seek to this position
            const seekEvent = new CustomEvent('timelineSeek', {
                detail: { progress }
            });
            document.dispatchEvent(seekEvent);
        };
        
        timelineSegments.addEventListener('click', this.timelineClickListener);
    }

    // Setup drag and resize for timeline segments
    setupTimelineSegmentInteraction(element, segmentIndex) {
        // Remove any existing listeners to prevent duplicates
        element.removeAttribute('data-listeners-attached');
        
        // Drag functionality
        const handleMouseDown = (e) => {
            e.preventDefault();
            if (e.target.classList.contains('timeline-segment-resize-handle')) {
                this.startResize(e, element, segmentIndex);
            } else {
                this.startDrag(e, element, segmentIndex);
            }
        };
        
        // Click to edit
        const handleDoubleClick = () => {
            const segment = this.segments[segmentIndex];
            if (segment && segment.type === 'transportation') {
                this.editTransportation(segmentIndex);
            }
        };
        
        // Attach event listeners
        element.addEventListener('mousedown', handleMouseDown);
        element.addEventListener('dblclick', handleDoubleClick);
        
        // Mark as having listeners attached
        element.setAttribute('data-listeners-attached', 'true');
        
        console.log(`Event listeners attached to timeline segment ${segmentIndex}`);
    }

    // Start dragging segment
    startDrag(e, element, segmentIndex) {
        e.preventDefault();
        const startX = e.clientX;
        const initialLeft = element.offsetLeft;
        
        const handleMouseMove = (e) => {
            const deltaX = e.clientX - startX;
            const newLeft = Math.max(0, initialLeft + deltaX);
            element.style.left = `${newLeft}px`;
            element.style.zIndex = '1000';
            element.classList.add('dragging');
        };
        
        const handleMouseUp = () => {
            element.style.zIndex = '';
            element.classList.remove('dragging');
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            
            // Reorder segments based on new position
            this.reorderSegmentsFromTimeline();
        };
        
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }

    // Start resizing segment
    startResize(e, element, segmentIndex) {
        e.preventDefault();
        e.stopPropagation();
        
        const startX = e.clientX;
        const startWidth = element.offsetWidth;
        const pixelsPerSecond = 3 * (this.timelineScale || 1);
        
        // Store original segment data for fallback
        const originalSegment = this.segments[segmentIndex];
        const originalDuration = element.querySelector('.timeline-segment-duration').textContent;
        
        const handleMouseMove = (e) => {
            const deltaX = e.clientX - startX;
            const newWidth = Math.max(30, startWidth + deltaX); // Minimum 30px
            const newDuration = Math.max(5, Math.round(newWidth / pixelsPerSecond));
            
            element.style.width = `${newWidth}px`;
            element.querySelector('.timeline-segment-duration').textContent = `${newDuration}s`;
            element.classList.add('resizing');
        };
        
        const handleMouseUp = () => {
            element.classList.remove('resizing');
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            
            try {
                // Calculate final duration
                const finalWidth = element.offsetWidth;
                const finalDuration = Math.max(5, Math.round(finalWidth / pixelsPerSecond));
                const segmentType = this.segments[segmentIndex].type === 'track' ? 'track' : 'transport';
                
                console.log(`Timeline resize: segment ${segmentIndex} (${segmentType}) duration changed to ${finalDuration}s`);
                
                // Use the same updateSegmentTime method to keep everything in sync
                // This will trigger a re-render but the event listeners will be reattached
                this.updateSegmentTime(segmentIndex, finalDuration, segmentType);
                
            } catch (error) {
                console.error('Error updating segment timing from resize:', error);
                // Restore original state
                element.style.width = startWidth + 'px';
                element.querySelector('.timeline-segment-duration').textContent = originalDuration;
                this.showMessage('Error updating segment timing', 'error');
            }
        };
        
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }

    // Update timeline ruler
    updateTimelineRuler(totalDuration, pixelsPerSecond) {
        const ruler = document.querySelector('.timeline-ruler');
        if (!ruler) return;
        
        ruler.innerHTML = '';
        const tickInterval = totalDuration > 120 ? 30 : totalDuration > 60 ? 15 : 10; // seconds
        
        for (let time = 0; time <= totalDuration; time += tickInterval) {
            const tick = document.createElement('div');
            tick.className = 'timeline-tick';
            tick.style.left = `${time * pixelsPerSecond}px`;
            tick.innerHTML = `<span>${this.formatTime(time)}</span>`;
            ruler.appendChild(tick);
        }
    }

    // Format time for ruler
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // Zoom timeline
    zoomTimeline(factor) {
        this.timelineZoom = (this.timelineZoom || 1) * factor;
        this.timelineZoom = Math.max(0.25, Math.min(4, this.timelineZoom)); // Limit zoom
        
        document.querySelector('.timeline-zoom-level').textContent = `${this.timelineZoom}x`;
        this.renderTimelineSegments();
    }

    // Reorder segments based on timeline positions
    reorderSegmentsFromTimeline() {
        const timelineSegmentElements = document.querySelectorAll('.timeline-segment');
        const segmentPositions = [];
        
        timelineSegmentElements.forEach((element, index) => {
            const segmentIndex = parseInt(element.getAttribute('data-segment-index'));
            if (!isNaN(segmentIndex) && this.segments[segmentIndex]) {
                segmentPositions.push({
                    element,
                    segmentIndex,
                    segment: this.segments[segmentIndex],
                    position: element.offsetLeft
                });
            }
        });
        
        // Sort by position
        segmentPositions.sort((a, b) => a.position - b.position);
        
        // Check if order actually changed
        const newOrder = segmentPositions.map(item => item.segmentIndex);
        const currentOrder = this.segments.map((_, index) => index);
        const orderChanged = !newOrder.every((value, index) => value === currentOrder[index]);
        
        if (!orderChanged) {
            console.log('Segment order unchanged, skipping reorder');
            return;
        }
        
        console.log('Reordering segments from timeline positions');
        
        // Reorder segments array
        const newSegments = [];
        segmentPositions.forEach(item => {
            newSegments.push(item.segment);
        });
        
        this.segments = newSegments;
        
        // Re-render everything to ensure consistency
        this.renderSegmentsList();
        this.renderTimelineSegments();
        
        // Notify main app of the change
        this.notifySegmentOrderChanged();
        
        // Auto-preview with new segment order
        this.autoPreviewJourney();
    }

    // Notify main app that segment order changed
    notifySegmentOrderChanged() {
        const event = new CustomEvent('segmentOrderChanged', {
            detail: { segments: this.segments }
        });
        document.dispatchEvent(event);
    }

    // Get icon for transportation mode
    getTransportIcon(mode) {
        const icons = {
            car: '🚗',
            boat: '⛵',
            plane: '✈️',
            train: '🚂',
            walk: '🚶‍♂️'
        };
        return icons[mode] || '🚶‍♂️';
    }

    // Show transportation options for a specific segment
    showTransportationOptions(segmentIndex) {
        const transportOptions = document.getElementById('transportationOptions');
        transportOptions.style.display = 'block';
        transportOptions.setAttribute('data-segment-index', segmentIndex);

        // Don't scroll when in route drawing mode
        if (!document.body.classList.contains('route-drawing-active')) {
            transportOptions.scrollIntoView({ behavior: 'smooth' });
        }
    }

    // Add transportation segment
    addTransportationSegment(mode) {
        const transportOptions = document.getElementById('transportationOptions');
        const segmentIndex = parseInt(transportOptions.getAttribute('data-segment-index'));
        
        // Find which tracks this transportation connects
        const trackIndex = Math.floor(segmentIndex / 2); // Approximate track index
        
        if (trackIndex >= 0 && trackIndex < this.tracks.length - 1) {
            const startPoint = this.tracks[trackIndex].endPoint;
            const endPoint = this.tracks[trackIndex + 1].startPoint;
            
            // Create a new transportation segment
            const transportSegment = {
                id: `transport_${trackIndex}`,
                type: 'transportation',
                mode: mode,
                startPoint: startPoint,
                endPoint: endPoint,
                route: null,
                userTime: this.getDefaultTransportTime(mode, 0) // Use default time
            };
            
            // Add the transport segment at the right position in the segments array
            const insertPosition = (trackIndex * 2) + 1; // After the track, before next track
            this.segments.splice(insertPosition, 0, transportSegment);
            
            console.log(`Added ${mode} transport between track ${trackIndex} and ${trackIndex + 1}`);
            
            // Automatically calculate route for car/walking/cycling
            if (['car', 'walk', 'cycling'].includes(mode)) {
                this.calculateRoute(insertPosition, mode);
            } else if (['boat', 'plane'].includes(mode)) {
                // Check if we have map access for route drawing
                this.checkMapAccessAndDraw(insertPosition, mode);
            }
        }

        transportOptions.style.display = 'none';
        // Clear editing attributes
        transportOptions.removeAttribute('data-editing');
        transportOptions.removeAttribute('data-previous-mode');
        
        this.renderSegmentsList();
        
        // Auto-preview the updated journey
        this.autoPreviewJourney();
    }

    // Check if map is available for route drawing, auto-preview if needed
    checkMapAccessAndDraw(segmentIndex, mode) {
        // Add route-drawing-active class to body
        document.body.classList.add('route-drawing-active');
        
        // Try to access map for route drawing
        const requestMapEvent = new CustomEvent('requestMapForDrawing', {
            detail: { 
                callback: (map) => {
                    if (map) {
                        // Map is available, start route drawing
                        this.startRouteDrawing(segmentIndex, mode);
                    } else {
                        // Map not available, trigger auto-preview first
                        this.autoPreviewForRouteDrawing(segmentIndex, mode);
                    }
                }
            }
        });
        document.dispatchEvent(requestMapEvent);
        
        // If no response within 100ms, assume map not available
        setTimeout(() => {
            if (!this.isDrawingRoute) {
                this.autoPreviewForRouteDrawing(segmentIndex, mode);
            }
        }, 100);
    }

    // Auto-preview the journey to enable route drawing
    autoPreviewForRouteDrawing(segmentIndex, mode) {
        this.showMessage(t('messages.openingMapPreview'), 'info');
        
        // Store the pending route drawing info
        this.pendingRouteDrawing = { segmentIndex, mode };
        
        // Trigger preview
        this.previewJourney();
        
        // Wait a bit for the map to load, then start route drawing
        setTimeout(() => {
            if (this.pendingRouteDrawing) {
                this.startRouteDrawing(this.pendingRouteDrawing.segmentIndex, this.pendingRouteDrawing.mode);
                this.pendingRouteDrawing = null;
            }
        }, 1500); // Give map time to load
    }

    // Calculate route using routing service
    async calculateRoute(segmentIndex, mode) {
        const segment = this.segments[segmentIndex];
        if (!segment) return;

        try {
            // Use the routing service to calculate the route
            // Map 'car' to 'driving' for routing service
            const routingMode = mode === 'car' ? 'driving' : mode;
            const route = await this.routingService.calculateRoute(
                segment.startPoint,
                segment.endPoint,
                routingMode
            );
            
            // Ensure userTime is set in seconds for consistency
            if (route && !route.userTime) {
                const distance = this.calculateDistance(segment.startPoint, segment.endPoint);
                route.userTime = this.getDefaultTransportTime(mode, distance);
            }
            
            segment.route = route;
            console.log(`Route calculated for ${mode}:`, route);
            this.renderSegmentsList();
            
            // Auto-preview with new route
            this.autoPreviewJourney();
            
        } catch (error) {
            console.error('Error calculating route:', error);
            // Fallback to realistic route
            const fallbackRoute = this.routingService.createRealisticRoute(
                segment.startPoint,
                segment.endPoint,
                mode
            );
            
            // Ensure userTime is set in seconds for fallback routes too
            if (fallbackRoute && !fallbackRoute.userTime) {
                const distance = this.calculateDistance(segment.startPoint, segment.endPoint);
                fallbackRoute.userTime = this.getDefaultTransportTime(mode, distance);
            }
            
            segment.route = fallbackRoute;
            this.renderSegmentsList();
            
            // Auto-preview with fallback route
            this.autoPreviewJourney();
        }
    }

    // Start route drawing mode for manual routes (boats and planes)
    startRouteDrawing(segmentIndex, mode) {
        this.isDrawingRoute = true;
        this.currentDrawnRoute = [];
        this.currentSegmentIndex = segmentIndex;
        this.currentDrawingMode = mode;
        
        // Enable drawing mode in the map
        document.body.classList.add('route-drawing-active');
        
        // Show instructions
        const modeText = mode === 'boat' ? t('journeyBuilder.transportBoat') : t('journeyBuilder.transportPlane');
        this.showMessage(t('messages.clickMapToDraw', { mode: modeText }), 'info');
        
        // Add visual feedback UI
        this.showRouteDrawingUI();
        
        // Listen for map clicks and escape key
        this.setupRouteDrawingListeners();
    }

    // Show route drawing UI
    showRouteDrawingUI() {
        const segment = this.segments[this.currentSegmentIndex];
        const startCoord = segment.startPoint;
        const endCoord = segment.endPoint;
        const distance = this.calculateDistance(startCoord, endCoord).toFixed(1);
        
        // Create overlay UI for route drawing
        const overlay = document.createElement('div');
        overlay.id = 'routeDrawingOverlay';
        overlay.className = 'route-drawing-overlay';
        overlay.innerHTML = `
            <div class="route-drawing-controls">
                <div class="route-drawing-info">
                    <span class="route-drawing-mode">${this.currentDrawingMode === 'boat' ? '⛵ Drawing Boat Route' : '✈️ Drawing Flight Path'}</span>
                    <div class="route-drawing-details">
                        <span class="route-distance">Distance: ~${distance}km</span>
                        <div class="route-timing">
                            <label>Animation Time:</label>
                            <input type="number" id="routeTravelTime" min="5" max="600" value="${this.getDefaultTimeInSeconds(distance)}" step="5">
                            <span>seconds</span>
                        </div>
                    </div>
                    <span class="route-drawing-points">Points: <span id="routePointCount">0</span></span>
                </div>
                <div class="route-drawing-instructions">
                    <p>🎯 Start at <strong>GREEN</strong> marker, end at <strong>RED</strong> marker</p>
                    <p>Click on the map to add waypoints for your route</p>
                </div>
                <div class="route-drawing-buttons">
                    <button id="finishRouteBtn" class="btn-primary" disabled>Finish Route</button>
                    <button id="cancelRouteBtn" class="btn-secondary">Cancel</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        // Add event listeners
        document.getElementById('finishRouteBtn').addEventListener('click', () => this.finishRouteDrawing());
        document.getElementById('cancelRouteBtn').addEventListener('click', () => this.cancelRouteDrawing());
    }

    // Get default time in seconds based on distance and mode
    getDefaultTimeInSeconds(distanceKm) {
        const baseTimes = {
            car: 30,
            boat: 40,
            plane: 20,
            train: 35,
            walk: 20,
            cycling: 25
        };
        
        const baseTime = baseTimes[this.currentDrawingMode] || 30;
        const scaledTime = baseTime + (distanceKm * 2); // Add 2 seconds per km
        return Math.max(10, Math.min(120, Math.round(scaledTime))); // 10-120 seconds
    }

    // Get default time based on distance and mode (kept for backward compatibility)
    getDefaultTime(distanceKm) {
        return this.getDefaultTimeInSeconds(distanceKm);
    }

    // Setup listeners for route drawing
    setupRouteDrawingListeners() {
        // We need to access the map instance from the main app
        // Dispatch event to request map access
        const requestMapEvent = new CustomEvent('requestMapForDrawing', {
            detail: { 
                callback: (map) => this.setupMapDrawingListeners(map)
            }
        });
        document.dispatchEvent(requestMapEvent);

        const handleEscape = (e) => {
            if (e.key === 'Escape' && this.isDrawingRoute) {
                this.finishRouteDrawing();
            }
        };

        document.addEventListener('keydown', handleEscape);
        this._escapeListener = handleEscape;
    }

    // Setup map-specific drawing listeners
    setupMapDrawingListeners(map) {
        this.drawingMap = map;
        
        // Show start and end points
        this.showRouteEndpoints();
        
        // Center map on the route area
        this.centerMapOnRoute();
        
        const handleMapClick = (e) => {
            if (!this.isDrawingRoute) return;
            
            // Add point to route
            const point = [e.lngLat.lng, e.lngLat.lat];
            this.currentDrawnRoute.push(point);
            
            console.log('Route point added:', point);
            
            // Update UI
            this.updateRouteDrawingUI();
            
            // Add visual point on map
            this.addRoutePoint(point);
            
            // Update route line
            this.updateRouteVisualization();
        };

        map.on('click', handleMapClick);
        this._mapClickListener = handleMapClick;
    }

    // Show start and end points on the map
    showRouteEndpoints() {
        if (!this.drawingMap) return;
        
        const segment = this.segments[this.currentSegmentIndex];
        const startPoint = segment.startPoint;
        const endPoint = segment.endPoint;
        
        // Add source for endpoints if it doesn't exist
        if (!this.drawingMap.getSource('route-endpoints')) {
            this.drawingMap.addSource('route-endpoints', {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: []
                }
            });
            
            this.drawingMap.addLayer({
                id: 'route-endpoints',
                type: 'circle',
                source: 'route-endpoints',
                paint: {
                    'circle-radius': 12,
                    'circle-color': [
                        'case',
                        ['==', ['get', 'type'], 'start'], '#4CAF50', // Green for start
                        '#f44336' // Red for end
                    ],
                    'circle-stroke-color': '#ffffff',
                    'circle-stroke-width': 3,
                    'circle-opacity': 0.9
                }
            });
        }
        
        // Set endpoint data
        this.drawingMap.getSource('route-endpoints').setData({
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: startPoint
                    },
                    properties: {
                        type: 'start',
                        label: 'Start'
                    }
                },
                {
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: endPoint
                    },
                    properties: {
                        type: 'end',
                        label: 'End'
                    }
                }
            ]
        });
    }

    // Center map on the route area
    centerMapOnRoute() {
        if (!this.drawingMap) return;
        
        const segment = this.segments[this.currentSegmentIndex];
        const startPoint = segment.startPoint;
        const endPoint = segment.endPoint;
        
        // Calculate bounds that include both points with padding
        const lngs = [startPoint[0], endPoint[0]];
        const lats = [startPoint[1], endPoint[1]];
        
        const bounds = [
            [Math.min(...lngs), Math.min(...lats)], // Southwest
            [Math.max(...lngs), Math.max(...lats)]  // Northeast
        ];
        
        this.drawingMap.fitBounds(bounds, {
            padding: 100,
            duration: 1000
        });
    }

    // Update route drawing UI
    updateRouteDrawingUI() {
        const pointCountElement = document.getElementById('routePointCount');
        const finishBtn = document.getElementById('finishRouteBtn');
        
        if (pointCountElement) {
            pointCountElement.textContent = this.currentDrawnRoute.length;
        }
        
        if (finishBtn) {
            finishBtn.disabled = this.currentDrawnRoute.length < 2;
        }
    }

    // Add visual point on map
    addRoutePoint(point) {
        if (!this.drawingMap) return;
        
        // Add source for route points if it doesn't exist
        if (!this.drawingMap.getSource('route-drawing-points')) {
            this.drawingMap.addSource('route-drawing-points', {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: []
                }
            });
            
            this.drawingMap.addLayer({
                id: 'route-drawing-points',
                type: 'circle',
                source: 'route-drawing-points',
                paint: {
                    'circle-radius': 6,
                    'circle-color': this.currentDrawingMode === 'boat' ? '#4ecdc4' : '#ffe66d',
                    'circle-stroke-color': '#ffffff',
                    'circle-stroke-width': 2
                }
            });
        }
        
        // Get current data
        const source = this.drawingMap.getSource('route-drawing-points');
        const data = source._data || { type: 'FeatureCollection', features: [] };
        
        // Add new point
        data.features.push({
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: point
            },
            properties: {
                index: this.currentDrawnRoute.length - 1
            }
        });
        
        source.setData(data);
    }

    // Update route line visualization
    updateRouteVisualization() {
        if (!this.drawingMap || this.currentDrawnRoute.length < 2) return;
        
        // Add source for route line if it doesn't exist
        if (!this.drawingMap.getSource('route-drawing-line')) {
            this.drawingMap.addSource('route-drawing-line', {
                type: 'geojson',
                data: {
                    type: 'Feature',
                    geometry: {
                        type: 'LineString',
                        coordinates: []
                    }
                }
            });
            
            this.drawingMap.addLayer({
                id: 'route-drawing-line',
                type: 'line',
                source: 'route-drawing-line',
                layout: {
                    'line-join': 'round',
                    'line-cap': 'round'
                },
                paint: {
                    'line-color': this.currentDrawingMode === 'boat' ? '#4ecdc4' : '#ffe66d',
                    'line-width': 4,
                    'line-opacity': 0.8,
                    'line-dasharray': this.currentDrawingMode === 'plane' ? [2, 2] : null
                }
            });
        }
        
        // Update line data
        const source = this.drawingMap.getSource('route-drawing-line');
        source.setData({
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: this.currentDrawnRoute
            }
        });
    }

    // Cancel route drawing
    cancelRouteDrawing() {
        this.isDrawingRoute = false;
        this.currentDrawnRoute = [];
        this.cleanupRouteDrawing();
        this.showMessage(t('messages.routeDrawingCancelled'), 'info');
    }

    // Finish route drawing
    finishRouteDrawing() {
        if (this.currentDrawnRoute.length < 2) {
            this.showMessage(t('messages.routeMustHaveTwoPoints'), 'error');
            return;
        }

        // Get user-specified time
        const travelTimeInput = document.getElementById('routeTravelTime');
        const travelTimeSeconds = parseInt(travelTimeInput?.value) || this.getDefaultTimeInSeconds(
            this.calculateRouteDistance(this.currentDrawnRoute)
        );

        // Save the drawn route
        const segment = this.segments[this.currentSegmentIndex];
        if (segment) {
            const distance = this.calculateRouteDistance(this.currentDrawnRoute) * 1000; // convert to meters
            const duration = travelTimeSeconds;
            
            segment.route = {
                coordinates: this.currentDrawnRoute,
                distance: distance,
                duration: duration,
                provider: 'manual',
                type: this.currentDrawingMode,
                userTime: travelTimeSeconds // Store user-specified time
            };
        }

        // Cleanup
        this.isDrawingRoute = false;
        this.currentDrawnRoute = [];
        this.cleanupRouteDrawing();
        
        this.renderSegmentsList();
        this.showMessage(t('messages.routeCompleted', { mode: t('journeyBuilder.' + (this.currentDrawingMode === 'boat' ? 'transportBoat' : 'transportPlane')), time: travelTimeSeconds }), 'success');
        
        // Auto-preview with new route
        this.autoPreviewJourney();
    }

    // Cleanup route drawing mode
    cleanupRouteDrawing() {
        // Remove route-drawing-active class from body
        document.body.classList.remove('route-drawing-active');
        
        // Remove UI overlay
        const overlay = document.getElementById('routeDrawingOverlay');
        if (overlay) {
            overlay.remove();
        }
        
        // Remove drawing classes
        document.body.classList.remove('route-drawing-active');
        
        // Remove event listeners
        if (this._escapeListener) {
            document.removeEventListener('keydown', this._escapeListener);
            this._escapeListener = null;
        }
        
        if (this._mapClickListener && this.drawingMap) {
            this.drawingMap.off('click', this._mapClickListener);
            this._mapClickListener = null;
        }
        
        // Clean up map layers
        if (this.drawingMap) {
            const layersToRemove = ['route-drawing-points', 'route-drawing-line', 'route-endpoints'];
            const sourcesToRemove = ['route-drawing-points', 'route-drawing-line', 'route-endpoints'];
            
            layersToRemove.forEach(layerId => {
                if (this.drawingMap.getLayer(layerId)) {
                    this.drawingMap.removeLayer(layerId);
                }
            });
            
            sourcesToRemove.forEach(sourceId => {
                if (this.drawingMap.getSource(sourceId)) {
                    this.drawingMap.removeSource(sourceId);
                }
            });
        }
        
        this.drawingMap = null;
    }

    // Calculate distance between two points (Haversine formula)
    calculateDistance(point1, point2) {
        const R = 6371; // Earth's radius in km
        const dLat = (point2[1] - point1[1]) * Math.PI / 180;
        const dLon = (point2[0] - point1[0]) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(point1[1] * Math.PI / 180) * Math.cos(point2[1] * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    // Calculate total distance of a route with multiple points
    calculateRouteDistance(coordinates) {
        let totalDistance = 0;
        for (let i = 0; i < coordinates.length - 1; i++) {
            totalDistance += this.calculateDistance(coordinates[i], coordinates[i + 1]);
        }
        return totalDistance;
    }

    // Preview the complete journey
    previewJourney() {
        // Combine all segments into a complete journey
        const completeJourney = this.buildCompleteJourney();
        
        if (completeJourney.coordinates.length === 0) {
            this.showMessage(t('messages.noJourneyToPreview'), 'warning');
            return;
        }

        // Emit event for the main app to handle visualization
        const journeyPreviewEvent = new CustomEvent('journeyPreview', {
            detail: { journey: completeJourney }
        });
        document.dispatchEvent(journeyPreviewEvent);
    }

    // Build complete journey from all segments
    buildCompleteJourney() {
        const journey = {
            coordinates: [],
            segments: [], // This is what MainApp will receive
            stats: {
                totalDistance: 0,
                totalDuration: 0, // This will be recalculated by MainApp based on userTimes
                elevationGain: 0
            }
        };

        // Iterate over JourneyBuilder's internal segments (this.segments)
        // which contain the most up-to-date userTime values.
        this.segments.forEach(jbSegment => {
            if (jbSegment.type === 'track') {
                journey.coordinates.push(...jbSegment.data.data.coordinates);
                
                // Create the segment for the journey object
                const journeySegment = {
                    type: 'track',
                    startIndex: journey.coordinates.length - jbSegment.data.data.coordinates.length,
                    endIndex: journey.coordinates.length - 1,
                    data: jbSegment.data, // Original track data
                    userTime: jbSegment.userTime // CRITICAL: Copy userTime
                };
                journey.segments.push(journeySegment);
                
                journey.stats.totalDistance += jbSegment.data.stats.totalDistance;
                journey.stats.elevationGain += jbSegment.data.stats.elevationGain;
                
            } else if (jbSegment.type === 'transportation') {
                let routeCoordinates = [];
                let route = jbSegment.route;
                
                if (jbSegment.route && jbSegment.route.coordinates) {
                    routeCoordinates = jbSegment.route.coordinates;
                } else if (jbSegment.mode && jbSegment.startPoint && jbSegment.endPoint) {
                    routeCoordinates = [jbSegment.startPoint, jbSegment.endPoint];
                    const distance = this.calculateDistance(jbSegment.startPoint, jbSegment.endPoint) * 1000;
                    // Use jbSegment.userTime if set by user, otherwise default.
                    const transportTime = (jbSegment.userTime !== undefined && jbSegment.userTime !== null) 
                                          ? jbSegment.userTime 
                                          : this.getDefaultTransportTime(jbSegment.mode, distance / 1000);
                    
                    route = {
                        coordinates: routeCoordinates,
                        distance: distance,
                        duration: transportTime, // This duration should reflect userTime or default
                        userTime: transportTime, // Explicitly set userTime here too for consistency
                        provider: 'fallback',
                        type: jbSegment.mode
                    };
                    jbSegment.route = route; // Update the internal segment's route
                }
                
                if (routeCoordinates.length > 0) {
                    journey.coordinates.push(...routeCoordinates);
                    
                    // Create the segment for the journey object
                    const journeySegment = {
                        type: 'transportation',
                        mode: jbSegment.mode,
                        startIndex: journey.coordinates.length - routeCoordinates.length,
                        endIndex: journey.coordinates.length - 1,
                        route: route, // route object now includes correct userTime or default
                        userTime: jbSegment.userTime // CRITICAL: Copy userTime if set for transport overall
                    };
                    journey.segments.push(journeySegment);
                    
                    if (route) {
                        journey.stats.totalDistance += route.distance / 1000;
                        // Note: totalDuration for journey.stats will be calculated by MainApp using these segments
                    }
                } else {
                    console.warn('Transportation segment has no coordinates:', jbSegment);
                }
            }
        });

        // MainApp's calculateSegmentTiming will now determine the true totalDuration
        // based on the userTime values it receives in journey.segments.
        console.log('JourneyBuilder: Built complete journey with segments containing userTime:', journey.segments.map(s => ({type: s.type, userTime: s.userTime})));
        return journey;
    }

    // Show/hide journey planning section
    showJourneyPlanningSection() {
        const section = document.getElementById('journeyPlanningSection');
        if (section) {
            section.style.display = 'block';
        }
    }

    hideJourneyPlanningSection() {
        const section = document.getElementById('journeyPlanningSection');
        if (section) {
            section.style.display = 'none';
        }
    }

    // Utility methods
    formatDistance(distanceKm) {
        if (distanceKm < 1) {
            return `${(distanceKm * 1000).toFixed(0)}m`;
        }
        return `${distanceKm.toFixed(1)}km`;
    }

    formatElevation(elevationM) {
        return `${elevationM.toFixed(0)}m`;
    }

    formatDuration(durationSeconds) {
        const hours = Math.floor(durationSeconds / 3600);
        const minutes = Math.floor((durationSeconds % 3600) / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else if (minutes > 0) {
            return `${minutes}m`;
        } else {
            return `${Math.ceil(durationSeconds)}s`;
        }
    }

    showMessage(message, type = 'info') {
        // Use the same message system as the main app
        const event = new CustomEvent('showMessage', {
            detail: { message, type }
        });
        document.dispatchEvent(event);
    }

    // Edit transportation segment
    editTransportation(segmentIndex) {
        const segment = this.segments[segmentIndex];
        if (!segment || segment.type !== 'transportation') return;
        const currentMode = segment.mode;
        segment.mode = null;
        segment.route = null;
        this.showTransportationOptions(segmentIndex);
        const transportOptions = document.getElementById('transportationOptions');
        transportOptions.setAttribute('data-editing', 'true');
        transportOptions.setAttribute('data-previous-mode', currentMode || '');
        this.showMessage(t('messages.selectNewTransportMode'), 'info');
    }

    // Remove transportation segment (reset to no transportation)
    removeTransportation(segmentIndex) {
        const segment = this.segments[segmentIndex];
        if (!segment || segment.type !== 'transportation') return;
        segment.mode = null;
        segment.route = null;
        this.renderSegmentsList();
        this.showMessage(t('messages.transportationRemoved'), 'info');
    }

    // Add more tracks button functionality
    addMoreTracks() {
        // Create a hidden file input for additional tracks
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.multiple = true;
        fileInput.accept = '.gpx';
        fileInput.style.display = 'none';
        
        fileInput.addEventListener('change', async (e) => {
            const files = e.target.files;
            if (!files || files.length === 0) return;

            try {
                // Import GPXParser dynamically to parse new files
                const { GPXParser } = await import('./gpxParser.js');
                const gpxParser = new GPXParser();

                for (let file of files) {
                    if (!file.name.toLowerCase().endsWith('.gpx')) {
                        this.showMessage(`${file.name} is not a GPX file`, 'error');
                        continue;
                    }

                    try {
                        const trackData = await gpxParser.parseFile(file);
                        this.addTrack(trackData, file.name);
                        console.log(`Added additional track: ${file.name}`);
                    } catch (error) {
                        console.error(`Error parsing ${file.name}:`, error);
                        this.showMessage(`Error parsing ${file.name}`, 'error');
                    }
                }

                this.showMessage(`${files.length} additional track(s) added!`, 'success');
            } catch (error) {
                console.error('Error adding tracks:', error);
                this.showMessage('Error adding tracks', 'error');
            } finally {
                // Clean up the temporary input
                document.body.removeChild(fileInput);
            }
        });

        // Add to DOM and trigger click
        document.body.appendChild(fileInput);
        fileInput.click();
    }

    // Calculate track time based on activity and distance
    calculateTrackTime(trackData) {
        const distance = trackData.stats.totalDistance; // in km
        const activityType = trackData.data.activityType || 'running';
        
        // Base speeds for different activities (km/h)
        const speeds = {
            running: 10,
            walking: 5,
            cycling: 20,
            hiking: 4,
            swimming: 2
        };
        
        const speed = speeds[activityType] || speeds.running;
        const timeHours = distance / speed;
        const timeMinutes = timeHours * 60;
        
        // Convert to reasonable animation time (scale down for viewing)
        const animationTime = Math.max(10, Math.min(180, timeMinutes / 2)); // 10-180 seconds
        return Math.round(animationTime);
    }

    // Get default transport time for animation - simplified to just return a fixed value
    getDefaultTransportTime(mode, distanceKm) {
        // Simple fixed times for different transport modes (animation time in seconds)
        const fixedTimes = {
            car: 30,
            walk: 20, 
            cycling: 25,
            boat: 40,
            plane: 25,
            train: 35
        };
        return fixedTimes[mode] || 30; // Default 30 seconds
    }

    // Update a segment's time and refresh everything
    updateSegmentTime(segmentIndex, newTime, segmentType) {
        console.log(`=== Updating ${segmentType} segment ${segmentIndex} time to: ${newTime}s ===`);
        
        const timeValue = parseInt(newTime);
        const segment = this.segments[segmentIndex];
        if (!segment) {
            console.error('Segment not found at index:', segmentIndex);
            return;
        }
        
        console.log(`Updating segment ${segmentIndex} (${segmentType}) time to exactly ${timeValue} seconds`);
        
        if (segmentType === 'track') {
            // Store exact user input for tracks
            segment.userTime = timeValue;
            console.log(`✅ Track segment ${segmentIndex}: userTime set to ${timeValue}s`);
            
        } else if (segmentType === 'transport') {
            if (segment.route) {
                // Store exact user input in route
                segment.route.userTime = timeValue;
                segment.route.duration = timeValue; // Keep both for compatibility
                console.log(`✅ Transport segment ${segmentIndex}: route.userTime set to ${timeValue}s`);
            } else {
                // Store exact user input directly on segment as fallback
                segment.userTime = timeValue;
                console.log(`✅ Transport segment ${segmentIndex}: segment.userTime set to ${timeValue}s`);
                
                // If we have enough info, create a basic route
                if (segment.mode && segment.startPoint && segment.endPoint) {
                    const distance = this.calculateDistance(segment.startPoint, segment.endPoint) * 1000;
                    segment.route = {
                        coordinates: [segment.startPoint, segment.endPoint],
                        distance: distance,
                        duration: timeValue, // Exact user input
                        userTime: timeValue, // Exact user input
                        provider: 'fallback',
                        type: segment.mode
                    };
                    console.log(`✅ Created fallback route with exact user time: ${timeValue}s`);
                }
            }
        }
        
        // Calculate new total as simple sum of all segment times
        const newJourneyTiming = this.calculateJourneyTiming();
        console.log(`Total journey time is now: ${newJourneyTiming.totalDuration}s (sum of all segments)`);
        
        // IMMEDIATE: Update UI elements directly with the exact calculated total
        console.log('Updating UI elements with exact total...');
        
        const totalTimeElement = document.getElementById('totalTime');
        if (totalTimeElement) {
            const exactTimeText = this.formatDuration(newJourneyTiming.totalDuration);
            totalTimeElement.textContent = exactTimeText;
            console.log('✅ Updated totalTime element to exact total:', exactTimeText);
        }
        
        // Update timing breakdown panel with exact values
        const timingPanel = document.getElementById('journeyTimingPanel');
        if (timingPanel) {
            const totalDurationSpan = timingPanel.querySelector('.total-duration');
            if (totalDurationSpan) {
                totalDurationSpan.textContent = this.formatDuration(newJourneyTiming.totalDuration);
                console.log('✅ Updated timing panel to exact total');
            }
        }
        
        // Show feedback with exact total
        this.showMessage(`Segment: ${timeValue}s | Total: ${newJourneyTiming.totalDuration}s`, 'success');
        
        // Re-render UI components
        this.renderSegmentsList();
        if (document.getElementById('timelineSegments')) {
            this.renderTimelineSegments();
        }
        
        // Notify main app with exact timing
        console.log('Notifying main app with exact timing values...');
        
        const timingUpdateEvent = new CustomEvent('segmentTimingUpdate', {
            detail: { 
                segments: this.segments,
                segmentIndex: segmentIndex,
                newTime: timeValue,
                segmentType: segmentType,
                totalDuration: newJourneyTiming.totalDuration, // Exact sum
                newSegmentTiming: newJourneyTiming
            }
        });
        
        const dispatched = document.dispatchEvent(timingUpdateEvent);
        console.log('Event dispatched:', dispatched ? '✅ Success' : '❌ Failed');
        
        // Direct backup call
        if (window.app && typeof window.app.handleSegmentTimingUpdate === 'function') {
            try {
                window.app.handleSegmentTimingUpdate({
                    segments: this.segments,
                    segmentIndex: segmentIndex,
                    newTime: timeValue,
                    segmentType: segmentType,
                    totalDuration: newJourneyTiming.totalDuration,
                    newSegmentTiming: newJourneyTiming
                });
                console.log('✅ Direct call successful');
            } catch (error) {
                console.error('❌ Direct call failed:', error);
            }
        }
        
        // Force update main app's total time
        if (window.app) {
            window.app.totalAnimationTime = newJourneyTiming.totalDuration;
            console.log('✅ Force updated main app totalAnimationTime to exact total:', newJourneyTiming.totalDuration);
        }
        
        this.autoPreviewJourney();
        console.log('=== Segment timing update completed with exact values ===');
    }

    // Calculate total journey timing
    calculateJourneyTiming() {
        let trackDuration = 0;
        let transportDuration = 0;
        
        console.log('Calculating journey timing from segments:', this.segments.length);
        
        this.segments.forEach((segment, index) => {
            let segmentDuration = 0;
            
            if (segment.type === 'track') {
                // Use exact user-defined time, or calculate default if not set
                if (segment.userTime !== undefined && segment.userTime !== null) {
                    segmentDuration = segment.userTime; // Use exact user input
                    console.log(`Track segment ${index}: using user time ${segmentDuration}s`);
                } else {
                    segmentDuration = this.calculateTrackTime(segment.data);
                    console.log(`Track segment ${index}: calculated default ${segmentDuration}s`);
                }
                trackDuration += segmentDuration;
                
            } else if (segment.type === 'transportation') {
                // Use exact user-defined time
                if (segment.route && segment.route.userTime !== undefined && segment.route.userTime !== null) {
                    segmentDuration = segment.route.userTime; // Use exact user input
                    console.log(`Transport segment ${index}: using user time ${segmentDuration}s`);
                } else if (segment.userTime !== undefined && segment.userTime !== null) {
                    segmentDuration = segment.userTime; // Fallback user time
                    console.log(`Transport segment ${index}: using fallback user time ${segmentDuration}s`);
                } else if (segment.mode && segment.startPoint && segment.endPoint) {
                    // Only calculate default if no user time is set
                    const distance = this.calculateDistance(segment.startPoint, segment.endPoint);
                    segmentDuration = this.getDefaultTransportTime(segment.mode, distance);
                    console.log(`Transport segment ${index}: calculated default ${segmentDuration}s`);
                } else {
                    segmentDuration = 30; // Default fallback
                    console.log(`Transport segment ${index}: using default fallback 30s`);
                }
                transportDuration += segmentDuration;
            }
        });
        
        const totalDuration = trackDuration + transportDuration;
        
        console.log('Journey timing calculation result:', {
            trackDuration: `${trackDuration}s`,
            transportDuration: `${transportDuration}s`,
            totalDuration: `${totalDuration}s`
        });
        
        return {
            trackDuration,
            transportDuration,
            totalDuration // This is now the exact sum of user inputs
        };
    }

    // Show auto-preview status
    showAutoPreviewStatus() {
        const statusElement = document.getElementById('autoPreviewStatus');
        if (statusElement) {
            statusElement.classList.add('visible');
            statusElement.classList.remove('completed');
            statusElement.querySelector('.status-icon').textContent = '🔄';
            statusElement.querySelector('.status-text').textContent = 'Auto-updating journey...';
        }
    }

    // Hide auto-preview status with completion feedback
    hideAutoPreviewStatus() {
        const statusElement = document.getElementById('autoPreviewStatus');
        if (statusElement) {
            statusElement.classList.add('completed');
            statusElement.querySelector('.status-icon').textContent = '✅';
            statusElement.querySelector('.status-text').textContent = 'Journey updated!';
            
            // Hide after a short delay
            setTimeout(() => {
                statusElement.classList.remove('visible', 'completed');
            }, 2000);
        }
    }

    // Automatic journey preview with debouncing
    autoPreviewJourney() {
        if (!this.autoPreviewEnabled) return;
        
        // Show status immediately
        this.showAutoPreviewStatus();
        
        // Clear existing timeout
        if (this.previewTimeout) {
            clearTimeout(this.previewTimeout);
        }
        
        // Set new timeout for debounced preview
        this.previewTimeout = setTimeout(() => {
            // Only auto-preview if we have at least one track
            if (this.tracks.length > 0) {
                console.log('Auto-previewing journey...');
                this.previewJourney();
                
                // Show completion status
                setTimeout(() => {
                    this.hideAutoPreviewStatus();
                }, 500); // Small delay to show the update completed
            } else {
                // Hide status if no tracks
                const statusElement = document.getElementById('autoPreviewStatus');
                if (statusElement) {
                    statusElement.classList.remove('visible');
                }
            }
        }, this.previewDelay);
    }

    // Toggle auto-preview on/off
    setAutoPreview(enabled) {
        this.autoPreviewEnabled = enabled;
        if (enabled && this.tracks.length > 0) {
            this.autoPreviewJourney();
        }
    }
}