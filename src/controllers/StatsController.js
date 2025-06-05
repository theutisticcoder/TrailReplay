export class StatsController {
    constructor(app) {
        this.app = app;
        this.lastStatsUpdate = 0;
        this._elevationDataChecked = false;
    }

    initialize() {
        // Initialize stats display
        this.resetLiveStats();
    }

    // Update the static stats section when a track is loaded
    updateStats(stats) {
        if (!stats) return;
        
        document.getElementById('totalDistance').textContent = this.app.gpxParser.formatDistance(stats.totalDistance);
        document.getElementById('elevationGain').textContent = this.app.gpxParser.formatElevation(stats.elevationGain);
    }

    // Update live stats during animation - this is the main method called during playback
    updateLiveStats() {
        const overlay = document.getElementById('liveStatsOverlay');
        if (!overlay) return;
        
        // Skip expensive operations during clean recording, but allow updates during overlay recording
        if (this.app.recordingMode && !this.app.overlayRecordingMode) {
            return;
        }
        
        // If no data, show placeholders
        if (!this.app.mapController || !this.app.currentTrackData) {
            document.getElementById('liveDistance').textContent = '–';
            document.getElementById('liveElevation').textContent = '–';
            return;
        }
        
        try {
            // Throttle updates during animation for performance
            const now = performance.now();
            if (this.lastStatsUpdate && (now - this.lastStatsUpdate) < 100) {
                return; // Skip if updated less than 100ms ago
            }
            this.lastStatsUpdate = now;
            
            // Ensure GPX parser is ready
            if (!this.app.mapRenderer.ensureGPXParserReady()) {
                document.getElementById('liveDistance').textContent = '–';
                document.getElementById('liveElevation').textContent = '–';
                return;
            }
            
            const progress = this.app.mapRenderer.getAnimationProgress();
            const currentPoint = this.app.mapRenderer.gpxParser.getInterpolatedPoint(progress);
            
            if (!currentPoint) {
                document.getElementById('liveDistance').textContent = '–';
                document.getElementById('liveElevation').textContent = '–';
                return;
            }
            
            // Calculate current distance (distance traveled so far)
            let currentDistance = 0;
            
            if (this.app.currentTrackData.isJourney && this.app.currentTrackData.segments) {
                // For journeys, calculate distance based on current segment and progress
                currentDistance = this.calculateJourneyCurrentDistance(progress);
            } else {
                // For single tracks, use simple calculation
                const totalDistance = this.app.currentTrackData.stats.totalDistance;
                currentDistance = progress * totalDistance;
            }
            
            // Calculate actual elevation gain based on current position in track
            const currentElevationGain = this.calculateActualElevationGain(progress);
            
            // Format and update the display values with optimized DOM updates
            const distanceElement = document.getElementById('liveDistance');
            const elevationElement = document.getElementById('liveElevation');
            
            if (distanceElement) {
                const formattedDistance = this.app.gpxParser.formatDistance(currentDistance);
                if (distanceElement.textContent !== formattedDistance) {
                    // Skip animation during heavy operations
                    if (this.app.isPlaying && this.app.mapRenderer.isAnimating) {
                        distanceElement.textContent = formattedDistance;
                    } else {
                        this.animateValueChange(distanceElement, formattedDistance);
                    }
                }
            }
            
            if (elevationElement) {
                const formattedElevation = this.app.gpxParser.formatElevation(currentElevationGain);
                if (elevationElement.textContent !== formattedElevation) {
                    // Skip animation during heavy operations
                    if (this.app.isPlaying && this.app.mapRenderer.isAnimating) {
                        elevationElement.textContent = formattedElevation;
                    } else {
                        this.animateValueChange(elevationElement, formattedElevation);
                    }
                }
            }
            
        } catch (error) {
            document.getElementById('liveDistance').textContent = '–';
            document.getElementById('liveElevation').textContent = '–';
            console.warn('Error updating live stats:', error);
        }
    }

    // Calculate actual elevation gain based on current progress through the track
    calculateActualElevationGain(progress) {
        if (!this.app.currentTrackData || !this.app.currentTrackData.trackPoints) {
            return 0;
        }
        
        const trackPoints = this.app.currentTrackData.trackPoints;
        if (trackPoints.length === 0) {
            return 0;
        }
        
        // Debug: Check if we have elevation data (only once)
        if (!this._elevationDataChecked) {
            const hasElevationData = trackPoints.some(point => point.elevation && point.elevation > 0);
            if (!hasElevationData) {
                console.log('Warning: No elevation data found in track points');
                console.log('First 3 track points:', trackPoints.slice(0, 3).map(p => ({
                    lat: p.lat,
                    lon: p.lon,
                    elevation: p.elevation
                })));
            } else {
                console.log('Elevation data found in track points');
            }
            this._elevationDataChecked = true;
        }
        
        // Calculate the current point index based on progress
        const totalPoints = trackPoints.length;
        const currentIndex = Math.min(Math.floor(progress * (totalPoints - 1)), totalPoints - 1);
        
        // Calculate actual elevation gain up to the current point
        let elevationGain = 0;
        let previousElevation = trackPoints[0].elevation || 0;
        
        for (let i = 1; i <= currentIndex; i++) {
            const currentElevation = trackPoints[i].elevation || 0;
            
            // Only count positive elevation changes as gain
            if (currentElevation > previousElevation) {
                elevationGain += currentElevation - previousElevation;
            }
            
            previousElevation = currentElevation;
        }
        
        // If we're between two points, interpolate the elevation gain for the partial segment
        if (currentIndex < totalPoints - 1) {
            const fraction = (progress * (totalPoints - 1)) - currentIndex;
            if (fraction > 0) {
                const currentElevation = trackPoints[currentIndex].elevation || 0;
                const nextElevation = trackPoints[currentIndex + 1].elevation || 0;
                
                // Only add partial gain if the next point is higher
                if (nextElevation > currentElevation) {
                    const partialGain = (nextElevation - currentElevation) * fraction;
                    elevationGain += partialGain;
                }
            }
        }
        
        return elevationGain;
    }

    animateValueChange(element, newValue) {
        // Add updating class for animation
        element.classList.add('updating');
        
        // Update the value
        element.textContent = newValue;
        
        // Remove the animation class after animation
        setTimeout(() => {
            element.classList.remove('updating');
        }, 200);
    }

    calculateGpxOnlyStats(journeyData) {
        if (!journeyData.segments) return { totalDistance: 0, elevationGain: 0 };
        
        let totalDistance = 0;
        let totalElevationGain = 0;
        
        journeyData.segments.forEach(segment => {
            if (segment.type === 'track' && segment.data && segment.data.stats) {
                totalDistance += segment.data.stats.totalDistance || 0;
                totalElevationGain += segment.data.stats.elevationGain || 0;
            }
        });
        
        return {
            totalDistance: totalDistance,
            elevationGain: totalElevationGain
        };
    }

    resetLiveStats() {
        document.getElementById('liveDistance').textContent = '0.0 km';
        document.getElementById('liveElevation').textContent = '0 m';
    }



    // Calculate current distance for journeys based on segments and progress
    calculateJourneyCurrentDistance(progress) {
        if (!this.app.currentTrackData.segments) return 0;

        const segments = this.app.currentTrackData.segments;
        const totalCoordinates = this.app.currentTrackData.trackPoints.length;
        
        // Convert linear progress to coordinate index
        const currentCoordIndex = Math.floor(progress * (totalCoordinates - 1));
        
        let accumulatedDistance = 0;
        
        for (const segment of segments) {
            const segmentStartIndex = segment.startIndex;
            const segmentEndIndex = segment.endIndex;
            
            if (currentCoordIndex >= segmentStartIndex && currentCoordIndex <= segmentEndIndex) {
                // We're in this segment
                if (segment.type === 'track') {
                    // Calculate partial distance within this track segment
                    const segmentProgress = (currentCoordIndex - segmentStartIndex) / (segmentEndIndex - segmentStartIndex);
                    const segmentDistance = segment.data?.stats?.totalDistance || 0;
                    
                    // Only count track distance if GPX-only stats is disabled, or always count if enabled
                    if (!this.app.state.gpxOnlyStats || segment.type === 'track') {
                        accumulatedDistance += segmentProgress * segmentDistance;
                    }
                }
                // For transportation segments, don't add distance if GPX-only stats is enabled
                else if (segment.type === 'transportation' && !this.app.state.gpxOnlyStats) {
                    // For simplicity, count transport as full distance if we've reached this segment
                    // In a more sophisticated implementation, you might interpolate based on time
                    const transportDistance = this.calculateTransportDistance(segment.startPoint, segment.endPoint);
                    accumulatedDistance += transportDistance;
                }
                
                break;
            } else if (currentCoordIndex > segmentEndIndex) {
                // We've passed this segment completely
                if (segment.type === 'track') {
                    const segmentDistance = segment.data?.stats?.totalDistance || 0;
                    if (!this.app.state.gpxOnlyStats || segment.type === 'track') {
                        accumulatedDistance += segmentDistance;
                    }
                } else if (segment.type === 'transportation' && !this.app.state.gpxOnlyStats) {
                    const transportDistance = this.calculateTransportDistance(segment.startPoint, segment.endPoint);
                    accumulatedDistance += transportDistance;
                }
            }
        }
        
        return accumulatedDistance;
    }

    // Calculate distance between two points for transport segments
    calculateTransportDistance(startPoint, endPoint) {
        if (!startPoint || !endPoint) return 0;
        
        const R = 6371; // Earth's radius in km
        const dLat = (endPoint[1] - startPoint[1]) * Math.PI / 180;
        const dLon = (endPoint[0] - startPoint[0]) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(startPoint[1] * Math.PI / 180) * Math.cos(endPoint[1] * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }
} 