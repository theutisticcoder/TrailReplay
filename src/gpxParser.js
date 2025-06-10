import * as turf from '@turf/turf';

export class GPXParser {
    constructor() {
        this.trackPoints = [];
        this.stats = {
            totalDistance: 0,
            totalDuration: 0,
            elevationGain: 0,
            avgSpeed: 0,
            minElevation: Infinity,
            maxElevation: -Infinity
        };
    }

    async parseFile(file) {
        try {
            const text = await this.readFile(file);
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(text, 'text/xml');
            
            // Check for parsing errors
            const parseError = xmlDoc.querySelector('parsererror');
            if (parseError) {
                throw new Error('Invalid GPX file format');
            }
            
            return this.extractTrackData(xmlDoc);
        } catch (error) {
            console.error('Error parsing GPX file:', error);
            throw new Error('Failed to parse GPX file');
        }
    }

    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    extractTrackData(xmlDoc) {
        // Try different GPX structures
        let trkpts = xmlDoc.querySelectorAll('trkpt');
        
        // If no track points found, try route points
        if (trkpts.length === 0) {
            trkpts = xmlDoc.querySelectorAll('rtept');
        }
        
        // If still no points, try waypoints
        if (trkpts.length === 0) {
            trkpts = xmlDoc.querySelectorAll('wpt');
        }
        
        if (trkpts.length === 0) {
            throw new Error('No track points found in GPX file');
        }

        this.trackPoints = [];
        let totalDistance = 0;
        let elevationGain = 0;
        let previousPoint = null;
        let startTime = null;
        let endTime = null;

        Array.from(trkpts).forEach((trkpt, index) => {
            const lat = parseFloat(trkpt.getAttribute('lat'));
            const lon = parseFloat(trkpt.getAttribute('lon'));
            
            if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
                console.warn(`Skipping invalid coordinate: lat=${lat}, lon=${lon}`);
                return; // Skip invalid points
            }
            
            const eleElement = trkpt.querySelector('ele');
            const timeElement = trkpt.querySelector('time');
            
            const elevation = eleElement ? parseFloat(eleElement.textContent) : 0;
            const timeStr = timeElement ? timeElement.textContent : null;
            let time = null;
            
            if (timeStr) {
                try {
                    time = new Date(timeStr);
                    if (isNaN(time.getTime())) {
                        time = null;
                    }
                } catch (e) {
                    time = null;
                }
            }

            if (!startTime && time) startTime = time;
            if (time) endTime = time;

            const point = {
                lat,
                lon,
                elevation: isNaN(elevation) ? 0 : elevation,
                time,
                index,
                distance: totalDistance,
                speed: 0
            };

            // Calculate distance from previous point
            if (previousPoint) {
                const distance = this.calculateDistance(
                    previousPoint.lat, previousPoint.lon,
                    lat, lon
                );
                
                totalDistance += distance;
                point.distance = totalDistance;

                // Calculate speed if we have time data
                if (previousPoint.time && time) {
                    const timeDiff = (time - previousPoint.time) / 1000 / 3600; // hours
                    point.speed = timeDiff > 0 ? distance / timeDiff : 0;
                }

                // Calculate elevation gain
                if (!isNaN(elevation) && !isNaN(previousPoint.elevation) && elevation > previousPoint.elevation) {
                    elevationGain += elevation - previousPoint.elevation;
                }
            }

            this.trackPoints.push(point);
            previousPoint = point;

            // Update min/max elevation
            if (!isNaN(elevation)) {
                this.stats.minElevation = Math.min(this.stats.minElevation, elevation);
                this.stats.maxElevation = Math.max(this.stats.maxElevation, elevation);
            }
        });

        // Check if we have any valid track points
        if (this.trackPoints.length === 0) {
            throw new Error('No valid track points found in GPX file');
        }

        // Calculate final statistics
        let duration = startTime && endTime ? (endTime - startTime) / 1000 / 3600 : 0; // hours
        
        // If no time data available, estimate duration based on distance and average speed
        if (duration === 0 && totalDistance > 0) {
            // Estimate based on activity type - assume reasonable speeds
            const estimatedSpeed = 5; // km/h for walking/hiking as default
            duration = totalDistance / estimatedSpeed; // hours
            console.log(`No time data found. Estimated duration: ${duration} hours based on distance ${totalDistance} km`);
        }
        
        const avgSpeed = duration > 0 ? totalDistance / duration : 0;

        this.stats = {
            totalDistance,
            totalDuration: duration,
            elevationGain,
            avgSpeed,
            minElevation: this.stats.minElevation === Infinity ? 0 : this.stats.minElevation,
            maxElevation: this.stats.maxElevation === -Infinity ? 0 : this.stats.maxElevation,
            startTime,
            endTime,
            hasTimeData: !!(startTime && endTime)
        };

        return {
            trackPoints: this.trackPoints,
            stats: this.stats,
            bounds: this.calculateBounds()
        };
    }

    // Haversine formula for distance calculation
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in kilometers
        const dLat = this.toRadians(lat2 - lat1);
        const dLon = this.toRadians(lon2 - lon1);
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }

    calculateBounds() {
        if (this.trackPoints.length === 0) return null;

        // Filter out any points with NaN coordinates
        const validPoints = this.trackPoints.filter(p => !isNaN(p.lat) && !isNaN(p.lon));
        
        if (validPoints.length === 0) {
            console.error('No valid track points found - all have NaN coordinates');
            return null;
        }

        const lats = validPoints.map(p => p.lat);
        const lons = validPoints.map(p => p.lon);

        const north = Math.max(...lats);
        const south = Math.min(...lats);
        const east = Math.max(...lons);
        const west = Math.min(...lons);

        // Validate the calculated bounds
        if (isNaN(north) || isNaN(south) || isNaN(east) || isNaN(west)) {
            console.error('Calculated bounds contain NaN values:', { north, south, east, west });
            return null;
        }

        return {
            north,
            south,
            east,
            west,
            center: [
                (west + east) / 2,
                (south + north) / 2
            ]
        };
    }

    // Get interpolated point for animation
    getInterpolatedPoint(progress) {
        if (this.trackPoints.length === 0) return null;
        
        const totalPoints = this.trackPoints.length;
        const targetIndex = Math.min(progress * (totalPoints - 1), totalPoints - 1);
        const index = Math.floor(targetIndex);
        const fraction = targetIndex - index;

        if (index >= totalPoints - 1) {
            return this.trackPoints[totalPoints - 1];
        }

        const currentPoint = this.trackPoints[index];
        const nextPoint = this.trackPoints[index + 1];

        // Safety checks for undefined points or properties
        if (!currentPoint || !nextPoint || 
            typeof currentPoint.lat === 'undefined' || typeof nextPoint.lat === 'undefined' ||
            typeof currentPoint.lon === 'undefined' || typeof nextPoint.lon === 'undefined') {
            console.warn('GPXParser: Invalid track points for interpolation at index:', index);
            return currentPoint || null;
        }

        // Linear interpolation with safe defaults
        return {
            lat: currentPoint.lat + (nextPoint.lat - currentPoint.lat) * fraction,
            lon: currentPoint.lon + (nextPoint.lon - currentPoint.lon) * fraction,
            elevation: (currentPoint.elevation || 0) + ((nextPoint.elevation || 0) - (currentPoint.elevation || 0)) * fraction,
            distance: (currentPoint.distance || 0) + ((nextPoint.distance || 0) - (currentPoint.distance || 0)) * fraction,
            speed: (currentPoint.speed || 0) + ((nextPoint.speed || 0) - (currentPoint.speed || 0)) * fraction,
            index: targetIndex
        };
    }

    // Get activity segments for triathlon or multi-sport activities
    detectActivitySegments() {
        if (this.trackPoints.length === 0) return [];

        const segments = [];
        let currentSegment = null;
        const speedThresholds = {
            swimming: 3, // km/h
            running: 15, // km/h
            cycling: 30  // km/h
        };

        this.trackPoints.forEach((point, index) => {
            let activity = 'running'; // default
            
            if (point.speed < speedThresholds.swimming) {
                activity = 'swimming';
            } else if (point.speed > speedThresholds.cycling) {
                activity = 'cycling';
            } else if (point.speed > speedThresholds.running) {
                activity = 'cycling';
            }

            if (!currentSegment || currentSegment.activity !== activity) {
                if (currentSegment) {
                    currentSegment.endIndex = index - 1;
                    segments.push(currentSegment);
                }
                
                currentSegment = {
                    activity,
                    startIndex: index,
                    startDistance: point.distance
                };
            }
        });

        if (currentSegment) {
            currentSegment.endIndex = this.trackPoints.length - 1;
            segments.push(currentSegment);
        }

        return segments;
    }

    formatDuration(hours) {
        if (!hours || hours === 0) return '0:00';
        
        // Handle very small values (less than 1 minute)
        if (hours < 1/60) return '0:01';
        
        const totalMinutes = Math.floor(hours * 60);
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        
        if (h === 0) {
            return `${m}:00`;
        }
        
        return `${h}:${m.toString().padStart(2, '0')}`;
    }

    formatDistance(km) {
        if (!km || km === 0) return '0.00 km';
        return `${km.toFixed(2)} km`;
    }

    formatSpeed(kmh) {
        if (!kmh || kmh === 0) return '0.0 km/h';
        return `${kmh.toFixed(1)} km/h`;
    }

    formatElevation(meters) {
        if (!meters || meters === 0) return '0 m';
        return `${Math.round(meters)} m`;
    }
} 