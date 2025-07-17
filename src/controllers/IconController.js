import { AVAILABLE_ICONS, ICON_CATEGORIES } from '../utils/constants.js';
import { t } from '../translations.js';

export class IconController {
    constructor(app) {
        this.app = app;
        this.currentIconChange = { icon: '🚴‍♂️' };
    }

    initialize() {
        this.setupEventListeners();
        this.setupCustomEvents();
        this.populateIconGrid();
        console.log('IconController initialized');
    }

    setupEventListeners() {
        // NOTE: Main buttons (addIconChangeBtn, changeIconBtn) are handled in eventListeners.js
        // to avoid duplicate event listeners

        // Main icon selection button - REMOVED: handled in eventListeners.js
        // const changeIconBtn = document.getElementById('changeIconBtn');
        // if (changeIconBtn) {
        //     changeIconBtn.addEventListener('click', () => this.showIconSelectionModal());
        // }

        // Icon selection modal controls
        const closeIconModal = document.getElementById('closeIconModal');
        const cancelIconBtn = document.getElementById('cancelIconBtn');
        if (closeIconModal) closeIconModal.addEventListener('click', () => this.closeIconSelectionModal());
        if (cancelIconBtn) cancelIconBtn.addEventListener('click', () => this.closeIconSelectionModal());

        // Icon change modal controls
        const closeIconChangeModal = document.getElementById('closeIconChangeModal');
        const cancelIconChangeBtn = document.getElementById('cancelIconChangeBtn');
        const saveIconChangeBtn = document.getElementById('saveIconChangeBtn');
        const selectIconForChangeBtn = document.getElementById('selectIconForChangeBtn');

        if (closeIconChangeModal) closeIconChangeModal.addEventListener('click', () => this.closeIconChangeModal());
        if (cancelIconChangeBtn) cancelIconChangeBtn.addEventListener('click', () => this.closeIconChangeModal());
        if (saveIconChangeBtn) saveIconChangeBtn.addEventListener('click', () => this.saveIconChange());
        if (selectIconForChangeBtn) selectIconForChangeBtn.addEventListener('click', () => this.showIconSelectionForChange());
    }

    setupCustomEvents() {
        // Listen for icon change clicks from map/progress bar
        document.addEventListener('iconChangeClick', (e) => {
            console.log('🎯 IconController: Received iconChangeClick event', e.detail);
            this.currentIconChange.progress = e.detail.progress;
            this.currentIconChange.coordinates = e.detail.coordinates;
            console.log('🎯 IconController: About to show icon change modal');
            this.showIconChangeModal();
        });

        // Listen for icon changed events
        document.addEventListener('iconChanged', (e) => {
            this.updateCurrentIconDisplay(e.detail.icon);
        });

        // Listen for current icon updated events
        document.addEventListener('currentIconUpdated', (e) => {
            this.updateCurrentIconDisplay(e.detail.icon);
        });
    }

    showIconSelectionModal() {
        const modal = document.getElementById('iconSelectionModal');
        if (modal) {
            modal.style.display = 'flex';
            this.populateIconGrid();
        }
    }

    closeIconSelectionModal() {
        const modal = document.getElementById('iconSelectionModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    populateIconGrid() {
        const iconGrid = document.getElementById('iconGrid');
        if (!iconGrid) return;

        iconGrid.innerHTML = '';

        // Just show all icons in a simple grid - no categories
        AVAILABLE_ICONS.forEach(icon => {
            const iconElement = document.createElement('div');
            iconElement.className = 'icon-option';
            iconElement.textContent = icon;
            iconElement.addEventListener('click', () => this.selectIcon(icon));
            iconGrid.appendChild(iconElement);
        });
    }

    selectIcon(icon) {
        // Check if we're in icon change mode or just setting the main icon
        const iconChangeModal = document.getElementById('iconChangeModal');
        const isIconChangeMode = iconChangeModal && iconChangeModal.style.display === 'flex';

        if (isIconChangeMode) {
            // We're selecting an icon for a change event
            this.currentIconChange.icon = icon;
            this.updateIconChangeDisplay(icon);
            this.closeIconSelectionModal();
        } else {
            // We're setting the main current icon
            this.app.mapRenderer.setCurrentIcon(icon);
            this.updateCurrentIconDisplay(icon);
            this.closeIconSelectionModal();
        }
    }

    updateCurrentIconDisplay(icon) {
        const display = document.getElementById('currentIconDisplay');
        if (display) {
            display.textContent = icon;
        }
        
        // Update state
        this.app.state.currentIcon = icon;
    }

    updateIconChangeDisplay(icon) {
        const display = document.getElementById('selectedIconForChange');
        if (display) {
            display.textContent = icon;
        }
    }

    toggleIconChangeMode() {
        console.log('🎯 IconController.toggleIconChangeMode() called');
        console.trace('🎯 Stack trace for toggleIconChangeMode call:');
        
        const btn = document.getElementById('addIconChangeBtn');
        if (!btn || !this.app.mapRenderer) {
            console.log('🎯 Button or mapRenderer not found');
            return;
        }

        const span = btn.querySelector('span');
        
        console.log('🎯 Current isIconChangeMode state:', this.app.mapRenderer.isIconChangeMode);
        
        if (this.app.mapRenderer.isIconChangeMode) {
            // Disable icon change mode
            console.log('🎯 Disabling icon change mode from toggle');
            this.app.mapRenderer.disableIconChangeMode();
            if (span) span.textContent = t('controls.addIconChange');
            btn.classList.remove('active');
        } else {
            // Enable icon change mode
            console.log('🎯 Enabling icon change mode from toggle');
            this.app.mapRenderer.enableIconChangeMode();
            if (span) span.textContent = t('controls.cancelIconChange');
            btn.classList.add('active');
            this.app.showMessage(t('messages.clickMapForIconChange'), 'info');
        }
    }

    showIconChangeModal() {
        console.log('🎯 IconController: showIconChangeModal() called');
        const modal = document.getElementById('iconChangeModal');
        if (modal) {
            console.log('🎯 IconController: Modal found, setting display to flex');
            modal.style.display = 'flex';
            // Initialize the display with the current icon in currentIconChange
            this.updateIconChangeDisplay(this.currentIconChange.icon);
            console.log('🎯 IconController: Modal should now be visible');
        } else {
            console.error('🎯 IconController: Modal element not found!');
        }
    }

    closeIconChangeModal() {
        console.log('🎯 IconController: closeIconChangeModal() called');
        console.trace('🎯 Stack trace for closeIconChangeModal call:');
        const modal = document.getElementById('iconChangeModal');
        if (modal) {
            modal.style.display = 'none';
            console.log('🎯 IconController: Modal hidden');
        }

        // Also disable icon change mode
        if (this.app.mapRenderer) {
            console.log('🎯 IconController: Disabling icon change mode from closeIconChangeModal');
            this.app.mapRenderer.disableIconChangeMode();
            const btn = document.getElementById('addIconChangeBtn');
            if (btn) {
                btn.classList.remove('active');
                const span = btn.querySelector('span');
                if (span) span.textContent = t('controls.addIconChange');
            }
        }
    }

    showIconSelectionForChange() {
        // Show icon selection modal for choosing icon change
        this.showIconSelectionModal();
    }

    saveIconChange() {
        if (!this.app.mapRenderer) {
            console.warn('Cannot save icon change - no map renderer');
            this.app.showMessage('Map not ready for icon changes', 'error');
            return;
        }
        
        if (this.currentIconChange.progress === undefined) {
            console.warn('Cannot save icon change - no progress set');
            this.app.showMessage('Please click on the map or progress bar first', 'error');
            return;
        }
        
        if (!this.currentIconChange.icon) {
            console.warn('Cannot save icon change - no icon selected');
            this.app.showMessage('Please select an icon first', 'error');
            return;
        }

        const iconChange = this.app.mapRenderer.addIconChange(
            this.currentIconChange.progress,
            this.currentIconChange.icon
        );

        if (iconChange) {
            // Add to unified timeline
            this.app.timeline.addTimelineEvent({
                id: iconChange.id,
                type: 'iconChange',
                progress: iconChange.progress,
                timestamp: iconChange.timestamp,
                icon: iconChange.icon
            });
            
            this.app.showMessage(t('messages.iconChangeAdded'), 'success');
            this.updateProgressBarMarkers();
        } else {
            this.app.showMessage('Failed to add icon change', 'error');
        }

        this.closeIconChangeModal();
    }

    addIconChangeToTimeline(iconChange) {
        const timelineSection = document.getElementById('iconTimelineSection');
        const timeline = document.getElementById('iconTimeline');
        
        if (!timeline) return;

        // Show timeline section if hidden
        if (timelineSection && timelineSection.style.display === 'none') {
            timelineSection.style.display = 'block';
            timelineSection.classList.add('fade-in');
        }

        const timelineItem = document.createElement('div');
        timelineItem.className = 'icon-timeline-item';
        timelineItem.setAttribute('data-id', iconChange.id);

        const progressPercent = (iconChange.progress * 100).toFixed(1);
        const timeFromStart = this.app.currentTrackData?.stats?.totalDuration ? 
            this.app.gpxParser?.formatDuration(iconChange.progress * this.app.currentTrackData.stats.totalDuration) :
            `${progressPercent}%`;

        timelineItem.innerHTML = `
            <div class="icon-timeline-icon">${iconChange.icon}</div>
            <div class="icon-timeline-content">
                <div class="icon-timeline-time">At ${timeFromStart}</div>
                <div class="icon-timeline-description">Change to ${iconChange.icon}</div>
            </div>
            <div class="icon-timeline-actions">
                <button class="timeline-action" onclick="app.icon.removeIconChangeFromTimeline(${iconChange.id})" title="Delete">🗑️</button>
            </div>
        `;

        // Add click handler to seek to this position
        timelineItem.addEventListener('click', (e) => {
            // Don't trigger on action button clicks
            if (!e.target.classList.contains('timeline-action')) {
                // Seek to this position
                if (this.app.mapRenderer) {
                    this.app.mapRenderer.setAnimationProgress(iconChange.progress);
                    this.app.mapRenderer.updateCurrentPosition();
                    this.app.updateProgressDisplay();
                }
            }
        });

        timeline.appendChild(timelineItem);
    }

    removeIconChangeFromTimeline(id) {
        // Use the unified timeline controller to remove
        this.app.timeline.removeTimelineEvent(id);
        this.updateProgressBarMarkers();
    }

    updateProgressBarMarkers() {
        const iconChangeMarkers = document.getElementById('iconChangeMarkers');
        if (!iconChangeMarkers || !this.app.mapRenderer) return;

        iconChangeMarkers.innerHTML = '';

        const iconChanges = this.app.mapRenderer.getIconChanges();
        if (!iconChanges) return;

        const elevationProfile = this.app.elevationProfile;
        const points = elevationProfile?.points;
        const pointsLength = points?.length;
        const svgWidth = elevationProfile?.svgWidth || 800;
        const renderedWidth = iconChangeMarkers.offsetWidth || svgWidth;

        iconChanges.forEach(change => {
            const marker = document.createElement('div');
            marker.className = 'progress-marker icon-change-marker';
            let leftPx = 0;
            if (points && pointsLength > 0) {
                // Place marker by track point index (distance-based), scaled to rendered width
                const index = Math.round(change.progress * (pointsLength - 1));
                const [x] = points[index].split(',').map(Number);
                leftPx = (x / svgWidth) * renderedWidth;
                marker.style.left = `${leftPx}px`;
            } else {
                marker.style.left = `${change.progress * 100}%`;
            }
            marker.title = `Icon change to ${change.icon} at ${(change.progress * 100).toFixed(1)}%`;
            marker.textContent = change.icon;
            iconChangeMarkers.appendChild(marker);
        });
    }

    // Add segment icon changes for journeys - using coordinate-based calculation
    addSegmentIconChanges(trackData) {
        if (!trackData.isJourney || !trackData.segments || !this.app.mapRenderer) {
            return;
        }

        console.log('Adding segment icon changes for journey with coordinate-based calculation');
        // Do NOT clear existing icon changes here; preserve user-added icon changes

        const totalCoordinates = trackData.trackPoints.length;
        let currentIndex = 0;

        trackData.segments.forEach((segment, segmentIndex) => {
            const segmentLength = segment.endIndex - segment.startIndex + 1;
            const progress = currentIndex / (totalCoordinates - 1);

            let icon;
            if (segment.type === 'track') {
                // Use activity-based icon for GPX tracks
                const activityType = segment.data?.data?.activityType || segment.data?.activityType || 'running';
                icon = this.getActivityIcon(activityType);
            } else if (segment.type === 'transportation') {
                // Use transportation mode icon
                icon = this.getTransportationIcon(segment.mode);
            }

            if (icon && segmentIndex > 0) { // Don't add for first segment (it starts with default)
                // Only add if not already present at this progress
                const existing = this.app.mapRenderer.getIconChanges().find(c => Math.abs(c.progress - progress) < 1e-6 && c.icon === icon);
                if (!existing) {
                    const iconChange = this.app.mapRenderer.addIconChange(progress, icon);
                    if (iconChange) {
                        // Add to unified timeline
                        this.app.timeline.addTimelineEvent({
                            id: iconChange.id,
                            type: 'iconChange',
                            progress: iconChange.progress,
                            timestamp: iconChange.timestamp,
                            icon: iconChange.icon
                        });
                        console.log(`Added automatic icon change at progress ${progress.toFixed(3)}: ${icon} for ${segment.type} (${segment.mode || segment.data?.data?.activityType || segment.data?.activityType})`);
                    }
                }
            }

            currentIndex = segment.endIndex + 1;
        });

        this.updateProgressBarMarkers();
    }

    // Get icon for transportation mode
    getTransportationIcon(mode) {
        const icons = {
            'car': '🚗',
            'driving': '🚗',
            'boat': '⛵',
            'plane': '✈️',
            'train': '🚂',
            'walk': '🚶‍♂️',
            'cycling': '🚴‍♂️'
        };
        return icons[mode] || '🚗';
    }

    getActivityIcon(activityType) {
        const iconMap = {
            running: '🏃‍♂️',
            cycling: '🚴‍♂️', 
            walking: '🚶‍♂️',
            hiking: '🥾',
            swimming: '🏊‍♂️'
        };
        return iconMap[activityType] || '🏃‍♂️';
    }

    // Clean up when controller is destroyed
    destroy() {
        // Remove event listeners
        document.removeEventListener('iconChangeClick', this.handleIconChangeClick);
        document.removeEventListener('iconChanged', this.handleIconChanged);
        document.removeEventListener('currentIconUpdated', this.handleCurrentIconUpdated);
    }
} 