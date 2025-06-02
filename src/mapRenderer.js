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
            zoom: 2,
            antialias: true
        });

        this.map.addControl(new maplibregl.NavigationControl());
        
        this.map.on('load', () => {
            this.setupMapLayers();
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

        // Add trail line layer (full trail)
        this.map.addLayer({
            id: 'trail-line',
            type: 'line',
            source: 'trail-line',
            layout: {
                'line-join': 'round',
                'line-cap': 'round'
            },
            paint: {
                'line-color': this.pathColor,
                'line-width': 4,
                'line-opacity': 0.4
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

        // Create GeoJSON for the trail
        const coordinates = trackData.trackPoints.map(point => [point.lon, point.lat, point.elevation]);
        
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

        // Fit map to trail bounds
        if (trackData.bounds) {
            this.map.fitBounds([
                [trackData.bounds.west, trackData.bounds.south],
                [trackData.bounds.east, trackData.bounds.north]
            ], {
                padding: 50,
                duration: 1000
            });
        }

        // Reset animation and icon changes
        this.animationProgress = 0;
        this.iconChanges = [];
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
    }

    async updateCurrentPosition() {
        if (!this.trackData || !this.trackData.trackPoints) return;

        this.gpxParser.trackPoints = this.trackData.trackPoints;
        
        const currentPoint = this.gpxParser.getInterpolatedPoint(this.animationProgress);
        
        if (currentPoint) {
            console.log('Updating position to:', currentPoint.lat, currentPoint.lon);
            
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

            // Check for icon changes
            this.checkIconChanges(this.animationProgress);

            // Check for annotations
            this.checkAnnotations(this.animationProgress);

            // Auto zoom to follow the marker
            if (this.autoZoom && this.isAnimating) {
                this.map.easeTo({
                    center: [currentPoint.lon, currentPoint.lat],
                    duration: 100
                });
            }

            // Ensure activity icon layer is visible
            if (this.map.getLayer('activity-icon')) {
                const layer = this.map.getLayer('activity-icon');
                const visibility = this.map.getLayoutProperty('activity-icon', 'visibility');
                const opacity = this.map.getPaintProperty('activity-icon', 'icon-opacity');
                
                console.log('Activity icon layer status:', {
                    layer: !!layer,
                    visibility: visibility,
                    opacity: opacity,
                    hasImage: this.map.hasImage('activity-icon')
                });
                
                // Force visibility
                this.map.setLayoutProperty('activity-icon', 'visibility', 'visible');
                this.map.setPaintProperty('activity-icon', 'icon-opacity', 1);
            } else {
                console.warn('Activity icon layer not found!');
                // Try to recreate it
                this.createAndAddActivityIconLayer();
            }
        }
    }

    checkIconChanges(progress) {
        if (this.iconChanges.length > 0) {
            console.log('Checking icon changes at progress:', progress, 'Total changes:', this.iconChanges.length);
        }
        
        const sortedChanges = this.iconChanges.sort((a, b) => a.progress - b.progress);
        
        // Start with the base icon (activity type icon)
        const baseIcon = this.getBaseIcon();
        let activeIcon = baseIcon;
        
        // Find the icon that should be active at this progress
        for (const change of sortedChanges) {
            console.log(`Checking change at progress ${change.progress} (current: ${progress}): ${change.icon}`);
            if (progress >= change.progress) {
                activeIcon = change.icon;
                console.log(`Applied icon change: ${activeIcon}`);
            } else {
                break; // No more changes apply
            }
        }
        
        // Only update if the icon has actually changed
        if (activeIcon !== this.currentIcon) {
            console.log(`Icon change at progress ${progress}: ${this.currentIcon} → ${activeIcon}`);
            this.currentIcon = activeIcon;
            
            // Only update icon if map is loaded
            if (this.map && this.map.loaded()) {
                console.log('About to call updateActivityIcon() from checkIconChanges()');
                this.updateActivityIcon();
                
                // Force complete layer refresh by removing and recreating it
                setTimeout(() => {
                    try {
                        console.log('Forcing complete icon layer refresh');
                        if (this.map.getLayer('activity-icon')) {
                            this.map.removeLayer('activity-icon');
                        }
                        if (this.map.hasImage('activity-icon')) {
                            this.map.removeImage('activity-icon');
                        }
                        
                        // Recreate the icon and layer
                        this.createAndAddActivityIconLayer(true);
                    } catch (error) {
                        console.error('Error refreshing icon layer:', error);
                    }
                }, 50);
            }
            
            // Dispatch event to update UI
            const iconChangeEvent = new CustomEvent('iconChanged', {
                detail: { icon: activeIcon, progress: progress }
            });
            document.dispatchEvent(iconChangeEvent);
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
            this.map.fitBounds([
                [this.trackData.bounds.west, this.trackData.bounds.south],
                [this.trackData.bounds.east, this.trackData.bounds.north]
            ], {
                padding: 50,
                duration: 1000
            });
        }
    }

    // Animation controls
    startAnimation() {
        if (!this.trackData || this.isAnimating) return;
        
        this.isAnimating = true;
        this.animate();
    }

    stopAnimation() {
        this.isAnimating = false;
    }

    resetAnimation() {
        this.isAnimating = false;
        this.animationProgress = 0;
        this.hideActiveAnnotation();
        this.updateCurrentPosition();
    }

    animate() {
        if (!this.isAnimating) return;

        this.animationProgress += 0.001 * this.animationSpeed;
        
        if (this.animationProgress >= 1) {
            this.animationProgress = 1;
            this.isAnimating = false;
        }

        this.updateCurrentPosition();

        if (this.isAnimating) {
            requestAnimationFrame(() => this.animate());
        }
    }

    getAnimationProgress() {
        return this.animationProgress;
    }

    setAnimationProgress(progress) {
        this.animationProgress = Math.max(0, Math.min(1, progress));
        this.updateCurrentPosition();
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
} 