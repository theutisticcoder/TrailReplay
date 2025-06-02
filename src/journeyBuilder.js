import { RoutingService } from './routingService.js';

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
        
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Clear tracks button
        document.getElementById('clearTracksBtn')?.addEventListener('click', () => {
            this.clearAllTracks();
        });

        // Preview journey button
        document.getElementById('previewJourneyBtn')?.addEventListener('click', () => {
            this.previewJourney();
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
            this.showMessage('Invalid track data received', 'error');
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
        
        // Show helpful message if this is the first track
        if (this.tracks.length === 1) {
            this.showMessage('Track added! Add more tracks or click "Preview Journey" to see it on the map.', 'info');
        }
    }

    // Remove a track
    removeTrack(trackId) {
        this.tracks = this.tracks.filter(track => track.id !== trackId);
        this.renderTracksList();
        this.updateSegments();
        
        if (this.tracks.length === 0) {
            this.hideJourneyPlanningSection();
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
                    <div class="track-name">Add More Tracks</div>
                    <div class="track-stats">Click to upload additional GPX files</div>
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
                    <button class="track-action-btn" onclick="journeyBuilder.moveTrack(${track.id}, 'up')" title="Move Up">⬆️</button>
                    <button class="track-action-btn" onclick="journeyBuilder.moveTrack(${track.id}, 'down')" title="Move Down">⬇️</button>
                    <button class="track-action-btn" onclick="journeyBuilder.removeTrack(${track.id})" title="Remove">🗑️</button>
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

            // Add transportation segment between tracks (except after last track)
            if (i < this.tracks.length - 1) {
                const startPoint = this.tracks[i].endPoint;
                const endPoint = this.tracks[i + 1].startPoint;
                
                this.segments.push({
                    id: `transport_${i}`,
                    type: 'transportation',
                    mode: null, // Will be set when user selects transportation
                    startPoint,
                    endPoint,
                    route: null
                });
            }
        }

        this.renderSegmentsList();
    }

    // Render the segments list UI
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
                <span>📊 Journey Timing</span>
                <span class="total-time">${this.formatDuration(timingSummary.totalDuration)}</span>
            </div>
            <div class="timing-summary-breakdown">
                <span>Tracks: ${this.formatDuration(timingSummary.trackDuration)}</span>
                <span>Transportation: ${this.formatDuration(timingSummary.transportDuration)}</span>
            </div>
        `;
        segmentsList.appendChild(summaryElement);

        this.segments.forEach((segment, index) => {
            const segmentElement = document.createElement('div');
            
            if (segment.type === 'track') {
                // Calculate estimated time for track based on distance and activity
                const estimatedTime = this.calculateTrackTime(segment.data);
                
                segmentElement.className = 'segment-item track';
                segmentElement.innerHTML = `
                    <div class="segment-icon">${this.getTrackIcon(segment.data.data.activityType)}</div>
                    <div class="segment-content">
                        <div class="segment-title">${segment.data.name}</div>
                        <div class="segment-description">
                            GPX Track • ${this.formatDistance(segment.data.stats.totalDistance)}
                        </div>
                        <div class="segment-timing">
                            <label>Animation Time:</label>
                            <input type="number" class="segment-time-input" 
                                   value="${segment.userTime || estimatedTime}" 
                                   min="5" max="600" step="5" 
                                   onchange="journeyBuilder.updateSegmentTime(${index}, this.value, 'track')">
                            <span>seconds</span>
                        </div>
                    </div>
                `;
            } else {
                segmentElement.className = 'segment-item transport';
                const distance = this.calculateDistance(segment.startPoint, segment.endPoint);
                
                if (segment.mode) {
                    const routeInfo = segment.route ? 
                        ` • ${this.formatDistance(segment.route.distance / 1000)} • ${this.formatDuration(segment.route.duration)}` :
                        ' • Click to add route';
                    
                    const transportTime = segment.route?.userTime || this.getDefaultTransportTime(segment.mode, distance);
                    
                    segmentElement.innerHTML = `
                        <div class="segment-icon">${this.getTransportIcon(segment.mode)}</div>
                        <div class="segment-content">
                            <div class="segment-title">Transportation: ${segment.mode}</div>
                            <div class="segment-description">
                                ${segment.route ? 'Route via ' + (segment.route.provider || 'roads') : `Distance: ~${distance.toFixed(1)}km`}${routeInfo}
                            </div>
                            <div class="segment-timing">
                                <label>Animation Time:</label>
                                <input type="number" class="segment-time-input" 
                                       value="${transportTime}" 
                                       min="5" max="600" step="5" 
                                       onchange="journeyBuilder.updateSegmentTime(${index}, this.value, 'transport')">
                                <span>seconds</span>
                            </div>
                        </div>
                        <div class="segment-actions">
                            <button class="track-action-btn" onclick="journeyBuilder.editTransportation(${index})" title="Edit">✏️</button>
                            <button class="track-action-btn" onclick="journeyBuilder.removeTransportation(${index})" title="Remove">🗑️</button>
                        </div>
                    `;
                } else {
                    segmentElement.innerHTML = `
                        <div class="segment-icon">❓</div>
                        <div class="segment-content">
                            <div class="segment-title">Add Transportation</div>
                            <div class="segment-description">
                                Choose how to travel between tracks (~${distance.toFixed(1)}km)
                            </div>
                        </div>
                        <div class="segment-actions">
                            <button class="track-action-btn" onclick="journeyBuilder.showTransportationOptions(${index})" title="Add Transport">➕</button>
                        </div>
                    `;
                }
            }

            segmentsList.appendChild(segmentElement);
        });
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

        // Scroll to transportation options
        transportOptions.scrollIntoView({ behavior: 'smooth' });
    }

    // Add transportation segment
    addTransportationSegment(mode) {
        const transportOptions = document.getElementById('transportationOptions');
        const segmentIndex = parseInt(transportOptions.getAttribute('data-segment-index'));
        
        if (segmentIndex !== null && this.segments[segmentIndex]) {
            this.segments[segmentIndex].mode = mode;
            
            // Automatically calculate route for car/walking/cycling
            if (['car', 'walk', 'cycling'].includes(mode)) {
                this.calculateRoute(segmentIndex, mode);
            } else if (['boat', 'plane'].includes(mode)) {
                // Check if we have map access for route drawing
                this.checkMapAccessAndDraw(segmentIndex, mode);
            }
        }

        transportOptions.style.display = 'none';
        // Clear editing attributes
        transportOptions.removeAttribute('data-editing');
        transportOptions.removeAttribute('data-previous-mode');
        
        this.renderSegmentsList();
    }

    // Check if map is available for route drawing, auto-preview if needed
    checkMapAccessAndDraw(segmentIndex, mode) {
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
        this.showMessage('Opening map preview to enable route drawing...', 'info');
        
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
        const modeText = mode === 'boat' ? 'boat route' : 'flight path';
        this.showMessage(`Click on the map to draw your ${modeText}. Press Escape or click "Finish Route" when done.`, 'info');
        
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
        this.showMessage('Route drawing cancelled', 'info');
    }

    // Finish route drawing
    finishRouteDrawing() {
        if (this.currentDrawnRoute.length < 2) {
            this.showMessage('Route must have at least 2 points', 'error');
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
        this.showMessage(`${this.currentDrawingMode === 'boat' ? 'Boat route' : 'Flight path'} completed in ${travelTimeSeconds} seconds!`, 'success');
    }

    // Cleanup route drawing mode
    cleanupRouteDrawing() {
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
            this.showMessage('No journey to preview. Add tracks and transportation.', 'warning');
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
            segments: [],
            stats: {
                totalDistance: 0,
                totalDuration: 0,
                elevationGain: 0
            }
        };

        this.segments.forEach(segment => {
            if (segment.type === 'track') {
                // Add track coordinates
                journey.coordinates.push(...segment.data.data.coordinates);
                journey.segments.push({
                    type: 'track',
                    startIndex: journey.coordinates.length - segment.data.data.coordinates.length,
                    endIndex: journey.coordinates.length - 1,
                    data: segment.data
                });
                
                // Add to stats
                journey.stats.totalDistance += segment.data.stats.totalDistance;
                journey.stats.elevationGain += segment.data.stats.elevationGain;
                
            } else if (segment.type === 'transportation' && segment.route) {
                // Add transportation route coordinates
                journey.coordinates.push(...segment.route.coordinates);
                journey.segments.push({
                    type: 'transportation',
                    mode: segment.mode,
                    startIndex: journey.coordinates.length - segment.route.coordinates.length,
                    endIndex: journey.coordinates.length - 1,
                    route: segment.route
                });
                
                // Add to stats
                journey.stats.totalDistance += segment.route.distance / 1000; // convert to km
                journey.stats.totalDuration += segment.route.duration;
            }
        });

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

        // Clear the current route and mode to allow re-selection
        const currentMode = segment.mode;
        segment.mode = null;
        segment.route = null;
        
        // Show transportation options for editing
        this.showTransportationOptions(segmentIndex);
        
        // Store the previous mode for reference
        const transportOptions = document.getElementById('transportationOptions');
        transportOptions.setAttribute('data-editing', 'true');
        transportOptions.setAttribute('data-previous-mode', currentMode || '');
        
        this.showMessage('Select a new transportation mode', 'info');
    }

    // Remove transportation segment (reset to no transportation)
    removeTransportation(segmentIndex) {
        const segment = this.segments[segmentIndex];
        if (!segment || segment.type !== 'transportation') return;

        // Reset transportation mode and route
        segment.mode = null;
        segment.route = null;
        
        this.renderSegmentsList();
        this.showMessage('Transportation removed', 'info');
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

    // Get default transport time for animation
    getDefaultTransportTime(mode, distanceKm) {
        // These are animation times, not real travel times
        const baseTimes = {
            car: 30,
            walk: 20,
            cycling: 25,
            boat: 40,
            plane: 20,
            train: 35
        };
        
        // Scale based on distance
        const baseTime = baseTimes[mode] || 30;
        const scaledTime = baseTime + (distanceKm * 2); // Add 2 seconds per km
        return Math.max(10, Math.min(120, Math.round(scaledTime))); // 10-120 seconds
    }

    // Update segment time
    updateSegmentTime(segmentIndex, newTime, segmentType) {
        const segment = this.segments[segmentIndex];
        if (!segment) return;
        
        const timeValue = parseInt(newTime);
        if (isNaN(timeValue) || timeValue < 5) return;
        
        if (segmentType === 'track') {
            segment.userTime = timeValue;
        } else if (segmentType === 'transport' && segment.route) {
            segment.route.userTime = timeValue;
            // Also update the duration for consistency
            segment.route.duration = timeValue; // Store as seconds for animation
        }
        
        console.log(`Updated ${segmentType} segment ${segmentIndex} time to ${timeValue} seconds`);
        
        // Re-render to update timing summary
        this.renderSegmentsList();
        
        // Notify the main app that timing has changed so it can update the animation system
        const timingUpdateEvent = new CustomEvent('segmentTimingUpdate', {
            detail: { 
                segments: this.segments,
                segmentIndex: segmentIndex,
                newTime: timeValue,
                segmentType: segmentType
            }
        });
        document.dispatchEvent(timingUpdateEvent);
    }

    // Calculate total journey timing
    calculateJourneyTiming() {
        let trackDuration = 0;
        let transportDuration = 0;
        
        this.segments.forEach(segment => {
            if (segment.type === 'track') {
                const estimatedTime = this.calculateTrackTime(segment.data);
                trackDuration += segment.userTime || estimatedTime;
            } else if (segment.type === 'transportation' && segment.route) {
                const defaultTime = this.getDefaultTransportTime(segment.mode, 
                    this.calculateDistance(segment.startPoint, segment.endPoint));
                transportDuration += segment.route.userTime || defaultTime;
            }
        });
        
        return {
            trackDuration,
            transportDuration,
            totalDuration: trackDuration + transportDuration
        };
    }
} 