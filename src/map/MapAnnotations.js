/**
 * MapAnnotations - Handles annotation functionality for the map
 */
import { MapUtils } from './MapUtils.js';

export class MapAnnotations {
    constructor(mapRenderer) {
        this.mapRenderer = mapRenderer;
        this.annotations = [];
        this.isAnnotationMode = false;
        this.activeAnnotation = null;
    }

    /**
     * Enable annotation mode
     */
    enableAnnotationMode() {
        this.isAnnotationMode = true;
        this.mapRenderer.map.getCanvas().style.cursor = 'crosshair';
    }

    /**
     * Disable annotation mode
     */
    disableAnnotationMode() {
        this.isAnnotationMode = false;
        this.mapRenderer.map.getCanvas().style.cursor = '';
    }

    /**
     * Handle click event for creating annotations
     */
    handleAnnotationClick(e) {
        if (!this.isAnnotationMode || !this.mapRenderer.trackData) return;

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

    /**
     * Find the closest point on the track to a click point
     */
    findClosestPointProgress(clickPoint) {
        if (!this.mapRenderer.trackData || !this.mapRenderer.trackData.trackPoints) return 0;

        const clickLat = clickPoint[1];
        const clickLng = clickPoint[0];
        
        return MapUtils.findClosestPointProgress(
            { lat: clickLat, lng: clickLng }, 
            this.mapRenderer.trackData.trackPoints
        );
    }

    /**
     * Add a new annotation
     */
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

    /**
     * Remove an annotation by ID
     */
    removeAnnotation(id) {
        this.annotations = this.annotations.filter(ann => ann.id !== id);
        
        // Hide if this is the active annotation
        if (this.activeAnnotation && this.activeAnnotation.id === id) {
            this.hideActiveAnnotation();
        }
    }

    /**
     * Get all annotations
     */
    getAnnotations() {
        return this.annotations;
    }

    /**
     * Check for annotations to show/hide during animation
     */
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

    /**
     * Show an active annotation popup
     */
    showActiveAnnotation(annotation, endProgress) {
        this.activeAnnotation = { ...annotation, endProgress };
        
        const annotationDisplay = document.getElementById('activeAnnotation');
        if (!annotationDisplay) return;
        
        const icon = annotationDisplay.querySelector('.annotation-popup-icon');
        const title = annotationDisplay.querySelector('.annotation-popup-title');
        const description = annotationDisplay.querySelector('.annotation-popup-description');
        
        if (icon) icon.textContent = annotation.icon;
        if (title) title.textContent = annotation.title;
        if (description) {
            description.textContent = annotation.description || '';
            description.style.display = annotation.description ? 'block' : 'none';
        }
        
        annotationDisplay.style.display = 'block';
        
        // Add close handler
        const closeBtn = annotationDisplay.querySelector('.annotation-popup-close');
        if (closeBtn) {
            closeBtn.onclick = () => this.hideActiveAnnotation();
        }
    }

    /**
     * Hide the active annotation popup
     */
    hideActiveAnnotation() {
        this.activeAnnotation = null;
        const annotationDisplay = document.getElementById('activeAnnotation');
        if (annotationDisplay) {
            annotationDisplay.style.display = 'none';
        }
    }
} 