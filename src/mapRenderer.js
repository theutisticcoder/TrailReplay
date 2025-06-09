import maplibregl from 'maplibre-gl';
import * as THREE from 'three';
import { GPXParser } from './gpxParser.js';

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
        this.annotations = [];
        this.iconChanges = [];
        this.currentIcon = '🏃‍♂️';
        this.isAnnotationMode = false;
        this.isIconChangeMode = false;
        this.activeAnnotation = null;
        this.gpxParser = new GPXParser();
        
        // Segment-aware animation properties
        this.segmentTimings = null;
        this.currentSegmentIndex = 0;
        this.segmentProgress = 0;
        this.lastAnimationTime = 0;
        this.journeyElapsedTime = 0;
        
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
            center: [0, 0], // Will be updated when track is loaded
            zoom: 8, // Better default zoom level (was 2)
            pitch: 0, // Start with 2D view
            bearing: 0,
            maxPitch: 85, // Allow steep 3D viewing angles
            antialias: true,
            // Enable preserveDrawingBuffer for video capture support
            preserveDrawingBuffer: true
            // Remove explicit navigation control settings - let MapLibre handle defaults
        });

        // Navigation controls (zoom buttons) disabled for cleaner look
        // this.map.addControl(new maplibregl.NavigationControl());
        
        this.map.on('load', () => {
            this.setupMapLayers();
            // DON'T setup terrain source automatically - only when 3D is enabled
            console.log('Map loaded successfully - basic navigation should work');
        });

        // Add click handler for annotations and icon changes
        this.map.on('click', (e) => {
            if (this.isAnnotationMode) {
                this.handleAnnotationClick(e);
            } else if (this.isIconChangeMode) {
                this.handleIconChangeClick(e);
            }
        });

        // Change cursor when in special modes
        this.map.on('mouseenter', () => {
            if (this.isAnnotationMode || this.isIconChangeMode) {
                this.map.getCanvas().style.cursor = 'crosshair';
            }
        });
        
        // Track 3D mode state
        this.is3DMode = false;
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

        // Add trail line layer (full trail) with data-driven styling for segments
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
                    ['==', ['get', 'isTransportation'], true], 6, // thicker for transportation
                    4 // normal width for tracks
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
                        ['==', ['get', 'segmentMode'], 'plane'], ['literal', [2, 2]], // dashed for plane
                        ['==', ['get', 'segmentMode'], 'boat'], ['literal', [5, 3]], // different dash for boat
                        ['literal', [1]] // solid for car/train/etc
                    ],
                    ['literal', [1]] // solid for tracks
                ]
            }
        });

        // Add completed trail line layer (trail already traveled)
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

        // Add current position marker (enhanced)
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

        // Create icon and add layer after it's ready
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

    createAndAddActivityIcon() {
        try {
            console.log('Creating activity icon with emoji:', this.currentIcon, 'showCircle:', this.showCircle);
            
            // Use a larger size to accommodate the background circle
            const size = 64;
            
            // Create canvas with proper device pixel ratio handling
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            canvas.style.width = size + 'px';
            canvas.style.height = size + 'px';
            
            const ctx = canvas.getContext('2d');
            
            // Clear canvas
            ctx.clearRect(0, 0, size, size);
            
            // Draw background circle if enabled
            if (this.showCircle) {
                console.log('Drawing background circle');
                // Draw larger background circle for better visibility
                const circleRadius = size * 0.45; // Circle takes up 90% of canvas
                
                // Draw background circle with white fill
                ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                ctx.beginPath();
                ctx.arc(size/2, size/2, circleRadius, 0, 2 * Math.PI);
                ctx.fill();
                
                // Add border around the circle
                ctx.strokeStyle = '#333333';
                ctx.lineWidth = 2;
                ctx.stroke();
            } else {
                console.log('Skipping background circle');
            }
            
            // Draw the emoji on top (smaller than the circle)
            const fontSize = Math.floor(size * 0.5 * this.markerSize); // Emoji is smaller than circle
            ctx.font = `bold ${fontSize}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#000000';
            
            // Add shadow for emoji visibility (especially when no circle)
            if (!this.showCircle) {
                console.log('Adding shadow for visibility');
                ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
                ctx.shadowBlur = 6;
                ctx.shadowOffsetX = 2;
                ctx.shadowOffsetY = 2;
            } else {
                console.log('No shadow needed with circle');
                // Reset shadow when circle is shown
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
            }
            
            ctx.fillText(this.currentIcon, size/2, size/2);
            
            // Create ImageData from canvas
            const imageData = ctx.getImageData(0, 0, size, size);
            
            // Add icon to map (remove existing one first if it exists)
            if (this.map.hasImage && this.map.hasImage('activity-icon')) {
                this.map.removeImage('activity-icon');
                console.log('Removed existing activity icon');
            }
            
            // Add image using ImageData instead of canvas
            this.map.addImage('activity-icon', {
                width: size,
                height: size,
                data: imageData.data
            });
            
            console.log('Activity icon image added to map successfully');
            
            // Verify the image was added
            if (this.map.hasImage('activity-icon')) {
                console.log('✓ Activity icon image confirmed in map');
            } else {
                console.error('✗ Activity icon image NOT found in map after adding');
            }
            
        } catch (error) {
            console.error('Error creating activity icon:', error);
        }
    }

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
        
        // Add the background layer without specifying a beforeId
        // This will place it as the bottom layer automatically
        this.map.addLayer({
            id: 'background',
            type: 'raster',
            source: config.source
        });

        // Move the background layer to the bottom if other layers exist
        const layers = this.map.getStyle().layers;
        if (layers && layers.length > 1) {
            // Find the first non-background layer to move background before it
            const firstLayer = layers.find(layer => layer.id !== 'background');
            if (firstLayer) {
                this.map.moveLayer('background', firstLayer.id);
            }
        }
    }

    loadTrack(trackData) {
        this.trackData = trackData;
        
        if (!trackData.trackPoints || trackData.trackPoints.length === 0) {
            return;
        }

        // Create GeoJSON for the trail with elevation data
        const coordinates = trackData.trackPoints.map(point => {
            // Include elevation in coordinates for 3D terrain
            const elevation = point.elevation || 0;
            return [point.lon, point.lat, elevation];
        });
        
        // Handle journey segments if available
        if (trackData.isJourney && trackData.segments) {
            console.log('Loading journey with segments for 3D terrain:', trackData.segments);
            this.loadJourneySegments(trackData, coordinates);
        } else {
            // Standard single track with elevation
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

            // Update trail line source
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
            
            // In 3D mode, adjust the fit to account for terrain elevation
            if (this.is3DMode) {
                fitOptions.pitch = 45; // Moderate tilt for 3D viewing
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
        } else {
            console.warn('Invalid or missing track bounds, skipping map fit:', trackData.bounds);
        }

        // Reset animation and icon changes (don't clear them for journeys as they're auto-generated)
        this.animationProgress = 0;
        if (!trackData.isJourney) {
            this.iconChanges = [];
        }
        this.annotations = [];
        
        // Set current icon to the base activity icon
        this.currentIcon = this.getBaseIcon();
        
        // Reset to initial icon based on activity type (only if map is loaded)
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

    // Load journey segments with visual differentiation
    loadJourneySegments(trackData, coordinates) {
        // Create a combined trail line for the main path
        const trailLineData = {
            type: 'FeatureCollection',
            features: []
        };

        // Add each segment as a separate feature with different styling
        trackData.segments.forEach((segment, index) => {
            const segmentCoords = coordinates.slice(segment.startIndex, segment.endIndex + 1);
            
            if (segmentCoords.length < 2) return; // Skip invalid segments
            
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

        // Update the trail line source with segmented data
        this.map.getSource('trail-line').setData(trailLineData);
        
        // Add segment transition markers
        this.addSegmentTransitionMarkers(trackData.segments, coordinates);
    }

    // Add visual markers at segment transitions
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
        
        // Add transition markers source if it doesn't exist
        if (!this.map.getSource('segment-transitions')) {
            this.map.addSource('segment-transitions', {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: transitionFeatures
                }
            });
            
            // Add transition markers layer
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
            // Update existing source
            this.map.getSource('segment-transitions').setData({
                type: 'FeatureCollection',
                features: transitionFeatures
            });
        }
    }

    async updateCurrentPosition() {
        // Performance throttling during recording
        if (this.performanceMode && this.updateThrottle) {
            const now = performance.now();
            if (this.lastUpdateTime && (now - this.lastUpdateTime) < this.updateThrottle) {
                return; // Skip this update
            }
            this.lastUpdateTime = now;
        }
        
        // Ensure GPX parser is ready
        if (!this.ensureGPXParserReady()) {
            return;
        }
        
        const currentPoint = this.gpxParser.getInterpolatedPoint(this.animationProgress);
        
        // Debug: Check the interpolated point
        if (currentPoint) {
            if (isNaN(currentPoint.lat) || isNaN(currentPoint.lon)) {
                console.error('NaN coordinates from interpolated point:', currentPoint, 'Progress:', this.animationProgress);
                return;
            }
        }
        
        if (currentPoint) {
            
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

            // Update completed trail (trail already traveled)
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

            // ALWAYS check for icon changes at current position
            this.checkIconChanges(this.animationProgress);

            // Check for annotations (skip during performance mode to reduce overhead)
            if (!this.performanceMode) {
                this.checkAnnotations(this.animationProgress);
            }

            // Auto zoom to follow the marker (always if auto zoom is enabled and we're animating)
            // Allow autofollow during video recording (performance mode) when user wants it
            if (this.autoZoom && this.isAnimating) {
                if (this.is3DMode) {
                    // In 3D mode, maintain the camera angle while following
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
        } else {
            console.error('Could not get interpolated point for progress:', this.animationProgress);
        }
    }

    // Ensure activity icon layer exists and is properly configured
    ensureActivityIconLayer() {
        if (!this.map.getLayer('activity-icon')) {
            console.warn('Activity icon layer not found! Recreating...');
            this.createAndAddActivityIconLayer(true); // Immediate creation
        } else {
            // Ensure the layer is visible and properly configured
            this.map.setLayoutProperty('activity-icon', 'visibility', 'visible');
            this.map.setPaintProperty('activity-icon', 'icon-opacity', 1);
            
            // Verify the icon image exists and is current
            if (!this.map.hasImage('activity-icon')) {
                console.warn('Activity icon image missing! Recreating...');
                this.createAndAddActivityIcon();
            }
        }
    }

    checkIconChanges(progress) {
        if (this.iconChanges.length === 0) {
            // No icon changes defined - keep current icon as is
            // Don't automatically revert to base icon, respect manually set icons
            return;
        }
        
        console.log('Checking icon changes at progress:', progress.toFixed(3), 'Total changes:', this.iconChanges.length);
        
        const sortedChanges = this.iconChanges.sort((a, b) => a.progress - b.progress);
        
        // Start with the base icon (activity type icon)
        const baseIcon = this.getBaseIcon();
        let activeIcon = baseIcon;
        
        // Find the icon that should be active at this progress
        for (const change of sortedChanges) {
            console.log(`Checking change at progress ${change.progress.toFixed(3)} (current: ${progress.toFixed(3)}): ${change.icon}`);
            if (progress >= change.progress) {
                activeIcon = change.icon;
                console.log(`Applied icon change: ${activeIcon} at progress ${progress.toFixed(3)}`);
            } else {
                break; // No more changes apply
            }
        }
        
        // Only update if the icon has actually changed
        if (activeIcon !== this.currentIcon) {
            console.log(`Icon change detected: ${this.currentIcon} → ${activeIcon} at progress ${progress.toFixed(3)}`);
            this.currentIcon = activeIcon;
            
            // Force icon update immediately
            this.forceIconUpdate();
            
            // Dispatch event to update UI
            const iconChangeEvent = new CustomEvent('iconChanged', {
                detail: { icon: activeIcon, progress: progress }
            });
            document.dispatchEvent(iconChangeEvent);
        } else {
            // Even if icon didn't change, ensure it's properly displayed
            this.ensureActivityIconLayer();
        }
    }

    // Force icon update with complete refresh
    forceIconUpdate() {
        try {
            console.log('Forcing icon update to:', this.currentIcon);
            
            // Remove existing layer and image completely
            if (this.map.getLayer('activity-icon')) {
                this.map.removeLayer('activity-icon');
                console.log('Removed existing activity icon layer');
            }
            
            if (this.map.hasImage('activity-icon')) {
                this.map.removeImage('activity-icon');
                console.log('Removed existing activity icon image');
            }
            
            // Wait a tiny bit for cleanup, then recreate
            setTimeout(() => {
                this.createAndAddActivityIcon();
                
                setTimeout(() => {
                    if (!this.map.getLayer('activity-icon')) {
                        console.log('Adding new activity icon layer after cleanup');
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
                        console.log('New activity icon layer added successfully');
                    }
                }, 50);
            }, 10);
            
        } catch (error) {
            console.error('Error in forceIconUpdate:', error);
        }
    }

    getBaseIcon() {
        const icons = {
            'running': '🏃‍♂️',
            'cycling': '🚴‍♂️',
            'swimming': '🏊‍♂️',
            'hiking': '🥾',
            'triathlon': '🏆'
        };
        return icons[this.currentActivityType] || icons['running'];
    }

    checkAnnotations(progress) {
        // Hide current annotation if we've moved past it
        if (this.activeAnnotation && progress > this.activeAnnotation.endProgress) {
            this.hideActiveAnnotation();
        }

        // Check for new annotations to show
        for (const annotation of this.annotations) {
            const annotationProgress = annotation.progress;
            const threshold = 0.02; // Show annotation for 2% of the trail

            if (progress >= annotationProgress && progress <= annotationProgress + threshold) {
                if (!this.activeAnnotation || this.activeAnnotation.id !== annotation.id) {
                    this.showActiveAnnotation(annotation, annotationProgress + threshold);
                }
                break;
            }
        }
    }

    showActiveAnnotation(annotation, endProgress) {
        this.activeAnnotation = { ...annotation, endProgress };
        
        const annotationDisplay = document.getElementById('activeAnnotation');
        const icon = annotationDisplay.querySelector('.annotation-popup-icon');
        const title = annotationDisplay.querySelector('.annotation-popup-title');
        const description = annotationDisplay.querySelector('.annotation-popup-description');
        
        icon.textContent = annotation.icon;
        title.textContent = annotation.title;
        description.textContent = annotation.description || '';
        description.style.display = annotation.description ? 'block' : 'none';
        
        annotationDisplay.style.display = 'block';
        
        // Add close handler
        const closeBtn = annotationDisplay.querySelector('.annotation-popup-close');
        closeBtn.onclick = () => this.hideActiveAnnotation();
    }

    hideActiveAnnotation() {
        this.activeAnnotation = null;
        document.getElementById('activeAnnotation').style.display = 'none';
    }

    createAndAddActivityIconLayer(immediate = false) {
        try {
            console.log('Creating activity icon layer...');
            
            // First create the icon image
            this.createAndAddActivityIcon();
            
            // Add the layer immediately if requested, or wait a bit for normal creation
            const delay = immediate ? 10 : 100;
            setTimeout(() => {
                try {
                    if (!this.map.getLayer('activity-icon')) {
                        console.log('Adding activity icon layer...');
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
                        console.log('Activity icon layer added successfully');
                    }
                } catch (layerError) {
                    console.error('Error adding activity icon layer:', layerError);
                }
            }, delay);
            
        } catch (error) {
            console.error('Error creating activity icon layer:', error);
        }
    }

    updateActivityIcon() {
        console.log('updateActivityIcon() called - checking conditions...');
        console.log('Map loaded:', this.map.loaded());
        console.log('Map hasImage:', !!this.map.hasImage);
        
        if (!this.map.loaded() || !this.map.hasImage) {
            console.log('Map not ready for icon update');
            return;
        }

        try {
            console.log('Updating activity icon with emoji:', this.currentIcon, 'showCircle:', this.showCircle);
            
            // Use a larger size to accommodate the background circle
            const size = 64;
            
            // Create canvas with proper device pixel ratio handling
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            canvas.style.width = size + 'px';
            canvas.style.height = size + 'px';
            
            const ctx = canvas.getContext('2d');
            
            // Clear canvas
            ctx.clearRect(0, 0, size, size);
            
            // Draw background circle if enabled
            if (this.showCircle) {
                console.log('Drawing background circle in update');
                // Draw larger background circle for better visibility
                const circleRadius = size * 0.45; // Circle takes up 90% of canvas
                
                // Draw background circle with white fill
                ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                ctx.beginPath();
                ctx.arc(size/2, size/2, circleRadius, 0, 2 * Math.PI);
                ctx.fill();
                
                // Add border around the circle
                ctx.strokeStyle = '#333333';
                ctx.lineWidth = 2;
                ctx.stroke();
            } else {
                console.log('Skipping background circle in update');
            }
            
            // Draw the emoji on top (smaller than the circle)
            const fontSize = Math.floor(size * 0.5 * this.markerSize); // Emoji is smaller than circle
            ctx.font = `bold ${fontSize}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#000000';
            
            // Add shadow for emoji visibility (especially when no circle)
            if (!this.showCircle) {
                console.log('Adding shadow for visibility in update');
                ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
                ctx.shadowBlur = 6;
                ctx.shadowOffsetX = 2;
                ctx.shadowOffsetY = 2;
            } else {
                console.log('No shadow needed with circle in update');
                // Reset shadow when circle is shown
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
            }
            
            ctx.fillText(this.currentIcon, size/2, size/2);
            
            // Create ImageData from canvas
            const imageData = ctx.getImageData(0, 0, size, size);
            
            // Remove and re-add icon to avoid size mismatch issues
            if (this.map.hasImage('activity-icon')) {
                this.map.removeImage('activity-icon');
                console.log('Removed existing activity icon in update');
            }
            
            // Add image using ImageData instead of canvas
            this.map.addImage('activity-icon', {
                width: size,
                height: size,
                data: imageData.data
            });
            
            // Ensure the icon layer is visible and properly configured
            if (this.map.getLayer('activity-icon')) {
                this.map.setLayoutProperty('activity-icon', 'visibility', 'visible');
                this.map.setLayoutProperty('activity-icon', 'icon-size', this.markerSize);
                this.map.setPaintProperty('activity-icon', 'icon-opacity', 1);
            }
            
            console.log('Activity icon updated successfully to:', this.currentIcon);
        } catch (error) {
            console.error('Error updating activity icon:', error);
        }
    }

    setActivityType(activityType) {
        this.currentActivityType = activityType;
        this.currentIcon = this.getBaseIcon();
        
        // Only update icon if map is loaded
        if (this.map && this.map.loaded()) {
            this.updateActivityIcon();
        }
    }

    setCurrentIcon(icon) {
        this.currentIcon = icon;
        
        // Only update icon if map is loaded
        if (this.map && this.map.loaded()) {
            this.updateActivityIcon();
        }
        
        // Dispatch event to update UI
        const iconUpdateEvent = new CustomEvent('currentIconUpdated', {
            detail: { icon }
        });
        document.dispatchEvent(iconUpdateEvent);
    }

    setPathColor(color) {
        this.pathColor = color;
        
        // Update trail colors
        this.map.setPaintProperty('trail-line', 'line-color', color);
        this.map.setPaintProperty('trail-completed', 'line-color', color);
        this.map.setPaintProperty('current-position-glow', 'circle-color', color);
    }

    setMarkerSize(size) {
        this.markerSize = size;
        
        // Update marker sizes
        this.map.setPaintProperty('current-position-glow', 'circle-radius', 15 * size);
        this.map.setLayoutProperty('activity-icon', 'icon-size', size);
        
        // Recreate activity icon with new size (only if map is loaded)
        if (this.map && this.map.loaded()) {
            this.updateActivityIcon();
        }
    }

    setAutoZoom(enabled) {
        this.autoZoom = enabled;
    }

    setShowCircle(enabled) {
        console.log('Setting show circle to:', enabled);
        this.showCircle = enabled;
        
        // Regenerate the activity icon with or without the background circle
        if (this.map && this.map.loaded()) {
            console.log('Updating activity icon with showCircle:', this.showCircle);
            this.updateActivityIcon();
        } else {
            console.log('Map not ready for icon update');
        }
    }

    setAnimationSpeed(speed) {
        this.animationSpeed = speed;
    }

    // Zoom controls
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
            
            // In 3D mode, adjust camera for better terrain visualization
            if (this.is3DMode) {
                fitOptions.pitch = 45; // Moderate angle for better terrain viewing (reduced from 70)
                fitOptions.bearing = 0;
                // In 3D mode, ensure reasonable zoom level
                fitOptions.maxZoom = 16; // Prevent zooming too close in 3D mode
                fitOptions.padding = 80; // More padding for 3D perspective
            }
            
            this.map.fitBounds([
                [this.trackData.bounds.west, this.trackData.bounds.south],
                [this.trackData.bounds.east, this.trackData.bounds.north]
            ], fitOptions);
        } else {
            // If no track data, center on current location or reasonable default
            const currentZoom = this.map.getZoom();
            if (currentZoom < 5) {
                // If zoomed out too far, zoom to a reasonable level
                this.map.easeTo({
                    zoom: Math.max(8, currentZoom),
                    pitch: this.is3DMode ? 45 : 0,
                    duration: 1000
                });
            }
        }
    }

    // Animation controls
    startAnimation() {
        if (!this.trackData || this.isAnimating) return;
        
        this.isAnimating = true;
        
        // ONLY reset timing if we're starting from the beginning (progress = 0)
        // Don't reset when resuming from a pause or seeked position
        if (this.animationProgress === 0) {
            this.lastAnimationTime = 0;
            this.journeyElapsedTime = 0;
            console.log('Starting animation from beginning - reset timing');
        } else {
            // When resuming from a seeked position, preserve the journey elapsed time
            this.lastAnimationTime = 0; // Reset frame timing only
            
            // Ensure journeyElapsedTime matches the current progress if we have segment timing
            if (this.segmentTimings && this.segmentTimings.totalDuration) {
                this.journeyElapsedTime = this.animationProgress * this.segmentTimings.totalDuration;
                console.log(`Resuming from seeked position: progress=${this.animationProgress.toFixed(3)}, journeyTime=${this.journeyElapsedTime.toFixed(1)}s`);
            } else {
                console.log(`Resuming from progress: ${this.animationProgress.toFixed(3)} (no segment timing)`);
            }
        }
        
        // Initialize segment progress based on current animation progress
        if (this.segmentTimings) {
            this.updateSegmentProgress(this.animationProgress);
        }
        
        // Force update current position to ensure correct icon and position
        this.updateCurrentPosition();
        
        this.animate();
    }

    stopAnimation() {
        this.isAnimating = false;
        // DON'T reset progress when stopping - just stop the animation
        console.log('Animation stopped at progress:', this.animationProgress.toFixed(3));
    }

    resetAnimation() {
        this.isAnimating = false;
        this.animationProgress = 0;
        this.currentSegmentIndex = 0;
        this.segmentProgress = 0;
        this.lastAnimationTime = 0;
        this.journeyElapsedTime = 0; // Reset journey time
        this.hideActiveAnnotation();
        this.updateCurrentPosition();
    }

    animate() {
        if (!this.isAnimating) return;

        const currentTime = performance.now();
        if (this.lastAnimationTime === 0) {
            this.lastAnimationTime = currentTime;
        }
        
        const deltaTime = currentTime - this.lastAnimationTime;
        this.lastAnimationTime = currentTime;

        if (this.segmentTimings && this.segmentTimings.segments && this.segmentTimings.segments.length > 0) {
            // Advanced segment-aware animation
            this.animateWithSegmentTiming(deltaTime);
        } else {
            // Fallback to original animation method
            const progressIncrement = 0.001 * this.animationSpeed;
            this.animationProgress += progressIncrement;
        }
        
        if (this.animationProgress >= 1) {
            this.animationProgress = 1;
            this.isAnimating = false;
        }

        this.updateCurrentPosition();

        if (this.isAnimating) {
            requestAnimationFrame(() => this.animate());
        }
    }

    // Handle animation with individual segment timing - completely rewritten for accuracy
    animateWithSegmentTiming(deltaTime) {
        // Ensure we have valid segment timing data
        if (!this.segmentTimings || !this.segmentTimings.segments || !this.segmentTimings.totalDuration) {
            console.error('Invalid segment timing data in animateWithSegmentTiming:', this.segmentTimings);
            // Fallback to simple animation
            const progressIncrement = 0.001 * this.animationSpeed;
            this.animationProgress += progressIncrement;
            return;
        }
        
        // Convert deltaTime from milliseconds to seconds
        const deltaSeconds = deltaTime / 1000;
        
        // Initialize journey elapsed time if not set
        if (this.journeyElapsedTime === undefined || this.journeyElapsedTime === null) {
            this.journeyElapsedTime = 0;
            console.log('Initialized journeyElapsedTime to 0');
        }
        
        // Add elapsed time
        this.journeyElapsedTime += deltaSeconds;
        
        const totalDuration = this.segmentTimings.totalDuration;
        
        // Clamp to total duration
        if (this.journeyElapsedTime >= totalDuration) {
            this.journeyElapsedTime = totalDuration;
            this.animationProgress = 1;
            this.isAnimating = false;
            console.log('Animation completed at total duration:', totalDuration);
            return;
        }
        
        // Calculate overall progress based on time
        const timeProgress = this.journeyElapsedTime / totalDuration;
        
        // Find the current segment based on elapsed time
        let currentSegment = null;
        let currentSegmentIndex = -1;
        
        for (let i = 0; i < this.segmentTimings.segments.length; i++) {
            const segment = this.segmentTimings.segments[i];
            if (this.journeyElapsedTime >= segment.startTime && this.journeyElapsedTime <= segment.endTime) {
                currentSegment = segment;
                currentSegmentIndex = i;
                break;
            }
        }
        
        // Handle edge cases
        if (!currentSegment) {
            if (this.journeyElapsedTime < this.segmentTimings.segments[0].startTime) {
                // Before first segment
                currentSegment = this.segmentTimings.segments[0];
                currentSegmentIndex = 0;
            } else {
                // After last segment
                const lastSegment = this.segmentTimings.segments[this.segmentTimings.segments.length - 1];
                currentSegment = lastSegment;
                currentSegmentIndex = this.segmentTimings.segments.length - 1;
            }
        }
        
        if (currentSegment) {
            // Calculate progress within the current segment (0 to 1)
            let segmentElapsedTime = this.journeyElapsedTime - currentSegment.startTime;
            segmentElapsedTime = Math.max(0, Math.min(currentSegment.duration, segmentElapsedTime));
            
            const segmentProgress = currentSegment.duration > 0 ? 
                segmentElapsedTime / currentSegment.duration : 1;
            
            // Map segment progress directly to global coordinate progress
            // Use linear interpolation between segment start and end progress ratios
            const globalProgress = currentSegment.progressStartRatio + 
                (segmentProgress * (currentSegment.progressEndRatio - currentSegment.progressStartRatio));
            
            // Set the animation progress
            this.animationProgress = Math.max(0, Math.min(1, globalProgress));
            this.currentSegmentIndex = currentSegmentIndex;
            this.segmentProgress = segmentProgress;
            
            // Debug logging (only occasionally to avoid spam)
            if (Math.floor(this.journeyElapsedTime * 2) !== Math.floor((this.journeyElapsedTime - deltaSeconds) * 2)) {
                console.log(`Segment ${currentSegmentIndex} (${currentSegment.type}): journey=${this.journeyElapsedTime.toFixed(1)}s/${totalDuration}s, progress=${this.animationProgress.toFixed(3)}, segmentDuration=${currentSegment.duration}s`);
            }
        } else {
            // Fallback - shouldn't happen but just in case
            this.animationProgress = Math.min(1, timeProgress);
            console.warn('No current segment found, using time-based progress:', timeProgress);
        }
    }

    getAnimationProgress() {
        return this.animationProgress;
    }

    // Ensure GPX parser is properly set up with track data
    ensureGPXParserReady() {
        if (!this.trackData || !this.trackData.trackPoints) {
            console.error('No track data available for GPX parser');
            return false;
        }
        
        if (!this.gpxParser.trackPoints || this.gpxParser.trackPoints !== this.trackData.trackPoints) {
            console.log('Setting up GPX parser with track data');
            this.gpxParser.trackPoints = this.trackData.trackPoints;
            
            // Debug: Check if trackPoints have valid data
            if (this.trackData.trackPoints.length > 0) {
                const firstPoint = this.trackData.trackPoints[0];
                console.log('First track point:', firstPoint);
                console.log('Track points count:', this.trackData.trackPoints.length);
                
                // Validate coordinates
                if (typeof firstPoint.lat !== 'number' || typeof firstPoint.lon !== 'number' || 
                    isNaN(firstPoint.lat) || isNaN(firstPoint.lon)) {
                    console.error('Invalid track point coordinates detected:', firstPoint);
                    return false;
                }
            }
        }
        
        return true;
    }

    setAnimationProgress(progress) {
        this.animationProgress = Math.max(0, Math.min(1, progress));
        
        console.log(`Setting animation progress to: ${progress.toFixed(3)}`);
        
        // Ensure GPX parser is ready
        if (!this.ensureGPXParserReady()) {
            return;
        }
        
        // Update journey elapsed time based on progress if we have segment timing
        if (this.segmentTimings && this.segmentTimings.totalDuration) {
            this.journeyElapsedTime = progress * this.segmentTimings.totalDuration;
            console.log(`Seeking: progress=${progress.toFixed(3)}, journey time=${this.journeyElapsedTime.toFixed(1)}s/${this.segmentTimings.totalDuration}s`);
        }
        
        // Update segment progress if we have segment timing
        if (this.segmentTimings && this.segmentTimings.segments) {
            this.updateSegmentProgress(progress);
        }
        
        // Reset frame timing to prevent animation from jumping
        this.lastAnimationTime = 0;
        
        this.updateCurrentPosition();
    }

    // Set journey elapsed time directly (for synchronization)
    setJourneyElapsedTime(timeInSeconds) {
        if (!this.segmentTimings) {
            console.warn('Cannot set journey elapsed time: no segment timing data available');
            return;
        }
        
        this.journeyElapsedTime = Math.max(0, Math.min(timeInSeconds, this.segmentTimings.totalDuration));
        console.log(`Journey elapsed time set to: ${this.journeyElapsedTime.toFixed(1)}s / ${this.segmentTimings.totalDuration}s`);
        
        // Update segment progress based on the new time
        if (this.segmentTimings.segments) {
            // Find which segment this time falls into
            for (let i = 0; i < this.segmentTimings.segments.length; i++) {
                const segment = this.segmentTimings.segments[i];
                if (this.journeyElapsedTime >= segment.startTime && this.journeyElapsedTime <= segment.endTime) {
                    this.currentSegmentIndex = i;
                    // Calculate progress within this segment (0-1)
                    if (segment.duration > 0) {
                        this.segmentProgress = (this.journeyElapsedTime - segment.startTime) / segment.duration;
                    } else {
                        this.segmentProgress = 0;
                    }
                    console.log(`Segment ${i}: segmentProgress=${this.segmentProgress.toFixed(3)}`);
                    break;
                }
            }
        }
        
        // Reset frame timing to prevent animation from jumping
        this.lastAnimationTime = 0;
    }

    // Update which segment we're currently in and progress within that segment
    updateSegmentProgress(globalProgress) {
        if (!this.segmentTimings || !this.segmentTimings.segments) return;
        
        const totalDuration = this.segmentTimings.totalDuration;
        const currentTime = globalProgress * totalDuration;
        
        // Find which segment we're currently in
        for (let i = 0; i < this.segmentTimings.segments.length; i++) {
            const segment = this.segmentTimings.segments[i];
            if (currentTime >= segment.startTime && currentTime <= segment.endTime) {
                this.currentSegmentIndex = i;
                // Calculate progress within this segment (0-1)
                if (segment.duration > 0) {
                    this.segmentProgress = (currentTime - segment.startTime) / segment.duration;
                } else {
                    this.segmentProgress = 0;
                }
                break;
            }
        }
    }

    // Icon change functionality
    enableIconChangeMode() {
        this.isIconChangeMode = true;
        this.map.getCanvas().style.cursor = 'crosshair';
    }

    disableIconChangeMode() {
        this.isIconChangeMode = false;
        this.map.getCanvas().style.cursor = '';
    }

    handleIconChangeClick(e) {
        if (!this.isIconChangeMode || !this.trackData) return;

        let progress;
        
        // Check if click is from progress bar or map
        if (e.detail && e.detail.progress !== undefined) {
            // Click from progress bar
            progress = e.detail.progress;
        } else {
            // Click from map
            const clickPoint = [e.lngLat.lng, e.lngLat.lat];
            progress = this.findClosestPointProgress(clickPoint);
        }
        
        // Dispatch custom event with progress
        const iconChangeEvent = new CustomEvent('iconChangeClick', {
            detail: { progress, coordinates: e.lngLat ? [e.lngLat.lng, e.lngLat.lat] : null }
        });
        document.dispatchEvent(iconChangeEvent);
    }

    addIconChange(progress, icon) {
        const iconChange = {
            id: Date.now(),
            progress,
            icon,
            timestamp: new Date()
        };

        this.iconChanges.push(iconChange);
        this.iconChanges.sort((a, b) => a.progress - b.progress);
        return iconChange;
    }

    removeIconChange(id) {
        this.iconChanges = this.iconChanges.filter(change => change.id !== id);
    }

    getIconChanges() {
        return this.iconChanges;
    }

    // Annotation functionality (position-based)
    enableAnnotationMode() {
        this.isAnnotationMode = true;
        this.map.getCanvas().style.cursor = 'crosshair';
    }

    disableAnnotationMode() {
        this.isAnnotationMode = false;
        this.map.getCanvas().style.cursor = '';
    }

    handleAnnotationClick(e) {
        if (!this.isAnnotationMode || !this.trackData) return;

        let progress;
        
        // Check if click is from progress bar or map
        if (e.detail && e.detail.progress !== undefined) {
            // Click from progress bar
            progress = e.detail.progress;
        } else {
            // Click from map
            const clickPoint = [e.lngLat.lng, e.lngLat.lat];
            progress = this.findClosestPointProgress(clickPoint);
        }
        
        // Dispatch custom event with progress
        const annotationEvent = new CustomEvent('annotationClick', {
            detail: { progress, coordinates: e.lngLat ? [e.lngLat.lng, e.lngLat.lat] : null }
        });
        document.dispatchEvent(annotationEvent);
    }

    findClosestPointProgress(clickPoint) {
        if (!this.trackData || !this.trackData.trackPoints) return 0;

        let minDistance = Infinity;
        let closestIndex = 0;

        this.trackData.trackPoints.forEach((point, index) => {
            const distance = this.calculateDistance(
                clickPoint[1], clickPoint[0],
                point.lat, point.lon
            );
            
            if (distance < minDistance) {
                minDistance = distance;
                closestIndex = index;
            }
        });

        return closestIndex / (this.trackData.trackPoints.length - 1);
    }

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

    addAnnotation(progress, title, description, icon = '📍') {
        const annotation = {
            id: Date.now(),
            progress,
            title,
            description,
            icon,
            timestamp: new Date()
        };

        this.annotations.push(annotation);
        return annotation;
    }

    removeAnnotation(id) {
        this.annotations = this.annotations.filter(ann => ann.id !== id);
        
        // Hide if this is the active annotation
        if (this.activeAnnotation && this.activeAnnotation.id === id) {
            this.hideActiveAnnotation();
        }
    }

    getAnnotations() {
        return this.annotations;
    }

    // Method to capture map for video export
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

    // Setup segment-aware animation
    setupSegmentAnimation(segments, segmentTiming) {
        console.log('Setting up segment animation with timing:', segmentTiming);
        
        // Store previous state
        const previousProgress = this.animationProgress || 0;
        const wasAnimating = this.isAnimating;
        
        // CRITICAL: Completely reset timing state
        this.segmentTimings = null;
        this.currentSegmentIndex = 0;
        this.segmentProgress = 0;
        this.journeyElapsedTime = 0;
        this.lastAnimationTime = 0;
        
        console.log('Reset all timing state');
        
        // Update segment timing data with the new timing
        this.segmentTimings = segmentTiming;
        
        // If we had a previous progress, calculate the new journey elapsed time based on new timing
        if (previousProgress > 0 && segmentTiming && segmentTiming.totalDuration > 0) {
            // Calculate the new journey elapsed time based on previous progress
            this.journeyElapsedTime = previousProgress * segmentTiming.totalDuration;
            this.animationProgress = previousProgress;
            
            // Update segment progress based on the new timing
            this.updateSegmentProgress(previousProgress);
            
            console.log(`Preserved progress ${previousProgress.toFixed(3)} with new timing:`, {
                oldJourneyTime: 'reset',
                newJourneyTime: this.journeyElapsedTime.toFixed(1),
                newTotalDuration: segmentTiming.totalDuration,
                currentSegment: this.currentSegmentIndex
            });
        } else {
            // Start from beginning
            this.animationProgress = 0;
            this.journeyElapsedTime = 0;
            console.log('Starting from beginning with new timing');
        }
        
        // Force update current position to reflect new timing
        this.updateCurrentPosition();
        
        console.log('Segment animation setup complete:', {
            totalDuration: segmentTiming.totalDuration,
            segmentCount: segments.length,
            currentProgress: this.animationProgress,
            journeyTime: this.journeyElapsedTime,
            segmentTimings: this.segmentTimings ? 'loaded' : 'null'
        });
    }

    // 3D Terrain controls
    enable3DTerrain() {
        if (!this.map || this.is3DMode) return;
        
        console.log('Enabling 3D terrain mode');
        this.is3DMode = true;
        
        try {
            // Store current animation state to preserve it
            const wasAnimating = this.isAnimating;
            const currentProgress = this.animationProgress;
            
            // Very gentle camera adjustment - just add a slight tilt
            this.map.easeTo({
                pitch: 30, // Much less aggressive tilt
                duration: 500 // Shorter transition
                // Don't change zoom, center, or bearing - preserve everything else
            });
            
            // Add terrain source but with minimal delay and impact
            setTimeout(() => {
                try {
                    this.setupTerrainSourceMinimal();
                    
                    // Restore animation state immediately if it was running
                    if (wasAnimating && currentProgress !== undefined) {
                        setTimeout(() => {
                            this.setAnimationProgress(currentProgress);
                            if (wasAnimating) {
                                this.startAnimation();
                            }
                        }, 100);
                    }
                    
                    console.log('3D terrain enabled with minimal impact');
                } catch (terrainError) {
                    console.warn('Could not add terrain elevation, using 3D view only:', terrainError);
                }
            }, 600);
            
        } catch (error) {
            console.error('Error enabling 3D terrain:', error);
            this.is3DMode = false;
        }
    }

    // Minimal terrain setup that doesn't interfere with navigation or animation
    setupTerrainSourceMinimal() {
        try {
            console.log('Setting up minimal terrain source');
            
            // Add terrain source only if it doesn't exist
            if (!this.map.getSource('terrain-dem')) {
                // Default to Mapzen (more reliable than OpenTopography)
                this.currentTerrainSource = this.currentTerrainSource || 'mapzen';
                this.addTerrainSource(this.currentTerrainSource);
                
                console.log('Added minimal terrain source:', this.currentTerrainSource);
            }
            
            // Apply terrain with very conservative settings
            setTimeout(() => {
                try {
                    this.map.setTerrain({
                        source: 'terrain-dem',
                        exaggeration: 0.8 // Even more conservative
                    });
                    
                    console.log('Applied minimal terrain elevation');
                    
                } catch (terrainError) {
                    console.warn('Could not apply terrain elevation:', terrainError);
                }
            }, 300);
            
        } catch (error) {
            console.warn('Could not setup minimal terrain source:', error);
        }
    }

    // Add terrain source based on provider
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

        const sourceConfig = sources[provider] || sources['opentopo'];
        
        this.map.addSource('terrain-dem', sourceConfig);
        console.log(`Added ${provider} terrain source`);
            }
            
    // Set terrain data source (Mapzen or OpenTopography)
    setTerrainSource(provider) {
        if (!this.map || !this.is3DMode) {
            // Store the preference for when 3D is enabled
            this.currentTerrainSource = provider;
            console.log(`Terrain source preference set to: ${provider}`);
            return;
        }

        try {
            console.log(`Switching terrain source to: ${provider}`);
            
            // Store current state
            const wasAnimating = this.isAnimating;
            const currentProgress = this.animationProgress;
            
            // Remove current terrain
            if (this.map.getSource('terrain-dem')) {
                this.map.setTerrain(null);
                this.map.removeSource('terrain-dem');
            }
            
            // Add new terrain source
            this.addTerrainSource(provider);
            this.currentTerrainSource = provider;
            
            // Re-apply terrain with small delay
            setTimeout(() => {
                try {
                    this.map.setTerrain({
                        source: 'terrain-dem',
                        exaggeration: 0.8
                    });
                    
                    console.log(`Successfully switched to ${provider} terrain`);
                    
                    // Restore animation state if needed
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

    // Update trail rendering for 3D mode
    update3DTrailRendering() {
        if (!this.trackData) {
            console.log('No track data available for 3D trail rendering');
            return;
        }
        
        // Check if trail layers exist before modifying them
        if (!this.map.getLayer('trail-line')) {
            console.log('Trail layers not yet created, skipping 3D trail rendering');
            return;
        }
        
        // Make the trail lines slightly thicker and more visible in 3D
        this.map.setPaintProperty('trail-line', 'line-width', [
            'case',
            ['==', ['get', 'isTransportation'], true], 8, // thicker for transportation in 3D
            6 // thicker for tracks in 3D
        ]);
        
        if (this.map.getLayer('trail-completed')) {
            this.map.setPaintProperty('trail-completed', 'line-width', 7);
            
            // Add more dramatic line opacity for better visibility in 3D
            this.map.setPaintProperty('trail-completed', 'line-opacity', 1.0);
        }
        
        // Add more dramatic line opacity for better visibility in 3D
        this.map.setPaintProperty('trail-line', 'line-opacity', [
            'case',
            ['==', ['get', 'isTransportation'], true], 0.9,
            0.8
        ]);
        
        // Enhance marker visibility in 3D
        if (this.map.getLayer('current-position-glow')) {
            this.map.setPaintProperty('current-position-glow', 'circle-radius', 20 * this.markerSize);
        }
        
        // Add elevation-based styling for better depth perception
        this.add3DElevationEffects();
    }
    
    // Add elevation-based visual effects
    add3DElevationEffects() {
        if (!this.trackData) return;
        
        try {
            // Add a subtle glow effect to the trail for better 3D perception
            if (!this.map.getLayer('trail-glow-3d') && this.map.getLayer('trail-line')) {
                // Clone the trail line data for the glow effect
                const trailSource = this.map.getSource('trail-line');
                if (trailSource) {
                    this.map.addLayer({
                        id: 'trail-glow-3d',
                        type: 'line',
                        source: 'trail-line',
                        layout: {
                            'line-join': 'round',
                            'line-cap': 'round'
                        },
                        paint: {
                            'line-color': this.pathColor,
                            'line-width': 12,
                            'line-opacity': 0.3,
                            'line-blur': 2
                        }
                    }, 'trail-line'); // Add below the main trail line
                    
                    console.log('Added 3D trail glow effect');
                }
            }
        } catch (error) {
            console.log('Could not add 3D elevation effects:', error);
        }
    }
    
    // Update trail rendering for 2D mode
    update2DTrailRendering() {
        if (!this.trackData) return;
        
        // Check if trail layers exist before modifying them
        if (!this.map.getLayer('trail-line')) {
            return;
        }
        
        // Reset to normal 2D line widths
        this.map.setPaintProperty('trail-line', 'line-width', [
            'case',
            ['==', ['get', 'isTransportation'], true], 6, // normal transportation width
            4 // normal track width
        ]);
        
        if (this.map.getLayer('trail-completed')) {
            this.map.setPaintProperty('trail-completed', 'line-width', 5);
            
            // Reset line opacity to normal
            this.map.setPaintProperty('trail-completed', 'line-opacity', 0.8);
        }
        
        // Reset line opacity to normal
        this.map.setPaintProperty('trail-line', 'line-opacity', [
            'case',
            ['==', ['get', 'isTransportation'], true], 0.7,
            0.4
        ]);
        
        // Reset marker sizes to normal
        if (this.map.getLayer('current-position-glow')) {
            this.map.setPaintProperty('current-position-glow', 'circle-radius', 15 * this.markerSize);
        }
        
        // Remove 3D effects
        this.remove3DElevationEffects();
    }
    
    // Remove 3D elevation effects
    remove3DElevationEffects() {
        try {
            // Remove the 3D glow effect
            if (this.map.getLayer('trail-glow-3d')) {
                this.map.removeLayer('trail-glow-3d');
                console.log('Removed 3D trail glow effect');
            }
        } catch (error) {
            console.log('Could not remove 3D elevation effects:', error);
        }
    }

    disable3DTerrain() {
        if (!this.map || !this.is3DMode) return;
        
        console.log('Disabling 3D terrain mode');
        this.is3DMode = false;
        
        try {
            // Store animation state
            const wasAnimating = this.isAnimating;
            const currentProgress = this.animationProgress;
            
            // Remove terrain elevation gently
            this.map.setTerrain(null);
            console.log('Removed 3D terrain elevation');
            
            // Reset camera to 2D view gently - only change pitch
            this.map.easeTo({
                pitch: 0,
                duration: 500 // Quick transition
                // Don't change center, zoom, or bearing
            });
            
            // Restore animation state if needed
            if (wasAnimating && currentProgress !== undefined) {
                setTimeout(() => {
                    this.setAnimationProgress(currentProgress);
                    if (wasAnimating) {
                        this.startAnimation();
                    }
                }, 600);
            }
            
            console.log('3D terrain disabled successfully - navigation preserved');
        } catch (error) {
            console.error('Error disabling 3D terrain:', error);
        }
    }

    // Method to adjust terrain exaggeration without breaking navigation
    setTerrainExaggeration(exaggeration) {
        if (this.is3DMode && this.map.getSource('terrain-dem')) {
            try {
                this.map.setTerrain({
                    source: 'terrain-dem',
                    exaggeration: exaggeration
                });
                console.log('Terrain exaggeration set to:', exaggeration);
            } catch (error) {
                console.error('Error setting terrain exaggeration:', error);
            }
        }
    }

    // Check if terrain is supported by the current MapLibre version
    isTerrainSupported() {
        return typeof this.map.setTerrain === 'function' && typeof this.map.addSource === 'function';
    }

    // Performance mode for video recording
    setPerformanceMode(enabled) {
        this.performanceMode = enabled;
        
        if (enabled) {
            console.log('Enabling performance mode for video recording');
            
            // Disable expensive map features during recording
            this.originalMapSettings = {
                antialias: this.map.getCanvas().getContext('webgl2', { antialias: true }),
                preserveDrawingBuffer: this.map.getCanvas().getContext('webgl2', { preserveDrawingBuffer: true })
            };
            
            // Reduce map update frequency during recording
            this.updateThrottle = 16; // ~60fps max
            
            // PRESERVE user's autofollow setting during recording (don't disable it)
            // The user chose their camera behavior and the video should respect it
            console.log(`Preserving user's autofollow setting: ${this.autoZoom}`);
            
        } else {
            console.log('Disabling performance mode');
            
            // Reset throttling and settings
            this.updateThrottle = 0;
            this.originalMapSettings = null;
            
            console.log('Performance mode disabled - autofollow setting preserved');
        }
    }

    // Optimize map for recording
    optimizeForRecording() {
        if (!this.map) return;
        
        try {
            // Ensure preserveDrawingBuffer is enabled for canvas capture
            this.ensurePreserveDrawingBuffer();
            
            // Reduce tile cache size temporarily to free memory
            if (this.map.style && this.map.style.sourceCaches) {
                Object.values(this.map.style.sourceCaches).forEach(sourceCache => {
                    if (sourceCache._cache) {
                        sourceCache._cache.max = 50; // Reduce from default
                    }
                });
            }
            
            // Force a repaint to stabilize the canvas
            this.map.triggerRepaint();
            
            console.log('Map optimized for recording');
            
        } catch (error) {
            console.warn('Could not fully optimize map for recording:', error);
        }
    }
    
    // Ensure the WebGL context has preserveDrawingBuffer enabled
    ensurePreserveDrawingBuffer() {
        try {
            const canvas = this.map.getCanvas();
            
            // Check current WebGL context
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl') || 
                      canvas.getContext('webgl2') || canvas.getContext('experimental-webgl2');
            
            if (gl) {
                // Check if preserveDrawingBuffer is enabled
                const preserveDrawingBuffer = gl.getContextAttributes().preserveDrawingBuffer;
                console.log('WebGL preserveDrawingBuffer status:', preserveDrawingBuffer);
                
                if (!preserveDrawingBuffer) {
                    console.warn('preserveDrawingBuffer is false - video capture may not work properly');
                    console.log('This can happen if the map was not initialized with preserveDrawingBuffer: true');
                    
                    // Force map to recreate with proper context
                    this.map.triggerRepaint();
                    
                    // Try to trigger context recreation (this is a MapLibre internal process)
                    if (this.map._painter && this.map._painter.gl) {
                        console.log('Attempting to refresh MapLibre painter context');
                        this.map._painter.resize(canvas.width, canvas.height);
                    }
                } else {
                    console.log('✅ preserveDrawingBuffer is enabled - video capture should work');
                }
            } else {
                console.warn('Could not get WebGL context for preserveDrawingBuffer check');
            }
            
        } catch (error) {
            console.warn('Error checking/setting preserveDrawingBuffer:', error);
        }
    }

    // Enhanced tile loading detection
    areTilesLoaded() {
        if (!this.map || !this.map.style) return true;
        
        try {
            const sources = this.map.style.sourceCaches;
            let totalTiles = 0;
            let loadedTiles = 0;
            let loadingTiles = 0;
            
            for (const sourceId in sources) {
                const source = sources[sourceId];
                if (source && source._tiles) {
                    for (const tileId in source._tiles) {
                        const tile = source._tiles[tileId];
                        totalTiles++;
                        
                        if (tile.state === 'loading' || tile.state === 'reloading') {
                            loadingTiles++;
                        } else if (tile.state === 'loaded') {
                            loadedTiles++;
                        }
                    }
                }
            }
            
            // Enhanced logging for debugging
            if (loadingTiles > 0) {
                console.log(`Tiles status: ${loadedTiles}/${totalTiles} loaded, ${loadingTiles} loading`);
            }
            
            // Consider tiles loaded if less than 5% are still loading
            const loadingPercentage = totalTiles > 0 ? (loadingTiles / totalTiles) : 0;
            return loadingPercentage < 0.05;
            
        } catch (error) {
            console.warn('Error checking tile loading status:', error);
            return true; // Assume loaded if we can't check
        }
    }
    
    // Get comprehensive tile loading status for video export
    getTileLoadingStatus() {
        if (!this.map || !this.map.style) {
            return { isComplete: true, totalTiles: 0, loadedTiles: 0, loadingTiles: 0 };
        }
        
        try {
            const sources = this.map.style.sourceCaches;
            let totalTiles = 0;
            let loadedTiles = 0;
            let loadingTiles = 0;
            let errorTiles = 0;
            
            for (const sourceId in sources) {
                const source = sources[sourceId];
                if (source && source._tiles) {
                    for (const tileId in source._tiles) {
                        const tile = source._tiles[tileId];
                        totalTiles++;
                        
                        switch (tile.state) {
                            case 'loading':
                            case 'reloading':
                                loadingTiles++;
                                break;
                            case 'loaded':
                                loadedTiles++;
                                break;
                            case 'errored':
                                errorTiles++;
                                break;
                        }
                    }
                }
            }
            
            const isComplete = loadingTiles === 0;
            const progress = totalTiles > 0 ? (loadedTiles / totalTiles) * 100 : 100;
            
            return {
                isComplete,
                totalTiles,
                loadedTiles,
                loadingTiles,
                errorTiles,
                progress: Math.round(progress)
            };
            
        } catch (error) {
            console.warn('Error getting tile loading status:', error);
            return { isComplete: true, totalTiles: 0, loadedTiles: 0, loadingTiles: 0, errorTiles: 0, progress: 100 };
        }
    }
    
    // Force load tiles in a specific viewport area
    async forceTileLoading(bounds, zoomLevel = null) {
        if (!this.map) return;
        
        try {
            const currentZoom = this.map.getZoom();
            const targetZoom = zoomLevel || currentZoom;
            
            // Set zoom if different
            if (Math.abs(targetZoom - currentZoom) > 0.1) {
                this.map.setZoom(targetZoom);
            }
            
            // Fit to bounds to trigger tile loading
            this.map.fitBounds(bounds, {
                padding: 0,
                duration: 0,
                maxZoom: targetZoom
            });
            
            // Force repaint and wait
            this.map.triggerRepaint();
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Check if sources need refresh
            if (this.map.style && this.map.style.sourceCaches) {
                Object.values(this.map.style.sourceCaches).forEach(sourceCache => {
                    if (sourceCache.reload) {
                        sourceCache.reload();
                    }
                });
            }
            
            console.log(`Forced tile loading for bounds:`, bounds, `at zoom ${targetZoom}`);
            
        } catch (error) {
            console.warn('Error forcing tile loading:', error);
        }
    }
    
    // Simple and efficient tile preloading for video export - preserves user camera settings
    async aggressiveTilePreload(route, progressCallback = null) {
        if (!this.map || !route || route.length === 0) return;
        
        console.log('Starting efficient tile preloading while preserving user camera settings');
        
        try {
            // Store user's current camera settings to restore later
            const userSettings = {
                zoom: this.map.getZoom(),
                center: this.map.getCenter(),
                pitch: this.map.getPitch(),
                bearing: this.map.getBearing()
            };
            
            console.log('Preserved user camera settings:', userSettings);
            
            // Use the current zoom level chosen by the user (never change it)
            const targetZoom = userSettings.zoom;
            const tileSize = 256; // Standard tile size
            
            // Calculate which unique tiles we need to cover the route
            const uniqueTiles = this.calculateUniqueTilesForRoute(route, targetZoom, tileSize);
            
            console.log(`Loading ${uniqueTiles.length} unique tiles at user's zoom level ${targetZoom.toFixed(1)}`);
            
            let loadedCount = 0;
            
            // Load each unique tile by centering on it briefly
            for (const tile of uniqueTiles) {
                // Convert tile coordinates back to lat/lng for the center of the tile
                const lat = this.tileToLat(tile.y, targetZoom);
                const lng = this.tileToLng(tile.x, targetZoom);
                
                // Pan to the center of this tile to trigger loading (preserve zoom, pitch, bearing)
                this.map.jumpTo({
                    center: [lng, lat],
                    zoom: targetZoom,
                    pitch: userSettings.pitch,
                    bearing: userSettings.bearing
                });
                this.map.triggerRepaint();
                
                // Very brief wait to trigger tile loading
                await new Promise(resolve => setTimeout(resolve, 30));
                
                loadedCount++;
                
                // Update progress
                if (progressCallback) {
                    const progress = (loadedCount / uniqueTiles.length) * 100;
                    progressCallback(progress);
                }
                
                // Log progress every 10 tiles
                if (loadedCount % 10 === 0) {
                    console.log(`Loaded ${loadedCount}/${uniqueTiles.length} tiles (${Math.round((loadedCount/uniqueTiles.length)*100)}%)`);
                }
            }
            
            // Restore user's exact camera settings
            this.map.jumpTo({
                center: userSettings.center,
                zoom: userSettings.zoom,
                pitch: userSettings.pitch,
                bearing: userSettings.bearing
            });
            
            console.log(`Tile preloading completed. Restored user camera settings:`, userSettings);
            
        } catch (error) {
            console.error('Error during efficient tile preload:', error);
        }
    }
    
    // Calculate unique tiles needed to cover the route at a specific zoom level
    calculateUniqueTilesForRoute(route, zoom, tileSize) {
        const uniqueTileSet = new Set();
        const tiles = [];
        
        // Convert each route point to tile coordinates
        for (const point of route) {
            const lat = point.lat || point[1];
            const lng = point.lon || point[0];
            
            const tileX = this.lngToTile(lng, zoom);
            const tileY = this.latToTile(lat, zoom);
            
            const tileKey = `${tileX},${tileY}`;
            
            // Only add if we haven't seen this tile before
            if (!uniqueTileSet.has(tileKey)) {
                uniqueTileSet.add(tileKey);
                tiles.push({ x: tileX, y: tileY, z: zoom });
            }
        }
        
        return tiles;
    }
    
    // Convert longitude to tile X coordinate
    lngToTile(lng, zoom) {
        return Math.floor((lng + 180) / 360 * Math.pow(2, zoom));
    }
    
    // Convert latitude to tile Y coordinate  
    latToTile(lat, zoom) {
        const latRad = lat * Math.PI / 180;
        return Math.floor((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2 * Math.pow(2, zoom));
    }
    
    // Convert tile X coordinate to longitude
    tileToLng(x, zoom) {
        return x / Math.pow(2, zoom) * 360 - 180;
    }
    
    // Convert tile Y coordinate to latitude
    tileToLat(y, zoom) {
        const n = Math.PI - 2 * Math.PI * y / Math.pow(2, zoom);
        return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
    }

    // Methods for video export overlay rendering
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
                
    getCurrentProgress() {
        return this.animationProgress;
                }
                
    getElevationData() {
        if (!this.trackData || !this.trackData.trackPoints) return [];
        
        return this.trackData.trackPoints.map(point => point.elevation || 0);
    }
    
    // Enable/disable direct overlay rendering on the map canvas
    enableOverlayRendering(enabled) {
        this.overlayRenderingEnabled = enabled;
        
        if (enabled) {
            console.log('Enabling direct overlay rendering on map canvas');
            // Start the overlay rendering loop
            this.startDirectOverlayRendering();
                    } else {
            console.log('Disabling direct overlay rendering on map canvas');
            // Stop the overlay rendering loop
            this.stopDirectOverlayRendering();
        }
    }
    
    // Start rendering overlays directly on the map canvas
    startDirectOverlayRendering() {
        if (this.overlayRenderingId) {
            cancelAnimationFrame(this.overlayRenderingId);
                    }
        
        const renderOverlays = () => {
            if (!this.overlayRenderingEnabled) {
                this.overlayRenderingId = null;
                    return;
                }
                
            try {
                // Get the canvas and context
                const canvas = this.map.getCanvas();
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                
                if (ctx) {
                    // Render live stats overlay
                    this.renderLiveStatsOnCanvas(ctx, canvas.width, canvas.height);
                    
                    // Render elevation profile overlay
                    this.renderElevationProfileOnCanvas(ctx, canvas.width, canvas.height);
                }
            } catch (error) {
                console.warn('Error in direct overlay rendering:', error);
            }
            
            // Continue the rendering loop
            this.overlayRenderingId = requestAnimationFrame(renderOverlays);
        };
        
        this.overlayRenderingId = requestAnimationFrame(renderOverlays);
    }
    
    // Stop direct overlay rendering
    stopDirectOverlayRendering() {
        if (this.overlayRenderingId) {
            cancelAnimationFrame(this.overlayRenderingId);
            this.overlayRenderingId = null;
        }
    }
    
    // Render live stats directly on map canvas
    renderLiveStatsOnCanvas(ctx, width, height) {
        if (!this.trackData || !window.app) return;
        
        try {
            // Get current progress and calculate stats
            const progress = this.getAnimationProgress();
            const currentPoint = this.gpxParser.getInterpolatedPoint(progress);
            
            if (!currentPoint) return;
            
            // Calculate current stats
            const totalDistance = this.trackData.stats?.totalDistance || 0;
            const currentDistance = progress * totalDistance;
            const currentElevationGain = window.app.calculateActualElevationGain ? 
                window.app.calculateActualElevationGain(progress) : (currentPoint.elevation || 0);
            
            // Style the overlay
            ctx.save();
            
            // Background
            ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
            ctx.strokeStyle = '#C1652F';
            ctx.lineWidth = 2;
            
            const padding = 16;
            const x = 20;
            const y = 20;
            const boxWidth = 280;
            const boxHeight = 80;
            
            // Draw background with border
            ctx.fillRect(x, y, boxWidth, boxHeight);
            ctx.strokeRect(x, y, boxWidth, boxHeight);
            
            // Text styling
            ctx.fillStyle = '#1B2A20';
            ctx.font = 'bold 14px Inter, sans-serif';
            
            // Draw stats text
            const lineHeight = 20;
            let textY = y + 25;
            
            ctx.fillText(`Distance: ${(currentDistance / 1000).toFixed(2)} km`, x + padding, textY);
            textY += lineHeight;
            ctx.fillText(`Elevation: ${Math.round(currentElevationGain)} m`, x + padding, textY);
            
            ctx.restore();
            
        } catch (error) {
            console.warn('Error rendering live stats on canvas:', error);
        }
    }
    
    // Render elevation profile directly on map canvas
    renderElevationProfileOnCanvas(ctx, width, height) {
        if (!this.trackData || !this.trackData.trackPoints) return;
        
        try {
            const trackPoints = this.trackData.trackPoints;
            const elevations = trackPoints.map(point => point.elevation || 0);
            
            if (elevations.length < 2) return;
            
            const minElevation = Math.min(...elevations);
            const maxElevation = Math.max(...elevations);
            const elevationRange = maxElevation - minElevation;
            
            if (elevationRange === 0) return;
            
            ctx.save();
            
            // Position at bottom of canvas
            const margin = 20;
            const profileHeight = 100;
            const profileWidth = Math.min(400, width - (margin * 2));
            const profileY = height - profileHeight - margin;
            const profileX = margin;
            
            // Background
            ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
            ctx.strokeStyle = '#C1652F';
            ctx.lineWidth = 2;
            
            // Draw background with border
            ctx.fillRect(profileX, profileY, profileWidth, profileHeight);
            ctx.strokeRect(profileX, profileY, profileWidth, profileHeight);
            
            // Draw elevation profile
            ctx.beginPath();
            ctx.strokeStyle = '#1B2A20';
            ctx.lineWidth = 2;
            
            // Sample elevations for drawing (optimize for large datasets)
            const step = Math.max(1, Math.floor(elevations.length / profileWidth));
            for (let i = 0; i < elevations.length; i += step) {
                const elevation = elevations[i];
                const x = profileX + (i / (elevations.length - 1)) * profileWidth;
                const normalizedElevation = (elevation - minElevation) / elevationRange;
                const y = profileY + profileHeight - (normalizedElevation * (profileHeight - 20)) - 10;
                
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            
            ctx.stroke();
            
            // Draw current position indicator
            const currentProgress = this.getAnimationProgress();
            const currentX = profileX + (currentProgress * profileWidth);
            
            ctx.beginPath();
            ctx.strokeStyle = '#C1652F';
            ctx.lineWidth = 3;
            ctx.moveTo(currentX, profileY);
            ctx.lineTo(currentX, profileY + profileHeight);
            ctx.stroke();
            
            // Draw current position circle
            const currentElevationIndex = Math.floor(currentProgress * (elevations.length - 1));
            if (elevations[currentElevationIndex] !== undefined) {
                const currentElevation = elevations[currentElevationIndex];
                const normalizedElevation = (currentElevation - minElevation) / elevationRange;
                const currentY = profileY + profileHeight - (normalizedElevation * (profileHeight - 20)) - 10;
                
                ctx.beginPath();
                ctx.fillStyle = '#C1652F';
                ctx.arc(currentX, currentY, 6, 0, 2 * Math.PI);
                ctx.fill();
            }
            
            ctx.restore();
            
        } catch (error) {
            console.warn('Error rendering elevation profile on canvas:', error);
        }
    }
} 