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
        this.pathColor = '#667eea';
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
            antialias: true
            // Remove explicit navigation control settings - let MapLibre handle defaults
        });

        // Add navigation control
        this.map.addControl(new maplibregl.NavigationControl());
        
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
                        ['==', ['get', 'segmentMode'], 'plane'], [2, 2], // dashed for plane
                        ['==', ['get', 'segmentMode'], 'boat'], [5, 3], // different dash for boat
                        null // solid for car/train/etc
                    ],
                    null // solid for tracks
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

        this.map.addLayer({
            id: 'current-position',
            type: 'circle',
            source: 'current-position',
            paint: {
                'circle-radius': 8 * this.markerSize,
                'circle-color': '#ffffff',
                'circle-stroke-color': this.pathColor,
                'circle-stroke-width': 3 * this.markerSize
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
        
        this.map.addLayer({
            id: 'background',
            type: 'raster',
            source: config.source
        }, 'trail-line');
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
        if (trackData.bounds) {
            const fitOptions = {
                padding: 50,
                duration: 1000
            };
            
            // In 3D mode, adjust the fit to account for terrain elevation
            if (this.is3DMode) {
                fitOptions.pitch = 45; // Moderate tilt for 3D viewing
                fitOptions.bearing = 0;
            }
            
            this.map.fitBounds([
                [trackData.bounds.west, trackData.bounds.south],
                [trackData.bounds.east, trackData.bounds.north]
            ], fitOptions);
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
        // Ensure GPX parser is ready
        if (!this.ensureGPXParserReady()) {
            return;
        }
        
        const currentPoint = this.gpxParser.getInterpolatedPoint(this.animationProgress);
        
        if (currentPoint) {
            console.log('Updating position to:', {
                progress: this.animationProgress.toFixed(3),
                lat: currentPoint.lat,
                lon: currentPoint.lon,
                index: currentPoint.index
            });
            
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

            // Check for annotations
            this.checkAnnotations(this.animationProgress);

            // Auto zoom to follow the marker (only if auto zoom is enabled and we're not manually seeking)
            if (this.autoZoom && this.isAnimating) {
                if (this.is3DMode) {
                    // In 3D mode, maintain the camera angle while following
                    this.map.easeTo({
                        center: [currentPoint.lon, currentPoint.lat],
                        duration: 100,
                        pitch: this.map.getPitch(), // Maintain current pitch
                        bearing: this.map.getBearing() // Maintain current bearing
                    });
                } else {
                    // Normal 2D following
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
            // No icon changes, ensure we're showing the base icon
            const baseIcon = this.getBaseIcon();
            if (this.currentIcon !== baseIcon) {
                console.log(`No icon changes - reverting to base icon: ${baseIcon}`);
                this.currentIcon = baseIcon;
                this.forceIconUpdate();
                
                // Dispatch event to update UI
                const iconChangeEvent = new CustomEvent('iconChanged', {
                    detail: { icon: this.currentIcon, progress: progress }
                });
                document.dispatchEvent(iconChangeEvent);
            }
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
        this.map.setPaintProperty('current-position', 'circle-stroke-color', color);
    }

    setMarkerSize(size) {
        this.markerSize = size;
        
        // Update marker sizes
        this.map.setPaintProperty('current-position-glow', 'circle-radius', 15 * size);
        this.map.setPaintProperty('current-position', 'circle-radius', 8 * size);
        this.map.setPaintProperty('current-position', 'circle-stroke-width', 3 * size);
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
                this.map.addSource('terrain-dem', {
                    type: 'raster-dem',
                    tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
                    tileSize: 256,
                    encoding: 'terrarium',
                    maxzoom: 15
                });
                
                console.log('Added minimal terrain source');
            }
            
            // Apply terrain with very conservative settings
            setTimeout(() => {
                try {
                    this.map.setTerrain({
                        source: 'terrain-dem',
                        exaggeration: 0.8 // Even more conservative
                    });
                    
                    console.log('Applied minimal terrain elevation');
                    
                    // Don't add terrain control automatically - it might interfere
                    // User can adjust elevation with the terrain source selector
                    
                } catch (terrainError) {
                    console.warn('Could not apply terrain elevation:', terrainError);
                }
            }, 300);
            
        } catch (error) {
            console.warn('Could not setup minimal terrain source:', error);
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
        if (this.map.getLayer('current-position')) {
            this.map.setPaintProperty('current-position', 'circle-radius', 10 * this.markerSize);
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
        if (this.map.getLayer('current-position')) {
            this.map.setPaintProperty('current-position', 'circle-radius', 8 * this.markerSize);
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
} 