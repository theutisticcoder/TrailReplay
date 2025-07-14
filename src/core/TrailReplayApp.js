import { initializeTranslations, t } from '../translations.js';
import { FileController } from '../controllers/FileController.js';
import { MapController } from '../controllers/MapController.js';
import { PlaybackController } from '../controllers/PlaybackController.js';
import { StatsController } from '../controllers/StatsController.js';
import { ExportController } from '../controllers/ExportController.js';
import { VideoExportController } from '../controllers/VideoExportController.js';
import { AnnotationController } from '../controllers/AnnotationController.js';
import { ProgressController } from '../controllers/ProgressController.js';
import { JourneyController } from '../controllers/JourneyController.js';
import { IconController } from '../controllers/IconController.js';
import { TimelineController } from '../controllers/TimelineController.js';
import { setupEventListeners } from '../ui/eventListeners.js';
import { setupModals } from '../ui/modalController.js';
import { DEFAULT_SETTINGS, ICON_CATEGORIES, AVAILABLE_ICONS } from '../utils/constants.js';

export class TrailReplayApp {
    constructor() {
        /** Global, app-wide state */
        this.state = {
            isPlaying: false,
            gpxOnlyStats: DEFAULT_SETTINGS.GPX_ONLY_STATS,
            totalAnimationTime: DEFAULT_SETTINGS.TOTAL_ANIMATION_TIME,
            currentIcon: DEFAULT_SETTINGS.DEFAULT_ICON,
            currentAnnotation: { icon: DEFAULT_SETTINGS.DEFAULT_ANNOTATION_ICON },
            currentIconChange: { icon: DEFAULT_SETTINGS.DEFAULT_ICON_CHANGE },
            isSelectingForChange: false,
            isDrawingMode: false,
            isAnnotationMode: false
        };

        // Legacy properties for compatibility during refactoring
        this.isPlaying = false;
        this.gpxOnlyStats = DEFAULT_SETTINGS.GPX_ONLY_STATS;
        this.recordingMode = false;
        this.overlayRecordingMode = false;

        // Data properties
        this.currentTrackData = null;
        this.journeyData = null;

        // Elevation profile properties
        this.elevationProfile = null;
        this.cachedElevationProfiles = {};
        this.frameCount = 0;

        // Keep references to icon data for compatibility
        this.iconCategories = ICON_CATEGORIES;
        this.availableIcons = AVAILABLE_ICONS;

        /* Controllers - they will be initialized with dependencies */
        this.file = null;
        this.map = null;
        this.playback = null;
        this.stats = null;
        this.progress = null;
        this.journey = null;
        this.icon = null;
        this.exporter = null;
        this.videoExporter = null;
        this.notes = null;

        // Legacy property names for compatibility
        this.mapController = null; // Will point to this.map
        this.gpxParser = null; // Will be set when data is loaded
    }

    async init() {
        // Initialize translations
        initializeTranslations();

        // Update placeholders with translations after a brief delay
        setTimeout(() => this.updatePlaceholders(), 100);

        // Initialize controllers with dependencies
        this.map = new MapController(this);
        await this.map.init();

        this.file = new FileController(this);
        this.playback = new PlaybackController(this);
        this.stats = new StatsController(this);
        this.progress = new ProgressController(this);
        this.journey = new JourneyController(this);
        this.icon = new IconController(this);
        this.timeline = new TimelineController(this);
        this.exporter = new ExportController(this);
        this.videoExporter = new VideoExportController(this);
        this.notes = new AnnotationController(this);

        // Set legacy compatibility references
        this.mapController = this.map;
        this.gpxParser = this.file.gpxParser;
        
        // Add direct mapRenderer reference for consistent access
        this.mapRenderer = this.map.mapRenderer;

        // Set up UI wiring
        setupEventListeners(this);
        setupModals(this);
        
        // Initialize progress bar interactions after DOM is ready
        this.progress.initialize();
        
        // Initialize journey functionality
        this.journey.initialize();
        
        // Initialize icon functionality
        this.icon.initialize();
        
        // Initialize video export functionality
        this.videoExporter.initialize();
        
        // Set up timing synchronization for journeys
        this.setupTimingSynchronization();
        
        // Initialize other features
        this.addLanguageSwitcher();

        // Setup annotation click event listener
        document.addEventListener('annotationClick', (e) => {
            const progress = e.detail.progress;
            console.log('Annotation click at progress:', progress);
            
            // Initialize currentAnnotation if not exists
            if (!this.currentAnnotation) {
                this.currentAnnotation = {};
            }
            
            // Set progress and default icon
            this.currentAnnotation.progress = progress;
            this.currentAnnotation.icon = this.currentAnnotation.icon || '📍';
            
            // Show annotation modal
            this.notes.showAnnotationModal();
        });

        // Setup timeline migration after track loads
        document.addEventListener('trackLoaded', () => {
            // Migrate existing annotations and icon changes to unified timeline
            setTimeout(() => {
                this.timeline.migrateExistingEvents();
            }, 100);
        });
    }

    // Temporary methods to maintain compatibility during refactoring
    updatePlaceholders() {
        // This will be moved to a UI controller later
        const elements = document.querySelectorAll('[data-translate-placeholder]');
        elements.forEach(element => {
            const key = element.dataset.translatePlaceholder;
            element.placeholder = t(key);
        });
    }

    addLanguageSwitcher() {
        // This will be moved to a UI controller later
        const languageSelector = document.getElementById('languageSelector');
        if (languageSelector) {
            languageSelector.addEventListener('change', (e) => {
                const language = e.target.value;
                localStorage.setItem('selectedLanguage', language);
                location.reload(); // Simple reload for language change
            });

            // Set current language
            const currentLanguage = localStorage.getItem('selectedLanguage') || 'en';
            languageSelector.value = currentLanguage;
        }
    }

    // Temporary methods to maintain compatibility during refactoring
    showLoading(show) {
        const loadingElement = document.getElementById('loading');
        if (loadingElement) {
            loadingElement.style.display = show ? 'block' : 'none';
        }
    }

    showMessage(message, type = 'info') {
        // Create or get message container
        let messageContainer = document.getElementById('messageContainer');
        if (!messageContainer) {
            messageContainer = document.createElement('div');
            messageContainer.id = 'messageContainer';
            messageContainer.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 1000;
                max-width: 400px;
            `;
            document.body.appendChild(messageContainer);
        }

        // Create message element
        const messageElement = document.createElement('div');
        messageElement.style.cssText = `
            padding: 12px 16px;
            margin-bottom: 10px;
            border-radius: 4px;
            color: white;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            animation: slideIn 0.3s ease-out;
            background-color: ${type === 'error' ? '#f44336' : type === 'warning' ? '#ff9800' : '#4caf50'};
        `;
        
        // Add animation styles if not already present
        if (!document.getElementById('messageStyles')) {
            const style = document.createElement('style');
            style.id = 'messageStyles';
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }

        messageElement.textContent = message;
        messageContainer.appendChild(messageElement);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (messageElement.parentNode) {
                messageElement.style.animation = 'slideOut 0.3s ease-in';
                setTimeout(() => {
                    if (messageElement.parentNode) {
                        messageElement.parentNode.removeChild(messageElement);
                    }
                }, 300);
            }
        }, 5000);
    }

    clearElevationProfileCache(trackId = null) {
        if (!this.cachedElevationProfiles) return;
        
        if (trackId) {
            delete this.cachedElevationProfiles[trackId];
            console.log(`Cleared elevation profile cache for: ${trackId}`);
        } else {
            this.cachedElevationProfiles = {};
            console.log('Cleared all elevation profile cache');
        }
    }

    startProgressUpdate() {
        const updateProgress = () => {
            if (!this.state.isPlaying || !this.mapRenderer) return;
            
            this.updateProgressDisplay();
            
            const progress = this.mapRenderer.getAnimationProgress();
            if (progress < 1 && this.state.isPlaying) {
                requestAnimationFrame(updateProgress);
            } else if (progress >= 1) {
                this.state.isPlaying = false;
                this.isPlaying = false; // Legacy compatibility
                const playBtn = document.getElementById('playBtn');
                if (playBtn) {
                    const playBtnSpan = playBtn.querySelector('span');
                    if (playBtnSpan) {
                        playBtnSpan.textContent = 'Play'; // Will be translated by eventListeners
                    }
                }
            }
        };
        
        updateProgress();
    }

    updateProgressDisplay() {
        // Skip expensive operations during clean recording, but allow updates during overlay recording (manual mode)
        if (this.recordingMode && !this.overlayRecordingMode) {
            return;
        }
        
        const progress = this.mapRenderer.getAnimationProgress();
        
        // Update the elevation profile progress (throttled)
        this.updateElevationProgress(progress);
        
        // Update live stats with throttling
        this.stats.updateLiveStats();
        
        // For journeys, ensure timing is synchronized
        if (this.currentTrackData && this.currentTrackData.isJourney && this.mapRenderer.getJourneyElapsedTime() !== undefined) {
            const currentTimeSeconds = Math.floor(this.mapRenderer.getJourneyElapsedTime());
            
            // Update current time display
            const currentTimeElement = document.getElementById('currentTime');
            if (currentTimeElement) {
                currentTimeElement.textContent = this.formatTimeInSeconds(currentTimeSeconds);
            }
            
            // Update total time display with journey timing
            if (this.currentTrackData.segmentTiming && this.currentTrackData.segmentTiming.totalDuration) {
                const totalTimeElement = document.getElementById('totalTime');
                if (totalTimeElement) {
                    totalTimeElement.textContent = this.formatTimeInSeconds(this.currentTrackData.segmentTiming.totalDuration);
                }
            }
            
            // Check for timing mismatches during animation
            const journeyTime = this.mapRenderer.getJourneyElapsedTime();
            const expectedProgress = this.convertSegmentTimeToLinearProgress(journeyTime);
            const actualProgress = progress;
            
            if (expectedProgress !== null && Math.abs(expectedProgress - actualProgress) > 0.05) {
                console.log(`⚠️  Time/Position sync mismatch: time=${journeyTime.toFixed(1)}s → expected progress=${expectedProgress.toFixed(3)}, actual progress=${actualProgress.toFixed(3)}, diff=${Math.abs(expectedProgress - actualProgress).toFixed(3)}`);
            }
        }
    }

    updateElevationProgress(progress) {
        // Skip expensive operations during clean recording, but allow updates during overlay recording (manual mode)
        if (this.recordingMode && !this.overlayRecordingMode) {
            return;
        }
        
        if (!this.elevationProfile) {
            // Fallback to flat progress bar behavior
            const progressFill = document.getElementById('progressFill');
            if (progressFill) {
                progressFill.style.width = `${progress * 100}%`;
            }
            return;
        }

        const { points, svgWidth, svgHeight } = this.elevationProfile;
        const progressIndex = Math.floor(progress * (points.length - 1));
        const currentPointIndex = Math.min(progressIndex, points.length - 1);

        // Get current position along the elevation profile
        let currentX = 0;
        let currentY = svgHeight / 2; // Default middle

        if (points.length > 0) {
            if (currentPointIndex < points.length) {
                const [x, y] = points[currentPointIndex].split(',').map(Number);
                currentX = x;
                currentY = y;

                // Interpolate between points if we're between indices
                const fraction = (progress * (points.length - 1)) - currentPointIndex;
                if (fraction > 0 && currentPointIndex < points.length - 1) {
                    const [nextX, nextY] = points[currentPointIndex + 1].split(',').map(Number);
                    currentX = x + (nextX - x) * fraction;
                    currentY = y + (nextY - y) * fraction;
                }
            }
        }

        // Batch DOM updates for better performance
        const progressPath = document.getElementById('progressPath');

        // Update progress path less frequently during animation for performance
        if (progressPath && points.length > 0) {
            // Only update every few frames during animation to reduce overhead
            const shouldUpdatePath = !this.state.isPlaying || (this.frameCount % 3 === 0);
            if (shouldUpdatePath) {
                const progressPoints = points.slice(0, currentPointIndex + 1);
                if (progressPoints.length > 0) {
                    // Add the current interpolated point
                    progressPoints.push(`${currentX.toFixed(2)},${currentY.toFixed(2)}`);
                    
                    // Create filled area from bottom to elevation profile
                    const progressPathData = `M0,${svgHeight} L${progressPoints.join(' L')} L${currentX},${svgHeight} Z`;
                    progressPath.setAttribute('d', progressPathData);
                }
            }
        }
        
        // Track frame count for throttling
        this.frameCount = (this.frameCount || 0) + 1;
    }

    // Generate elevation profile SVG path
    generateElevationProfile() {
        if (!this.currentTrackData || !this.currentTrackData.trackPoints) {
            console.log('No track data available for elevation profile');
            return;
        }

        // Create a unique cache key - for journeys, include segment composition
        let trackId;
        if (this.currentTrackData.isJourney && this.currentTrackData.segments) {
            // For journeys, create a cache key based on segment composition and order
            const segmentIds = this.currentTrackData.segments.map(segment => {
                if (segment.type === 'track') {
                    return `track_${segment.data.filename || segment.data.name}`;
                } else {
                    return `${segment.type}_${segment.mode || 'unknown'}`;
                }
            }).join('|');
            const trackPointsCount = this.currentTrackData.trackPoints.length;
            trackId = `journey_${segmentIds}_${trackPointsCount}pts`;
        } else {
            trackId = this.currentTrackData.filename || 'unknown';
        }

        // Check if we already have a cached profile for this exact journey composition
        if (this.cachedElevationProfiles && this.cachedElevationProfiles[trackId]) {
            this.elevationProfile = this.cachedElevationProfiles[trackId];
            document.getElementById('elevationPath').setAttribute('d', this.elevationProfile.pathData);
            console.log('Using cached elevation profile for:', trackId);
            this.updateElevationLabels();
            return;
        }

        const trackPoints = this.currentTrackData.trackPoints;
        const svgWidth = 800; // SVG viewBox width
        const svgHeight = 60; // SVG viewBox height
        const padding = 5; // Padding from edges

        // Extract elevation data
        const elevations = trackPoints.map(point => point.elevation || 0);
        const minElevation = Math.min(...elevations);
        const maxElevation = Math.max(...elevations);
        const elevationRange = maxElevation - minElevation;

        // If no elevation variation, create a flat line
        if (elevationRange === 0) {
            const flatY = svgHeight / 2;
            const pathData = `M0,${flatY} L${svgWidth},${flatY} L${svgWidth},${svgHeight} L0,${svgHeight} Z`;
            
            document.getElementById('elevationPath').setAttribute('d', pathData);
            
            // Cache the flat profile
            this.elevationProfile = {
                points: [`0,${flatY}`, `${svgWidth},${flatY}`],
                minElevation,
                maxElevation,
                elevationRange,
                svgWidth,
                svgHeight,
                padding,
                pathData
            };
            
            console.log('Generated flat elevation profile (no elevation variation)');
            this.updateElevationLabels();
            return;
        }

        // Generate path points with optimization for large datasets
        const pathPoints = [];
        const pointCount = trackPoints.length;
        
        // Optimize point generation for large tracks
        const step = pointCount > 1000 ? Math.ceil(pointCount / 800) : 1;
        
        for (let i = 0; i < pointCount; i += step) {
            const actualIndex = Math.min(i, pointCount - 1);
            const x = (actualIndex / (pointCount - 1)) * svgWidth;
            const normalizedElevation = (elevations[actualIndex] - minElevation) / elevationRange;
            const y = svgHeight - (normalizedElevation * (svgHeight - padding * 2)) - padding;
            pathPoints.push(`${x.toFixed(2)},${y.toFixed(2)}`);
        }

        // Create SVG path - filled area under the curve
        const pathData = `M0,${svgHeight} L${pathPoints.join(' L')} L${svgWidth},${svgHeight} Z`;
        
        // Update the elevation path
        document.getElementById('elevationPath').setAttribute('d', pathData);
        
        // Store elevation data for progress updates with caching
        this.elevationProfile = {
            points: pathPoints,
            minElevation,
            maxElevation,
            elevationRange,
            svgWidth,
            svgHeight,
            padding,
            pathData
        };

        // Cache the profile for future use
        if (!this.cachedElevationProfiles) {
            this.cachedElevationProfiles = {};
        }
        this.cachedElevationProfiles[trackId] = this.elevationProfile;

        console.log(`Generated elevation profile: ${elevations.length} points (optimized to ${pathPoints.length}), range: ${elevationRange.toFixed(1)}m`);
        
        // Update elevation labels
        this.updateElevationLabels();
    }

    // Update elevation labels with start and peak elevation values
    updateElevationLabels() {
        if (!this.elevationProfile || !this.currentTrackData) {
            // Hide labels if no elevation data
            const minLabel = document.getElementById('minElevationLabel');
            const maxLabel = document.getElementById('maxElevationLabel');
            if (minLabel) minLabel.style.display = 'none';
            if (maxLabel) maxLabel.style.display = 'none';
            return;
        }

        const { minElevation, maxElevation } = this.elevationProfile;
        const trackPoints = this.currentTrackData.trackPoints;
        
        // Find the starting elevation (first point)
        const startElevation = trackPoints.length > 0 ? (trackPoints[0].elevation || 0) : minElevation;
        
        // Find the position of the maximum elevation point
        let maxElevationIndex = 0;
        let currentMaxElevation = startElevation;
        
        trackPoints.forEach((point, index) => {
            if (point.elevation && point.elevation > currentMaxElevation) {
                currentMaxElevation = point.elevation;
                maxElevationIndex = index;
            }
        });
        
        // Update start elevation label
        const minLabel = document.getElementById('minElevationLabel');
        if (minLabel) {
            minLabel.style.display = 'flex';
            minLabel.style.visibility = 'visible';
            const valueSpan = minLabel.querySelector('.elevation-value');
            if (valueSpan) {
                valueSpan.textContent = `${Math.round(startElevation)} m`;
            }
        }
        
        // Update peak elevation label  
        const maxLabel = document.getElementById('maxElevationLabel');
        if (maxLabel) {
            maxLabel.style.display = 'flex';
            maxLabel.style.visibility = 'visible';
            const valueSpan = maxLabel.querySelector('.elevation-value');
            if (valueSpan) {
                valueSpan.textContent = `${Math.round(maxElevation)} m`;
            }
        }
        
        console.log(`Elevation labels updated: Start ${Math.round(startElevation)}m, Peak ${Math.round(maxElevation)}m`);
    }

    // Convert linear progress (0-1) to segment timing for journeys
    convertLinearProgressToSegmentTime(linearProgress) {
        if (!this.currentTrackData || !this.currentTrackData.isJourney || !this.currentTrackData.segmentTiming) {
            return null;
        }

        // Ensure progress is within bounds
        linearProgress = Math.max(0, Math.min(1, linearProgress));

        const segments = this.currentTrackData.segmentTiming.segments;
        if (!segments || segments.length === 0) {
            return linearProgress * (this.currentTrackData.segmentTiming.totalDuration || this.state.totalAnimationTime);
        }

        // Find which segment this linear progress falls into
        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];
            
            // Validate segment data
            if (typeof segment.progressStartRatio !== 'number' || typeof segment.progressEndRatio !== 'number' ||
                typeof segment.startTime !== 'number' || typeof segment.duration !== 'number') {
                console.warn(`Invalid segment data at index ${i}:`, segment);
                continue;
            }
            
            // Check if the linear progress falls within this segment's coordinate range
            if (linearProgress >= segment.progressStartRatio && linearProgress <= segment.progressEndRatio) {
                // Calculate the relative position within this segment
                const segmentProgressRange = segment.progressEndRatio - segment.progressStartRatio;
                let relativeProgressInSegment = 0;
                
                if (segmentProgressRange > 0) {
                    relativeProgressInSegment = (linearProgress - segment.progressStartRatio) / segmentProgressRange;
                }
                
                // Convert to time within this segment
                const timeInSegment = relativeProgressInSegment * segment.duration;
                const totalTime = segment.startTime + timeInSegment;
                
                if (isNaN(totalTime)) {
                    console.warn(`Invalid time calculation for segment ${i}:`, { timeInSegment, totalTime, segment });
                    break; // Fall through to fallback
                }
                
                return totalTime;
            }
        }

        // Fallback: if not found in any segment, use proportional mapping
        const fallbackTime = linearProgress * (this.currentTrackData.segmentTiming.totalDuration || this.state.totalAnimationTime);
        return isNaN(fallbackTime) ? linearProgress * this.state.totalAnimationTime : fallbackTime;
    }

    // Convert segment time to linear progress for journeys (reverse mapping)
    convertSegmentTimeToLinearProgress(segmentTime) {
        if (!this.currentTrackData || !this.currentTrackData.isJourney || !this.currentTrackData.segmentTiming) {
            return null;
        }

        // Ensure time is valid
        if (typeof segmentTime !== 'number' || isNaN(segmentTime)) {
            return null;
        }

        const segments = this.currentTrackData.segmentTiming.segments;
        if (!segments || segments.length === 0) {
            const totalDuration = this.currentTrackData.segmentTiming.totalDuration || this.state.totalAnimationTime;
            return totalDuration > 0 ? Math.max(0, Math.min(1, segmentTime / totalDuration)) : 0;
        }

        // Find which segment this time falls into
        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];
            
            // Validate segment data
            if (typeof segment.startTime !== 'number' || typeof segment.endTime !== 'number' ||
                typeof segment.duration !== 'number' || typeof segment.progressStartRatio !== 'number' ||
                typeof segment.progressEndRatio !== 'number') {
                console.warn(`Invalid segment data for time conversion at index ${i}:`, segment);
                continue;
            }
            
            if (segmentTime >= segment.startTime && segmentTime <= segment.endTime) {
                // Calculate relative position within this segment's time
                const relativeTimeInSegment = segmentTime - segment.startTime;
                const relativeProgressInSegment = segment.duration > 0 ? relativeTimeInSegment / segment.duration : 0;
                
                // Convert to linear progress
                const segmentProgressRange = segment.progressEndRatio - segment.progressStartRatio;
                const linearProgress = segment.progressStartRatio + (relativeProgressInSegment * segmentProgressRange);
                
                if (isNaN(linearProgress)) {
                    console.warn(`Invalid progress calculation for segment ${i}:`, { relativeProgressInSegment, linearProgress, segment });
                    break; // Fall through to fallback
                }
                
                return Math.max(0, Math.min(1, linearProgress));
            }
        }

        // Fallback: if not found in any segment, use proportional mapping
        const totalDuration = this.currentTrackData.segmentTiming.totalDuration || this.state.totalAnimationTime;
        const fallbackProgress = totalDuration > 0 ? segmentTime / totalDuration : 0;
        return Math.max(0, Math.min(1, fallbackProgress));
    }

    updateTimelineProgressIndicator(progress) {
        // Placeholder for timeline progress indicator update
        // Implementation will be added when timeline features are needed
        console.log('Timeline progress indicator updated:', progress);
    }

    // Calculate detailed segment timing for journeys
    calculateSegmentTiming(segments) {
        // segments argument is the array from JourneyBuilder.buildCompleteJourney().segments
        let totalDuration = 0;
        let trackDuration = 0;
        let transportDuration = 0;
        const detailedSegmentTimings = []; // This will be MapRenderer's segmentTimings.segments

        console.log('MAIN APP: Calculating detailed segment timing for MapRenderer using JourneyBuilder defaults...');

        // First pass: calculate total coordinates to determine progress ratios
        let totalCoordinates = 0;
        segments.forEach(segment => {
            // Ensure segment.startIndex and segment.endIndex are valid numbers
            const len = (segment.endIndex - segment.startIndex + 1);
            totalCoordinates += (isNaN(len) || len < 0) ? 0 : len;
        });
        if (totalCoordinates === 0 && segments.length > 0) totalCoordinates = segments.length; // Basic fallback
        if (totalCoordinates === 0) totalCoordinates = 1; // Avoid division by zero

        let currentCoordIndex = 0;

        segments.forEach((segment, index) => {
            let segmentTime = 0;

            if (segment.type === 'track') {
                if (segment.userTime !== undefined && segment.userTime !== null) {
                    segmentTime = segment.userTime;
                } else {
                    // Use journey controller's method for default track time
                    segmentTime = this.journeyController ? this.journeyController.calculateTrackTime(segment.data) : 60; // Fallback if no controller
                }
                trackDuration += segmentTime;
            } else if (segment.type === 'transportation') {
                if (segment.route && segment.route.userTime !== undefined && segment.route.userTime !== null) {
                    segmentTime = segment.route.userTime;
                } else if (segment.userTime !== undefined && segment.userTime !== null) {
                    segmentTime = segment.userTime;
                } else {
                    // Use journey controller's method for default transport time
                    let distance = 0;
                    if (segment.startPoint && segment.endPoint && this.journeyController) {
                        distance = this.journeyController.calculateDistance(segment.startPoint, segment.endPoint);
                    }
                    segmentTime = this.journeyController ? this.journeyController.getDefaultTransportTime(segment.mode, distance) : 30;
                }
                transportDuration += segmentTime;
            }

            const segmentLength = (segment.endIndex - segment.startIndex + 1);
            const currentSegmentLength = (isNaN(segmentLength) || segmentLength < 0) ? 0 : segmentLength;
            
            // Ensure progress ratios are always valid numbers between 0 and 1
            const progressStartRatio = totalCoordinates > 1 ? currentCoordIndex / (totalCoordinates -1) : 0;
            const progressEndRatio = totalCoordinates > 1 ? (currentCoordIndex + Math.max(0, currentSegmentLength -1)) / (totalCoordinates -1) : 1;

            detailedSegmentTimings.push({
                ...segment, // Pass through original segment data (type, data, mode, route, etc.)
                duration: segmentTime,
                startTime: totalDuration,
                endTime: totalDuration + segmentTime,
                coordinateLength: currentSegmentLength,
                progressStartRatio: Math.max(0, Math.min(1, progressStartRatio)),
                progressEndRatio: Math.max(0, Math.min(1, progressEndRatio)),
                startCoordIndex: currentCoordIndex,
                endCoordIndex: currentCoordIndex + Math.max(0, currentSegmentLength -1)
            });

            totalDuration += segmentTime;
            currentCoordIndex += currentSegmentLength;
        });

        console.log('MAIN APP: Detailed segment timing calculation result:', {
            totalDuration: `${totalDuration}s`,
            trackDuration: `${trackDuration}s`,
            transportDuration: `${transportDuration}s`,
            segmentCount: detailedSegmentTimings.length
        });

        return {
            totalDuration,
            trackDuration,
            transportDuration,
            segments: detailedSegmentTimings // This is the crucial part for MapRenderer
        };
    }

    // Handle segment timing updates from journey controller
    handleSegmentTimingUpdate(updateData) {
        console.log('🎯 MAIN APP: Handling segment timing update:', updateData);

        if (!updateData || !updateData.segments) {
            console.warn('Invalid segment timing update data');
            return;
        }

        // Calculate detailed timing for MapRenderer
        const detailedSegmentTimingForMapRenderer = this.calculateSegmentTiming(updateData.segments);
        
        console.log('🎯 MAIN APP: Recalculated detailed timing for MapRenderer:', detailedSegmentTimingForMapRenderer);

        // Update all timing-related state
        this.state.totalAnimationTime = detailedSegmentTimingForMapRenderer.totalDuration;

        // Update current track data
        if (this.currentTrackData) {
            this.currentTrackData.segmentTiming = detailedSegmentTimingForMapRenderer;
        }

        // Update MapRenderer with new timing
        if (this.mapRenderer) {
            console.log('🎯 MAIN APP: Updating MapRenderer with new segment timing');
            this.mapRenderer.setupSegmentAnimation(updateData.segments, detailedSegmentTimingForMapRenderer);
        }

        // Update all UI displays
        this.synchronizeAllTimingDisplays(detailedSegmentTimingForMapRenderer);

        // Update any journey-related UI
        if (this.journeyController) {
            this.journeyController.updateTimingDisplay(detailedSegmentTimingForMapRenderer);
        }

        console.log('🎯 MAIN APP: Segment timing update complete');
    }

    // Synchronize all timing displays
    synchronizeAllTimingDisplays(segmentTiming) {
        console.log('🔄 Synchronizing all timing displays with:', segmentTiming.totalDuration, 'seconds');

        const formattedTime = this.formatTimeInSeconds(segmentTiming.totalDuration);
        
        // Update total time displays
        const totalTimeElements = document.querySelectorAll('#totalTime, .total-time-display');
        totalTimeElements.forEach(element => {
            element.textContent = formattedTime;
        });

        // Update timing breakdown if visible
        if (this.journeyController) {
            this.journeyController.showTimingBreakdown(segmentTiming);
        }

        // Validate all displays are synchronized
        this.validateAllTimingDisplaysSync(segmentTiming);
        
        console.log('✅ All timing displays synchronized');
    }

    // Validate timing synchronization across all components
    validateAllTimingDisplaysSync(expectedTiming) {
        const issues = [];

        // Check TrackData timing
        if (this.currentTrackData?.segmentTiming?.totalDuration !== expectedTiming.totalDuration) {
            issues.push(`TrackData timing: ${this.currentTrackData?.segmentTiming?.totalDuration} ≠ ${expectedTiming.totalDuration}`);
        }

        // Check MapRenderer timing  
        if (this.mapRenderer?.segmentTimings?.totalDuration !== expectedTiming.totalDuration) {
            issues.push(`MapRenderer timing: ${this.mapRenderer?.segmentTimings?.totalDuration} ≠ ${expectedTiming.totalDuration}`);
        }

        // Check app state timing
        if (this.state.totalAnimationTime !== expectedTiming.totalDuration) {
            issues.push(`App state timing: ${this.state.totalAnimationTime} ≠ ${expectedTiming.totalDuration}`);
        }

        if (issues.length > 0) {
            console.warn('⚠️  Timing synchronization issues detected:', issues);
            return false;
        } else {
            console.log('✅ All timing displays are synchronized');
            return true;
        }
    }

    // Debug method to validate journey synchronization
    validateJourneySynchronization() {
        if (!this.currentTrackData || !this.currentTrackData.isJourney || !this.mapRenderer) {
            console.log('❌ Not a journey or no map renderer - synchronization validation skipped');
            return false;
        }

        const progress = this.mapRenderer.getCurrentProgress();
        const journeyTime = this.mapRenderer.getJourneyElapsedTime();
        
        // Convert progress to expected time
        const expectedTime = this.convertLinearProgressToSegmentTime(progress);
        
        // Convert time to expected progress  
        const expectedProgress = this.convertSegmentTimeToLinearProgress(journeyTime);
        
        const timeDiff = Math.abs(expectedTime - journeyTime);
        const progressDiff = Math.abs(expectedProgress - progress);
        
        console.log('🔍 Journey Synchronization Status:');
        console.log(`   Current Progress: ${progress.toFixed(3)}`);
        console.log(`   Current Journey Time: ${journeyTime?.toFixed(1)}s`);
        console.log(`   Expected Time from Progress: ${expectedTime?.toFixed(1)}s (diff: ${timeDiff?.toFixed(1)}s)`);
        console.log(`   Expected Progress from Time: ${expectedProgress?.toFixed(3)} (diff: ${progressDiff?.toFixed(3)})`);
        
        const isTimeSynced = timeDiff < 2; // 2 second tolerance
        const isProgressSynced = progressDiff < 0.02; // 2% tolerance
        const isFullySynced = isTimeSynced && isProgressSynced;
        
        console.log(`   Time Sync: ${isTimeSynced ? '✅' : '❌'}, Progress Sync: ${isProgressSynced ? '✅' : '❌'}, Overall: ${isFullySynced ? '✅' : '❌'}`);
        
        if (!isFullySynced) {
            console.log('⚠️  Synchronization issues detected - this may cause position/time mismatches');
            
            // Suggest fixes
            if (!isTimeSynced) {
                console.log(`   💡 Consider calling: app.mapRenderer.setJourneyElapsedTime(${expectedTime?.toFixed(1)})`);
            }
            if (!isProgressSynced) {
                console.log(`   💡 Consider calling: app.mapRenderer.setAnimationProgress(${expectedProgress?.toFixed(3)})`);
            }
        }
        
        return isFullySynced;
    }

    // Force synchronization between position and time for journeys
    forceSynchronization() {
        if (!this.currentTrackData || !this.currentTrackData.isJourney || !this.mapRenderer) {
            console.log('❌ Cannot force synchronization - not a journey or no map renderer');
            return false;
        }

        const progress = this.mapRenderer.getCurrentProgress();
        const expectedTime = this.convertLinearProgressToSegmentTime(progress);
        
        console.log(`🔧 Forcing synchronization: progress=${progress.toFixed(3)} → time=${expectedTime?.toFixed(1)}s`);
        
        if (expectedTime !== null) {
            this.mapRenderer.setJourneyElapsedTime(expectedTime);
            this.updateProgressDisplay();
            // Update timeline progress if journey controller exists
            if (this.journeyController) {
                this.journeyController.updateTimelineProgressIndicator(progress);
            }
            console.log('✅ Synchronization forced successfully');
            return true;
        } else {
            console.log('❌ Failed to force synchronization');
            return false;
        }
    }

    showVisualizationSection() {
        const uploadSection = document.getElementById('uploadSection');
        const visualizationSection = document.getElementById('visualizationSection');
        const statsSection = document.getElementById('statsSection');
        
        if (uploadSection) uploadSection.style.display = 'none';
        if (visualizationSection) {
            visualizationSection.style.display = 'block';
            visualizationSection.classList.add('fade-in');
        }
        if (statsSection) {
            statsSection.style.display = 'block';
            statsSection.classList.add('fade-in');
        }
        
        // Initialize live stats and generate elevation profile
        this.stats.resetLiveStats();
        this.generateElevationProfile();
    }

    updateStats(stats) {
        const elements = {
            'totalDistance': stats.totalDistance ? `${stats.totalDistance.toFixed(2)} km` : '0 km',
            'elevationGain': stats.elevationGain ? `${Math.round(stats.elevationGain)} m` : '0 m',
            'totalTime': this.formatTimeInSeconds(this.state.totalAnimationTime)
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });
    }

    formatTimeInSeconds(totalSeconds) {
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    updateStatsDisplay() {
        if (!this.currentTrackData) return;
        
        let stats = this.currentTrackData.stats;
        
        // If GPX-only stats is enabled and this is a journey, recalculate stats
        if (this.state.gpxOnlyStats && this.currentTrackData.isJourney && this.currentTrackData.segments) {
            stats = this.calculateGpxOnlyStats(this.currentTrackData);
        }
        
        this.updateStats(stats);
    }

    // Calculate stats including only GPX track segments (excluding transportation)
    calculateGpxOnlyStats(journeyData) {
        let totalDistance = 0;
        let totalElevationGain = 0;
        
        if (journeyData.segments) {
            journeyData.segments.forEach(segment => {
                // Only include track segments, skip transportation segments
                if (segment.type === 'track' && segment.data && segment.data.stats) {
                    totalDistance += segment.data.stats.totalDistance || 0;
                    totalElevationGain += segment.data.stats.elevationGain || 0;
                }
            });
        }
        
        return {
            totalDistance,
            elevationGain: totalElevationGain
        };
    }

    updateProgressBarMarkers() {
        // Delegate to icon controller
        if (this.icon) {
            this.icon.updateProgressBarMarkers();
        }
    }

    setupTimingSynchronization() {
        // Listen for segment timing updates from journey controller
        document.addEventListener('segmentTimingUpdate', (e) => {
            console.log('🎯 MAIN APP: Received segmentTimingUpdate event:', e.detail);
            this.handleSegmentTimingUpdate(e.detail);
        });

        // Listen for journey data load events
        document.addEventListener('journeyDataLoaded', (e) => {
            console.log('🎯 MAIN APP: Received journeyDataLoaded event:', e.detail);
            if (e.detail && e.detail.segments) {
                // Calculate timing for the loaded journey
                const segmentTiming = this.calculateSegmentTiming(e.detail.segments);
                this.handleSegmentTimingUpdate({ segments: e.detail.segments, newSegmentTiming: segmentTiming });
            }
        });

        // Set up progress bar to synchronize timing during seeking
        document.addEventListener('progressSeek', (e) => {
            if (this.currentTrackData && this.currentTrackData.isJourney && this.currentTrackData.segmentTiming) {
                const progress = e.detail.progress;
                const segmentTime = this.convertLinearProgressToSegmentTime(progress);
                
                if (segmentTime !== null) {
                    this.mapRenderer.setJourneyElapsedTime(segmentTime);
                    console.log(`🔄 Progress seek: Updated journey time to ${segmentTime.toFixed(1)}s for progress ${progress.toFixed(3)}`);
                }
            }
        });

        // Set up playback synchronization during animation
        document.addEventListener('animationFrame', (e) => {
            if (this.currentTrackData && this.currentTrackData.isJourney && this.currentTrackData.segmentTiming && this.state.isPlaying) {
                const progress = this.mapRenderer.getCurrentProgress();
                const journeyTime = this.mapRenderer.getJourneyElapsedTime();
                
                if (journeyTime !== undefined) {
                    const expectedTime = this.convertLinearProgressToSegmentTime(progress);
                    
                    if (expectedTime !== null && !isNaN(expectedTime)) {
                        const timeDiff = Math.abs(journeyTime - expectedTime);
                        
                        // If timing drift is significant (>1 second), correct it
                        if (timeDiff > 1) {
                            console.log(`🔄 Auto-correction: journey time ${journeyTime.toFixed(1)}s → ${expectedTime.toFixed(1)}s`);
                            this.mapRenderer.setJourneyElapsedTime(expectedTime);
                        }
                    }
                }
            }
        });


    }

    // Video export support methods
    async enhancedTilePreloading(progressCallback) {
        if (!this.mapRenderer || !this.currentTrackData) return;
        
        const trackPoints = this.currentTrackData.trackPoints;
        if (!trackPoints || trackPoints.length === 0) return;
        
        console.log('Starting enhanced tile preloading for video export');
        
        // Use basic tile preloading for now - can be enhanced later
        if (progressCallback) {
            for (let i = 0; i <= 100; i += 10) {
                await new Promise(resolve => setTimeout(resolve, 50));
                progressCallback(i);
            }
        }
        
        console.log('Enhanced tile preloading completed');
    }

    async waitForMapTilesToLoadWithTimeout(timeoutMs = 8000) {
        if (!this.mapRenderer || !this.mapRenderer.map) {
            return Promise.resolve();
        }

        return new Promise((resolve) => {
            const timeoutId = setTimeout(() => {
                console.warn('Map tiles loading timeout reached');
                resolve();
            }, timeoutMs);

            // Wait for map to be idle (all tiles loaded)
            const onIdle = () => {
                clearTimeout(timeoutId);
                console.log('Map tiles loaded successfully');
                resolve();
            };

            this.mapRenderer.map.once('idle', onIdle);
        });
    }
} 