export class StatsController {
    constructor(app) {
        this.app = app;
        this.lastStatsUpdate = 0;

        this._elevationDataChecked = false;
    }

    initialize() {
        // Initialize stats display
        this.resetLiveStats();
        this.resetStats();
    }

    // Update the static stats section when a track is loaded
    updateStats(stats) {
        if (!stats) return;

        // For journeys, use the aggregated stats directly (they've already been calculated)
        // For single tracks, recalculate from trackPoints if available
        if (!this.app.currentTrackData?.isJourney) {
            this.recalculateStatsFromTrackPoints(stats);
        }

        // Ensure we have valid stats for all fields
        this.ensureCompleteStats(stats);



        // Format and update the display values
        const distanceText = this.app.gpxParser.formatDistance(stats.totalDistance);
        const elevationText = this.app.gpxParser.formatElevation(stats.elevationGain);
        const durationText = this.formatDurationMinutes(stats.totalDuration);
        const speedText = this.formatSpeed(stats.avgSpeed);
        const paceText = this.formatPaceValue(stats.avgPace); // Use avgPace directly (already in min/km)
        const maxElevationText = this.app.gpxParser.formatElevation(stats.maxElevation);
        const minElevationText = this.app.gpxParser.formatElevation(stats.minElevation);



        // Update the DOM elements
        const totalDistanceEl = document.getElementById('totalDistance');
        const elevationGainEl = document.getElementById('elevationGain');
        const durationEl = document.getElementById('duration');
        const averageSpeedEl = document.getElementById('averageSpeed');
        const averagePaceEl = document.getElementById('averagePace');
        const maxElevationEl = document.getElementById('maxElevation');
        const minElevationEl = document.getElementById('minElevation');

        if (totalDistanceEl) totalDistanceEl.textContent = distanceText;
        if (elevationGainEl) elevationGainEl.textContent = elevationText;
        if (durationEl) durationEl.textContent = durationText;
        if (averageSpeedEl) averageSpeedEl.textContent = speedText;
        if (averagePaceEl) averagePaceEl.textContent = paceText;
        if (maxElevationEl) maxElevationEl.textContent = maxElevationText;
        if (minElevationEl) minElevationEl.textContent = minElevationText;
    }

    // Update live stats during animation - this is the main method called during playback
    updateLiveStats() {
        // Cache overlay element
        if (!this.overlayElement) {
            this.overlayElement = document.getElementById('liveStatsOverlay');
        }
        if (!this.overlayElement) return;
        
        // Skip expensive operations during clean recording, but allow updates during overlay recording
        if (this.app.recordingMode && !this.app.overlayRecordingMode) {
            return;
        }
        
        // If no data, show placeholders
        if (!this.app.mapController || !this.app.currentTrackData) {
            this.setErrorState();
            return;
        }
        
        try {
            // Increased throttling for better performance during animation
            const now = performance.now();
            if (this.lastStatsUpdate && (now - this.lastStatsUpdate) < 150) {
                return; // Skip if updated less than 150ms ago
            }
            this.lastStatsUpdate = now;
            
            // Ensure GPX parser is ready
            if (!this.app.mapRenderer.ensureGPXParserReady()) {
                this.setErrorState();
                return;
            }
            
            const progress = this.app.mapRenderer.getAnimationProgress();
            const currentPoint = this.app.mapRenderer.gpxParser.getInterpolatedPoint(progress);
            
            if (!currentPoint) {
                this.setErrorState();
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
            
            // Cache DOM elements for better performance
            if (!this.distanceElement) {
                this.distanceElement = document.getElementById('liveDistance');
            }
            if (!this.elevationElement) {
                this.elevationElement = document.getElementById('liveElevation');
            }
            
            // Format and update the display values - simplified without animation during playback
            if (this.distanceElement) {
                const formattedDistance = this.app.gpxParser.formatDistance(currentDistance);
                if (this.distanceElement.textContent !== formattedDistance) {
                    this.distanceElement.textContent = formattedDistance;
                }
            }
            
            if (this.elevationElement) {
                const formattedElevation = this.app.gpxParser.formatElevation(currentElevationGain);
                if (this.elevationElement.textContent !== formattedElevation) {
                    this.elevationElement.textContent = formattedElevation;
                }
            }
            
        } catch (error) {
            this.setErrorState();
            console.warn('Error updating live stats:', error);
        }
    }

    // Helper method to set error state for all stats - reduces code duplication
    setErrorState() {
        if (!this.distanceElement) {
            this.distanceElement = document.getElementById('liveDistance');
        }
        if (!this.elevationElement) {
            this.elevationElement = document.getElementById('liveElevation');
        }
        
        if (this.distanceElement) this.distanceElement.textContent = '–';
        if (this.elevationElement) this.elevationElement.textContent = '–';
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
        const avgSpeedElement = document.getElementById('liveAverageSpeed');
        if (avgSpeedElement) {
            avgSpeedElement.textContent = '0 km/h';
        }
    }

    // Reset all static stats to default values
    resetStats() {
        document.getElementById('totalDistance').textContent = '0 km';
        document.getElementById('elevationGain').textContent = '0 m';
        document.getElementById('duration').textContent = '0h 0m';
        document.getElementById('averageSpeed').textContent = '0 km/h';
        document.getElementById('averagePace').textContent = '0:00 min/km';
        document.getElementById('maxElevation').textContent = '0 m';
        document.getElementById('minElevation').textContent = '0 m';
    }

    // Format duration from hours to readable format (1h 30m)
    formatDuration(hours) {
        if (!hours || hours === 0) return '0h 0m';

        const totalMinutes = Math.round(hours * 60);
        const displayHours = Math.floor(totalMinutes / 60);
        const displayMinutes = totalMinutes % 60;

        if (displayHours > 0) {
            return `${displayHours}h ${displayMinutes}m`;
        } else {
            return `${displayMinutes}m`;
        }
    }

    // Format duration from hours to minutes format (same as above for now)
    formatDurationMinutes(hours) {
        return this.formatDuration(hours);
    }

    // Format speed in km/h
    formatSpeed(speedKmh) {
        if (!speedKmh || speedKmh === 0) return '0 km/h';
        return `${speedKmh.toFixed(1)} km/h`;
    }

    // Format pace from km/h to min/km
    formatPace(avgSpeedKmh) {
        if (!avgSpeedKmh || avgSpeedKmh === 0) return '0:00 min/km';

        // Convert km/h to min/km
        const paceMinPerKm = 60 / avgSpeedKmh;

        // Format as MM:SS
        const minutes = Math.floor(paceMinPerKm);
        const seconds = Math.round((paceMinPerKm - minutes) * 60);

        return `${minutes}:${seconds.toString().padStart(2, '0')} min/km`;
    }

    // Format pace value directly (when pace is already in min/km)
    formatPaceValue(paceMinPerKm) {
        if (!paceMinPerKm || paceMinPerKm === 0) return '0:00 min/km';

        // Format as MM:SS
        const minutes = Math.floor(paceMinPerKm);
        const seconds = Math.round((paceMinPerKm - minutes) * 60);

        return `${minutes}:${seconds.toString().padStart(2, '0')} min/km`;
    }

    // Ensure all stats fields are properly calculated
    ensureCompleteStats(stats) {
        if (!stats) return;

        // Calculate average speed if not present or if we have distance and duration
        if ((!stats.avgSpeed || stats.avgSpeed === 0) && stats.totalDistance > 0 && stats.totalDuration > 0) {
            stats.avgSpeed = stats.totalDistance / stats.totalDuration; // km/h (totalDuration should already be in hours)
        }

        // Ensure avgPace is calculated (it might be stored as avgPace or need to be calculated from avgSpeed)
        if ((!stats.avgPace || stats.avgPace === 0) && stats.avgSpeed > 0) {
            stats.avgPace = (1 / stats.avgSpeed) * 60; // min/km
        }



        // Ensure duration is in hours format (not seconds)
        if (stats.totalDuration && stats.totalDuration > 24) {
            // If duration is in seconds, convert to hours
            stats.totalDuration = stats.totalDuration / 3600;
        }
    }

    // Recalculate stats from current trackPoints data (useful after journey transformations)
    recalculateStatsFromTrackPoints(stats) {
        if (!this.app.currentTrackData || !this.app.currentTrackData.trackPoints) {
            return;
        }

        const trackPoints = this.app.currentTrackData.trackPoints;

        // Recalculate elevation stats
        const elevations = trackPoints.map(point => point.elevation || 0).filter(e => e > 0);
        if (elevations.length > 0) {
            const newMinElevation = Math.min(...elevations);
            const newMaxElevation = Math.max(...elevations);

            if (newMinElevation !== stats.minElevation || newMaxElevation !== stats.maxElevation) {
                stats.minElevation = newMinElevation;
                stats.maxElevation = newMaxElevation;
            }
        }

        // Recalculate speed stats
        const speeds = trackPoints.map(point => point.speed || 0).filter(s => s > 0);
        if (speeds.length > 0) {
            const newAvgSpeed = speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length;

            if (Math.abs(newAvgSpeed - (stats.avgSpeed || 0)) > 0.1) {
                stats.avgSpeed = newAvgSpeed;
            }
        }

        // Recalculate duration if we have time data
        const pointsWithTime = trackPoints.filter(p => p.time).length;
        if (pointsWithTime > 1) {
            const firstTime = trackPoints.find(p => p.time)?.time;
            const lastTime = trackPoints.slice().reverse().find(p => p.time)?.time;

            if (firstTime && lastTime) {
                const newDuration = (lastTime - firstTime) / 1000 / 3600; // hours

                if (Math.abs(newDuration - (stats.totalDuration || 0)) > 0.01) {
                    stats.totalDuration = newDuration;
                }
            }
        }
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