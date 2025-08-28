import { JourneyBuilder } from '../journey/JourneyBuilder.js';

export class JourneyController {
    constructor(app) {
        this.app = app;
        this.journeyBuilder = null;
    }

    initialize() {
        // Initialize the journey builder
        this.journeyBuilder = new JourneyBuilder();
        
        // Set up integration with the main app
        this.setupJourneyIntegration();
        
        // Make journey builder globally available for onclick handlers (legacy compatibility)
        window.journeyBuilder = this.journeyBuilder;
        
        console.log('JourneyController initialized');
    }

    // Add a track to the journey
    addTrack(trackData, filename) {
        if (!this.journeyBuilder) {
            console.error('Journey builder not initialized');
            return;
        }
        
        console.log('Adding track to journey:', filename);
        this.journeyBuilder.addTrack(trackData, filename);
    }

    // Get current tracks
    getTracks() {
        return this.journeyBuilder?.tracks || [];
    }

    // Get current segments
    getSegments() {
        return this.journeyBuilder?.segments || [];
    }

    // Check if there are tracks loaded
    hasTracks() {
        return this.getTracks().length > 0;
    }

    // Clear all tracks
    clearAllTracks() {
        if (this.journeyBuilder) {
            this.journeyBuilder.clearAllTracks();
        }
    }

    // Setup integration between journey builder and main app
    setupJourneyIntegration() {
        if (!this.journeyBuilder) return;

        // Listen for journey preview events
        document.addEventListener('journeyPreview', (e) => {
            console.log('Journey preview event received:', e.detail);
            
            // Clear elevation profile cache for journey updates
            this.app.clearElevationProfileCache?.();
            
            // Load the journey data into the main app
            this.loadJourneyData(e.detail.journey);
        });

        // Listen for message events from journey builder
        document.addEventListener('showMessage', (e) => {
            this.app.showMessage?.(e.detail.message, e.detail.type);
        });

        // Listen for segment timing updates
        document.addEventListener('segmentTimingUpdate', (e) => {
            console.log('🎯 JOURNEY CONTROLLER: Received segmentTimingUpdate event:', e.detail);
            
            // Immediate UI update first
            if (e.detail.totalDuration) {
                console.log('🎯 JOURNEY CONTROLLER: Immediately updating UI with total duration:', e.detail.totalDuration);
                this.app.state.totalAnimationTime = e.detail.totalDuration;
                
                // Update UI elements
                const totalTimeElement = document.getElementById('totalTime');
                if (totalTimeElement) {
                    totalTimeElement.textContent = this.app.formatTimeInSeconds(e.detail.totalDuration);
                }
                
                console.log('🎯 JOURNEY CONTROLLER: UI updated successfully');
            }
            
            // Then handle the full timing update
            this.handleSegmentTimingUpdate(e.detail);
        });

        // Listen for timeline seeking
        document.addEventListener('timelineSeek', (e) => {
            console.log('🎯 Received timeline seek event:', e.detail.progress);
            this.handleTimelineSeek(e.detail.progress);
        });

        // Listen for segment order changes
        document.addEventListener('segmentOrderChanged', (e) => {
            if (this.app.currentTrackData?.isJourney) {
                // Rebuild journey with new segment order
                this.rebuildJourneyFromSegments(e.detail.segments);
            }
        });

        // Listen for map access requests from journey builder for route drawing
        document.addEventListener('requestMapForDrawing', (e) => {
                          if (this.app.mapRenderer?.map) {
                  // Provide map access to the journey builder
                  e.detail.callback(this.app.mapRenderer.map);
              } else {
                  this.app.showMessage?.('Map not ready for route drawing', 'error');
              }
        });
    }

    // Load journey data into the main app
    async loadJourneyData(journeyData) {
        console.log('Loading journey data:', journeyData);
        
        try {
            // Store the original journey data
            this.app.journeyData = journeyData;
            
            // Calculate segment timing first using the app's sophisticated method
            const segmentTiming = this.app.calculateSegmentTiming(journeyData.segments);
            
            // Convert journey data format to track data format that MapRenderer expects
            // but preserve segment information for icon changes and visual transitions
            let trackPoints = [];
            
            // Try to preserve original trackPoints with speed/time data if available
            if (journeyData.segments && journeyData.segments.length === 1 && 
                journeyData.segments[0].type === 'track' &&
                journeyData.segments[0].data && 
                journeyData.segments[0].data.data &&
                journeyData.segments[0].data.data.trackPoints) {
                
                // Single track journey - use original trackPoints with full data
                trackPoints = journeyData.segments[0].data.data.trackPoints;
                const speedyPoints = trackPoints.filter(p => p.speed > 0).length;
                console.log(`🚀 Using original trackPoints: ${trackPoints.length} points, ${speedyPoints} with speed > 0`);
                console.log('🔍 First 5 speeds:', trackPoints.slice(0, 5).map(p => p.speed?.toFixed(2) || '0.00'));
                
            } else {
                // Multi-segment journey or missing trackPoints - fallback to coordinates
                console.log('🔄 Converting coordinates to trackPoints (speed data will be lost)');
                trackPoints = journeyData.coordinates.map((coord, index) => ({
                    lat: coord[1],
                    lon: coord[0],
                    elevation: coord[2] || 0,
                    index: index,
                    distance: 0, // Will be calculated if needed
                    speed: 0,
                    time: null
                }));
            }

            const trackData = {
                trackPoints: trackPoints,
                stats: journeyData.stats,
                bounds: this.calculateBounds(journeyData.coordinates),
                // Preserve journey segment information
                segments: journeyData.segments,
                isJourney: true,
                // Add segment timing information
                segmentTiming: segmentTiming
            };
            
            // CRITICAL: Synchronize all timing sources from the start
            console.log('🎯 INITIAL JOURNEY LOAD: Synchronizing all timing sources with:', segmentTiming.totalDuration);
            this.app.state.totalAnimationTime = segmentTiming.totalDuration;
            this.app.currentTrackData = trackData;
            
            // Load journey data into map
            if (this.app.mapController) {
                this.app.mapController.loadTrackData(trackData);
                
                // Set up segment-aware animation in MapRenderer - THIS IS CRITICAL
                this.app.mapController.setupSegmentAnimation(journeyData.segments, segmentTiming);
                console.log('✅ MapRenderer setupSegmentAnimation completed with detailed timing');
            } else {
                console.error('MapController not available for segment animation setup');
            }
            
            // Add automatic icon changes based on segments
            if (this.app.icon) {
                this.app.icon.addSegmentIconChanges(trackData);
            }
            
            // Update UI with synchronized timing
            this.app.showVisualizationSection();
            this.app.updateStats(trackData.stats);
            
            // Generate elevation profile for the journey
            this.app.generateElevationProfile();
            
            // Use the new synchronization method to ensure all displays match
            this.app.synchronizeAllTimingDisplays(segmentTiming);
            
            // Render timeline under the map (visual feedback)
            this.renderJourneyTimeline();
            
            // Keep journey builder section visible for configuration
            this.showJourneyPlanningSection();
            
            // Mark as journey and update stats with GPX only setting if applicable
            this.app.currentTrackData.isJourney = true;
            this.app.updateStatsDisplay();
            
            // Emit event for other components
            const journeyLoadedEvent = new CustomEvent('journeyDataLoaded', {
                detail: { segments: journeyData.segments, trackData }
            });
            document.dispatchEvent(journeyLoadedEvent);
            
            console.log('✅ Journey data loaded successfully with full timing synchronization');
            
        } catch (error) {
            console.error('Error loading journey data:', error);
            this.app.showMessage?.('Error loading journey data', 'error');
        }
    }

    // Handle segment timing updates
    handleSegmentTimingUpdate(updateData) {
        console.log('🎯 JOURNEY CONTROLLER: Handling segment timing update:', updateData);
        
        // Update current track data with new timing
        if (this.app.currentTrackData) {
            this.app.currentTrackData.segmentTiming = updateData;
        }
        
        // Update animation time
        if (updateData.totalDuration) {
            this.app.state.totalAnimationTime = updateData.totalDuration;
        }
        
        // Synchronize timing displays
        this.synchronizeAllTimingDisplays(updateData);
    }

    // Calculate track time using journey builder's logic
    calculateTrackTime(trackData) {
        if (!this.journeyBuilder) {
            console.warn('Journey builder not available, using fallback track time calculation');
            const distance = trackData.stats?.totalDistance || 1;
            const activityType = trackData.data?.activityType || 'running';
            const speeds = { running: 10, walking: 5, cycling: 20, hiking: 4, swimming: 2 };
            const speed = speeds[activityType] || speeds.running;
            const timeHours = distance / speed;
            const timeMinutes = timeHours * 60;
            return Math.max(10, Math.min(180, Math.round(timeMinutes / 2)));
        }
        
        return this.journeyBuilder.calculateTrackTime(trackData);
    }

    // Get default transport time using journey builder's logic
    getDefaultTransportTime(mode, distanceKm) {
        if (!this.journeyBuilder) {
            console.warn('Journey builder not available, using fallback transport time calculation');
            const baseTimes = { car: 30, walk: 20, cycling: 25, boat: 40, plane: 20, train: 35 };
            const baseTime = baseTimes[mode] || 30;
            return Math.max(10, Math.min(120, Math.round(baseTime + (distanceKm * 2))));
        }
        
        return this.journeyBuilder.getDefaultTransportTime(mode, distanceKm);
    }

    // Calculate distance between two points
    calculateDistance(point1, point2) {
        if (!this.journeyBuilder) {
            console.warn('Journey builder not available, using fallback distance calculation');
            const R = 6371; // Earth's radius in km
            const dLat = (point2[1] - point1[1]) * Math.PI / 180;
            const dLon = (point2[0] - point1[0]) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                      Math.cos(point1[1] * Math.PI / 180) * Math.cos(point2[1] * Math.PI / 180) *
                      Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            return R * c;
        }
        
        return this.journeyBuilder.calculateDistance(point1, point2);
    }

    // Show timing breakdown panel
    showTimingBreakdown(segmentTiming) {
        // Find or create timing breakdown panel
        let timingPanel = document.getElementById('journeyTimingPanel');
        if (!timingPanel) {
            timingPanel = document.createElement('div');
            timingPanel.id = 'journeyTimingPanel';
            timingPanel.className = 'journey-timing-panel';
            // Insert after the controls panel
            const controlsPanel = document.querySelector('.controls-panel');
            if (controlsPanel && controlsPanel.parentNode) {
                controlsPanel.parentNode.insertBefore(timingPanel, controlsPanel.nextSibling);
            }
        }
        
        const t = window.t || ((key) => key); // Translation function fallback
        
        timingPanel.innerHTML = `
            <div class="timing-panel-header">
                <h4>🎬 ${t('messages.journeyAnimationTiming')}</h4>
                <span class="total-duration">${this.formatTime(segmentTiming.totalDuration)}</span>
            </div>
            <div class="timing-breakdown">
                <div class="timing-item">
                    <span class="timing-label">${t('messages.timingTracks')}</span>
                    <span class="timing-value">${this.formatTime(segmentTiming.trackDuration)}</span>
                </div>
                <div class="timing-item">
                    <span class="timing-label">${t('messages.timingTransportation')}</span>
                    <span class="timing-value">${this.formatTime(segmentTiming.transportDuration)}</span>
                </div>
            </div>
            <div class="timing-note">
                <small>${t('messages.timingNote')}</small>
            </div>
        `;
        timingPanel.style.display = 'block';
        
        console.log('Timing breakdown panel updated');
    }

    // Update timing display
    updateTimingDisplay(segmentTiming) {
        console.log('🎯 JOURNEY CONTROLLER: Updating timing display with:', segmentTiming);
        
        // Update total time in stats
        const totalTimeElement = document.getElementById('totalTime');
        if (totalTimeElement) {
            totalTimeElement.textContent = this.formatTime(segmentTiming.totalDuration);
        }
        
        // Show timing breakdown
        this.showTimingBreakdown(segmentTiming);
        
        console.log('✅ Timing display updated');
    }

    // Calculate bounds for journey coordinates
    calculateBounds(coordinates) {
        if (!coordinates || coordinates.length === 0) {
            return null;
        }
        
        let minLat = coordinates[0][1];
        let maxLat = coordinates[0][1];
        let minLon = coordinates[0][0];
        let maxLon = coordinates[0][0];
        
        coordinates.forEach(coord => {
            const lat = coord[1];
            const lon = coord[0];
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
            if (lon < minLon) minLon = lon;
            if (lon > maxLon) maxLon = lon;
        });
        
        return {
            south: minLat,
            west: minLon,
            north: maxLat,
            east: maxLon
        };
    }

    // Render the journey timeline under the map
    renderJourneyTimeline() {
        // Find or create timeline container
        let timelineContainer = document.getElementById('journeyTimelineContainer');
        if (!timelineContainer) {
            timelineContainer = document.createElement('div');
            timelineContainer.id = 'journeyTimelineContainer';
            timelineContainer.className = 'journey-timeline-container';
            
            // Insert after the progress controls container (not the map container)
            const progressControlsContainer = document.querySelector('.progress-controls-container');
            if (progressControlsContainer) {
                progressControlsContainer.parentNode.insertBefore(timelineContainer, progressControlsContainer.nextSibling);
            } else {
                // Fallback: insert after the map container if progress controls not found
                const mapContainer = document.querySelector('.map-container');
                if (mapContainer && mapContainer.parentNode) {
                    mapContainer.parentNode.insertBefore(timelineContainer, mapContainer.nextSibling);
                }
            }
        }
        
        // Render the timeline using journey builder
        if (this.journeyBuilder && this.journeyBuilder.renderTimelineEditor) {
            this.journeyBuilder.renderTimelineEditor(timelineContainer);
        }
        
        // Start progress indicator updates
        this.setupTimelineProgressUpdates();
    }

    // Show journey planning section
    showJourneyPlanningSection() {
        const section = document.getElementById('journeyPlanningSection');
        if (section) {
            section.style.display = 'block';
        }
    }

    // Setup timeline progress updates with optimized throttling
    setupTimelineProgressUpdates() {
        // Clear any existing interval
        if (this.timelineProgressInterval) {
            clearInterval(this.timelineProgressInterval);
        }
        
        // Set up periodic updates during animation with reduced frequency for better performance
        this.timelineProgressInterval = setInterval(() => {
            if (this.app.state.isPlaying && this.app.mapRenderer && this.app.currentTrackData?.isJourney) {
                const progress = this.app.mapRenderer.getAnimationProgress();
                this.updateTimelineProgressIndicator(progress);
            }
        }, 200); // Reduced from 100ms to 200ms for better performance
    }

    // Handle timeline seeking
    handleTimelineSeek(progress) {
        if (!this.app.mapRenderer || !this.app.currentTrackData) {
            return;
        }
        
        // Pause animation if playing during seek
        const wasPlaying = this.app.state.isPlaying;
        if (wasPlaying) {
            this.app.playback.pause();
        }
        
        // Seek to the position using enhanced synchronization
        this.app.mapRenderer.setAnimationProgress(progress);
        
        // For journeys, also synchronize the segment timing
        if (this.app.currentTrackData.isJourney && this.app.currentTrackData.segmentTiming) {
            const segmentTime = this.app.convertLinearProgressToSegmentTime(progress);
            if (this.app.mapRenderer.setJourneyElapsedTime && segmentTime !== null) {
                this.app.mapRenderer.setJourneyElapsedTime(segmentTime);
                console.log(`Timeline seeking: linear progress ${progress.toFixed(3)} → segment time ${segmentTime.toFixed(1)}s`);
            }
        }
        
        this.app.mapRenderer.updateCurrentPosition();
        this.app.updateProgressDisplay();
        this.updateTimelineProgressIndicator(progress);
        
        // Center view on new position
        if (this.app.currentTrackData.trackPoints) {
            const currentPoint = this.app.mapRenderer.gpxParser.getInterpolatedPoint(progress);
            if (currentPoint && this.app.mapRenderer.map) {
                this.app.mapRenderer.map.easeTo({
                    center: [currentPoint.lon, currentPoint.lat],
                    duration: 300
                });
            }
        }
        
        console.log('Timeline seek completed to:', progress.toFixed(3));
        
        // Don't automatically resume playback after timeline seek
    }

    // Rebuild journey from segments
    rebuildJourneyFromSegments(segments) {
        console.log('Rebuilding journey from segments:', segments);
        
        if (!this.journeyBuilder) return;
        
        // Update the journey builder's segments
        this.journeyBuilder.segments = segments;
        
        // Trigger a new journey preview with the updated segments
        this.journeyBuilder.autoPreviewJourney();
    }

    // Synchronize all timing displays
    synchronizeAllTimingDisplays(segmentTiming) {
        console.log('🎯 JOURNEY CONTROLLER: Synchronizing timing displays:', segmentTiming);
        
        // Update total time display
        if (segmentTiming.totalDuration) {
            const totalTimeElement = document.getElementById('totalTime');
            if (totalTimeElement) {
                totalTimeElement.textContent = this.app.formatTimeInSeconds(segmentTiming.totalDuration);
            }
        }
        
        // Update individual segment displays if they exist
        if (segmentTiming.segments) {
            segmentTiming.segments.forEach((segment, index) => {
                const segmentElement = document.querySelector(`[data-segment-index="${index}"]`);
                if (segmentElement) {
                    const timeDisplay = segmentElement.querySelector('.segment-time');
                    if (timeDisplay) {
                        timeDisplay.textContent = this.formatTime(segment.duration);
                    }
                }
            });
        }
    }

    // Update timeline progress indicator
    updateTimelineProgressIndicator(progress) {
        const indicator = document.getElementById('timelineProgressIndicator');
        if (!indicator || !this.app.currentTrackData?.segmentTiming) return;
        
        // Use journeyElapsedTime from the MapRenderer if available
        let actualElapsedTime = progress * this.app.state.totalAnimationTime;
        
        if (this.app.mapRenderer?.journeyElapsedTime !== undefined) {
            actualElapsedTime = this.app.mapRenderer.journeyElapsedTime;
        }
        
        // Calculate position based on actual elapsed time
        const totalDuration = this.app.currentTrackData.segmentTiming.totalDuration || this.app.state.totalAnimationTime;
        const timeProgress = Math.min(actualElapsedTime / totalDuration, 1);
        
        // Update indicator position
        const timelineContainer = indicator.parentElement;
        if (timelineContainer) {
            const containerWidth = timelineContainer.offsetWidth;
            const indicatorPosition = timeProgress * containerWidth;
            indicator.style.left = `${indicatorPosition}px`;
        }
        
        console.log(`Timeline indicator updated: ${actualElapsedTime.toFixed(1)}s / ${totalDuration.toFixed(1)}s (${(timeProgress * 100).toFixed(1)}%)`);
    }

    // Utility method to format time
    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    // Clean up when controller is destroyed
    destroy() {
        // Remove event listeners
        document.removeEventListener('journeyPreview', this.handleJourneyPreview);
        document.removeEventListener('showMessage', this.handleShowMessage);
        document.removeEventListener('segmentTimingUpdate', this.handleSegmentTimingUpdate);
        document.removeEventListener('timelineSeek', this.handleTimelineSeek);
        document.removeEventListener('segmentOrderChanged', this.handleSegmentOrderChanged);
        document.removeEventListener('requestMapForDrawing', this.handleRequestMapForDrawing);
        
        // Clean up journey builder
        if (this.journeyBuilder) {
            this.journeyBuilder = null;
        }
        
        // Remove global reference
        delete window.journeyBuilder;
    }
} 