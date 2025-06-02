import { initializeTranslations, t } from './translations.js';
import { GPXParser } from './gpxParser.js';
import { MapRenderer } from './mapRenderer.js';

class TrailReplayApp {
    constructor() {
        this.gpxParser = new GPXParser();
        this.mapRenderer = null;
        this.currentTrackData = null;
        this.isPlaying = false;
        this.videoExporter = null;
        this.currentAnnotation = { icon: '📍' };
        this.currentIconChange = { icon: '🚴‍♂️' };
        this.totalAnimationTime = 60; // Default 60 seconds
        this.isSelectingForChange = false; // Flag for icon selection mode
        this.iconCategories = {
            'Running/Walking': ['🏃‍♂️', '🏃‍♀️', '🚶‍♂️', '🚶‍♀️', '🥾', '👟', '🏃', '🚶'],
            'Cycling': ['🚴‍♂️', '🚴‍♀️', '🚲', '🚴', '🏍️', '🛵', '🛴'],
            'Swimming': ['🏊‍♂️', '🏊‍♀️', '🤽‍♂️', '🤽‍♀️', '🏊', '🤽'],
            'Cars & Vehicles': ['🚗', '🚙', '🚐', '🚕', '🚖', '🚘', '🚔', '🚨', '🚒', '🚑', '🛻', '🚚', '🚛', '🚜', '🏎️', '🛺'],
            'Aircraft': ['✈️', '🛩️', '🚁', '🛸', '🎈', '🪂', '🛫', '🛬'],
            'Boats & Water': ['⛵', '🚤', '🛥️', '🚢', '⛴️', '🛳️', '🚣‍♂️', '🚣‍♀️', '🏄‍♂️', '🏄‍♀️'],
            'Trains & Public Transport': ['🚂', '🚃', '🚄', '🚅', '🚆', '🚇', '🚈', '🚝', '🚞', '🚋', '🚌', '🚍', '🚠', '🚡'],
            'Adventure & Outdoor': ['🧗‍♂️', '🧗‍♀️', '🏔️', '⛰️', '🗻', '🏕️', '⛺', '🎒', '🧭', '🔦', '⛸️', '🛹', '🛼', '🏂', '⛷️'],
            'Sports': ['🏆', '🥇', '🥈', '🥉', '🎯', '⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏉', '🏌️‍♂️', '🏌️‍♀️', '🤸‍♂️', '🤸‍♀️', '🤾‍♂️', '🤾‍♀️', '🏋️‍♂️', '🏋️‍♀️', '🤺', '🏸', '🏓', '🥊', '🥋']
        };
        
        // Flatten all icons for compatibility
        this.availableIcons = Object.values(this.iconCategories).flat();
        
        this.initializeApp();
    }

    async initializeApp() {
        // Initialize translations
        initializeTranslations();
        
        // Initialize UI event listeners
        this.setupEventListeners();
        
        // Add drag and drop functionality
        this.setupDragAndDrop();
        
        // Add language switcher
        this.addLanguageSwitcher();

        // Setup event listeners for new features
        this.setupFeatureListeners();

        // Enhanced Progress bar scrubbing functionality
        this.setupProgressBarScrubbing();
    }

    setupEventListeners() {
        // File input
        const fileInput = document.getElementById('gpxFileInput');
        fileInput.addEventListener('change', (e) => this.handleFileSelect(e));

        // Control buttons
        document.getElementById('playBtn').addEventListener('click', () => this.togglePlayback());
        document.getElementById('resetBtn').addEventListener('click', () => this.resetAnimation());
        document.getElementById('addIconChangeBtn').addEventListener('click', () => this.toggleIconChangeMode());
        document.getElementById('addAnnotationBtn').addEventListener('click', () => this.toggleAnnotationMode());
        document.getElementById('exportBtn').addEventListener('click', () => this.exportVideo());

        // Icon controls
        document.getElementById('changeIconBtn').addEventListener('click', () => this.showIconSelectionModal());

        // Control inputs
        document.getElementById('activityType').addEventListener('change', (e) => {
            if (this.mapRenderer) {
                this.mapRenderer.setActivityType(e.target.value);
            }
        });

        document.getElementById('terrainStyle').addEventListener('change', (e) => {
            if (this.mapRenderer) {
                this.mapRenderer.changeMapStyle(e.target.value);
            }
        });

        // Replace animation speed with total time
        const timeSlider = document.getElementById('animationSpeed');
        timeSlider.min = 10;
        timeSlider.max = 300;
        timeSlider.value = 60;
        timeSlider.step = 5;
        
        timeSlider.addEventListener('input', (e) => {
            const totalTime = parseInt(e.target.value);
            this.totalAnimationTime = totalTime;
            document.getElementById('speedValue').textContent = `${totalTime}s`;
            
            // Update the total time display in the progress bar
            document.getElementById('totalTime').textContent = this.formatTimeInSeconds(totalTime);
            
            // Update animation speed based on total time and track duration
            if (this.mapRenderer && this.currentTrackData) {
                // Calculate the speed multiplier to make animation last exactly totalTime seconds
                // Since animation increments by 0.001 per frame at 60fps, we need to adjust speed
                const targetDurationMs = totalTime * 1000; // Convert to milliseconds
                const framesNeeded = (1 / 0.001); // Number of frames to complete (1000 frames for full progress)
                const frameTime = targetDurationMs / framesNeeded; // Time per frame in ms
                const speedMultiplier = 16.67 / frameTime; // 16.67ms is roughly 60fps
                this.mapRenderer.setAnimationSpeed(speedMultiplier);
            }
        });

        // Initialize the display
        document.getElementById('speedValue').textContent = `${this.totalAnimationTime}s`;

        // New controls
        const pathColorInput = document.getElementById('pathColor');
        pathColorInput.addEventListener('change', (e) => {
            if (this.mapRenderer) {
                this.mapRenderer.setPathColor(e.target.value);
            }
        });

        // Color presets
        document.querySelectorAll('.color-preset').forEach(preset => {
            preset.addEventListener('click', (e) => {
                const color = e.target.getAttribute('data-color');
                pathColorInput.value = color;
                if (this.mapRenderer) {
                    this.mapRenderer.setPathColor(color);
                }
            });
        });

        const markerSizeSlider = document.getElementById('markerSize');
        markerSizeSlider.addEventListener('input', (e) => {
            const size = parseFloat(e.target.value);
            document.getElementById('markerSizeValue').textContent = `${size}x`;
            if (this.mapRenderer) {
                this.mapRenderer.setMarkerSize(size);
            }
        });

        const autoZoomToggle = document.getElementById('autoZoom');
        autoZoomToggle.addEventListener('change', (e) => {
            if (this.mapRenderer) {
                this.mapRenderer.setAutoZoom(e.target.checked);
            }
        });

        const showCircleToggle = document.getElementById('showCircle');
        showCircleToggle.addEventListener('change', (e) => {
            if (this.mapRenderer) {
                this.mapRenderer.setShowCircle(e.target.checked);
            }
        });

        // Map control buttons
        // document.getElementById('centerTrailBtn').addEventListener('click', () => {
        //     if (this.mapRenderer) this.mapRenderer.centerOnTrail();
        // });

        // Modal controls
        this.setupModalControls();
    }

    setupModalControls() {
        // Icon Selection Modal
        const iconModal = document.getElementById('iconSelectionModal');
        const closeIconModal = document.getElementById('closeIconModal');
        const cancelIconBtn = document.getElementById('cancelIconBtn');

        closeIconModal.addEventListener('click', () => this.closeIconSelectionModal());
        cancelIconBtn.addEventListener('click', () => this.closeIconSelectionModal());

        // Icon Change Modal
        const iconChangeModal = document.getElementById('iconChangeModal');
        const closeIconChangeModal = document.getElementById('closeIconChangeModal');
        const cancelIconChangeBtn = document.getElementById('cancelIconChangeBtn');
        const saveIconChangeBtn = document.getElementById('saveIconChangeBtn');
        const selectIconForChangeBtn = document.getElementById('selectIconForChangeBtn');

        closeIconChangeModal.addEventListener('click', () => this.closeIconChangeModal());
        cancelIconChangeBtn.addEventListener('click', () => this.closeIconChangeModal());
        saveIconChangeBtn.addEventListener('click', () => this.saveIconChange());
        selectIconForChangeBtn.addEventListener('click', () => this.showIconSelectionForChange());

        // Annotation Modal
        const modal = document.getElementById('annotationModal');
        const closeBtn = document.getElementById('closeAnnotationModal');
        const cancelBtn = document.getElementById('cancelAnnotationBtn');
        const saveBtn = document.getElementById('saveAnnotationBtn');

        closeBtn.addEventListener('click', () => this.closeAnnotationModal());
        cancelBtn.addEventListener('click', () => this.closeAnnotationModal());
        saveBtn.addEventListener('click', () => this.saveAnnotation());

        // Icon selection
        document.querySelectorAll('.annotation-icon').forEach(icon => {
            icon.addEventListener('click', (e) => {
                document.querySelectorAll('.annotation-icon').forEach(i => i.classList.remove('selected'));
                e.target.classList.add('selected');
                this.currentAnnotation.icon = e.target.getAttribute('data-icon');
            });
        });

        // Close modals when clicking outside
        [iconModal, iconChangeModal, modal].forEach(modalEl => {
            modalEl.addEventListener('click', (e) => {
                if (e.target === modalEl) {
                    modalEl.style.display = 'none';
                }
            });
        });
    }

    setupFeatureListeners() {
        // Listen for annotation clicks
        document.addEventListener('annotationClick', (e) => {
            this.currentAnnotation.progress = e.detail.progress;
            this.currentAnnotation.coordinates = e.detail.coordinates;
            this.showAnnotationModal();
        });

        // Listen for icon change clicks
        document.addEventListener('iconChangeClick', (e) => {
            this.currentIconChange.progress = e.detail.progress;
            this.currentIconChange.coordinates = e.detail.coordinates;
            this.showIconChangeModal();
        });

        // Listen for icon changes during animation
        document.addEventListener('iconChanged', (e) => {
            this.updateCurrentIconDisplay(e.detail.icon);
        });

        // Listen for current icon updates
        document.addEventListener('currentIconUpdated', (e) => {
            this.updateCurrentIconDisplay(e.detail.icon);
        });
    }

    // Icon Selection Modal
    showIconSelectionModal() {
        this.populateIconGrid();
        document.getElementById('iconSelectionModal').style.display = 'flex';
    }

    closeIconSelectionModal() {
        document.getElementById('iconSelectionModal').style.display = 'none';
    }

    populateIconGrid() {
        const iconGrid = document.getElementById('iconGrid');
        iconGrid.innerHTML = '';

        this.availableIcons.forEach(icon => {
            const iconOption = document.createElement('div');
            iconOption.className = 'icon-option';
            iconOption.textContent = icon;
            iconOption.addEventListener('click', () => {
                if (this.isSelectingForChange) {
                    // Selecting icon for change
                    this.currentIconChange.icon = icon;
                    document.getElementById('selectedIconForChange').textContent = icon;
                    this.isSelectingForChange = false;
                    this.closeIconSelectionModal();
                } else {
                    // Selecting current icon
                    if (this.mapRenderer) {
                        this.mapRenderer.setCurrentIcon(icon);
                    }
                    this.closeIconSelectionModal();
                }
            });
            iconGrid.appendChild(iconOption);
        });
    }

    updateCurrentIconDisplay(icon) {
        document.getElementById('currentIconDisplay').textContent = icon;
    }

    // Icon Change functionality
    toggleIconChangeMode() {
        if (!this.mapRenderer) return;

        const btn = document.getElementById('addIconChangeBtn');
        const span = btn.querySelector('span');
        
        if (this.mapRenderer.isIconChangeMode) {
            this.mapRenderer.disableIconChangeMode();
            span.textContent = t('controls.addIconChange');
            btn.classList.remove('primary');
        } else {
            this.mapRenderer.enableIconChangeMode();
            span.textContent = '✖️ Cancel';
            btn.classList.add('primary');
            this.showMessage(t('messages.clickMapForIconChange'), 'info');
        }
    }

    showIconChangeModal() {
        document.getElementById('iconChangeModal').style.display = 'flex';
    }

    closeIconChangeModal() {
        document.getElementById('iconChangeModal').style.display = 'none';
        
        // Reset icon change mode
        if (this.mapRenderer) {
            this.mapRenderer.disableIconChangeMode();
            const btn = document.getElementById('addIconChangeBtn');
            btn.querySelector('span').textContent = t('controls.addIconChange');
            btn.classList.remove('primary');
        }
    }

    showIconSelectionForChange() {
        this.isSelectingForChange = true;
        this.populateIconGrid();
        document.getElementById('iconSelectionModal').style.display = 'flex';
    }

    saveIconChange() {
        if (this.mapRenderer && this.currentIconChange.progress !== undefined) {
            const iconChange = this.mapRenderer.addIconChange(
                this.currentIconChange.progress,
                this.currentIconChange.icon
            );

            this.addIconChangeToTimeline(iconChange);
            this.updateProgressBarMarkers();
            this.showMessage(t('messages.iconChangeAdded'), 'success');
        }

        this.closeIconChangeModal();
    }

    addIconChangeToTimeline(iconChange) {
        const timelineSection = document.getElementById('iconTimelineSection');
        const timeline = document.getElementById('iconTimeline');
        
        // Show timeline section if hidden
        if (timelineSection.style.display === 'none') {
            timelineSection.style.display = 'block';
            timelineSection.classList.add('fade-in');
        }

        const timelineItem = document.createElement('div');
        timelineItem.className = 'icon-timeline-item';
        timelineItem.setAttribute('data-id', iconChange.id);
        
        const progressPercent = (iconChange.progress * 100).toFixed(1);
        const timeFromStart = this.currentTrackData ? 
            this.gpxParser.formatDuration(iconChange.progress * this.currentTrackData.stats.totalDuration) : 
            `${progressPercent}%`;

        timelineItem.innerHTML = `
            <div class="icon-timeline-icon">${iconChange.icon}</div>
            <div class="icon-timeline-content">
                <div class="icon-timeline-time">At ${timeFromStart}</div>
                <div class="icon-timeline-description">Change to ${iconChange.icon}</div>
            </div>
            <div class="icon-timeline-actions">
                <button class="timeline-action" onclick="app.removeIconChangeFromTimeline(${iconChange.id})" title="Delete">🗑️</button>
            </div>
        `;

        // Add click handler to jump to that position
        timelineItem.addEventListener('click', (e) => {
            // Don't trigger if clicking on delete button
            if (!e.target.classList.contains('timeline-action')) {
                if (this.mapRenderer) {
                    this.mapRenderer.setAnimationProgress(iconChange.progress);
                    this.updateProgressDisplay();
                }
            }
        });

        timeline.appendChild(timelineItem);
    }

    removeIconChangeFromTimeline(id) {
        if (this.mapRenderer) {
            this.mapRenderer.removeIconChange(id);
        }

        // Remove from UI
        const timeline = document.getElementById('iconTimeline');
        const item = timeline.querySelector(`[data-id="${id}"]`);
        if (item) {
            item.remove();
        }

        // Hide section if no icon changes left
        if (timeline.children.length === 0) {
            document.getElementById('iconTimelineSection').style.display = 'none';
        }

        this.updateProgressBarMarkers();
    }

    setupDragAndDrop() {
        const uploadCard = document.querySelector('.upload-card');
        
        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadCard.addEventListener(eventName, this.preventDefaults, false);
            document.body.addEventListener(eventName, this.preventDefaults, false);
        });

        // Highlight drop area when item is dragged over it
        ['dragenter', 'dragover'].forEach(eventName => {
            uploadCard.addEventListener(eventName, () => uploadCard.classList.add('highlight'), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            uploadCard.addEventListener(eventName, () => uploadCard.classList.remove('highlight'), false);
        });

        // Handle dropped files
        uploadCard.addEventListener('drop', (e) => this.handleDrop(e), false);
    }

    preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files.length > 0) {
            this.handleFileSelect({ target: { files } });
        }
    }

    async handleFileSelect(event) {
        const file = event.target.files[0];
        
        if (!file) return;
        
        if (!file.name.toLowerCase().endsWith('.gpx')) {
            this.showMessage(t('messages.fileError'), 'error');
            return;
        }

        try {
            // Show loading state
            this.showLoading(true);
            
            console.log('Starting to parse GPX file:', file.name);
            
            // Parse GPX file
            const trackData = await this.gpxParser.parseFile(file);
            this.currentTrackData = trackData;
            
            console.log('GPX parsed successfully:', trackData);
            
            // Initialize map renderer if not already done
            if (!this.mapRenderer) {
                console.log('Initializing map renderer...');
                this.mapRenderer = new MapRenderer('map');
                // Wait for map to load
                await this.waitForMapLoad();
                console.log('Map loaded successfully');
            }
            
            // Load track data into map
            console.log('Loading track into map...');
            this.mapRenderer.loadTrack(trackData);
            
            // Update animation speed based on total time
            this.updateAnimationSpeed();
            
            // Update UI
            this.showVisualizationSection();
            this.updateStats(trackData.stats);
            this.showMessage(t('messages.fileLoaded'), 'success');
            
        } catch (error) {
            console.error('Error processing GPX file:', error);
            this.showMessage(`${t('messages.fileError')}: ${error.message}`, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    updateAnimationSpeed() {
        if (this.mapRenderer && this.currentTrackData) {
            try {
                // Calculate the speed multiplier to make animation last exactly totalTime seconds
                // Since animation increments by 0.001 per frame at 60fps, we need to adjust speed
                const targetDurationMs = this.totalAnimationTime * 1000; // Convert to milliseconds
                const framesNeeded = (1 / 0.001); // Number of frames to complete (1000 frames for full progress)
                const frameTime = targetDurationMs / framesNeeded; // Time per frame in ms
                const speedMultiplier = 16.67 / frameTime; // 16.67ms is roughly 60fps
                
                console.log('Target animation time (seconds):', this.totalAnimationTime);
                console.log('Speed multiplier:', speedMultiplier);
                this.mapRenderer.setAnimationSpeed(speedMultiplier);
            } catch (error) {
                console.error('Error updating animation speed:', error);
                this.mapRenderer.setAnimationSpeed(1);
            }
        }
    }

    waitForMapLoad() {
        return new Promise((resolve) => {
            if (this.mapRenderer.map.loaded()) {
                resolve();
            } else {
                this.mapRenderer.map.on('load', resolve);
            }
        });
    }

    showVisualizationSection() {
        document.getElementById('uploadSection').style.display = 'none';
        document.getElementById('visualizationSection').style.display = 'block';
        document.getElementById('statsSection').style.display = 'block';
        
        // Add fade-in animation
        document.getElementById('visualizationSection').classList.add('fade-in');
        document.getElementById('statsSection').classList.add('fade-in');
    }

    updateStats(stats) {
        document.getElementById('totalDistance').textContent = this.gpxParser.formatDistance(stats.totalDistance);
        document.getElementById('elevationGain').textContent = this.gpxParser.formatElevation(stats.elevationGain);
        
        // Update total time to show the selected animation duration in MM:SS format
        document.getElementById('totalTime').textContent = this.formatTimeInSeconds(this.totalAnimationTime);
    }

    // New method to format time in MM:SS format
    formatTimeInSeconds(totalSeconds) {
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    togglePlayback() {
        if (!this.mapRenderer || !this.currentTrackData) return;

        const playBtn = document.getElementById('playBtn');
        const playText = playBtn.querySelector('span');
        
        if (this.isPlaying) {
            this.mapRenderer.stopAnimation();
            playText.textContent = t('controls.play');
            this.isPlaying = false;
        } else {
            this.mapRenderer.startAnimation();
            playText.textContent = t('controls.pause');
            this.isPlaying = true;
            this.startProgressUpdate();
        }
    }

    resetAnimation() {
        if (!this.mapRenderer) return;
        
        this.mapRenderer.resetAnimation();
        this.isPlaying = false;
        
        const playBtn = document.getElementById('playBtn');
        playBtn.querySelector('span').textContent = t('controls.play');
        
        // Reset progress bar
        document.getElementById('progressFill').style.width = '0%';
        document.getElementById('currentTime').textContent = '00:00';
    }

    startProgressUpdate() {
        const updateProgress = () => {
            if (!this.isPlaying || !this.mapRenderer) return;
            
            this.updateProgressDisplay();
            
            const progress = this.mapRenderer.getAnimationProgress();
            if (progress < 1 && this.isPlaying) {
                requestAnimationFrame(updateProgress);
            } else if (progress >= 1) {
                this.isPlaying = false;
                const playBtn = document.getElementById('playBtn');
                playBtn.querySelector('span').textContent = t('controls.play');
            }
        };
        
        updateProgress();
    }

    updateProgressDisplay() {
        const progress = this.mapRenderer.getAnimationProgress();
        const progressPercent = progress * 100;
        
        document.getElementById('progressFill').style.width = `${progressPercent}%`;
        
        // Show progress through the selected animation duration in seconds
        const currentTimeSeconds = Math.floor(progress * this.totalAnimationTime);
        document.getElementById('currentTime').textContent = this.formatTimeInSeconds(currentTimeSeconds);
    }

    updateProgressBarMarkers() {
        if (!this.mapRenderer) return;

        // Update icon change markers
        const iconChangeMarkers = document.getElementById('iconChangeMarkers');
        iconChangeMarkers.innerHTML = '';

        this.mapRenderer.getIconChanges().forEach(change => {
            const marker = document.createElement('div');
            marker.className = 'icon-change-marker';
            marker.style.left = `${change.progress * 100}%`;
            marker.title = `Icon change to ${change.icon}`;
            iconChangeMarkers.appendChild(marker);
        });

        // Update annotation markers
        const annotationMarkers = document.getElementById('annotationMarkers');
        annotationMarkers.innerHTML = '';

        this.mapRenderer.getAnnotations().forEach(annotation => {
            const marker = document.createElement('div');
            marker.className = 'annotation-marker';
            marker.style.left = `${annotation.progress * 100}%`;
            marker.title = annotation.title;
            annotationMarkers.appendChild(marker);
        });
    }

    // Annotation functionality
    toggleAnnotationMode() {
        if (!this.mapRenderer) return;

        const btn = document.getElementById('addAnnotationBtn');
        const span = btn.querySelector('span');
        
        if (this.mapRenderer.isAnnotationMode) {
            this.mapRenderer.disableAnnotationMode();
            span.textContent = t('controls.addAnnotation');
            btn.classList.remove('primary');
        } else {
            this.mapRenderer.enableAnnotationMode();
            span.textContent = '✖️ Cancel';
            btn.classList.add('primary');
            this.showMessage(t('messages.clickMapToAnnotate'), 'info');
        }
    }

    showAnnotationModal() {
        document.getElementById('annotationModal').style.display = 'flex';
        document.getElementById('annotationTitle').focus();
    }

    closeAnnotationModal() {
        document.getElementById('annotationModal').style.display = 'none';
        document.getElementById('annotationTitle').value = '';
        document.getElementById('annotationDescription').value = '';
        
        // Reset annotation mode
        if (this.mapRenderer) {
            this.mapRenderer.disableAnnotationMode();
            const btn = document.getElementById('addAnnotationBtn');
            btn.querySelector('span').textContent = t('controls.addAnnotation');
            btn.classList.remove('primary');
        }
    }

    saveAnnotation() {
        const title = document.getElementById('annotationTitle').value.trim();
        const description = document.getElementById('annotationDescription').value.trim();
        
        if (!title) {
            document.getElementById('annotationTitle').focus();
            return;
        }

        if (this.mapRenderer && this.currentAnnotation.progress !== undefined) {
            const annotation = this.mapRenderer.addAnnotation(
                this.currentAnnotation.progress,
                title,
                description,
                this.currentAnnotation.icon
            );

            this.addAnnotationToList(annotation);
            this.updateProgressBarMarkers();
            this.showMessage(t('messages.annotationAdded'), 'success');
        }

        this.closeAnnotationModal();
    }

    addAnnotationToList(annotation) {
        const annotationsSection = document.getElementById('annotationsSection');
        const annotationsList = document.getElementById('annotationsList');
        
        // Show annotations section if hidden
        if (annotationsSection.style.display === 'none') {
            annotationsSection.style.display = 'block';
            annotationsSection.classList.add('fade-in');
        }

        const progressPercent = (annotation.progress * 100).toFixed(1);
        const timeFromStart = this.currentTrackData ? 
            this.gpxParser.formatDuration(annotation.progress * this.currentTrackData.stats.totalDuration) : 
            `${progressPercent}%`;

        const annotationElement = document.createElement('div');
        annotationElement.className = 'annotation-item';
        annotationElement.setAttribute('data-id', annotation.id);
        annotationElement.innerHTML = `
            <div class="annotation-header">
                <span class="annotation-icon">${annotation.icon}</span>
                <span class="annotation-title">${annotation.title}</span>
                <span class="annotation-time">At ${timeFromStart}</span>
                <div class="annotation-actions">
                    <button class="annotation-action" onclick="app.removeAnnotationFromList(${annotation.id})" title="Delete">🗑️</button>
                </div>
            </div>
            ${annotation.description ? `<div class="annotation-description">${annotation.description}</div>` : ''}
        `;

        // Add click handler to jump to annotation
        annotationElement.addEventListener('click', (e) => {
            // Don't trigger if clicking on delete button
            if (!e.target.classList.contains('annotation-action')) {
                if (this.mapRenderer) {
                    this.mapRenderer.setAnimationProgress(annotation.progress);
                    this.updateProgressDisplay();
                }
            }
        });

        annotationsList.appendChild(annotationElement);
    }

    removeAnnotationFromList(id) {
        if (this.mapRenderer) {
            this.mapRenderer.removeAnnotation(id);
        }

        // Remove from UI
        const annotationsList = document.getElementById('annotationsList');
        const item = annotationsList.querySelector(`[data-id="${id}"]`);
        if (item) {
            item.remove();
        }

        // Hide section if no annotations left
        if (annotationsList.children.length === 0) {
            document.getElementById('annotationsSection').style.display = 'none';
        }

        this.updateProgressBarMarkers();
    }

    async exportVideo() {
        if (!this.mapRenderer || !this.currentTrackData) return;

        try {
            this.showMessage(t('messages.exportStarted'), 'info');
            
            // Simple video export - capture frames during animation
            const frames = [];
            const totalFrames = 60; // 2 seconds at 30fps
            
            for (let i = 0; i <= totalFrames; i++) {
                const progress = i / totalFrames;
                this.mapRenderer.setAnimationProgress(progress);
                
                // Wait a bit for the map to render
                await new Promise(resolve => setTimeout(resolve, 100));
                
                const frame = await this.mapRenderer.captureFrame();
                frames.push(frame);
            }
            
            // For now, just download the first frame as an image
            // In a full implementation, you'd combine frames into a video
            if (frames.length > 0) {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(frames[0]);
                link.download = 'trail-replay.png';
                link.click();
            }
            
            this.showMessage(t('messages.exportComplete'), 'success');
            
        } catch (error) {
            console.error('Error exporting video:', error);
            this.showMessage('Error exporting video', 'error');
        }
    }

    addLanguageSwitcher() {
        const header = document.querySelector('.header .container');
        const langSwitcher = document.createElement('div');
        langSwitcher.className = 'language-switcher';
        langSwitcher.innerHTML = `
            <select id="languageSelect" style="margin-top: 10px; padding: 5px; border-radius: 5px;">
                <option value="en">🇺🇸 English</option>
                <option value="es">🇪🇸 Español</option>
            </select>
        `;
        
        header.appendChild(langSwitcher);
        
        document.getElementById('languageSelect').addEventListener('change', (e) => {
            import('./translations.js').then(({ setLanguage }) => {
                setLanguage(e.target.value);
            });
        });
    }

    showMessage(message, type = 'info') {
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 10px;
            color: white;
            font-weight: 600;
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        
        // Set background color based on type
        const colors = {
            success: '#4CAF50',
            error: '#f44336',
            info: '#2196F3'
        };
        toast.style.backgroundColor = colors[type] || colors.info;
        
        document.body.appendChild(toast);
        
        // Remove toast after 3 seconds
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
        
        // Add CSS animations if not already added
        if (!document.getElementById('toast-styles')) {
            const style = document.createElement('style');
            style.id = 'toast-styles';
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
    }

    showLoading(show) {
        const uploadCard = document.querySelector('.upload-card');
        if (show) {
            uploadCard.classList.add('loading');
        } else {
            uploadCard.classList.remove('loading');
        }
    }

    // Enhanced Progress bar scrubbing functionality
    setupProgressBarScrubbing() {
        const progressBar = document.getElementById('progressBar');
        let isDragging = false;
        let wasPlaying = false;
        
        // Helper function to calculate progress from mouse/touch position
        const getProgressFromEvent = (e) => {
            const rect = progressBar.getBoundingClientRect();
            const x = (e.type.includes('touch') ? e.touches[0].clientX : e.clientX) - rect.left;
            return Math.max(0, Math.min(1, x / rect.width));
        };
        
        // Helper function to handle seeking to a specific progress
        const seekToProgress = (progress) => {
            if (!this.mapRenderer || !this.currentTrackData) return;
            
            // Check if in special modes (icon change or annotation)
            if (this.mapRenderer.isIconChangeMode) {
                const iconChangeEvent = new CustomEvent('iconChangeClick', {
                    detail: { progress, coordinates: null }
                });
                document.dispatchEvent(iconChangeEvent);
                return;
            }
            
            if (this.mapRenderer.isAnnotationMode) {
                const annotationEvent = new CustomEvent('annotationClick', {
                    detail: { progress, coordinates: null }
                });
                document.dispatchEvent(annotationEvent);
                return;
            }
            
            // Normal seeking
            this.mapRenderer.setAnimationProgress(progress);
            this.updateProgressDisplay();
        };
        
        // Mouse events
        const handleMouseDown = (e) => {
            if (!this.mapRenderer || !this.currentTrackData) return;
            
            isDragging = true;
            wasPlaying = this.isPlaying;
            
            // Pause animation while dragging
            if (this.isPlaying) {
                this.togglePlayback();
            }
            
            // Immediately seek to clicked position
            const progress = getProgressFromEvent(e);
            seekToProgress(progress);
            
            // Prevent text selection while dragging
            e.preventDefault();
        };
        
        const handleMouseMove = (e) => {
            if (!isDragging || !this.mapRenderer || !this.currentTrackData) return;
            
            const progress = getProgressFromEvent(e);
            seekToProgress(progress);
            e.preventDefault();
        };
        
        const handleMouseUp = (e) => {
            if (!isDragging) return;
            
            isDragging = false;
            
            // Resume playback if it was playing before dragging
            if (wasPlaying && !this.isPlaying) {
                this.togglePlayback();
            }
            
            e.preventDefault();
        };
        
        // Touch events for mobile support
        const handleTouchStart = (e) => {
            if (!this.mapRenderer || !this.currentTrackData) return;
            
            isDragging = true;
            wasPlaying = this.isPlaying;
            
            // Pause animation while dragging
            if (this.isPlaying) {
                this.togglePlayback();
            }
            
            // Immediately seek to touched position
            const progress = getProgressFromEvent(e);
            seekToProgress(progress);
            
            e.preventDefault();
        };
        
        const handleTouchMove = (e) => {
            if (!isDragging || !this.mapRenderer || !this.currentTrackData) return;
            
            const progress = getProgressFromEvent(e);
            seekToProgress(progress);
            e.preventDefault();
        };
        
        const handleTouchEnd = (e) => {
            if (!isDragging) return;
            
            isDragging = false;
            
            // Resume playback if it was playing before dragging
            if (wasPlaying && !this.isPlaying) {
                this.togglePlayback();
            }
            
            e.preventDefault();
        };
        
        // Add mouse event listeners
        progressBar.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        
        // Add touch event listeners for mobile
        progressBar.addEventListener('touchstart', handleTouchStart, { passive: false });
        document.addEventListener('touchmove', handleTouchMove, { passive: false });
        document.addEventListener('touchend', handleTouchEnd, { passive: false });
        
        // Handle mouse leave to stop dragging if mouse leaves the window
        document.addEventListener('mouseleave', () => {
            if (isDragging) {
                isDragging = false;
                if (wasPlaying && !this.isPlaying) {
                    this.togglePlayback();
                }
            }
        });
        
        // Add visual feedback for interaction
        progressBar.style.cursor = 'pointer';
        progressBar.addEventListener('mouseenter', () => {
            if (!isDragging) {
                progressBar.style.transform = 'scaleY(1.2)';
                progressBar.style.transition = 'transform 0.2s ease';
            }
        });
        
        progressBar.addEventListener('mouseleave', () => {
            if (!isDragging) {
                progressBar.style.transform = 'scaleY(1)';
            }
        });
    }
}

// Initialize the app when DOM is loaded
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new TrailReplayApp();
    window.app = app; // Make available globally for onclick handlers
}); 