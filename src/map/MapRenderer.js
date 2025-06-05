/**
 * MapRenderer - Main map rendering class (refactored for modularity)
 */
import maplibregl from 'maplibre-gl';
import { GPXParser } from '../gpxParser.js';
import { MapUtils } from './MapUtils.js';
import { MapAnnotations } from './MapAnnotations.js';
import { MapIconChanges } from './MapIconChanges.js';
// TODO: Import other modules as they are created

export class MapRenderer {
    constructor(container) {
        this.container = container;
        this.map = null;
        this.trackData = null;
        this.animationMarker = null;
        this.isAnimating = false;
        this.animationProgress = 0;
        this.animationSpeed = 1;
        this.currentActivityType = 'running';
        this.pathColor = '#C1652F';
        this.markerSize = 1.0;
        this.autoZoom = true;
        this.showCircle = true;
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
        
        // Initialize modular components AFTER other properties are set
        this.annotations = new MapAnnotations(this);
        this.iconChanges = new MapIconChanges(this);
        
        // Debug: Log the methods available on each module
        console.log('🔍 MapRenderer constructor - Annotations methods:', {
            instance: !!this.annotations,
            enableMethod: typeof this.annotations?.enableAnnotationMode,
            addMethod: typeof this.annotations?.addAnnotation,
            getMethod: typeof this.annotations?.getAnnotations,
            allMethods: this.annotations ? Object.getOwnPropertyNames(Object.getPrototypeOf(this.annotations)) : 'N/A'
        });
        
        console.log('🔍 MapRenderer constructor - IconChanges methods:', {
            instance: !!this.iconChanges,
            enableMethod: typeof this.iconChanges?.enableIconChangeMode,
            addMethod: typeof this.iconChanges?.addIconChange,
            getMethod: typeof this.iconChanges?.getIconChanges,
            checkMethod: typeof this.iconChanges?.checkIconChanges,
            allMethods: this.iconChanges ? Object.getOwnPropertyNames(Object.getPrototypeOf(this.iconChanges)) : 'N/A'
        });
        
        // Ensure proper method binding for icon changes
        if (this.iconChanges && typeof this.iconChanges.checkIconChanges === 'function') {
            // Explicitly bind the method to ensure it's available
            this.iconChanges.checkIconChanges = this.iconChanges.checkIconChanges.bind(this.iconChanges);
            console.log('✅ MapRenderer: iconChanges.checkIconChanges method properly bound');
        } else {
            console.error('❌ MapRenderer: iconChanges.checkIconChanges method not found');
        }
        
        this.initializeMap();
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
                    'terrain': {
                        type: 'raster',
                        tiles: [
                            'https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}.png'
                        ],
                        tileSize: 256,
                        attribution: '© Stadia Maps © Stamen Design © OpenMapTiles'
                    },
                    'satellite': {
                        type: 'raster',
                        tiles: [
                            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                        ],
                        tileSize: 256,
                        attribution: '© Esri'
                    }
                },
                layers: [
                    {
                        id: 'background',
                        type: 'raster',
                        source: 'satellite'
                    }
                ]
            },
            center: [0, 0],
            zoom: 8,
            pitch: 0,
            bearing: 0,
            maxPitch: 85,
            antialias: true,
            preserveDrawingBuffer: true
        });

        this.map.on('load', () => {
            this.setupMapLayers();
            console.log('Map loaded successfully - basic navigation should work');
        });

        // Add click handler for annotations and icon changes
        this.map.on('click', (e) => {
            console.log('🗺️ Map clicked:', {
                isAnnotationMode: this.isAnnotationMode,
                isIconChangeMode: this.isIconChangeMode,
                coords: [e.lngLat.lng, e.lngLat.lat]
            });
            
            if (this.isAnnotationMode) {
                console.log('🎯 Handling annotation click');
                this.annotations.handleAnnotationClick(e);
            } else if (this.isIconChangeMode) {
                console.log('🎯 Handling icon change click');
                // Stop event propagation to prevent modal from closing immediately
                e.originalEvent?.stopPropagation();
                this.iconChanges.handleIconChangeClick(e);
            }
        });

        // Change cursor when in special modes
        this.map.on('mouseenter', () => {
            if (this.isAnnotationMode || this.isIconChangeMode) {
                console.log('🖱️ Setting crosshair cursor - annotation mode:', this.isAnnotationMode, 'icon change mode:', this.isIconChangeMode);
                this.map.getCanvas().style.cursor = 'crosshair';
            } else {
                this.map.getCanvas().style.cursor = '';
            }
        });

        // Also update cursor on mousemove to ensure it stays correct
        this.map.on('mousemove', () => {
            if (this.isAnnotationMode || this.isIconChangeMode) {
                if (this.map.getCanvas().style.cursor !== 'crosshair') {
                    console.log('🖱️ Correcting cursor to crosshair during special mode');
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
                'line-dasharray': [
                    'case',
                    ['==', ['get', 'isTransportation'], true],
                    [
                        'case',
                        ['==', ['get', 'segmentMode'], 'plane'], ['literal', [2, 2]],
                        ['==', ['get', 'segmentMode'], 'boat'], ['literal', [5, 3]],
                        ['literal', [1]]
                    ],
                    ['literal', [1]]
                ]
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
        this.createAndAddActivityIconLayer();

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

    // Delegate icon change methods to the iconChanges module
    enableIconChangeMode() {
        console.log('🎯 MapRenderer.enableIconChangeMode() called');
        if (this.iconChanges && typeof this.iconChanges.enableIconChangeMode === 'function') {
            const result = this.iconChanges.enableIconChangeMode();
            console.log('🎯 Icon change mode enabled, isIconChangeMode:', this.isIconChangeMode);
            return result;
        } else {
            console.error('iconChanges.enableIconChangeMode not available');
        }
    }

    disableIconChangeMode() {
        console.log('🎯 MapRenderer.disableIconChangeMode() called');
        console.trace('🎯 Stack trace for disableIconChangeMode call:');
        if (this.iconChanges && typeof this.iconChanges.disableIconChangeMode === 'function') {
            const result = this.iconChanges.disableIconChangeMode();
            console.log('🎯 Icon change mode disabled, isIconChangeMode:', this.isIconChangeMode);
            return result;
        } else {
            console.error('iconChanges.disableIconChangeMode not available');
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
    }

    setMarkerSize(size) {
        this.markerSize = size;
        
        if (this.map.loaded()) {
            this.map.setPaintProperty('current-position-glow', 'circle-radius', 15 * size);
            if (this.map.getLayer('activity-icon')) {
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
        
        if (!this.gpxParser.trackPoints || this.gpxParser.trackPoints !== this.trackData.trackPoints) {
            this.gpxParser.trackPoints = this.trackData.trackPoints;
        }
        
        return true;
    }

    loadTrack(trackData) {
        this.trackData = trackData;
        
        if (!trackData.trackPoints || trackData.trackPoints.length === 0) {
            return;
        }

        // Create GeoJSON for the trail with elevation data
        const coordinates = trackData.trackPoints.map(point => {
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
        if (trackData.bounds && 
            !isNaN(trackData.bounds.west) && !isNaN(trackData.bounds.south) && 
            !isNaN(trackData.bounds.east) && !isNaN(trackData.bounds.north)) {
            
            const fitOptions = {
                padding: 50,
                duration: 1000
            };
            
            if (this.is3DMode) {
                fitOptions.pitch = 45;
                fitOptions.bearing = 0;
            }
            
            try {
                this.map.fitBounds([
                    [trackData.bounds.west, trackData.bounds.south],
                    [trackData.bounds.east, trackData.bounds.north]
                ], fitOptions);
            } catch (error) {
                console.error('Error fitting map bounds:', error, 'Bounds:', trackData.bounds);
            }
        }

        // Reset animation 
        this.animationProgress = 0;
        if (!trackData.isJourney) {
            this.iconChanges.iconChanges = [];
        }
        this.annotations.annotations = [];
        
        // Set current icon to the base activity icon
        this.currentIcon = this.getBaseIcon();
        
        // Initialize icon if map is loaded
        if (this.map.loaded()) {
            this.setActivityType(this.currentActivityType);
        } else {
            this.map.once('load', () => {
                this.setActivityType(this.currentActivityType);
            });
        }
        
        this.updateCurrentPosition();
        
        // Apply 3D rendering if in 3D mode
        if (this.is3DMode) {
            this.update3DTrailRendering();
        }
    }

    updateCurrentPosition() {
        // Ensure GPX parser is ready
        if (!this.ensureGPXParserReady()) {
            return;
        }
        
        const currentPoint = this.gpxParser.getInterpolatedPoint(this.animationProgress);
        
        if (currentPoint) {
            if (isNaN(currentPoint.lat) || isNaN(currentPoint.lon)) {
                console.error('NaN coordinates from interpolated point:', currentPoint, 'Progress:', this.animationProgress);
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
                    this.iconChanges.checkIconChanges(this.animationProgress);
                } catch (error) {
                    console.error('Error calling checkIconChanges:', error);
                }
            }

            // Check for annotations
            if (this.annotations && typeof this.annotations.checkAnnotations === 'function') {
                this.annotations.checkAnnotations(this.animationProgress);
            }

            // Auto zoom to follow the marker
            if (this.autoZoom && this.isAnimating) {
                if (this.is3DMode) {
                    this.map.easeTo({
                        center: [currentPoint.lon, currentPoint.lat],
                        duration: 100,
                        pitch: this.map.getPitch(),
                        bearing: this.map.getBearing()
                    });
                } else {
                    this.map.easeTo({
                        center: [currentPoint.lon, currentPoint.lat],
                        duration: 100
                    });
                }
            }

            // Ensure activity icon layer exists and is visible
            this.ensureActivityIconLayer();
        } else {
            console.error('Could not get interpolated point for progress:', this.animationProgress);
        }
    }

    startAnimation() {
        if (!this.trackData || this.isAnimating || !this.segmentTimings) {
            return;
        }
        
        this.isAnimating = true;
        this.lastAnimationTime = 0;
        
        if (this.segmentTimings && this.segmentTimings.totalDuration) {
            this.journeyElapsedTime = this.animationProgress * this.segmentTimings.totalDuration;
        }
        
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
        
        if (this.segmentTimings.totalDuration > 0) {
            this.animationProgress = Math.min(this.journeyElapsedTime / this.segmentTimings.totalDuration, 1);
        }
        
        if (this.animationProgress >= 1) {
            this.animationProgress = 1;
            this.journeyElapsedTime = this.segmentTimings.totalDuration;
            this.isAnimating = false;
        }

        this.updateCurrentPosition();

        if (this.isAnimating) {
            requestAnimationFrame(() => this.animate());
        }
    }

    stopAnimation() {
        this.isAnimating = false;
    }

    resetAnimation() {
        this.isAnimating = false;
        this.animationProgress = 0;
        this.currentSegmentIndex = 0;
        this.segmentProgress = 0;
        this.lastAnimationTime = 0;
        this.journeyElapsedTime = 0;
        this.annotations.hideActiveAnnotation();
        this.updateCurrentPosition();
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
            
            // Draw the emoji
            const fontSize = Math.floor(size * 0.5 * this.markerSize);
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
            this.map.setLayoutProperty('activity-icon', 'visibility', 'visible');
            this.map.setLayoutProperty('activity-icon', 'icon-size', this.markerSize);
            this.map.setPaintProperty('activity-icon', 'icon-opacity', 1);
        }
    }

    ensureActivityIconLayer() {
        if (!this.map.getLayer('activity-icon')) {
            this.createAndAddActivityIconLayer(true);
        } else {
            this.map.setLayoutProperty('activity-icon', 'visibility', 'visible');
            this.map.setPaintProperty('activity-icon', 'icon-opacity', 1);
            
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
                        this.map.addLayer({
                            id: 'activity-icon',
                            type: 'symbol',
                            source: 'current-position',
                            layout: {
                                'icon-image': 'activity-icon',
                                'icon-size': this.markerSize,
                                'icon-allow-overlap': true,
                                'icon-ignore-placement': true,
                                'icon-anchor': 'center'
                            },
                            paint: {
                                'icon-opacity': 1
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
                                'visibility': 'visible'
                            },
                            paint: {
                                'icon-opacity': 1
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
            const fitOptions = {
                padding: 50,
                duration: 1000
            };
            
            if (this.is3DMode) {
                fitOptions.pitch = 45;
                fitOptions.bearing = 0;
                fitOptions.maxZoom = 16;
                fitOptions.padding = 80;
            }
            
            this.map.fitBounds([
                [this.trackData.bounds.west, this.trackData.bounds.south],
                [this.trackData.bounds.east, this.trackData.bounds.north]
            ], fitOptions);
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
        
        if (this.segmentTimings && this.segmentTimings.totalDuration) {
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
        this.lastAnimationTime = 0;
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
            'terrain': {
                source: 'terrain',
                attribution: '© Stadia Maps © Stamen Design'
            },
            'street': {
                source: 'osm',
                attribution: '© OpenStreetMap contributors'
            }
        };

        const config = layerConfigs[style] || layerConfigs['satellite'];
        
        if (this.map.getLayer('background')) {
            this.map.removeLayer('background');
        }
        
        this.map.addLayer({
            id: 'background',
            type: 'raster',
            source: config.source
        });

        const layers = this.map.getStyle().layers;
        if (layers && layers.length > 1) {
            const firstLayer = layers.find(layer => layer.id !== 'background');
            if (firstLayer) {
                this.map.moveLayer('background', firstLayer.id);
            }
        }
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

    // Getters for compatibility
    get isAnnotationMode() {
        return this.annotations.isAnnotationMode;
    }

    get isIconChangeMode() {
        return this.iconChanges.isIconChangeMode;
    }
} 