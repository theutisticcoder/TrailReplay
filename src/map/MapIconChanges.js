/**
 * MapIconChanges - Handles icon change functionality for the map
 */
import { MapUtils } from './MapUtils.js';

export class MapIconChanges {
    constructor(mapRenderer) {
        this.mapRenderer = mapRenderer;
        this.iconChanges = [];
        this.isIconChangeMode = false;
    }

    /**
     * Enable icon change mode
     */
    enableIconChangeMode() {
        this.isIconChangeMode = true;
        this.mapRenderer.map.getCanvas().style.cursor = 'crosshair';
    }

    /**
     * Disable icon change mode
     */
    disableIconChangeMode() {
        this.isIconChangeMode = false;
        this.mapRenderer.map.getCanvas().style.cursor = '';
    }

    /**
     * Handle click event for creating icon changes
     */
    handleIconChangeClick(e) {
        console.log('🎯 MapIconChanges.handleIconChangeClick called:', {
            isIconChangeMode: this.isIconChangeMode,
            hasTrackData: !!this.mapRenderer.trackData,
            event: e
        });
        
        if (!this.isIconChangeMode || !this.mapRenderer.trackData) {
            console.warn('Icon change click ignored - mode not enabled or no track data');
            return;
        }

        let progress;
        
        // Check if click is from progress bar or map
        if (e.detail && e.detail.progress !== undefined) {
            // Click from progress bar
            progress = e.detail.progress;
            console.log('🎯 Click from progress bar, progress:', progress);
        } else {
            // Click from map
            const clickPoint = [e.lngLat.lng, e.lngLat.lat];
            progress = this.findClosestPointProgress(clickPoint);
            console.log('🎯 Click from map, calculated progress:', progress);
        }
        
        // Stop event propagation to prevent modal from closing immediately
        if (e.originalEvent) {
            e.originalEvent.stopPropagation();
        }
        
        // Dispatch custom event with progress
        const iconChangeEvent = new CustomEvent('iconChangeClick', {
            detail: { progress, coordinates: e.lngLat ? [e.lngLat.lng, e.lngLat.lat] : null }
        });
        console.log('🎯 Dispatching iconChangeClick event with progress:', progress);
        document.dispatchEvent(iconChangeEvent);
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
     * Add a new icon change
     */
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

    /**
     * Remove an icon change by ID
     */
    removeIconChange(id) {
        this.iconChanges = this.iconChanges.filter(change => change.id !== id);
    }

    /**
     * Get all icon changes
     */
    getIconChanges() {
        return this.iconChanges;
    }

    /**
     * Check which icon should be active at a given progress
     */
    checkIconChanges(progress) {
        if (this.iconChanges.length === 0) {
            // No icon changes defined - keep current icon as is
            // Don't automatically revert to base icon, respect manually set icons
            return;
        }
        
        console.log('Checking icon changes at progress:', progress.toFixed(3), 'Total changes:', this.iconChanges.length);
        
        const sortedChanges = this.iconChanges.sort((a, b) => a.progress - b.progress);
        
        // Start with the base icon (activity type icon)
        const baseIcon = this.mapRenderer.getBaseIcon();
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
        if (activeIcon !== this.mapRenderer.currentIcon) {
            console.log(`Icon change detected: ${this.mapRenderer.currentIcon} → ${activeIcon} at progress ${progress.toFixed(3)}`);
            this.mapRenderer.currentIcon = activeIcon;
            
            // Force icon update immediately
            this.mapRenderer.forceIconUpdate();
            
            // Dispatch event to update UI
            const iconChangeEvent = new CustomEvent('iconChanged', {
                detail: { icon: activeIcon, progress: progress }
            });
            document.dispatchEvent(iconChangeEvent);
        } else {
            // Even if icon didn't change, ensure it's properly displayed
            this.mapRenderer.ensureActivityIconLayer();
        }
    }

} 