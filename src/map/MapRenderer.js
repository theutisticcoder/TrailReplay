/**
 * MapRenderer - Main map rendering class (refactored for modularity)
 */
import maplibregl from 'maplibre-gl';
import { GPXParser } from '../gpxParser.js';
import { MapUtils } from './MapUtils.js';
import { MapAnnotations } from './MapAnnotations.js';
import { MapIconChanges } from './MapIconChanges.js';
import { MapPictureAnnotations } from './MapPictureAnnotations.js';
import { FollowBehindCamera } from './FollowBehindCamera.js';
import { DEFAULT_SETTINGS } from '../utils/constants.js';
// TODO: Import other modules as they are created

export class MapRenderer {
    constructor(container, app = null) {
        this.container = container;
        this.app = app;
        this.map = null;
        this.trackData = null;
        this.animationMarker = null;
        this.isAnimating = false;
        this.animationProgress = 0;
        this.animationSpeed = 1;
        this.currentActivityType = 'running';
        this.pathColor = '#C1652F';
        this.markerSize = DEFAULT_SETTINGS.DEFAULT_MARKER_SIZE;
        this.autoZoom = true;
        this.showCircle = true;
        this.showMarker = false; // Disabled by default for more professional look
        this.showEndStats = true;
        
        // Comparison mode properties
        this.comparisonTrackData = null;
        this.comparisonGpxParser = null;
        this.currentIcon = '🏃‍♂️';
        this.userSelectedBaseIcon = null; // Stores user's custom base icon choice
        this.gpxParser = new GPXParser();
        
        // Segment-aware animation properties
        this.segmentTimings = null;
        this.currentSegmentIndex = 0;
        this.segmentProgress = 0;
        this.lastAnimationTime = 0;
        this.journeyElapsedTime = 0;
        
        // Track 3D mode state
        this.is3DMode = false;
        this.currentTerrainSource = 'mapzen';
        
        // Camera mode properties
        this.cameraMode = 'followBehind'; // 'standard' or 'followBehind' - followBehind is default
        
        // Performance mode for video recording
        this.performanceMode = false;
        
        // Initialize modular components AFTER other properties are set
        this.annotations = new MapAnnotations(this);
        this.iconChanges = new MapIconChanges(this);
        this.pictureAnnotations = new MapPictureAnnotations(this);
        this.followBehindCamera = new FollowBehindCamera(this);
        
        // Ensure proper method binding for icon changes
        if (this.iconChanges && typeof this.iconChanges.checkIconChanges === 'function') {
            // Explicitly bind the method to ensure it's available
            this.iconChanges.checkIconChanges = this.iconChanges.checkIconChanges.bind(this.iconChanges);
        }
        
        this.initializeMap();

        // Add resize event listener for dynamic layout detection
        this.setupResizeListener();

        // Initialize default camera mode after a brief delay
        setTimeout(() => {
            this.initializeCameraMode();
            // Detect initial layout after map is fully loaded
            setTimeout(() => {
                this.detectAndSetMapLayout();
            }, 500);
        }, 100);
        this.preloadedTiles = new Set(); // Track preloaded tile URLs
        this.currentMapStyle = 'satellite'; // Track current style for preloading
    }

    initializeMap() {
        // Initialize MapLibre GL JS with free tile sources
        this.map = new maplibregl.Map({
            container: this.container,
            style: {
                version: 8,
                sources: {
                    'osm': {
                        type: 'raster',
                        tiles: [
                            'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
                        ],
                        tileSize: 256,
                        attribution: '© OpenStreetMap contributors'
                    },
                    // --- OpenTopoMap (topographic/terrain) ---
                    'opentopomap': {
                        type: 'raster',
                        tiles: [
                            'https://a.tile.opentopomap.org/{z}/{x}/{y}.png'
                        ],
                        tileSize: 256,
                        attribution: '© OpenTopoMap (CC-BY-SA)'
                    },
                    'satellite': {
                        type: 'raster',
                        tiles: [
                            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                        ],
                        tileSize: 256,
                        attribution: '© Esri'
                    },
                    'carto-labels': {
                        type: 'raster',
                        tiles: [
                            'https://cartodb-basemaps-a.global.ssl.fastly.net/light_only_labels/{z}/{x}/{y}.png'
                        ],
                        tileSize: 256,
                        attribution: '© CartoDB'
                    }
                },
                layers: [
                    {
                        id: 'background',
                        type: 'raster',
                        source: 'satellite'
                    },
                    // CartoDB labels above satellite (initially hidden)
                    {
                        id: 'carto-labels',
                        type: 'raster',
                        source: 'carto-labels',
                        layout: { visibility: 'none' }
                    },
                    // --- OpenTopoMap layer (initially hidden) ---
                    {
                        id: 'opentopomap',
                        type: 'raster',
                        source: 'opentopomap',
                        layout: { visibility: 'none' }
                    },
                    // OSM street layer (initially hidden)
                    {
                        id: 'street',
                        type: 'raster',
                        source: 'osm',
                        layout: { visibility: 'none' }
                    }
                ]
            },
            center: [0, 0],
            zoom: 2,
            pitch: 0,
            bearing: 0,
            maxPitch: 85,
            antialias: true,
            preserveDrawingBuffer: true
        });

        this.map.on('load', () => {
            this.setupMapLayers();
            // Allow zooming before animation starts in follow-behind mode
            if (this.cameraMode === 'followBehind' && !this.isAnimating) {
                this.enableZoomOnlyInteractions();
            }
            // Initialize marker-dependent controls state
            this.updateMarkerDependentControls(this.showMarker);
            
            // Initialize elevation profile color
            const progressPath = document.getElementById('progressPath');
            if (progressPath) {
                progressPath.setAttribute('stroke', this.pathColor);
            }
            
            // Initialize elevation profile gradient
            this.updateElevationGradient(this.pathColor);
        });

        // Add click handler for annotations and icon changes
        this.map.on('click', (e) => {
            if (this.isAnnotationMode) {
                this.annotations.handleAnnotationClick(e);
            } else if (this.isIconChangeMode) {
                // Stop event propagation to prevent modal from closing immediately
                e.originalEvent?.stopPropagation();
                this.iconChanges.handleIconChangeClick(e);
            }
        });

        // Change cursor when in special modes
        this.map.on('mouseenter', () => {
            if (this.isAnnotationMode || this.isIconChangeMode) {
                this.map.getCanvas().style.cursor = 'crosshair';
            } else {
                this.map.getCanvas().style.cursor = '';
            }
        });

        // Also update cursor on mousemove to ensure it stays correct
        this.map.on('mousemove', () => {
            if (this.isAnnotationMode || this.isIconChangeMode) {
                if (this.map.getCanvas().style.cursor !== 'crosshair') {
                    this.map.getCanvas().style.cursor = 'crosshair';
                }
            } else {
                if (this.map.getCanvas().style.cursor === 'crosshair') {
                    this.map.getCanvas().style.cursor = '';
                }
            }
        });
    }

    setupMapLayers() {
        // Add sources for trail visualization
        this.map.addSource('trail-line', {
            type: 'geojson',
            data: {
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: []
                }
            }
        });

        this.map.addSource('trail-completed', {
            type: 'geojson',
            data: {
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: []
                }
            }
        });

        this.map.addSource('current-position', {
            type: 'geojson',
            data: {
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [0, 0]
                }
            }
        });

        this.map.addSource('annotations', {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features: []
            }
        });

        // Add trail line layer with data-driven styling for segments
        this.map.addLayer({
            id: 'trail-line',
            type: 'line',
            source: 'trail-line',
            layout: {
                'line-join': 'round',
                'line-cap': 'round'
            },
            paint: {
                'line-color': [
                    'case',
                    ['==', ['get', 'isTransportation'], true],
                    [
                        'case',
                        ['==', ['get', 'segmentMode'], 'car'], '#ff6b6b',
                        ['==', ['get', 'segmentMode'], 'driving'], '#ff6b6b',
                        ['==', ['get', 'segmentMode'], 'boat'], '#4ecdc4',
                        ['==', ['get', 'segmentMode'], 'plane'], '#ffe66d',
                        ['==', ['get', 'segmentMode'], 'train'], '#a8e6cf',
                        ['==', ['get', 'segmentMode'], 'walk'], '#ff9f43',
                        ['==', ['get', 'segmentMode'], 'cycling'], '#48cae4',
                        '#ff6b6b' // default transportation color
                    ],
                    this.pathColor // default color for GPX tracks
                ],
                'line-width': [
                    'case',
                    ['==', ['get', 'isTransportation'], true], 6,
                    4
                ],
                'line-opacity': [
                    'case',
                    ['==', ['get', 'isTransportation'], true], 0.7,
                    0.4
                ],
                'line-dasharray': [1, 0]
            }
        });

        // Add completed trail layer
        this.map.addLayer({
            id: 'trail-completed',
            type: 'line',
            source: 'trail-completed',
            layout: {
                'line-join': 'round',
                'line-cap': 'round'
            },
            paint: {
                'line-color': this.pathColor,
                'line-width': 5,
                'line-opacity': 0.8
            }
        });

        // Add current position glow
        this.map.addLayer({
            id: 'current-position-glow',
            type: 'circle',
            source: 'current-position',
            paint: {
                'circle-radius': 15 * this.markerSize,
                'circle-color': this.pathColor,
                'circle-opacity': 0.3
            }
        });

        // Create and add activity icon layer
        this.createAndAddActivityIcon();

        // Add annotations layer (hidden initially)
        this.map.addLayer({
            id: 'annotations',
            type: 'circle',
            source: 'annotations',
            paint: {
                'circle-radius': 8,
                'circle-color': '#4ecdc4',
                'circle-stroke-color': '#ffffff',
                'circle-stroke-width': 2,
                'circle-opacity': 0
            }
        });
    }

    // Delegate annotation methods to the annotations module
    enableAnnotationMode() {
        if (this.annotations && typeof this.annotations.enableAnnotationMode === 'function') {
        return this.annotations.enableAnnotationMode();
        } else {
            console.error('annotations.enableAnnotationMode not available');
        }
    }

    disableAnnotationMode() {
        if (this.annotations && typeof this.annotations.disableAnnotationMode === 'function') {
        return this.annotations.disableAnnotationMode();
        } else {
            console.error('annotations.disableAnnotationMode not available');
        }
    }

    addAnnotation(progress, title, description, icon = '📍') {
        if (this.annotations && typeof this.annotations.addAnnotation === 'function') {
        return this.annotations.addAnnotation(progress, title, description, icon);
        } else {
            console.error('annotations.addAnnotation not available');
            return null;
        }
    }

    removeAnnotation(id) {
        if (this.annotations && typeof this.annotations.removeAnnotation === 'function') {
        return this.annotations.removeAnnotation(id);
        } else {
            console.error('annotations.removeAnnotation not available');
        }
    }

    getAnnotations() {
        if (this.annotations && typeof this.annotations.getAnnotations === 'function') {
            return this.annotations.getAnnotations();
        } else {
            console.error('annotations.getAnnotations not available');
            return [];
        }
    }

    // Picture annotation methods
    addPictureAnnotation(progress, title, description, imageData, displayDuration = 3000) {
        if (this.pictureAnnotations && typeof this.pictureAnnotations.addPictureAnnotation === 'function') {
            return this.pictureAnnotations.addPictureAnnotation(progress, title, description, imageData, displayDuration);
        } else {
            console.error('pictureAnnotations.addPictureAnnotation not available');
            return null;
        }
    }

    getPictureAnnotations() {
        if (this.pictureAnnotations && typeof this.pictureAnnotations.getPictureAnnotations === 'function') {
            return this.pictureAnnotations.getPictureAnnotations();
        } else {
            console.error('pictureAnnotations.getPictureAnnotations not available');
            return [];
        }
    }

    removePictureAnnotation(id) {
        if (this.pictureAnnotations && typeof this.pictureAnnotations.removePictureAnnotation === 'function') {
            return this.pictureAnnotations.removePictureAnnotation(id);
        } else {
            console.error('pictureAnnotations.removePictureAnnotation not available');
        }
    }

    // Delegate icon change methods to the iconChanges module
    enableIconChangeMode() {
        if (this.iconChanges && typeof this.iconChanges.enableIconChangeMode === 'function') {
        return this.iconChanges.enableIconChangeMode();
        }
    }

    disableIconChangeMode() {
        if (this.iconChanges && typeof this.iconChanges.disableIconChangeMode === 'function') {
        return this.iconChanges.disableIconChangeMode();
        }
    }

    addIconChange(progress, icon) {
        if (this.iconChanges && typeof this.iconChanges.addIconChange === 'function') {
        return this.iconChanges.addIconChange(progress, icon);
        } else {
            console.error('iconChanges.addIconChange not available');
            return null;
        }
    }

    removeIconChange(id) {
        if (this.iconChanges && typeof this.iconChanges.removeIconChange === 'function') {
        return this.iconChanges.removeIconChange(id);
        } else {
            console.error('iconChanges.removeIconChange not available');
        }
    }

    getIconChanges() {
        if (this.iconChanges && typeof this.iconChanges.getIconChanges === 'function') {
            return this.iconChanges.getIconChanges();
        } else {
            console.error('iconChanges.getIconChanges not available');
            return [];
        }
    }

    clearIconChanges() {
        if (this.iconChanges && this.iconChanges.iconChanges) {
            this.iconChanges.iconChanges = [];
        }
    }

    // Activity type and icon management
    setActivityType(activityType) {
        this.currentActivityType = activityType;
        this.currentIcon = this.getBaseIcon();
        
        if (this.map && this.map.loaded()) {
            this.updateActivityIcon();
        }
    }

    setCurrentIcon(icon) {
        this.currentIcon = icon;
        
        // If not currently animating/playing, save this as the user's preferred base icon
        // This ensures it persists when playback starts
        if (!this.isAnimating) {
            console.log('💾 Setting user base icon to:', icon);
            this.userSelectedBaseIcon = icon;
        }
        
        if (this.map && this.map.loaded()) {
            this.updateActivityIcon();
        }
        
        const iconUpdateEvent = new CustomEvent('currentIconUpdated', {
            detail: { icon }
        });
        document.dispatchEvent(iconUpdateEvent);
    }

    // Clear user's custom base icon and return to activity-based icon
    clearUserBaseIcon() {
        console.log('🔄 Clearing user base icon, returning to activity-based icon');
        this.userSelectedBaseIcon = null;
        const activityIcon = this.getBaseIcon(); // Will now return activity-based icon
        this.setCurrentIcon(activityIcon);
    }

    // Map styling methods
    setPathColor(color) {
        this.pathColor = color;
        
        if (this.map.loaded()) {
            this.map.setPaintProperty('trail-line', 'line-color', color);
            this.map.setPaintProperty('trail-completed', 'line-color', color);
            this.map.setPaintProperty('current-position-glow', 'circle-color', color);
        }
        
        // Update elevation profile progress color
        const progressPath = document.getElementById('progressPath');
        if (progressPath) {
            progressPath.setAttribute('stroke', color);
        }
        
        // Update elevation profile gradient colors
        this.updateElevationGradient(color);
    }

    updateElevationGradient(baseColor) {
        // Convert hex color to RGB for manipulation
        const hexToRgb = (hex) => {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : null;
        };

        const rgb = hexToRgb(baseColor);
        if (!rgb) return;

        // Create lighter variants of the base color for gradient
        const lighten = (r, g, b, factor) => {
            return {
                r: Math.min(255, Math.round(r + (255 - r) * factor)),
                g: Math.min(255, Math.round(g + (255 - g) * factor)),
                b: Math.min(255, Math.round(b + (255 - b) * factor))
            };
        };

        const rgbToHex = (r, g, b) => {
            return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
        };

        // Generate gradient colors
        const midColor = lighten(rgb.r, rgb.g, rgb.b, 0.3);
        const lightColor = lighten(rgb.r, rgb.g, rgb.b, 0.6);

        const midColorHex = rgbToHex(midColor.r, midColor.g, midColor.b);
        const lightColorHex = rgbToHex(lightColor.r, lightColor.g, lightColor.b);

        // Update gradient stops
        const progressGradient = document.getElementById('progressGradient');
        if (progressGradient) {
            const stops = progressGradient.querySelectorAll('stop');
            if (stops.length >= 3) {
                stops[0].setAttribute('style', `stop-color:${baseColor};stop-opacity:0.9`);
                stops[1].setAttribute('style', `stop-color:${midColorHex};stop-opacity:0.7`);
                stops[2].setAttribute('style', `stop-color:${lightColorHex};stop-opacity:0.5`);
            }
        }

        // Update speed profile gradient stops
        const speedProgressGradient = document.getElementById('speedProgressGradient');
        if (speedProgressGradient) {
            const stops = speedProgressGradient.querySelectorAll('stop');
            if (stops.length >= 3) {
                stops[0].setAttribute('style', `stop-color:${baseColor};stop-opacity:0.9`);
                stops[1].setAttribute('style', `stop-color:${midColorHex};stop-opacity:0.7`);
                stops[2].setAttribute('style', `stop-color:${lightColorHex};stop-opacity:0.5`);
            }
        }

        // Update speed background path stroke color
        const speedBackgroundPath = document.getElementById('speedBackgroundPath');
        if (speedBackgroundPath) {
            speedBackgroundPath.setAttribute('stroke', baseColor);
        }
    }

    setMarkerSize(size) {
        this.markerSize = size;
        
        if (this.map.loaded()) {
            this.map.setPaintProperty('current-position-glow', 'circle-radius', 15 * size);
            if (this.map.getLayer('activity-icon') && this.showMarker) {
                this.map.setLayoutProperty('activity-icon', 'icon-size', size);
            }
            this.updateActivityIcon();
        }
    }

    setAutoZoom(enabled) {
        this.autoZoom = enabled;
    }

    setShowCircle(enabled) {
        this.showCircle = enabled;
        
        if (this.map && this.map.loaded()) {
            this.updateActivityIcon();
        }
    }

    setShowMarker(enabled) {
        this.showMarker = enabled;
        
        if (this.map && this.map.loaded()) {
            this.updateMarkerVisibility();
        }
        
        // Update UI controls that depend on marker visibility
        this.updateMarkerDependentControls(enabled);
    }

    setShowEndStats(enabled) {
        this.showEndStats = enabled;
        console.log('🎯 End stats visibility set to:', enabled);
    }

    setAnimationSpeed(speed) {
        this.animationSpeed = speed;
    }

    getBaseIcon() {
        // If user has selected a custom base icon, use that
        if (this.userSelectedBaseIcon) {
            return this.userSelectedBaseIcon;
        }
        
        // Otherwise, return activity-based icon
        const icons = {
            'running': '🏃‍♂️',
            'cycling': '🚴‍♂️',
            'swimming': '🏊‍♂️',
            'hiking': '🥾',
            'triathlon': '🏆'
        };
        return icons[this.currentActivityType] || icons['running'];
    }

    getAnimationProgress() {
        return this.animationProgress;
    }

    getCurrentProgress() {
        return this.animationProgress;
    }

    ensureGPXParserReady() {
        if (!this.trackData || !this.trackData.trackPoints) {
            console.error('No track data available for GPX parser');
            return false;
        }
        
        // Use original track data
        let trackPoints = this.trackData.trackPoints;
        
        if (!this.gpxParser.trackPoints || this.gpxParser.trackPoints !== trackPoints) {
            this.gpxParser.trackPoints = trackPoints;
        }
        
        return true;
    }

    loadTrack(trackData) {
        this.trackData = trackData;
        
        // Use optimized track data if available, otherwise fall back to original
        const trackPoints = trackData.trackPoints || [];
        if (trackPoints.length === 0) {
            return;
        }

        // Create GeoJSON for the trail with elevation data
        const coordinates = trackPoints.map(point => {
            const elevation = point.elevation || 0;
            return [point.lon, point.lat, elevation];
        });
        
        // Handle journey segments if available
        if (trackData.isJourney && trackData.segments) {
            this.loadJourneySegments(trackData, coordinates);
        } else {
            // Standard single track
            const trailLineData = {
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: coordinates
                },
                properties: {
                    distance: trackData.stats.totalDistance,
                    elevation: trackData.stats.elevationGain
                }
            };

            this.map.getSource('trail-line').setData(trailLineData);
        }

        // Fit map to trail bounds
        // Center the map on the track without changing zoom
        if (trackData.bounds && 
            !isNaN(trackData.bounds.west) && !isNaN(trackData.bounds.south) && 
            !isNaN(trackData.bounds.east) && !isNaN(trackData.bounds.north)) {
            
            const centerLon = (trackData.bounds.west + trackData.bounds.east) / 2;
            const centerLat = (trackData.bounds.south + trackData.bounds.north) / 2;
            
            // Only center the map, preserve current zoom level
            this.map.setCenter([centerLon, centerLat]);
        }

        // Reset animation 
        this.animationProgress = 0;
        if (!trackData.isJourney) {
            this.iconChanges.iconChanges = [];
        }
        this.annotations.annotations = [];
        
        // Reset follow-behind camera for new track
        this.followBehindCamera.reset();
        
        // Set current icon to the activity icon if present, otherwise base icon
        if (trackData.activityIcon) {
            this.setCurrentIcon(trackData.activityIcon);
        } else {
            this.currentIcon = this.getBaseIcon();
        }
        
        // Initialize icon if map is loaded
        if (this.map.loaded()) {
            this.updateActivityIcon();
        } else {
            this.map.once('load', () => {
                this.updateActivityIcon();
            });
        }
        
        this.updateCurrentPosition();
        
        // Apply 3D rendering if in 3D mode
        if (this.is3DMode) {
            this.update3DTrailRendering();
        }
        
        // If in follow-behind mode, automatically set up the camera for this track
        if (this.cameraMode === 'followBehind') {
            console.log('🎬 Track loaded - setting up follow-behind camera automatically');
            setTimeout(() => {
                this.followBehindCamera.initialize();
            }, 1500); // Wait for map bounds fitting to complete
        }

        // Detect and apply proper map layout based on aspect ratio
        setTimeout(() => {
            this.detectAndSetMapLayout();
        }, 200); // Small delay to ensure map container is properly sized
    }

    updateCurrentPosition() {
        // Ensure GPX parser is ready
        if (!this.ensureGPXParserReady()) {
            return;
        }
        // --- Per-segment progress calculation ---
        let globalProgress = 0;
        if (this.segmentTimings && this.segmentTimings.segments && this.segmentTimings.segments.length > 0) {
            const { segmentIndex, segmentProgress } = this.getSegmentAndLocalProgress(this.journeyElapsedTime);
            const seg = this.segmentTimings.segments[segmentIndex];
            if (this.trackData && this.trackData.trackPoints && typeof seg.startIndex === 'number' && typeof seg.endIndex === 'number') {
                const segStart = seg.startIndex;
                const segEnd = seg.endIndex;
                const segLength = segEnd - segStart;
                globalProgress = (segStart + segmentProgress * segLength) / (this.trackData.trackPoints.length - 1);
            } else {
                globalProgress = Math.min(this.journeyElapsedTime / this.segmentTimings.totalDuration, 1);
            }
        } else {
            globalProgress = this.animationProgress;
        }
        const currentPoint = this.gpxParser.getInterpolatedPoint(globalProgress);
        
        if (isNaN(currentPoint.lat) || isNaN(currentPoint.lon)) {
            console.error('NaN coordinates from interpolated point:', currentPoint, 'Progress:', globalProgress);
            return;
        }
        
        // Update current position marker
        this.map.getSource('current-position').setData({
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [currentPoint.lon, currentPoint.lat]
            },
            properties: {
                elevation: currentPoint.elevation,
                speed: currentPoint.speed,
                distance: currentPoint.distance
            }
        });

        // Update comparison position if in comparison mode
        this.updateComparisonPosition();

        // Update completed trail
        const completedCoordinates = this.trackData.trackPoints
            .slice(0, Math.floor(currentPoint.index) + 1)
            .map(point => [point.lon, point.lat]);

        this.map.getSource('trail-completed').setData({
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: completedCoordinates
            }
        });

        // Check for icon changes - ensure method is properly bound
        if (this.iconChanges && typeof this.iconChanges.checkIconChanges === 'function') {
            try {
                this.iconChanges.checkIconChanges(globalProgress);
                } catch (error) {
                console.error('Error calling checkIconChanges:', error);
            }
        }

        // Check for annotations
        if (this.annotations && typeof this.annotations.checkAnnotations === 'function') {
        this.annotations.checkAnnotations(globalProgress);
        }

        // Check for picture annotations
        if (this.pictureAnnotations && typeof this.pictureAnnotations.checkPictureAnnotations === 'function') {
            this.pictureAnnotations.checkPictureAnnotations(globalProgress);
        }

        // Auto zoom to follow the marker (always if auto zoom is enabled and we're animating)
        if (this.autoZoom && this.isAnimating) {
            if (this.cameraMode === 'followBehind') {
                // Follow-behind camera mode: delegate to FollowBehindCamera
                this.followBehindCamera.updateCameraPosition();
            } else if (this.is3DMode) {
                // Standard 3D mode, maintain the camera angle while following
                this.map.easeTo({
                    center: [currentPoint.lon, currentPoint.lat],
                    duration: this.performanceMode ? 50 : 100, // Faster transitions during recording
                    pitch: this.map.getPitch(), // Maintain current pitch
                    bearing: this.map.getBearing() // Maintain current bearing
                });
            } else {
                // Normal 2D following
                this.map.easeTo({
                    center: [currentPoint.lon, currentPoint.lat],
                    duration: this.performanceMode ? 50 : 100 // Faster transitions during recording
                });
            }
        }

        // Ensure activity icon layer exists and is visible
        this.ensureActivityIconLayer();
    }

    async startAnimation() {
        if (!this.trackData || this.isAnimating || !this.segmentTimings) {
            return;
        }
        
        if (this.segmentTimings && this.segmentTimings.totalDuration && this.journeyElapsedTime === 0) {
            this.journeyElapsedTime = this.animationProgress * this.segmentTimings.totalDuration;
        }
        
        // Reset picture annotation triggered states for a clean start
        if (this.pictureAnnotations && this.pictureAnnotations.resetTriggeredStates) {
            this.pictureAnnotations.resetTriggeredStates();
        }
        
        // If in follow-behind mode and should trigger cinematic start
        if (this.cameraMode === 'followBehind' && this.followBehindCamera.shouldTriggerCinematic() && this.animationProgress <= 0.05) {
            console.log('🎬 Starting follow-behind with pre-animation zoom-in');
            this.followBehindCamera.setCinematicStart(false); // Prevent multiple triggers
            
            // Wait for cinematic zoom-in to complete BEFORE starting trail animation
            // Use video export-specific method if available (for consistent timing)
            if (this.followBehindCamera.startCinematicSequenceForVideoExport) {
                await this.followBehindCamera.startCinematicSequenceForVideoExport();
            } else {
                await this.followBehindCamera.startCinematicSequence();
            }
            console.log('🎬 Pre-animation zoom-in complete, now starting trail animation');
        }
        
        // Now start the actual trail animation
        this.isAnimating = true;
        
        // Hide the full track line during animation - only show completed portion
        if (this.map.getLayer('trail-line')) {
            this.map.setPaintProperty('trail-line', 'line-opacity', 0);
        }
        
        // If in follow-behind mode, disable all map interactions during animation
        if (this.cameraMode === 'followBehind') {
            this.disableMapInteractions();
        }
        this.lastAnimationTime = 0;
        this.updateCurrentPosition();
        this.animate();
    }

    animate() {
        if (!this.isAnimating || !this.segmentTimings) return;

        const currentTime = performance.now();
        if (this.lastAnimationTime === 0) {
            this.lastAnimationTime = currentTime;
        }
        
        const deltaTime = (currentTime - this.lastAnimationTime) / 1000;
        this.lastAnimationTime = currentTime;

        const timeIncrement = deltaTime * this.animationSpeed;
        this.journeyElapsedTime += timeIncrement;

        // --- Per-segment progress calculation ---
        let globalProgress = 0;
        if (this.segmentTimings.segments && this.segmentTimings.segments.length > 0) {
            const { segmentIndex, segmentProgress } = this.getSegmentAndLocalProgress(this.journeyElapsedTime);
            const seg = this.segmentTimings.segments[segmentIndex];
            // Map to global progress (index in trackPoints)
            if (this.trackData && this.trackData.trackPoints && typeof seg.startIndex === 'number' && typeof seg.endIndex === 'number') {
                const segStart = seg.startIndex;
                const segEnd = seg.endIndex;
                const segLength = segEnd - segStart;
                globalProgress = (segStart + segmentProgress * segLength) / (this.trackData.trackPoints.length - 1);
            } else {
                // Fallback: use time proportion
                globalProgress = Math.min(this.journeyElapsedTime / this.segmentTimings.totalDuration, 1);
            }
        } else if (this.segmentTimings.totalDuration > 0) {
            // Single GPX fallback
            globalProgress = Math.min(this.journeyElapsedTime / this.segmentTimings.totalDuration, 1);
        }
        this.animationProgress = globalProgress;

        if (this.journeyElapsedTime >= this.segmentTimings.totalDuration) {
            this.animationProgress = 1;
            this.journeyElapsedTime = this.segmentTimings.totalDuration;
            this.isAnimating = false;
            
            // Show the full track line again when animation completes
            if (this.map.getLayer('trail-line')) {
                this.map.setPaintProperty('trail-line', 'line-opacity', [
                    'case',
                    ['==', ['get', 'isTransportation'], true], 0.9,
                    0.8
                ]);
            }
            
            // Trigger stats end animation
            this.triggerStatsEndAnimation();
            
            // If in follow-behind mode, trigger zoom-out to show whole track after a brief pause
            if (this.cameraMode === 'followBehind') {
                console.log('🎬 Animation complete, starting zoom-out sequence');
                setTimeout(() => {
                    this.followBehindCamera.zoomOutToWholeTrack();
                }, this.followBehindCamera.getZoomOutDelay());
            }
        }

        this.updateCurrentPosition();

        // Preload tiles 2 seconds ahead in follow-behind mode
        if (this.cameraMode === 'followBehind' && this.autoZoom && this.trackData && this.gpxParser) {
            const lookAheadSeconds = 2;
            const totalDuration = this.segmentTimings.totalDuration || 1;
            const lookAheadTime = Math.min(this.journeyElapsedTime + lookAheadSeconds, totalDuration);
            let lookAheadProgress = 0;
            if (this.segmentTimings.segments && this.segmentTimings.segments.length > 0) {
                const { segmentIndex, segmentProgress } = this.getSegmentAndLocalProgress(lookAheadTime);
                const seg = this.segmentTimings.segments[segmentIndex];
                if (this.trackData && this.trackData.trackPoints && typeof seg.startIndex === 'number' && typeof seg.endIndex === 'number') {
                    const segStart = seg.startIndex;
                    const segEnd = seg.endIndex;
                    const segLength = segEnd - segStart;
                    lookAheadProgress = (segStart + segmentProgress * segLength) / (this.trackData.trackPoints.length - 1);
                } else {
                    lookAheadProgress = lookAheadTime / totalDuration;
                }
            } else {
                lookAheadProgress = lookAheadTime / totalDuration;
            }
            const lookAheadPoint = this.gpxParser.getInterpolatedPoint(lookAheadProgress);
            let lookAheadZoom = 14; // Default
            if (typeof this.followBehindCamera?.getCurrentPresetSettings === 'function') {
                lookAheadZoom = this.followBehindCamera.getCurrentPresetSettings().ZOOM || 14;
            }
            if (lookAheadPoint && lookAheadPoint.lat && lookAheadPoint.lon) {
                this.preloadTilesAtPosition(lookAheadPoint.lat, lookAheadPoint.lon, Math.round(lookAheadZoom), this.currentMapStyle);
            }
        }

        if (this.isAnimating) {
            requestAnimationFrame(() => this.animate());
        }
    }

    stopAnimation() {
        this.isAnimating = false;
        
        // Show the full track line again when animation stops
        if (this.map.getLayer('trail-line')) {
            this.map.setPaintProperty('trail-line', 'line-opacity', [
                'case',
                ['==', ['get', 'isTransportation'], true], 0.9,
                0.8
            ]);
        }
        
        // If in follow-behind mode, allow zooming when paused
        if (this.cameraMode === 'followBehind') {
            this.enableZoomOnlyInteractions();
        }
    }

    resetAnimation() {
        this.isAnimating = false;
        this.animationProgress = 0;
        this.currentSegmentIndex = 0;
        this.segmentProgress = 0;
        this.lastAnimationTime = 0;
        this.journeyElapsedTime = 0;
        this.annotations.hideActiveAnnotation();
        
        // Reset picture annotation triggered states
        if (this.pictureAnnotations && this.pictureAnnotations.resetTriggeredStates) {
            this.pictureAnnotations.resetTriggeredStates();
        }
        
        // Reset stats end animation
        this.resetStatsEndAnimation();
        
        // Reset follow-behind specific flags for next animation
        this.followBehindCamera.setCinematicStart(true);
        
        // Show the full track line when animation is reset
        if (this.map.getLayer('trail-line')) {
            this.map.setPaintProperty('trail-line', 'line-opacity', [
                'case',
                ['==', ['get', 'isTransportation'], true], 0.9,
                0.8
            ]);
        }
        
        this.updateCurrentPosition();
        
        // If in follow-behind mode, reset camera to starting position (instantly, no animation)
        if (this.cameraMode === 'followBehind') {
            console.log('🎬 Animation reset - setting starting position instantly');
            setTimeout(() => {
                this.followBehindCamera.setStartingPosition(true); // true = instant, no animation
            }, 100);
        }
    }

    // Enhanced activity icon creation and management
    createAndAddActivityIcon() {
        try {
            const size = 64;
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            
            ctx.clearRect(0, 0, size, size);
            
            // Draw background circle if enabled
            if (this.showCircle) {
                const circleRadius = size * 0.45;
                ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                ctx.beginPath();
                ctx.arc(size/2, size/2, circleRadius, 0, 2 * Math.PI);
                ctx.fill();
                
                ctx.strokeStyle = '#333333';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
            
            // Draw the emoji - make it fill most of the marker
            const fontSize = Math.floor(size * 0.9 * this.markerSize);
            ctx.font = `bold ${fontSize}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#000000';
            
            if (!this.showCircle) {
                ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
                ctx.shadowBlur = 6;
                ctx.shadowOffsetX = 2;
                ctx.shadowOffsetY = 2;
            }
            
            ctx.fillText(this.currentIcon, size/2, size/2);
            
            const imageData = ctx.getImageData(0, 0, size, size);
            
            if (this.map.hasImage && this.map.hasImage('activity-icon')) {
                this.map.removeImage('activity-icon');
            }
            
            this.map.addImage('activity-icon', {
                width: size,
                height: size,
                data: imageData.data
            });
            
        } catch (error) {
            console.error('Error creating activity icon:', error);
        }
    }

    updateActivityIcon() {
        if (!this.map.loaded() || !this.map.hasImage) {
            return;
        }
        
        this.createAndAddActivityIcon();
        
        if (this.map.getLayer('activity-icon')) {
            const visibility = this.showMarker ? 'visible' : 'none';
            const opacity = this.showMarker ? 1 : 0;
            
            this.map.setLayoutProperty('activity-icon', 'visibility', visibility);
            this.map.setLayoutProperty('activity-icon', 'icon-size', this.markerSize);
            this.map.setPaintProperty('activity-icon', 'icon-opacity', opacity);
        } else {
            // If the layer is missing, recreate it
            this.createAndAddActivityIconLayer(true);
        }
    }

    updateMarkerVisibility() {
        if (!this.map.loaded()) {
            return;
        }
        
        const visibility = this.showMarker ? 'visible' : 'none';
        const opacity = this.showMarker ? 1 : 0;
        
        if (this.map.getLayer('activity-icon')) {
            this.map.setLayoutProperty('activity-icon', 'visibility', visibility);
            this.map.setPaintProperty('activity-icon', 'icon-opacity', opacity);
        }
    }

    updateMarkerDependentControls(enabled) {
        // Get all marker-related control groups
        const markerSizeGroup = document.getElementById('markerSize')?.closest('.control-group');
        const currentIconGroup = document.getElementById('currentIconDisplay')?.closest('.control-group');
        const showCircleGroup = document.getElementById('showCircle')?.closest('.control-group');
        
        // Disable/enable marker size slider
        const markerSizeSlider = document.getElementById('markerSize');
        if (markerSizeSlider) {
            markerSizeSlider.disabled = !enabled;
            markerSizeSlider.style.opacity = enabled ? '1' : '0.5';
        }
        
        // Disable/enable marker size value display
        const markerSizeValue = document.getElementById('markerSizeValue');
        if (markerSizeValue) {
            markerSizeValue.style.opacity = enabled ? '1' : '0.5';
        }
        
        // Disable/enable current icon display
        const currentIconDisplay = document.getElementById('currentIconDisplay');
        if (currentIconDisplay) {
            currentIconDisplay.style.opacity = enabled ? '1' : '0.5';
        }
        
        // Disable/enable change icon button
        const changeIconBtn = document.getElementById('changeIconBtn');
        if (changeIconBtn) {
            changeIconBtn.disabled = !enabled;
            changeIconBtn.style.opacity = enabled ? '1' : '0.5';
        }
        
        // Disable/enable show circle toggle (since it only affects the marker)
        const showCircleToggle = document.getElementById('showCircle');
        if (showCircleToggle) {
            showCircleToggle.disabled = !enabled;
            showCircleToggle.style.opacity = enabled ? '1' : '0.5';
        }
        
        // Update control group classes for visual feedback
        if (markerSizeGroup) {
            markerSizeGroup.classList.toggle('disabled', !enabled);
        }
        if (currentIconGroup) {
            currentIconGroup.classList.toggle('disabled', !enabled);
        }
        if (showCircleGroup) {
            showCircleGroup.classList.toggle('disabled', !enabled);
        }
    }

    ensureActivityIconLayer() {
        if (!this.map.getLayer('activity-icon')) {
            this.createAndAddActivityIconLayer(true);
        } else {
            const visibility = this.showMarker ? 'visible' : 'none';
            const opacity = this.showMarker ? 1 : 0;
            
            this.map.setLayoutProperty('activity-icon', 'visibility', visibility);
            this.map.setPaintProperty('activity-icon', 'icon-opacity', opacity);
            
            if (!this.map.hasImage('activity-icon')) {
                this.createAndAddActivityIcon();
            }
        }
    }

    createAndAddActivityIconLayer(immediate = false) {
        try {
            this.createAndAddActivityIcon();
            
            const delay = immediate ? 10 : 100;
            setTimeout(() => {
                try {
            if (!this.map.getLayer('activity-icon')) {
                const visibility = this.showMarker ? 'visible' : 'none';
                const opacity = this.showMarker ? 1 : 0;
                
                this.map.addLayer({
                    id: 'activity-icon',
                    type: 'symbol',
                    source: 'current-position',
                    layout: {
                        'icon-image': 'activity-icon',
                        'icon-size': this.markerSize,
                        'icon-allow-overlap': true,
                        'icon-ignore-placement': true,
                        'icon-anchor': 'center',
                        'visibility': visibility
                    },
                    paint: {
                        'icon-opacity': opacity
                    }
                });
            }
                } catch (layerError) {
                    console.error('Error adding activity icon layer:', layerError);
                }
            }, delay);
            
        } catch (error) {
            console.error('Error creating activity icon layer:', error);
        }
    }

    forceIconUpdate() {
        try {
            if (this.map.getLayer('activity-icon')) {
                this.map.removeLayer('activity-icon');
            }
            
            if (this.map.hasImage('activity-icon')) {
                this.map.removeImage('activity-icon');
            }
            
            setTimeout(() => {
                this.createAndAddActivityIcon();
                
                setTimeout(() => {
                    if (!this.map.getLayer('activity-icon')) {
                        const visibility = this.showMarker ? 'visible' : 'none';
                        const opacity = this.showMarker ? 1 : 0;
                        
                        this.map.addLayer({
                            id: 'activity-icon',
                            type: 'symbol',
                            source: 'current-position',
                            layout: {
                                'icon-image': 'activity-icon',
                                'icon-size': this.markerSize,
                                'icon-allow-overlap': true,
                                'icon-ignore-placement': true,
                                'icon-anchor': 'center',
                                'visibility': visibility
                            },
                            paint: {
                                'icon-opacity': opacity
                            }
                        });
                    }
                }, 50);
            }, 10);
            
        } catch (error) {
            console.error('Error in forceIconUpdate:', error);
        }
    }

    // Navigation controls
    zoomIn() {
        this.map.zoomIn();
    }

    zoomOut() {
        this.map.zoomOut();
    }

    centerOnTrail() {
        if (this.trackData && this.trackData.bounds) {
            // Calculate center point of the track
            const centerLon = (this.trackData.bounds.west + this.trackData.bounds.east) / 2;
            const centerLat = (this.trackData.bounds.south + this.trackData.bounds.north) / 2;
            
            // Only center the map, don't change zoom
            this.map.setCenter([centerLon, centerLat]);
        }
    }

    // Video export support
    captureFrame() {
        return new Promise((resolve) => {
            this.map.getCanvas().toBlob((blob) => {
                resolve(blob);
            });
        });
    }

    // Setup resize event listener for dynamic layout updates
    setupResizeListener() {
        // Debounce resize events to avoid excessive layout recalculations
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                console.log('🔄 Window resized, updating map layout');
                this.detectAndSetMapLayout();
            }, 250); // 250ms debounce
        });

        console.log('📏 Resize listener setup for dynamic layout detection');
    }

    // Function to detect and set map layout based on aspect ratio
    detectAndSetMapLayout() {
        const overlay = document.getElementById('liveStatsOverlay');
        if (!overlay) {
            console.log('🎯 Layout detection skipped: overlay not found');
            return;
        }

        console.log('🎯 Detecting map layout based on aspect ratio');

        // Detect layout based on screen size and map aspect ratio
        const mapContainer = this.map.getContainer();
        const mapWidth = mapContainer.clientWidth;
        const mapHeight = mapContainer.clientHeight;
        const aspectRatio = mapWidth / mapHeight;
        const isMobile = window.innerWidth <= 768;

        console.log('📐 Map dimensions:', mapWidth, 'x', mapHeight, 'Aspect ratio:', aspectRatio.toFixed(2));

        // Remove any existing layout classes
        overlay.classList.remove('mobile-layout', 'square-layout', 'horizontal-layout', 'with-speed');

        // Determine layout based on conditions
        if (isMobile) {
            overlay.classList.add('mobile-layout');
            console.log('📱 Applied mobile layout');
        } else if (aspectRatio >= 0.8 && aspectRatio <= 1.2) {
            // Square-ish aspect ratio (0.8 to 1.2)
            overlay.classList.add('square-layout');
            console.log('⬜ Applied square layout (aspect ratio:', aspectRatio.toFixed(2), ')');
        } else {
            // Horizontal/widescreen aspect ratio
            overlay.classList.add('horizontal-layout');
            console.log('⬌ Applied horizontal layout (aspect ratio:', aspectRatio.toFixed(2), ')');
        }
    }

    triggerStatsEndAnimation() {
        const overlay = document.getElementById('liveStatsOverlay');
        if (!overlay || !this.showEndStats) {
            console.log('🎯 End stats animation skipped:', !overlay ? 'overlay not found' : 'disabled by user');
            return;
        }

        console.log('🎯 Triggering stats end animation');

        // Use the new layout detection function
        this.detectAndSetMapLayout();

        // Add the end animation class to trigger the CSS transition
        overlay.classList.add('end-animation');

        // Remove the animation after 10 seconds to return to normal state
        setTimeout(() => {
            overlay.classList.remove('end-animation', 'mobile-layout', 'square-layout', 'horizontal-layout', 'with-speed');
        }, 10000);
    }

    resetStatsEndAnimation() {
        const overlay = document.getElementById('liveStatsOverlay');
        if (!overlay) return;
        
        console.log('🎯 Resetting stats end animation');
        
        // Remove the end animation class and layout classes to return to normal state
        overlay.classList.remove('end-animation', 'mobile-layout', 'square-layout', 'horizontal-layout', 'with-speed');
        

    }

    destroy() {
        if (this.map) {
            this.map.remove();
            this.map = null;
        }
    }

    // Segment animation setup
    setupSegmentAnimation(segments, segmentTiming) {
        const previousProgress = this.animationProgress || 0;
        const wasAnimating = this.isAnimating;
        
        this.segmentTimings = null;
        this.currentSegmentIndex = 0;
        this.segmentProgress = 0;
        this.journeyElapsedTime = 0;
        this.lastAnimationTime = 0;
        
        this.segmentTimings = segmentTiming;
        
        if (previousProgress > 0 && segmentTiming && segmentTiming.totalDuration > 0) {
            this.journeyElapsedTime = previousProgress * segmentTiming.totalDuration;
            this.animationProgress = previousProgress;
            this.updateSegmentProgress(previousProgress);
        } else {
            this.animationProgress = 0;
            this.journeyElapsedTime = 0;
        }
        
        this.updateCurrentPosition();
    }

    setAnimationProgress(progress) {
        this.animationProgress = Math.max(0, Math.min(1, progress));
        
        // Reset stats animation if seeking away from the end
        if (progress < 0.98) {
            this.resetStatsEndAnimation();
        }
        
        // --- Per-segment time calculation ---
        if (this.segmentTimings && this.segmentTimings.segments && this.segmentTimings.segments.length > 0) {
            // Map global progress to journeyElapsedTime
            const totalPoints = this.trackData.trackPoints.length - 1;
            const targetIndex = progress * totalPoints;
            let found = false;
            for (let i = 0; i < this.segmentTimings.segments.length; i++) {
                const seg = this.segmentTimings.segments[i];
                if (typeof seg.startIndex === 'number' && typeof seg.endIndex === 'number') {
                    if (targetIndex >= seg.startIndex && targetIndex <= seg.endIndex) {
                        const segLength = seg.endIndex - seg.startIndex;
                        const segmentProgress = segLength > 0 ? (targetIndex - seg.startIndex) / segLength : 0;
                        this.journeyElapsedTime = seg.startTime + segmentProgress * seg.duration;
                        found = true;
                        break;
                    }
                }
            }
            if (!found) {
                // Fallback: use total duration
                this.journeyElapsedTime = progress * this.segmentTimings.totalDuration;
            }
        } else if (this.segmentTimings && this.segmentTimings.totalDuration) {
            this.journeyElapsedTime = progress * this.segmentTimings.totalDuration;
        }
        if (this.segmentTimings && this.segmentTimings.segments) {
            this.updateSegmentProgress(progress);
        }
        this.lastAnimationTime = 0;
        this.updateCurrentPosition();
    }

    setJourneyElapsedTime(timeInSeconds) {
        if (!this.segmentTimings) return;
        this.journeyElapsedTime = Math.max(0, Math.min(timeInSeconds, this.segmentTimings.totalDuration));
        // --- Synchronize animationProgress for journeys ---
        if (this.segmentTimings.segments && this.segmentTimings.segments.length > 0) {
            // Find which segment this time falls into
            let found = false;
            for (let i = 0; i < this.segmentTimings.segments.length; i++) {
                const seg = this.segmentTimings.segments[i];
                if (timeInSeconds >= seg.startTime && timeInSeconds <= seg.endTime) {
                    const relativeTimeInSegment = timeInSeconds - seg.startTime;
                    const segmentProgress = seg.duration > 0 ? relativeTimeInSegment / seg.duration : 0;
                    const segStart = seg.startIndex;
                    const segEnd = seg.endIndex;
                    const segLength = segEnd - segStart;
                    const globalIndex = segStart + segmentProgress * segLength;
                    this.animationProgress = globalIndex / (this.trackData.trackPoints.length - 1);
                    found = true;
                    break;
                }
            }
            if (!found) {
                // Fallback: proportional
                this.animationProgress = timeInSeconds / this.segmentTimings.totalDuration;
            }
        } else if (this.segmentTimings.totalDuration) {
            this.animationProgress = timeInSeconds / this.segmentTimings.totalDuration;
        }
        this.lastAnimationTime = 0;
        this.updateCurrentPosition();
    }

    getJourneyElapsedTime() {
        return this.journeyElapsedTime;
    }

    updateSegmentProgress(globalProgress) {
        if (!this.segmentTimings || !this.segmentTimings.segments) return;
        
        const totalDuration = this.segmentTimings.totalDuration;
        const currentTime = globalProgress * totalDuration;
        
        for (let i = 0; i < this.segmentTimings.segments.length; i++) {
            const segment = this.segmentTimings.segments[i];
            if (currentTime >= segment.startTime && currentTime <= segment.endTime) {
                this.currentSegmentIndex = i;
                if (segment.duration > 0) {
                    this.segmentProgress = (currentTime - segment.startTime) / segment.duration;
                } else {
                    this.segmentProgress = 0;
                }
                break;
            }
        }
    }

    // Map style methods
    changeMapStyle(style) {
        const layerConfigs = {
            'satellite': {
                source: 'satellite',
                attribution: '© Esri'
            },
            'opentopomap': {
                source: 'opentopomap',
                attribution: '© OpenTopoMap (CC-BY-SA)'
            },
            'street': {
                source: 'osm',
                attribution: '© OpenStreetMap contributors'
            },
            // New hybrid style: satellite + labels
            'hybrid': {
                sources: ['satellite', 'carto-labels'],
                attribution: '© Esri, © CartoDB'
            }
        };

        // --- Handle hybrid style ---
        if (style === 'hybrid') {
            // Show both satellite and labels
            if (this.map.getLayer('background')) {
                this.map.setLayoutProperty('background', 'visibility', 'visible');
            }
            if (this.map.getLayer('carto-labels')) {
                this.map.setLayoutProperty('carto-labels', 'visibility', 'visible');
            }
            // Hide other base layers if present
            if (this.map.getLayer('opentopomap')) {
                this.map.setLayoutProperty('opentopomap', 'visibility', 'none');
            }
            if (this.map.getLayer('street')) {
                this.map.setLayoutProperty('street', 'visibility', 'none');
            }
            // Always disable 3D terrain in hybrid mode
            this.disable3DTerrain();
            // Optionally update attribution UI here
            return;
        }

        // --- Handle other styles ---
        const config = layerConfigs[style] || layerConfigs['satellite'];
        if (this.map.getLayer('background')) {
            this.map.setLayoutProperty('background', 'visibility', style === 'satellite' ? 'visible' : 'none');
        }
        if (this.map.getLayer('carto-labels')) {
            this.map.setLayoutProperty('carto-labels', 'visibility', 'none');
        }
        if (this.map.getLayer('opentopomap')) {
            this.map.setLayoutProperty('opentopomap', 'visibility', style === 'opentopomap' ? 'visible' : 'none');
        }
        if (this.map.getLayer('street')) {
            // Show street only if style is street
            this.map.setLayoutProperty('street', 'visibility', style === 'street' ? 'visible' : 'none');
        }
        // Optionally update attribution UI here
        this.currentMapStyle = style; // Track current style for preloading
    }

    // Journey segments handling
    loadJourneySegments(trackData, coordinates) {
        const trailLineData = {
            type: 'FeatureCollection',
            features: []
        };

        trackData.segments.forEach((segment, index) => {
            const segmentCoords = coordinates.slice(segment.startIndex, segment.endIndex + 1);
            
            if (segmentCoords.length < 2) return;
            
            const feature = {
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: segmentCoords
                },
                properties: {
                    segmentType: segment.type,
                    segmentMode: segment.mode || segment.data?.data?.activityType,
                    segmentIndex: index,
                    isTrack: segment.type === 'track',
                    isTransportation: segment.type === 'transportation'
                }
            };
            
            trailLineData.features.push(feature);
        });

        this.map.getSource('trail-line').setData(trailLineData);
        this.addSegmentTransitionMarkers(trackData.segments, coordinates);
    }

    addSegmentTransitionMarkers(segments, coordinates) {
        const transitionFeatures = [];
        
        for (let i = 1; i < segments.length; i++) {
            const prevSegment = segments[i - 1];
            const currentSegment = segments[i];
            const transitionIndex = currentSegment.startIndex;
            
            if (transitionIndex < coordinates.length) {
                const coord = coordinates[transitionIndex];
                
                transitionFeatures.push({
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: coord
                    },
                    properties: {
                        fromType: prevSegment.type,
                        toType: currentSegment.type,
                        fromMode: prevSegment.mode || prevSegment.data?.data?.activityType,
                        toMode: currentSegment.mode || currentSegment.data?.data?.activityType
                    }
                });
            }
        }
        
        if (!this.map.getSource('segment-transitions')) {
            this.map.addSource('segment-transitions', {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: transitionFeatures
                }
            });
            
            this.map.addLayer({
                id: 'segment-transitions',
                type: 'circle',
                source: 'segment-transitions',
                paint: {
                    'circle-radius': 8,
                    'circle-color': '#ff6b6b',
                    'circle-stroke-color': '#ffffff',
                    'circle-stroke-width': 2,
                    'circle-opacity': 0.8
                }
            });
        } else {
            this.map.getSource('segment-transitions').setData({
                type: 'FeatureCollection',
                features: transitionFeatures
            });
        }
    }

    // 3D Terrain functionality
    enable3DTerrain() {
        if (!this.map || this.is3DMode) return;
        
        this.is3DMode = true;
        
        try {
            const wasAnimating = this.isAnimating;
            const currentProgress = this.animationProgress;
            
            this.map.easeTo({
                pitch: 30,
                duration: 500
            });
            
            setTimeout(() => {
                try {
                    this.setupTerrainSourceMinimal();
                    
                    if (wasAnimating && currentProgress !== undefined) {
                        setTimeout(() => {
                            this.setAnimationProgress(currentProgress);
                            if (wasAnimating) {
                                this.startAnimation();
                            }
                        }, 100);
                    }
                } catch (terrainError) {
                    console.warn('Could not add terrain elevation:', terrainError);
                }
            }, 600);
            
        } catch (error) {
            console.error('Error enabling 3D terrain:', error);
            this.is3DMode = false;
        }
    }

    setupTerrainSourceMinimal() {
        try {
            if (!this.map.getSource('terrain-dem')) {
                this.addTerrainSource(this.currentTerrainSource);
            }
            
            setTimeout(() => {
                try {
                    this.map.setTerrain({
                        source: 'terrain-dem',
                        exaggeration: 0.8
                    });
                } catch (terrainError) {
                    console.warn('Could not apply terrain elevation:', terrainError);
                }
            }, 300);
            
        } catch (error) {
            console.warn('Could not setup terrain source:', error);
        }
    }

    addTerrainSource(provider) {
        const sources = {
            'mapzen': {
                type: 'raster-dem',
                tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
                tileSize: 256,
                encoding: 'terrarium',
                maxzoom: 15
            },
            'opentopo': {
                type: 'raster-dem',
                tiles: ['https://cloud.sdsc.edu/v1/AUTH_opentopography/Raster/SRTM_GL1/{z}/{x}/{y}.png'],
                tileSize: 256,
                encoding: 'mapbox',
                maxzoom: 14
            }
        };

        const sourceConfig = sources[provider] || sources['mapzen'];
        this.map.addSource('terrain-dem', sourceConfig);
    }

    setTerrainSource(provider) {
        if (!this.map || !this.is3DMode) {
            this.currentTerrainSource = provider;
            return;
        }

        try {
            const wasAnimating = this.isAnimating;
            const currentProgress = this.animationProgress;
            
            if (this.map.getSource('terrain-dem')) {
                this.map.setTerrain(null);
                this.map.removeSource('terrain-dem');
            }
            
            this.addTerrainSource(provider);
            this.currentTerrainSource = provider;
            
            setTimeout(() => {
                try {
                    this.map.setTerrain({
                        source: 'terrain-dem',
                        exaggeration: 0.8
                    });
                    
                    if (wasAnimating && currentProgress !== undefined) {
                        setTimeout(() => {
                            this.setAnimationProgress(currentProgress);
                            if (wasAnimating) {
                                this.startAnimation();
                            }
                        }, 200);
                    }
                } catch (terrainError) {
                    console.warn(`Could not apply ${provider} terrain:`, terrainError);
                }
            }, 300);
            
        } catch (error) {
            console.error(`Error switching terrain source to ${provider}:`, error);
        }
    }

    disable3DTerrain() {
        if (!this.map || !this.is3DMode) return;
        
        this.is3DMode = false;
        
        try {
            const wasAnimating = this.isAnimating;
            const currentProgress = this.animationProgress;
            
            this.map.setTerrain(null);
            
            this.map.easeTo({
                pitch: 0,
                duration: 500
            });
            
            if (wasAnimating && currentProgress !== undefined) {
                setTimeout(() => {
                    this.setAnimationProgress(currentProgress);
                    if (wasAnimating) {
                        this.startAnimation();
                    }
                }, 600);
            }
        } catch (error) {
            console.error('Error disabling 3D terrain:', error);
        }
    }

    update3DTrailRendering() {
        if (!this.trackData || !this.map.getLayer('trail-line')) {
            return;
        }
        
        this.map.setPaintProperty('trail-line', 'line-width', [
            'case',
            ['==', ['get', 'isTransportation'], true], 8,
            6
        ]);
        
        if (this.map.getLayer('trail-completed')) {
            this.map.setPaintProperty('trail-completed', 'line-width', 7);
            this.map.setPaintProperty('trail-completed', 'line-opacity', 1.0);
        }
        
        this.map.setPaintProperty('trail-line', 'line-opacity', [
            'case',
            ['==', ['get', 'isTransportation'], true], 0.9,
            0.8
        ]);
        
        if (this.map.getLayer('current-position-glow')) {
            this.map.setPaintProperty('current-position-glow', 'circle-radius', 20 * this.markerSize);
        }
    }

    setTerrainExaggeration(exaggeration) {
        if (this.is3DMode && this.map.getSource('terrain-dem')) {
            try {
                this.map.setTerrain({
                    source: 'terrain-dem',
                    exaggeration: exaggeration
                });
            } catch (error) {
                console.error('Error setting terrain exaggeration:', error);
            }
        }
    }

    isTerrainSupported() {
        return typeof this.map.setTerrain === 'function' && typeof this.map.addSource === 'function';
    }

    // Stats methods for video export
    getCurrentDistance() {
        if (!this.gpxParser || !this.trackData) return 0;
        
        const currentPoint = this.gpxParser.getInterpolatedPoint(this.animationProgress);
        return currentPoint ? currentPoint.distance : 0;
    }

    getCurrentElevation() {
        if (!this.gpxParser || !this.trackData) return 0;
        
        const currentPoint = this.gpxParser.getInterpolatedPoint(this.animationProgress);
        return currentPoint ? currentPoint.elevation : 0;
    }

    getCurrentSpeed() {
        if (!this.gpxParser || !this.trackData) return 0;
        
        const currentPoint = this.gpxParser.getInterpolatedPoint(this.animationProgress);
        return currentPoint ? currentPoint.speed : 0;
    }

    getElevationData() {
        if (!this.trackData || !this.trackData.trackPoints) return [];
        
        return this.trackData.trackPoints.map(point => point.elevation || 0);
    }

    // Camera mode methods
    setCameraMode(mode) {
        console.log('📹 setCameraMode called with:', mode);
        console.log('📹 Current state:', {
            hasMap: !!this.map,
            hasTrackData: !!this.trackData,
            animationProgress: this.animationProgress,
            is3DMode: this.is3DMode
        });
        
        this.cameraMode = mode;
        console.log('📹 Camera mode set to:', mode);
        
        if (mode === 'followBehind') {
            console.log('📹 Entering follow-behind mode');
            
            // Disable map interactions when in follow-behind mode
            this.disableMapInteractions();
            console.log('📹 Map interactions disabled');
            
            // Force auto-follow to be enabled
            const autoFollowToggle = document.getElementById('autoZoom');
            if (autoFollowToggle && !autoFollowToggle.checked) {
                autoFollowToggle.checked = true;
                this.autoZoom = true;
                console.log('📹 Auto-follow enabled for follow-behind mode');
            }
            
            // Disable the auto-follow toggle to prevent user from turning it off
            if (autoFollowToggle) {
                autoFollowToggle.disabled = true;
                console.log('📹 Auto-follow toggle disabled');
            }
            
            // Initialize the follow-behind camera
            console.log('📹 Initializing follow-behind camera');
            this.followBehindCamera.initialize();
            
            // If paused, allow zooming
            if (!this.isAnimating) {
                this.enableZoomOnlyInteractions();
            }
        } else {
            console.log('📹 Entering standard camera mode');
            
            // Reset follow-behind camera to allow re-initialization
            this.followBehindCamera.reset();
            
            // Re-enable map interactions for standard mode
            this.enableMapInteractions();
            
            // Re-enable the auto-follow toggle
            const autoFollowToggle = document.getElementById('autoZoom');
            if (autoFollowToggle) {
                autoFollowToggle.disabled = false;
            }
            
            // Return to a normal overview of the track when switching to standard mode
            if (this.trackData && this.trackData.bounds) {
                console.log('📹 Switching to standard mode - showing track overview');
                this.centerOnTrail();
            }
            
            // Restore original marker size when switching to standard mode
            if (this.followBehindCamera.originalMarkerSize) {
                this.markerSize = this.followBehindCamera.originalMarkerSize;
                this.createAndAddActivityIcon();
                if (this.map.getLayer('activity-icon-layer')) {
                    this.forceIconUpdate();
                }
            }
        }
    }

    initializeFollowBehindCamera() {
        console.log('🎬 initializeFollowBehindCamera called');
        console.log('🎬 Checking prerequisites:', {
            hasTrackData: !!this.trackData,
            hasMap: !!this.map,
            is3DMode: this.is3DMode,
            alreadyInitialized: this.followBehindInitialized
        });
        
        if (!this.trackData || !this.map) {
            console.warn('🎬 Cannot initialize follow-behind camera: missing prerequisites');
            return;
        }
        
        // Prevent multiple initializations
        if (this.followBehindInitialized) {
            console.log('🎬 Follow-behind camera already initialized, skipping');
            return;
        }
        
        console.log('🎬 Initializing follow-behind camera mode');
        this.followBehindInitialized = true;
        
        // Enable 3D if not already enabled for better cinematic effect
        if (!this.is3DMode) {
            console.log('🎬 Enabling 3D terrain for cinematic effect');
            this.enable3DTerrain();
            
            // Wait longer for terrain to actually load
            this.waitForTerrainToLoad().then(() => {
                console.log('🎬 Terrain loaded, initializing terrain-aware settings');
                this.initializeTerrainAwareSettings();
                this.setFollowBehindStartingPosition();
            });
        } else {
            // 3D already enabled, set position immediately
            setTimeout(() => {
                this.initializeTerrainAwareSettings();
                this.setFollowBehindStartingPosition();
            }, 500);
        }
        
        console.log('🎬 Follow-behind camera mode initialized');
    }

    async initializeFollowBehindCameraStart() {
        if (!this.trackData || !this.map) {
            console.warn('🎬 Cannot initialize follow-behind start: missing trackData or map');
            return;
        }
        
        console.log('🎬 Starting follow-behind camera cinematic sequence');
        
        // Ensure terrain is loaded before starting cinematic sequence
        if (this.is3DMode && (!this.map.getTerrain || !this.map.getTerrain())) {
            console.log('🎬 Waiting for terrain before starting cinematic sequence');
            await this.waitForTerrainToLoad();
        }
        
        // Get the CURRENT marker position (not start point) since animation may have already started
        const currentPoint = this.gpxParser.getInterpolatedPoint(this.animationProgress);
        if (!currentPoint) {
            console.warn('🎬 No current point available for follow-behind camera at progress:', this.animationProgress);
            return;
        }
        
        // Calculate bearing from current position
        const bearing = this.calculateCameraBearing(this.animationProgress);
        
        // Get current zoom to use as starting point (should be the overview zoom we set)
        const currentZoom = this.map.getZoom();
        
        console.log(`🎬 Starting cinematic sequence from zoom ${currentZoom.toFixed(1)} at progress ${this.animationProgress.toFixed(3)}`);
        console.log(`🎬 Location: [${currentPoint.lon.toFixed(6)}, ${currentPoint.lat.toFixed(6)}] with bearing ${bearing.toFixed(1)}`);
        
        // Get terrain-aware settings for the current position
        const terrainSettings = this.calculateTerrainAwareCameraSettings(this.animationProgress);
        
        // Initialize the terrain-aware tracking variables properly
        this.lastCameraZoom = terrainSettings.zoom;
        this.lastCameraPitch = terrainSettings.pitch;
        this.lastCameraBearing = bearing;
        
        console.log(`🎬 Calculated terrain-aware start settings: zoom=${terrainSettings.zoom.toFixed(1)}, pitch=${terrainSettings.pitch.toFixed(1)}, bearing=${bearing.toFixed(1)}`);
        
        // Start the cinematic zoom-in from current position to terrain-aware follow-behind view
        this.map.easeTo({
            center: [currentPoint.lon, currentPoint.lat],
            zoom: terrainSettings.zoom,
            pitch: terrainSettings.pitch,
            bearing: bearing,
            duration: 3000 // 3 second cinematic zoom-in
        });
        
        this.lastCameraBearing = bearing;
        console.log('🎬 Follow-behind camera cinematic start sequence initialized');
    }

    setFollowBehindCameraPosition() {
        if (!this.trackData || !this.map) {
            console.warn('🎬 Cannot set follow-behind camera: missing trackData or map');
            return;
        }
        
        console.log('🎬 Setting follow-behind camera position for progress:', this.animationProgress);
        
        // Get current position
        const currentPoint = this.gpxParser.getInterpolatedPoint(this.animationProgress);
        if (!currentPoint) {
            console.warn('🎬 No current point for follow-behind camera at progress:', this.animationProgress);
            return;
        }
        
        // Calculate bearing from movement direction
        const bearing = this.calculateCameraBearing(this.animationProgress);
        
        console.log(`🎬 Setting follow-behind camera: center=[${currentPoint.lon.toFixed(6)}, ${currentPoint.lat.toFixed(6)}], zoom=${this.followBehindSettings.zoom}, pitch=${this.followBehindSettings.pitch}, bearing=${bearing.toFixed(1)}`);
        
        // Set camera position with smooth transition
        this.map.easeTo({
            center: [currentPoint.lon, currentPoint.lat],
            zoom: this.followBehindSettings.zoom,
            pitch: this.followBehindSettings.pitch,
            bearing: bearing,
            duration: 1500
        });
        
        this.lastCameraBearing = bearing;
        console.log('🎬 Follow-behind camera position set successfully');
    }

    calculateCameraBearing(progress) {
        if (!this.trackData || !this.trackData.trackPoints || this.trackData.trackPoints.length < 2) {
            return 0;
        }
        
        // Get a larger segment ahead to calculate direction for better stability
        const lookAheadProgress = Math.min(progress + 0.05, 1); // Look ahead by 5%
        const currentPoint = this.gpxParser.getInterpolatedPoint(progress);
        const futurePoint = this.gpxParser.getInterpolatedPoint(lookAheadProgress);
        
        if (!currentPoint || !futurePoint) {
            return this.lastCameraBearing || 0;
        }
        
        // Calculate bearing between current and future point
        const bearing = this.calculateBearingBetweenPoints(
            currentPoint.lat, currentPoint.lon,
            futurePoint.lat, futurePoint.lon
        );
        
        return bearing;
    }

    calculateTerrainAwareCameraSettings(progress) {
        // Ensure GPX parser is ready
        if (!this.ensureGPXParserReady()) {
            return {
                zoom: this.followBehindSettings.baseZoom,
                pitch: this.followBehindSettings.basePitch,
                markerScale: 1.0
            };
        }
        
        const currentPoint = this.gpxParser.getInterpolatedPoint(progress);
        if (!currentPoint) {
            return {
                zoom: this.followBehindSettings.baseZoom,
                pitch: this.followBehindSettings.basePitch,
                markerScale: 1.0
            };
        }

        const currentElevation = currentPoint.elevation || 0;
        
        // Calculate elevation change and terrain steepness
        const lookAheadProgress = Math.min(progress + 0.02, 1); // Look ahead 2%
        const lookBehindProgress = Math.max(progress - 0.02, 0); // Look behind 2%
        
        const futurePoint = this.gpxParser.getInterpolatedPoint(lookAheadProgress);
        const pastPoint = this.gpxParser.getInterpolatedPoint(lookBehindProgress);
        
        let elevationChange = 0;
        let steepness = 0;
        
        if (futurePoint && pastPoint) {
            elevationChange = futurePoint.elevation - pastPoint.elevation;
            
            // Calculate steepness (elevation change per distance)
            const distance = this.calculateDistanceBetweenPoints(
                pastPoint.lat, pastPoint.lon,
                futurePoint.lat, futurePoint.lon
            );
            steepness = distance > 0 ? Math.abs(elevationChange) / distance : 0;
        }
        
        // Dynamic zoom based on elevation and steepness
        let dynamicZoom = this.followBehindSettings.baseZoom;
        
        // Zoom out for higher elevations and steep terrain
        const elevationFactor = Math.min(currentElevation * this.followBehindSettings.elevationSensitivity, 2);
        const steepnessFactor = Math.min(steepness * 1000, 1.5); // Scale steepness impact
        
        dynamicZoom = this.followBehindSettings.baseZoom - elevationFactor - steepnessFactor;
        dynamicZoom = Math.max(this.followBehindSettings.minZoom, 
                              Math.min(this.followBehindSettings.maxZoom, dynamicZoom));
        
        // Dynamic pitch based on elevation change and steepness
        let dynamicPitch = this.followBehindSettings.basePitch;
        
        // Adjust pitch for terrain
        if (elevationChange > 20) {
            // Ascending: reduce pitch to see more ahead
            dynamicPitch = Math.max(this.followBehindSettings.minPitch, 
                                   this.followBehindSettings.basePitch - 15);
        } else if (elevationChange < -20) {
            // Descending: increase pitch but not too much to avoid going inside terrain
            dynamicPitch = Math.min(this.followBehindSettings.maxPitch - 10, 
                                   this.followBehindSettings.basePitch + 5);
        }
        
        // For very steep terrain, always use lower pitch to stay above terrain
        if (steepness > 0.1) { // Very steep
            dynamicPitch = Math.max(this.followBehindSettings.minPitch, dynamicPitch - 10);
        }
        
        // Extra smooth transitions for terrain changes with rate limiting
        const maxZoomChangePerFrame = 0.1;
        const maxPitchChangePerFrame = 2;
        
        const zoomDiff = dynamicZoom - this.lastCameraZoom;
        const pitchDiff = dynamicPitch - this.lastCameraPitch;
        
        // Limit rapid changes for ultra-smooth movement
        const limitedZoomChange = Math.max(-maxZoomChangePerFrame, 
                                         Math.min(maxZoomChangePerFrame, zoomDiff));
        const limitedPitchChange = Math.max(-maxPitchChangePerFrame, 
                                          Math.min(maxPitchChangePerFrame, pitchDiff));
        
        this.lastCameraZoom = this.lastCameraZoom * 0.95 + (this.lastCameraZoom + limitedZoomChange) * 0.05;
        this.lastCameraPitch = this.lastCameraPitch * 0.95 + (this.lastCameraPitch + limitedPitchChange) * 0.05;
        this.lastElevation = currentElevation;
        
        // Calculate marker scale based on zoom level to prevent it from being too large
        // Higher zoom = smaller marker scale to maintain proportion
        const baseZoom = this.followBehindSettings.baseZoom;
        const currentZoom = this.lastCameraZoom;
        const zoomDifference = currentZoom - baseZoom;
        
        // Scale marker inversely with zoom: closer zoom = smaller marker
        // At base zoom (17): scale = 1.0
        // At min zoom (15): scale = 1.4 (larger marker when zoomed out)
        // At max zoom (18): scale = 0.6 (smaller marker when zoomed in)
        let markerScale = 1.0 - (zoomDifference * 0.2);
        markerScale = Math.max(0.3, Math.min(1.5, markerScale)); // Clamp between 0.3 and 1.5
        
        return {
            zoom: this.lastCameraZoom,
            pitch: this.lastCameraPitch,
            elevation: currentElevation,
            elevationChange: elevationChange,
            steepness: steepness,
            markerScale: markerScale
        };
    }

    calculateDistanceBetweenPoints(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in kilometers
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c * 1000; // Return distance in meters
    }

    updateMarkerScaleForZoom(targetScale) {
        // Store the original marker size if not already stored
        if (!this.originalMarkerSize) {
            this.originalMarkerSize = this.markerSize;
        }
        
        // Calculate the adjusted marker size
        const adjustedSize = this.originalMarkerSize * targetScale;
        
        // Only update if the change is significant to avoid constant updates
        if (Math.abs(this.markerSize - adjustedSize) > 0.05) {
            this.markerSize = adjustedSize;
            
            // Force marker icon regeneration with new size
            this.createAndAddActivityIcon();
            
            // Update activity icon layer if it exists
            if (this.map.getLayer('activity-icon-layer')) {
                this.forceIconUpdate();
            }
        }
    }

    async waitForTerrainToLoad() {
        return new Promise((resolve) => {
            const checkTerrain = () => {
                // Check if terrain is actually applied and ready
                if (this.map.getTerrain && this.map.getTerrain()) {
                    console.log('🎬 Terrain confirmed loaded');
                    resolve();
                } else {
                    console.log('🎬 Waiting for terrain to load...');
                    setTimeout(checkTerrain, 500);
                }
            };
            
            // Start checking immediately, but with a fallback timeout
            checkTerrain();
            
            // Fallback: resolve after 3 seconds even if terrain check fails
            setTimeout(() => {
                console.log('🎬 Terrain load timeout, proceeding anyway');
                resolve();
            }, 3000);
        });
    }

    initializeTerrainAwareSettings() {
        console.log('🎬 Initializing terrain-aware camera settings');
        
        // Ensure we have track data and GPX parser is ready
        if (!this.ensureGPXParserReady()) {
            console.warn('🎬 Cannot initialize terrain-aware settings: GPX parser not ready');
            return;
        }
        
        // Get the starting point elevation for initial calculation
        const startPoint = this.gpxParser.getInterpolatedPoint(0);
        if (!startPoint) {
            console.warn('🎬 No start point available for terrain initialization');
            return;
        }
        
        const startElevation = startPoint.elevation || 0;
        
        // Calculate base terrain-aware settings directly without smoothing
        let baseZoom = this.followBehindSettings.baseZoom;
        let basePitch = this.followBehindSettings.basePitch;
        
        // Apply elevation-based adjustments
        const elevationFactor = Math.min(startElevation * this.followBehindSettings.elevationSensitivity, 2);
        baseZoom = Math.max(this.followBehindSettings.minZoom, 
                           Math.min(this.followBehindSettings.maxZoom, baseZoom - elevationFactor));
        
        // Initialize the tracking variables with consistent values
        this.lastCameraZoom = baseZoom;
        this.lastCameraPitch = basePitch;
        this.lastElevation = startElevation;
        
        console.log(`🎬 Initialized terrain-aware settings: zoom=${baseZoom.toFixed(1)}, pitch=${basePitch.toFixed(1)}, elevation=${startElevation.toFixed(0)}m`);
    }

    calculateBearingBetweenPoints(lat1, lon1, lat2, lon2) {
        const toRadians = (degrees) => degrees * (Math.PI / 180);
        const toDegrees = (radians) => radians * (180 / Math.PI);
        
        const dLon = toRadians(lon2 - lon1);
        const lat1Rad = toRadians(lat1);
        const lat2Rad = toRadians(lat2);
        
        const y = Math.sin(dLon) * Math.cos(lat2Rad);
        const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - 
                  Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
        
        let bearing = toDegrees(Math.atan2(y, x));
        return (bearing + 360) % 360; // Normalize to 0-360
    }

    smoothBearing(currentBearing, targetBearing) {
        // Handle bearing wrapping (e.g., 350° -> 10°)
        let diff = targetBearing - currentBearing;
        
        if (diff > 180) {
            diff -= 360;
        } else if (diff < -180) {
            diff += 360;
        }
        
        // Apply smoothing
        const smoothedBearing = currentBearing + (diff * this.followBehindSettings.smoothing);
        return (smoothedBearing + 360) % 360; // Normalize to 0-360
    }

    disableMapInteractions() {
        if (!this.map) return;
        
        // Disable all map interactions for cinematic mode
        this.map.dragPan.disable();
        this.map.scrollZoom.disable();
        this.map.boxZoom.disable();
        this.map.dragRotate.disable();
        this.map.keyboard.disable();
        this.map.doubleClickZoom.disable();
        this.map.touchZoomRotate.disable();
        
        // Change cursor to indicate no interaction
        this.map.getCanvas().style.cursor = 'default';
        
        console.log('🎬 Map interactions disabled for follow-behind mode');
    }

    enableMapInteractions() {
        if (!this.map) return;
        
        // Re-enable all map interactions
        this.map.dragPan.enable();
        this.map.scrollZoom.enable();
        this.map.boxZoom.enable();
        this.map.dragRotate.enable();
        this.map.keyboard.enable();
        this.map.doubleClickZoom.enable();
        this.map.touchZoomRotate.enable();
        
        // Reset cursor
        this.map.getCanvas().style.cursor = '';
        
        console.log('🎬 Map interactions re-enabled for standard mode');
    }

    // Enable only zoom interactions (scroll and double-click) for the map
    enableZoomOnlyInteractions() {
        if (!this.map) return;
        // Disable all interactions first
        this.map.dragPan.disable();
        this.map.boxZoom.disable();
        this.map.dragRotate.disable();
        this.map.keyboard.disable();
        this.map.touchZoomRotate.disable();
        // Enable only zoom interactions
        this.map.scrollZoom.enable();
        this.map.doubleClickZoom.enable();
        // Cursor: default (not crosshair or grab)
        this.map.getCanvas().style.cursor = '';
        console.log('🎬 Zoom-only map interactions enabled (paused, follow-behind)');
    }

    setFollowBehindStartingPosition(instant = false) {
        if (!this.trackData || !this.map) {
            console.warn('🎬 Cannot set starting position: missing data');
            return;
        }
        
        console.log(`🎬 Setting consistent starting position for follow-behind mode ${instant ? '(instant)' : '(animated)'}`);
        
        // Get the track start point and ensure it's centered
        const startPoint = this.gpxParser.getInterpolatedPoint(0);
        if (!startPoint) {
            console.warn('🎬 No start point available');
            return;
        }
        
        console.log(`🎬 Centering overview on start point: [${startPoint.lon.toFixed(6)}, ${startPoint.lat.toFixed(6)}]`);
        
        // Calculate ideal overview zoom based on track bounds - start very wide like Spain-level
        let overviewZoom = 5; // Default very wide overview zoom (Spain-level)
        
        if (this.trackData.bounds) {
            const latDiff = this.trackData.bounds.north - this.trackData.bounds.south;
            const lonDiff = this.trackData.bounds.east - this.trackData.bounds.west;
            const maxDiff = Math.max(latDiff, lonDiff);
            
            // Calculate zoom based on track size - keep it wide for dramatic zoom-in effect
            if (maxDiff < 0.01) overviewZoom = 8;       // Very small track - still wide
            else if (maxDiff < 0.05) overviewZoom = 6;  // Small track - wide
            else if (maxDiff < 0.1) overviewZoom = 5;   // Medium track - very wide 
            else overviewZoom = 4;                      // Large track - extremely wide (Europe-level)
        }
        
        console.log(`🎬 Setting overview position: zoom ${overviewZoom} at start point`);
        
        // Set camera to overview position centered on start point
        if (instant) {
            // Instant positioning for reset
            this.map.jumpTo({
                center: [startPoint.lon, startPoint.lat],
                zoom: overviewZoom,
                pitch: 30, // Moderate 3D angle for overview
                bearing: 0 // North-up for overview
            });
        } else {
            // Animated positioning for initial setup
            this.map.easeTo({
                center: [startPoint.lon, startPoint.lat],
                zoom: overviewZoom,
                pitch: 30, // Moderate 3D angle for overview
                bearing: 0, // North-up for overview
            duration: 1000
        });
    }

        console.log('🎬 Starting position set successfully');
    }

    zoomOutToWholeTrack() {
        if (!this.trackData || !this.map) {
            console.warn('🎬 Cannot zoom out to whole track: missing data');
            return;
        }
        
        console.log('🎬 Zooming out to show whole track');
        
        if (this.trackData.bounds) {
            // Calculate a dramatic zoom-out with 3D perspective
            const fitOptions = {
                padding: 100,
                duration: 3000, // 3 second zoom-out
                pitch: 45, // Maintain 3D perspective
                bearing: 0 // Reset bearing to north-up
            };
            
            this.map.fitBounds([
                [this.trackData.bounds.west, this.trackData.bounds.south],
                [this.trackData.bounds.east, this.trackData.bounds.north]
            ], fitOptions);
            
            console.log('🎬 Zoom-out to whole track completed');
        } else {
            console.warn('🎬 No track bounds available for zoom-out');
        }
    }

    initializeCameraMode() {
        console.log('🎬 Initializing default camera mode:', this.cameraMode);
        
        // Apply default camera mode settings
        if (this.cameraMode === 'followBehind') {
            // Disable map interactions and force auto-zoom for follow-behind
            this.disableMapInteractions();
            
            const autoFollowToggle = document.getElementById('autoZoom');
            if (autoFollowToggle) {
                autoFollowToggle.checked = true;
                autoFollowToggle.disabled = true;
                this.autoZoom = true;
            }
            
            console.log('🎬 Follow-behind mode initialized as default');
        } else {
            // Standard mode - ensure map interactions are enabled
            this.enableMapInteractions();
            
            const autoFollowToggle = document.getElementById('autoZoom');
            if (autoFollowToggle) {
                autoFollowToggle.disabled = false;
            }
            
            console.log('🎬 Standard camera mode initialized as default');
        }
    }

    // Getters for compatibility
    get isAnnotationMode() {
        return this.annotations.isAnnotationMode;
    }

    get isIconChangeMode() {
        return this.iconChanges.isIconChangeMode;
    }

    /**
     * Preload all tiles covering the viewport at a given lat/lon/zoom for the current style
     */
    preloadTilesAtPosition(lat, lon, zoom, style) {
        // Determine tile URL template for the style
        const tileTemplates = {
            satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            opentopomap: 'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
            'opensnowmap-pistes': 'https://tiles.opensnowmap.org/pistes/{z}/{x}/{y}.png',
            street: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        };
        const template = tileTemplates[style] || tileTemplates['satellite'];
        if (!template) return;

        // Get viewport bounds in lat/lon
        if (!this.map) return;
        const map = this.map;
        const canvas = map.getCanvas();
        const width = canvas.width;
        const height = canvas.height;

        // Calculate bounds in lat/lon for the viewport at the given center/zoom
        // Use maplibre's projection utilities
        const center = [lon, lat];
        const originalZoom = map.getZoom();
        const originalCenter = map.getCenter();
        // Project corners at the given zoom/center
        const project = (lng, lat) => map.project([lng, lat]);
        const unproject = (x, y) => map.unproject([x, y]);
        // Calculate pixel offsets for corners
        const halfW = width / 2;
        const halfH = height / 2;
        // Center in screen pixels
        const centerPx = map.project(center);
        // Corners in screen pixels
        const nwPx = { x: centerPx.x - halfW, y: centerPx.y - halfH };
        const sePx = { x: centerPx.x + halfW, y: centerPx.y + halfH };
        // Unproject to lat/lon
        const nw = map.unproject([nwPx.x, nwPx.y]);
        const se = map.unproject([sePx.x, sePx.y]);
        // Calculate tile x/y ranges
        const minX = MapUtils.lngToTile(nw.lng, zoom);
        const maxX = MapUtils.lngToTile(se.lng, zoom);
        const minY = MapUtils.latToTile(se.lat, zoom);
        const maxY = MapUtils.latToTile(nw.lat, zoom);
        // Preload all tiles in the range
        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                const url = template.replace('{z}', zoom).replace('{x}', x).replace('{y}', y);
                if (!this.preloadedTiles.has(url)) {
                    this.preloadedTiles.add(url);
                    const img = new window.Image();
                    img.src = url;
                }
            }
        }
    }

    // Helper: Map journeyElapsedTime to segment and local progress (for journeys)
    getSegmentAndLocalProgress(journeyElapsedTime) {
        if (!this.segmentTimings || !this.segmentTimings.segments) return { segmentIndex: 0, segmentProgress: 0 };
        const segments = this.segmentTimings.segments;
        for (let i = 0; i < segments.length; i++) {
            const seg = segments[i];
            if (journeyElapsedTime >= seg.startTime && journeyElapsedTime < seg.endTime) {
                const segmentProgress = (journeyElapsedTime - seg.startTime) / seg.duration;
                return { segmentIndex: i, segmentProgress };
            }
        }
        // If at or past the end, return last segment at 1
        const last = segments.length - 1;
        return { segmentIndex: last, segmentProgress: 1 };
    }

    // Comparison Mode Methods
    addComparisonTrack(comparisonTrackData) {
        this.comparisonTrackData = comparisonTrackData;
        this.comparisonGpxParser = new GPXParser();
        this.comparisonGpxParser.trackPoints = comparisonTrackData.trackPoints;
        this.comparisonGpxParser.stats = comparisonTrackData.stats;

        if (!this.map.loaded()) {
            this.map.on('load', () => this.setupComparisonLayers());
        } else {
            this.setupComparisonLayers();
        }
    }

    setupComparisonLayers() {
        if (!this.comparisonTrackData) return;

        // Add comparison trail line (different color)
        const comparisonCoordinates = this.comparisonTrackData.trackPoints.map(point => [point.lon, point.lat]);
        
        this.map.addSource('comparison-trail', {
            type: 'geojson',
            data: {
                type: 'Feature',
                properties: {},
                geometry: {
                    type: 'LineString',
                    coordinates: comparisonCoordinates
                }
            }
        });

        this.map.addLayer({
            id: 'comparison-trail-line',
            type: 'line',
            source: 'comparison-trail',
            layout: {
                'line-join': 'round',
                'line-cap': 'round'
            },
            paint: {
                'line-color': '#FF4444', // Red color for comparison
                'line-width': 3,
                'line-opacity': 0.8
            }
        });

        // Add comparison completed trail (for progress)
        this.map.addSource('comparison-trail-completed', {
            type: 'geojson',
            data: {
                type: 'Feature',
                properties: {},
                geometry: {
                    type: 'LineString',
                    coordinates: []
                }
            }
        });

        this.map.addLayer({
            id: 'comparison-trail-completed',
            type: 'line',
            source: 'comparison-trail-completed',
            layout: {
                'line-join': 'round',
                'line-cap': 'round'
            },
            paint: {
                'line-color': '#FF0000', // Brighter red for completed
                'line-width': 4,
                'line-opacity': 1.0
            }
        });

        // Add comparison position marker
        this.map.addSource('comparison-position', {
            type: 'geojson',
            data: {
                type: 'Feature',
                properties: {},
                geometry: {
                    type: 'Point',
                    coordinates: comparisonCoordinates[0] || [0, 0]
                }
            }
        });

        this.map.addLayer({
            id: 'comparison-position-glow',
            type: 'circle',
            source: 'comparison-position',
            paint: {
                'circle-radius': 15,
                'circle-color': '#FF4444',
                'circle-opacity': 0.3,
                'circle-blur': 1
            }
        });

        // Add comparison activity icon
        this.map.addSource('comparison-activity-icon', {
            type: 'geojson',
            data: {
                type: 'Feature',
                properties: {
                    icon: '🚴‍♀️' // Different icon for comparison
                },
                geometry: {
                    type: 'Point',
                    coordinates: comparisonCoordinates[0] || [0, 0]
                }
            }
        });

        this.map.addLayer({
            id: 'comparison-activity-icon',
            type: 'symbol',
            source: 'comparison-activity-icon',
            layout: {
                'text-field': '🚴‍♀️',
                'text-size': 20,
                'text-allow-overlap': true,
                'text-ignore-placement': true,
                'text-anchor': 'center'
            }
        });

        console.log('Comparison track layers added to map');
    }

    removeComparisonTrack() {
        if (!this.map.loaded()) return;

        const layersToRemove = [
            'comparison-activity-icon',
            'comparison-position-glow',
            'comparison-trail-completed',
            'comparison-trail-line'
        ];

        const sourcesToRemove = [
            'comparison-activity-icon',
            'comparison-position',
            'comparison-trail-completed',
            'comparison-trail'
        ];

        layersToRemove.forEach(layerId => {
            if (this.map.getLayer(layerId)) {
                this.map.removeLayer(layerId);
            }
        });

        sourcesToRemove.forEach(sourceId => {
            if (this.map.getSource(sourceId)) {
                this.map.removeSource(sourceId);
            }
        });

        this.comparisonTrackData = null;
        this.comparisonGpxParser = null;

        console.log('Comparison track removed from map');
    }

    updateComparisonPosition() {
        if (!this.comparisonTrackData || !this.comparisonGpxParser || !this.map.loaded()) return;

        // Use the same progress as the main track for time-synchronized comparison
        const progress = this.animationProgress;
        const comparisonPoint = this.comparisonGpxParser.getInterpolatedPoint(progress);
        
        if (!comparisonPoint || isNaN(comparisonPoint.lat) || isNaN(comparisonPoint.lon)) {
            return;
        }

        // Update comparison position marker
        this.map.getSource('comparison-position').setData({
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [comparisonPoint.lon, comparisonPoint.lat]
            },
            properties: {
                elevation: comparisonPoint.elevation,
                speed: comparisonPoint.speed,
                distance: comparisonPoint.distance
            }
        });

        // Update comparison activity icon
        this.map.getSource('comparison-activity-icon').setData({
            type: 'Feature',
            properties: {
                icon: '🚴‍♀️'
            },
            geometry: {
                type: 'Point',
                coordinates: [comparisonPoint.lon, comparisonPoint.lat]
            }
        });

        // Update comparison completed trail
        const currentIndex = Math.floor(progress * (this.comparisonTrackData.trackPoints.length - 1));
        const completedCoordinates = this.comparisonTrackData.trackPoints
            .slice(0, currentIndex + 1)
            .map(point => [point.lon, point.lat]);

        if (completedCoordinates.length > 1) {
            // Add the interpolated current position as the last point
            completedCoordinates.push([comparisonPoint.lon, comparisonPoint.lat]);
        }

        this.map.getSource('comparison-trail-completed').setData({
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'LineString',
                coordinates: completedCoordinates
            }
        });
    }
} 