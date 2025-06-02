import { initializeTranslations, t } from './translations.js';
import { GPXParser } from './gpxParser.js';
import { MapRenderer } from './mapRenderer.js';
import { JourneyBuilder } from './journeyBuilder.js';

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
        
        // Initialize Journey Builder
        this.journeyBuilder = new JourneyBuilder();
        
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

        // Setup journey builder integration
        this.setupJourneyIntegration();
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
        document.getElementById('terrainStyle').addEventListener('change', (e) => {
            if (this.mapRenderer) {
                this.mapRenderer.changeMapStyle(e.target.value);
            }
        });

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

        const showLiveStatsToggle = document.getElementById('showLiveStats');
        showLiveStatsToggle.addEventListener('change', (e) => {
            this.toggleLiveStats(e.target.checked);
        });

        const terrain3dToggle = document.getElementById('terrain3d');
        terrain3dToggle.addEventListener('change', (e) => {
            if (this.mapRenderer) {
                const terrainSourceGroup = document.getElementById('terrainSourceGroup');
                
                if (e.target.checked) {
                    // Check if terrain is supported
                    if (this.mapRenderer.isTerrainSupported && this.mapRenderer.isTerrainSupported()) {
                        this.mapRenderer.enable3DTerrain();
                        terrainSourceGroup.style.display = 'block'; // Show terrain source selector
                        this.showMessage('3D terrain enabled! The map now has a slight 3D tilt with elevation data.', 'success');
                    } else {
                        this.showMessage('3D terrain is not supported by your browser/device', 'error');
                        e.target.checked = false;
                    }
                } else {
                    this.mapRenderer.disable3DTerrain();
                    terrainSourceGroup.style.display = 'none'; // Hide terrain source selector
                    this.showMessage('3D terrain disabled', 'info');
                }
            }
        });

        // Terrain source selection
        const terrainSourceSelect = document.getElementById('terrainSource');
        if (terrainSourceSelect) {
            terrainSourceSelect.addEventListener('change', (e) => {
                if (this.mapRenderer && this.mapRenderer.is3DMode) {
                    const sourceType = e.target.value;
                    console.log('Switching terrain source to:', sourceType);
                    
                    // For now, just change the exaggeration instead of switching sources
                    // This is more reliable and less likely to break navigation
                    switch (sourceType) {
                        case 'opentopo':
                            this.mapRenderer.setTerrainExaggeration && this.mapRenderer.setTerrainExaggeration(0.6);
                            this.showMessage('Using OpenTopography elevation data (subtle)', 'info');
                            break;
                        case 'mapzen':
                        default:
                            this.mapRenderer.setTerrainExaggeration && this.mapRenderer.setTerrainExaggeration(0.8);
                            this.showMessage('Using Mapzen elevation data (default)', 'info');
                            break;
                    }
                }
            });
        }

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

        // Listen for terrain errors
        document.addEventListener('terrainError', (e) => {
            this.showMessage(e.detail.message, 'error');
            // Reset the 3D toggle
            const terrain3dToggle = document.getElementById('terrain3d');
            if (terrain3dToggle) {
                terrain3dToggle.checked = false;
            }
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
        const files = event.target.files;
        
        console.log('handleFileSelect called with', files?.length, 'files');
        
        if (!files || files.length === 0) return;
        
        // Check all files are GPX
        for (let file of files) {
            if (!file.name.toLowerCase().endsWith('.gpx')) {
                this.showMessage(`${file.name} is not a GPX file`, 'error');
                return;
            }
        }

        try {
            // Show loading state
            this.showLoading(true);
            this.showUploadProgress(true);
            
            console.log(`Starting to parse ${files.length} GPX file(s)`);
            
            let singleFileTrackData = null;
            
            // Process each file
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const progress = ((i + 1) / files.length) * 100;
                
                this.updateUploadProgress(progress, `Processing ${file.name}...`);
                
                console.log(`Parsing file ${i + 1}/${files.length}: ${file.name}`);
                
                try {
                    // Parse GPX file
                    const trackData = await this.gpxParser.parseFile(file);
                    console.log('Track data parsed:', trackData);
                    
                    // Store first file data for single file backward compatibility
                    if (i === 0) {
                        singleFileTrackData = trackData;
                    }
                    
                    // Add to journey builder
                    console.log('Adding track to journey builder...');
                    this.journeyBuilder.addTrack(trackData, file.name);
                    
                    console.log(`File ${file.name} parsed and added to journey`);
                } catch (fileError) {
                    console.error(`Error processing file ${file.name}:`, fileError);
                    this.showMessage(`Error processing ${file.name}: ${fileError.message}`, 'error');
                    continue; // Continue with other files
                }
            }
            
            this.updateUploadProgress(100, 'All files processed!');
            this.showMessage(`${files.length} GPX file(s) loaded successfully!`, 'success');
            
            // If only one file, load it directly for backward compatibility
            if (files.length === 1 && singleFileTrackData) {
                this.currentTrackData = singleFileTrackData;
                
                // Initialize map renderer if not already done
                if (!this.mapRenderer) {
                    console.log('Initializing map renderer...');
                    this.mapRenderer = new MapRenderer('map');
                    await this.waitForMapLoad();
                    console.log('Map loaded successfully');
                }
                
                // Load track data into map
                console.log('Loading track into map...');
                this.mapRenderer.loadTrack(singleFileTrackData);
                
                // Update UI
                this.showVisualizationSection();
                this.updateStats(singleFileTrackData.stats);
            } else if (files.length > 1) {
                // Multiple files - guide user to journey builder
                this.showMessage(
                    `Multiple tracks loaded! Scroll down to the Journey Builder to arrange them and add transportation between tracks. Click "Preview Journey" when ready.`, 
                    'info'
                );
                
                // Auto-scroll to journey builder
                setTimeout(() => {
                    const journeySection = document.getElementById('journeyPlanningSection');
                    if (journeySection) {
                        journeySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }, 1000);
            }
            
        } catch (error) {
            console.error('Error processing GPX files:', error);
            this.showMessage(`Error processing files: ${error.message}`, 'error');
        } finally {
            this.showLoading(false);
            this.hideUploadProgress();
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
        
        // Initialize live stats
        this.resetLiveStats();
        this.updateLiveStats();
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
            console.log('Playback paused at progress:', this.mapRenderer.getAnimationProgress().toFixed(3));
        } else {
            this.mapRenderer.startAnimation();
            playText.textContent = t('controls.pause');
            this.isPlaying = true;
            this.startProgressUpdate();
            console.log('Playback started from progress:', this.mapRenderer.getAnimationProgress().toFixed(3));
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
        
        // Reset live stats
        this.resetLiveStats();
    }

    resetLiveStats() {
        document.getElementById('liveDistance').textContent = '0.0 km';
        document.getElementById('liveElevation').textContent = '0 m';
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
        
        // For journeys with segment timing, show elapsed time based on actual journey time
        if (this.currentTrackData && this.currentTrackData.isJourney && this.mapRenderer.journeyElapsedTime !== undefined) {
            const currentTimeSeconds = Math.floor(this.mapRenderer.journeyElapsedTime);
            document.getElementById('currentTime').textContent = this.formatTimeInSeconds(currentTimeSeconds);
            
            // Also ensure the total time reflects the current segment timing
            if (this.currentTrackData.segmentTiming && this.currentTrackData.segmentTiming.totalDuration) {
                document.getElementById('totalTime').textContent = this.formatTimeInSeconds(this.currentTrackData.segmentTiming.totalDuration);
            }
        } else {
            // Fallback: show progress through the selected animation duration in seconds
            const currentTimeSeconds = Math.floor(progress * this.totalAnimationTime);
            document.getElementById('currentTime').textContent = this.formatTimeInSeconds(currentTimeSeconds);
            
            // Ensure total time shows the current animation time
            document.getElementById('totalTime').textContent = this.formatTimeInSeconds(this.totalAnimationTime);
        }
        
        // Update live stats if enabled
        this.updateLiveStats();
        
        console.log('Progress display updated:', {
            progress: progress.toFixed(3),
            currentTime: document.getElementById('currentTime').textContent,
            totalTime: document.getElementById('totalTime').textContent,
            journeyElapsedTime: this.mapRenderer.journeyElapsedTime,
            totalAnimationTime: this.totalAnimationTime
        });
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

    showUploadProgress(show) {
        const progressContainer = document.getElementById('uploadProgress');
        if (progressContainer) {
            progressContainer.style.display = show ? 'block' : 'none';
        }
    }

    updateUploadProgress(percent, status) {
        const progressFill = document.getElementById('uploadProgressFill');
        const statusElement = document.getElementById('uploadStatus');
        
        if (progressFill) {
            progressFill.style.width = `${percent}%`;
        }
        
        if (statusElement) {
            statusElement.textContent = status;
        }
    }

    hideUploadProgress() {
        setTimeout(() => {
            this.showUploadProgress(false);
        }, 2000); // Hide after 2 seconds
    }

    // Enhanced Progress bar scrubbing functionality
    setupProgressBarScrubbing() {
        const progressBar = document.getElementById('progressBar');
        let isDragging = false;
        let wasPlaying = false;
        
        // Helper function to calculate progress from mouse/touch position
        const getProgressFromEvent = (e) => {
            const rect = progressBar.getBoundingClientRect();
            const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
            const x = clientX - rect.left;
            const progress = x / rect.width;
            
            // Ensure progress is within bounds
            const boundedProgress = Math.max(0, Math.min(1, progress));
            
            console.log('Progress calculation:', {
                clientX,
                rectLeft: rect.left,
                rectWidth: rect.width,
                x,
                rawProgress: progress,
                boundedProgress: boundedProgress.toFixed(3)
            });
            
            return boundedProgress;
        };
        
        // Helper function to handle seeking to a specific progress
        const seekToProgress = (progress) => {
            if (!this.mapRenderer || !this.currentTrackData) return;
            
            console.log('Seeking to progress:', progress.toFixed(3));
            
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
            
            // Normal seeking - set the animation progress
            this.mapRenderer.setAnimationProgress(progress);
            
            // Update progress display immediately
            this.updateProgressDisplay();
            
            // Update timeline progress indicator if available
            if (this.currentTrackData.isJourney) {
                this.updateTimelineProgressIndicator(progress);
            }
            
            // Force the view to follow the new position (auto-center)
            if (this.currentTrackData && this.currentTrackData.trackPoints) {
                const currentPoint = this.mapRenderer.gpxParser.getInterpolatedPoint(progress);
                if (currentPoint && this.mapRenderer.map) {
                    console.log('Centering view on seeked position:', currentPoint.lat, currentPoint.lon);
                    this.mapRenderer.map.easeTo({
                        center: [currentPoint.lon, currentPoint.lat],
                        duration: 300 // Smooth transition
                    });
                }
            }
            
            console.log('Seek completed to progress:', progress.toFixed(3), 'Animation can now resume from this position');
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
            
            // Get final position after dragging
            const finalProgress = getProgressFromEvent(e);
            seekToProgress(finalProgress);
            
            console.log(`Mouse released at progress: ${finalProgress.toFixed(3)}, wasPlaying: ${wasPlaying}`);
            
            // Resume playback if it was playing before dragging
            if (wasPlaying && !this.isPlaying) {
                console.log('Resuming playback from seeked position');
                setTimeout(() => {
                    this.togglePlayback();
                }, 100); // Small delay to ensure seek is complete
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
            
            // Get final position after dragging
            if (e.changedTouches && e.changedTouches.length > 0) {
                const finalProgress = getProgressFromEvent(e);
                seekToProgress(finalProgress);
                console.log(`Touch ended at progress: ${finalProgress.toFixed(3)}, wasPlaying: ${wasPlaying}`);
            }
            
            // Resume playback if it was playing before dragging
            if (wasPlaying && !this.isPlaying) {
                console.log('Resuming playback from seeked position (touch)');
                setTimeout(() => {
                    this.togglePlayback();
                }, 100); // Small delay to ensure seek is complete
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

    // Setup journey builder integration
    setupJourneyIntegration() {
        // Listen for journey preview events
        document.addEventListener('journeyPreview', (e) => {
            this.loadJourneyData(e.detail.journey);
        });

        // Listen for message events from journey builder
        document.addEventListener('showMessage', (e) => {
            this.showMessage(e.detail.message, e.detail.type);
        });

        // Listen for segment timing updates
        document.addEventListener('segmentTimingUpdate', (e) => {
            console.log('🎯 MAIN APP: Received segmentTimingUpdate event:', e.detail);
            
            // Immediate UI update first
            if (e.detail.totalDuration) {
                console.log('🎯 MAIN APP: Immediately updating UI with total duration:', e.detail.totalDuration);
                this.totalAnimationTime = e.detail.totalDuration;
                
                // Update UI elements
                document.getElementById('totalTime').textContent = this.formatTimeInSeconds(e.detail.totalDuration);
                
                console.log('🎯 MAIN APP: UI updated successfully');
            }
            
            // Then handle the full timing update
            this.handleSegmentTimingUpdate(e.detail);
        });

        // Listen for timeline seeking
        document.addEventListener('timelineSeek', (e) => {
            console.log('🎯 Received timeline seek event:', e.detail.progress);
            if (this.mapRenderer && this.currentTrackData) {
                // Use the same seeking logic as the progress bar
                const progress = e.detail.progress;
                
                // Pause animation if playing during seek
                const wasPlaying = this.isPlaying;
                if (wasPlaying) {
                    this.togglePlayback();
                }
                
                // Seek to the position
                this.mapRenderer.setAnimationProgress(progress);
                this.mapRenderer.updateCurrentPosition();
                this.updateProgressDisplay();
                this.updateTimelineProgressIndicator(progress);
                
                // Center view on new position
                if (this.currentTrackData.trackPoints) {
                    const currentPoint = this.mapRenderer.gpxParser.getInterpolatedPoint(progress);
                    if (currentPoint && this.mapRenderer.map) {
                        this.mapRenderer.map.easeTo({
                            center: [currentPoint.lon, currentPoint.lat],
                            duration: 300
                        });
                    }
                }
                
                console.log('Timeline seek completed to:', progress.toFixed(3));
                
                // Don't automatically resume playback after timeline seek
            }
        });

        // Listen for segment order changes
        document.addEventListener('segmentOrderChanged', (e) => {
            if (this.currentTrackData && this.currentTrackData.isJourney) {
                // Rebuild journey with new segment order
                this.rebuildJourneyFromSegments(e.detail.segments);
            }
        });

        // Listen for map access requests from journey builder for route drawing
        document.addEventListener('requestMapForDrawing', (e) => {
            if (this.mapRenderer && this.mapRenderer.map) {
                // Provide map access to the journey builder
                e.detail.callback(this.mapRenderer.map);
            } else {
                this.showMessage('Map not ready for route drawing', 'error');
            }
        });

        // Make journey builder globally available for onclick handlers
        window.journeyBuilder = this.journeyBuilder;
    }

    // Setup real-time progress updates on timeline
    setupTimelineProgressUpdates() {
        // Update timeline progress indicator during animation
        const updateTimelineProgress = () => {
            if (this.mapRenderer && this.currentTrackData && this.currentTrackData.isJourney) {
                const progress = this.mapRenderer.getAnimationProgress();
                this.updateTimelineProgressIndicator(progress);
            }
            
            if (this.isPlaying) {
                requestAnimationFrame(updateTimelineProgress);
            }
        };
        
        // Start timeline progress updates when animation starts
        document.addEventListener('animationStarted', updateTimelineProgress);
        
        // Override the existing progress update to include timeline
        const originalStartProgressUpdate = this.startProgressUpdate.bind(this);
        this.startProgressUpdate = () => {
            originalStartProgressUpdate();
            updateTimelineProgress();
        };
    }

    // Update the progress indicator on the timeline
    updateTimelineProgressIndicator(progress) {
        const indicator = document.getElementById('timelineProgressIndicator');
        if (!indicator || !this.currentTrackData || !this.currentTrackData.segmentTiming) return;
        
        // Use journeyElapsedTime from the MapRenderer if available
        let currentTime = 0;
        if (this.mapRenderer && this.mapRenderer.journeyElapsedTime !== undefined) {
            currentTime = this.mapRenderer.journeyElapsedTime;
        } else {
            // Fallback to progress-based calculation
            currentTime = progress * this.currentTrackData.segmentTiming.totalDuration;
        }
        
        const pixelsPerSecond = 3 * (this.journeyBuilder.timelineScale || 1);
        const position = currentTime * pixelsPerSecond;
        
        indicator.style.left = `${position}px`;
        indicator.style.display = 'block';
        
        // Also update the current time display to match the timeline
        const currentTimeElement = document.getElementById('currentTime');
        if (currentTimeElement) {
            currentTimeElement.textContent = this.formatTimeInSeconds(Math.floor(currentTime));
        }
    }

    // Rebuild journey when segments are reordered
    rebuildJourneyFromSegments(segments) {
        try {
            // Update the journey builder segments
            this.journeyBuilder.segments = segments;
            
            // Rebuild the complete journey
            const completeJourney = this.journeyBuilder.buildCompleteJourney();
            
            if (completeJourney.coordinates.length > 0) {
                // Reload the journey data
                this.loadJourneyData(completeJourney);
                this.showMessage('Journey updated with new segment order', 'success');
            }
        } catch (error) {
            console.error('Error rebuilding journey:', error);
            this.showMessage('Error updating journey', 'error');
        }
    }

    // Handle segment timing updates
    handleSegmentTimingUpdate(updateData) {
        if (!this.currentTrackData || !this.currentTrackData.isJourney) {
            console.log('🎯 MAIN APP: No journey data available for timing update');
            return;
        }
        
        console.log('🎯 MAIN APP: Processing full timing update:', updateData);
        
        // Use the provided segment timing if available, otherwise recalculate
        let newSegmentTiming;
        if (updateData.newSegmentTiming) {
            newSegmentTiming = updateData.newSegmentTiming;
            console.log('🎯 MAIN APP: Using provided segment timing');
        } else {
            newSegmentTiming = this.calculateSegmentTiming(updateData.segments);
            console.log('🎯 MAIN APP: Recalculated segment timing');
        }
        
        // Update the current track data
        this.currentTrackData.segmentTiming = newSegmentTiming;
        this.currentTrackData.segments = updateData.segments;
        
        // CRITICAL: Update total animation time
        this.totalAnimationTime = newSegmentTiming.totalDuration;
        console.log('🎯 MAIN APP: Updated totalAnimationTime to:', this.totalAnimationTime);
        
        // Update MapRenderer if available
        if (this.mapRenderer) {
            console.log('🎯 MAIN APP: Updating MapRenderer with new timing...');
            
            const wasPlaying = this.isPlaying;
            const currentProgress = this.mapRenderer.getAnimationProgress();
            
            if (wasPlaying) {
                this.togglePlayback(); // Pause
            }
            
            // Update MapRenderer timing
            this.mapRenderer.setupSegmentAnimation(updateData.segments, newSegmentTiming);
            
            // Restore position
            setTimeout(() => {
                this.mapRenderer.setAnimationProgress(currentProgress);
                this.updateProgressDisplay();
                
                if (wasPlaying) {
                    setTimeout(() => this.togglePlayback(), 100); // Resume
                }
            }, 50);
        }
        
        console.log('🎯 MAIN APP: Timing update completed successfully');
    }

    // Load combined journey data
    async loadJourneyData(journeyData) {
        try {
            // Calculate segment timing first
            const segmentTiming = this.calculateSegmentTiming(journeyData.segments);
            
            // Convert journey data format to track data format that MapRenderer expects
            // but preserve segment information for icon changes and visual transitions
            const trackData = {
                trackPoints: journeyData.coordinates.map((coord, index) => ({
                    lat: coord[1],
                    lon: coord[0],
                    elevation: coord[2] || 0,
                    index: index,
                    distance: 0, // Will be calculated if needed
                    speed: 0,
                    time: null
                })),
                stats: journeyData.stats,
                bounds: this.calculateBounds(journeyData.coordinates),
                // Preserve journey segment information
                segments: journeyData.segments,
                isJourney: true,
                // Add segment timing information
                segmentTiming: segmentTiming
            };
            
            this.currentTrackData = trackData;
            
            // Initialize map renderer if not already done
            if (!this.mapRenderer) {
                this.mapRenderer = new MapRenderer('map');
                await this.waitForMapLoad();
            }
            
            // Load journey data into map
            this.mapRenderer.loadTrack(trackData);
            
            // Set up segment-aware animation in MapRenderer
            this.mapRenderer.setupSegmentAnimation(journeyData.segments, segmentTiming);
            
            // Add automatic icon changes based on segments
            this.addSegmentIconChanges(trackData);
            
            // Set the total animation time based on segment timings
            this.totalAnimationTime = segmentTiming.totalDuration;
            // Don't call updateAnimationSpeed here as MapRenderer now handles segment timing
            
            // Update UI
            this.showVisualizationSection();
            this.updateStats(trackData.stats);
            this.updateTimingControls(segmentTiming);
            
            // Render timeline under the map (visual feedback)
            this.renderJourneyTimeline();
            
            // Keep journey builder section visible for configuration
            this.showJourneyPlanningSection();
            
            this.showMessage('Journey preview loaded!', 'success');
            
        } catch (error) {
            console.error('Error loading journey data:', error);
            this.showMessage('Error loading journey data', 'error');
        }
    }

    // Render the journey timeline under the map
    renderJourneyTimeline() {
        // Find or create timeline container
        let timelineContainer = document.getElementById('journeyTimelineContainer');
        if (!timelineContainer) {
            timelineContainer = document.createElement('div');
            timelineContainer.id = 'journeyTimelineContainer';
            timelineContainer.className = 'journey-timeline-container';
            
            // Insert after the map container
            const mapContainer = document.querySelector('.map-container');
            mapContainer.parentNode.insertBefore(timelineContainer, mapContainer.nextSibling);
        }
        
        // Render the timeline using journey builder
        this.journeyBuilder.renderTimelineEditor(timelineContainer);
        
        // Start progress indicator updates
        this.setupTimelineProgressUpdates();
    }

    // Show journey planning section
    showJourneyPlanningSection() {
        const section = document.getElementById('journeyPlanningSection');
        if (section) {
            section.style.display = 'block';
        }
    }

    // Calculate segment timing for the journey
    calculateSegmentTiming(segments) {
        let totalDuration = 0;
        let trackDuration = 0;
        let transportDuration = 0;
        const segmentTimings = [];
        
        console.log('MAIN APP: Calculating segment timing from EXACT user inputs only...');
        
        // First pass: calculate total coordinates to determine progress ratios
        let totalCoordinates = 0;
        segments.forEach(segment => {
            const segmentLength = segment.endIndex - segment.startIndex + 1;
            totalCoordinates += segmentLength;
        });
        
        let currentCoordIndex = 0;
        
        // Calculate timing for each segment using ONLY exact user input values
        segments.forEach((segment, index) => {
            let segmentTime = 0;
            
            if (segment.type === 'track') {
                // Use ONLY exact user-defined time
                if (segment.userTime !== undefined && segment.userTime !== null) {
                    segmentTime = segment.userTime; // EXACT user input
                } else {
                    // If no user time, use calculated default
                    segmentTime = this.calculateDefaultTrackTime(segment.data);
                }
                trackDuration += segmentTime;
                
            } else if (segment.type === 'transportation') {
                // Use ONLY exact user-defined time  
                if (segment.route && segment.route.userTime !== undefined && segment.route.userTime !== null) {
                    segmentTime = segment.route.userTime; // EXACT user input
                } else if (segment.userTime !== undefined && segment.userTime !== null) {
                    segmentTime = segment.userTime; // EXACT user input
                } else {
                    // If no user time, use simple default
                    segmentTime = 30; // Fixed 30 seconds default
                }
                transportDuration += segmentTime;
            }
            
            // Calculate progress ratios based on coordinate positions in the combined journey
            const segmentLength = segment.endIndex - segment.startIndex + 1;
            const progressStartRatio = currentCoordIndex / (totalCoordinates - 1);
            const progressEndRatio = (currentCoordIndex + segmentLength - 1) / (totalCoordinates - 1);
            
            // Create segment timing with exact user input
            segmentTimings.push({
                ...segment,
                duration: segmentTime, // EXACT user input or simple default
                startTime: totalDuration,
                endTime: totalDuration + segmentTime,
                coordinateLength: segmentLength,
                progressStartRatio: Math.max(0, Math.min(1, progressStartRatio)),
                progressEndRatio: Math.max(0, Math.min(1, progressEndRatio)),
                startCoordIndex: currentCoordIndex,
                endCoordIndex: currentCoordIndex + segmentLength - 1
            });
            
            totalDuration += segmentTime; // Simple addition of exact values
            currentCoordIndex += segmentLength;
        });
        
        console.log('MAIN APP: Segment timing - EXACT SUM:', {
            totalDuration: `${totalDuration}s`,
            trackDuration: `${trackDuration}s`, 
            transportDuration: `${transportDuration}s`,
            segmentCount: segmentTimings.length
        });
        
        return { 
            totalDuration, // Exact sum of user inputs
            trackDuration, 
            transportDuration,
            segments: segmentTimings
        };
    }

    // Helper method to calculate distance between two points
    calculateDistanceFromPoints(point1, point2) {
        const R = 6371; // Earth's radius in km
        const dLat = (point2[1] - point1[1]) * Math.PI / 180;
        const dLon = (point2[0] - point1[0]) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(point1[1] * Math.PI / 180) * Math.cos(point2[1] * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    // Calculate default track time
    calculateDefaultTrackTime(trackData) {
        const distance = trackData.stats.totalDistance;
        const activityType = trackData.data.activityType || 'running';
        
        const speeds = { running: 10, walking: 5, cycling: 20, hiking: 4, swimming: 2 };
        const speed = speeds[activityType] || speeds.running;
        const timeHours = distance / speed;
        const timeMinutes = timeHours * 60;
        
        return Math.max(10, Math.min(180, Math.round(timeMinutes / 2)));
    }

    // Calculate default transport time
    calculateDefaultTransportTime(mode, distanceKm) {
        const baseTimes = { car: 30, walk: 20, cycling: 25, boat: 40, plane: 20, train: 35 };
        const baseTime = baseTimes[mode] || 30;
        return Math.max(10, Math.min(120, Math.round(baseTime + (distanceKm * 2))));
    }

    // Update timing controls in the UI
    updateTimingControls(segmentTiming) {
        // Update the total time display
        document.getElementById('totalTime').textContent = this.formatTimeInSeconds(segmentTiming.totalDuration);
        
        // Show segment breakdown in a new timing panel
        this.showTimingBreakdown(segmentTiming);
    }

    // Show timing breakdown panel
    showTimingBreakdown(segmentTiming) {
        // Find or create timing breakdown panel
        let timingPanel = document.getElementById('journeyTimingPanel');
        if (!timingPanel) {
            timingPanel = document.createElement('div');
            timingPanel.id = 'journeyTimingPanel';
            timingPanel.className = 'journey-timing-panel';
            
            // Insert after the controls panel
            const controlsPanel = document.querySelector('.controls-panel');
            controlsPanel.parentNode.insertBefore(timingPanel, controlsPanel.nextSibling);
        }
        
        timingPanel.innerHTML = `
            <div class="timing-panel-header">
                <h4>🎬 Journey Animation Timing</h4>
                <span class="total-duration">${this.formatTimeInSeconds(segmentTiming.totalDuration)}</span>
            </div>
            <div class="timing-breakdown">
                <div class="timing-item">
                    <span class="timing-label">📍 Tracks:</span>
                    <span class="timing-value">${this.formatTimeInSeconds(segmentTiming.trackDuration)}</span>
                </div>
                <div class="timing-item">
                    <span class="timing-label">🚗 Transportation:</span>
                    <span class="timing-value">${this.formatTimeInSeconds(segmentTiming.transportDuration)}</span>
                </div>
            </div>
            <div class="timing-note">
                <small>💡 Adjust individual segment times in the Journey Builder above</small>
            </div>
        `;
        
        timingPanel.style.display = 'block';
    }

    // Add automatic icon changes based on journey segments
    addSegmentIconChanges(trackData) {
        if (!trackData.segments || !this.mapRenderer) return;

        // Clear existing icon changes
        this.mapRenderer.iconChanges = [];

        const totalCoordinates = trackData.trackPoints.length;
        let currentIndex = 0;

        trackData.segments.forEach((segment, segmentIndex) => {
            const segmentLength = segment.endIndex - segment.startIndex + 1;
            const progress = currentIndex / (totalCoordinates - 1);

            let icon;
            if (segment.type === 'track') {
                // Use activity-based icon for GPX tracks
                const activityType = segment.data?.data?.activityType || 'running';
                icon = this.getActivityIcon(activityType);
            } else if (segment.type === 'transportation') {
                // Use transportation mode icon
                icon = this.getTransportationIcon(segment.mode);
            }

            if (icon && segmentIndex > 0) { // Don't add for first segment (it starts with default)
                const iconChange = this.mapRenderer.addIconChange(progress, icon);
                console.log(`Added automatic icon change at progress ${progress}: ${icon} for ${segment.type} (${segment.mode || segment.data?.data?.activityType})`);
            }

            currentIndex = segment.endIndex + 1;
        });

        // Update progress bar markers
        this.updateProgressBarMarkers();
    }

    // Get icon for activity type
    getActivityIcon(activityType) {
        const icons = {
            'running': '🏃‍♂️',
            'cycling': '🚴‍♂️', 
            'swimming': '🏊‍♂️',
            'hiking': '🥾',
            'walking': '🚶‍♂️',
            'triathlon': '🏆'
        };
        return icons[activityType] || '🏃‍♂️';
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

    // Helper method to calculate bounds from coordinates
    calculateBounds(coordinates) {
        if (!coordinates || coordinates.length === 0) return null;

        const lats = coordinates.map(coord => coord[1]);
        const lons = coordinates.map(coord => coord[0]);

        return {
            north: Math.max(...lats),
            south: Math.min(...lats),
            east: Math.max(...lons),
            west: Math.min(...lons),
            center: [
                (Math.max(...lons) + Math.min(...lons)) / 2,
                (Math.max(...lats) + Math.min(...lats)) / 2
            ]
        };
    }

    // Force refresh all timing-related UI elements
    refreshTimingDisplay() {
        if (!this.currentTrackData) return;
        
        console.log('Force refreshing timing display');
        
        // Update progress display
        this.updateProgressDisplay();
        
        // Update timeline progress indicator
        if (this.currentTrackData.isJourney && this.mapRenderer) {
            const currentProgress = this.mapRenderer.getAnimationProgress();
            this.updateTimelineProgressIndicator(currentProgress);
        }
        
        console.log('Timing display refreshed - total time:', this.totalAnimationTime);
    }

    // Validate timing update
    validateTimingUpdate(newSegmentTiming) {
        console.log('🔍 Validating timing update...');
        
        const issues = [];
        
        // Check if totalAnimationTime was updated
        if (this.totalAnimationTime !== newSegmentTiming.totalDuration) {
            issues.push(`totalAnimationTime mismatch: ${this.totalAnimationTime} vs ${newSegmentTiming.totalDuration}`);
        }
        
        // Check if MapRenderer has the correct segment timing
        if (this.mapRenderer && this.mapRenderer.segmentTimings) {
            if (this.mapRenderer.segmentTimings.totalDuration !== newSegmentTiming.totalDuration) {
                issues.push(`MapRenderer timing mismatch: ${this.mapRenderer.segmentTimings.totalDuration} vs ${newSegmentTiming.totalDuration}`);
            }
        } else {
            issues.push('MapRenderer segment timing is null or undefined');
        }
        
        // Check if current track data has updated segment timing
        if (this.currentTrackData && this.currentTrackData.segmentTiming) {
            if (this.currentTrackData.segmentTiming.totalDuration !== newSegmentTiming.totalDuration) {
                issues.push(`TrackData timing mismatch: ${this.currentTrackData.segmentTiming.totalDuration} vs ${newSegmentTiming.totalDuration}`);
            }
        } else {
            issues.push('CurrentTrackData segment timing is null or undefined');
        }
        
        // Check UI elements
        const totalTimeElement = document.getElementById('totalTime');
        if (totalTimeElement) {
            const displayedTime = totalTimeElement.textContent;
            const expectedTime = this.formatTimeInSeconds(newSegmentTiming.totalDuration);
            if (displayedTime !== expectedTime) {
                issues.push(`UI total time mismatch: "${displayedTime}" vs "${expectedTime}"`);
            }
        }
        
        const timeSlider = document.getElementById('animationSpeed');
        if (timeSlider && parseInt(timeSlider.value) !== newSegmentTiming.totalDuration) {
            issues.push(`Time slider mismatch: ${timeSlider.value} vs ${newSegmentTiming.totalDuration}`);
        }
        
        if (issues.length === 0) {
            console.log('✅ Timing update validation PASSED - all systems synchronized');
        } else {
            console.error('❌ Timing update validation FAILED:', issues);
            // Try to fix the issues
            this.forceTimingSync(newSegmentTiming);
        }
    }
    
    // Force synchronization of all timing systems
    forceTimingSync(newSegmentTiming) {
        console.log('🔧 Force synchronizing timing systems...');
        
        // Update totalAnimationTime
        this.totalAnimationTime = newSegmentTiming.totalDuration;
        
        // Update current track data
        if (this.currentTrackData) {
            this.currentTrackData.segmentTiming = newSegmentTiming;
        }
        
        // Force update MapRenderer if needed
        if (this.mapRenderer && (!this.mapRenderer.segmentTimings || 
            this.mapRenderer.segmentTimings.totalDuration !== newSegmentTiming.totalDuration)) {
            console.log('Force updating MapRenderer segment timing');
            this.mapRenderer.segmentTimings = newSegmentTiming;
        }
        
        // Force update UI elements
        document.getElementById('totalTime').textContent = this.formatTimeInSeconds(newSegmentTiming.totalDuration);
        
        // Force update progress display
        this.updateProgressDisplay();
        
        console.log('✅ Force timing synchronization completed');
    }

    toggleLiveStats(show) {
        const overlay = document.getElementById('liveStatsOverlay');
        if (overlay) {
            if (show) {
                overlay.classList.remove('hidden');
                this.updateLiveStats(); // Update immediately when shown
            } else {
                overlay.classList.add('hidden');
            }
        }
    }

    updateLiveStats() {
        if (!this.mapRenderer || !this.currentTrackData) return;
        
        const overlay = document.getElementById('liveStatsOverlay');
        if (!overlay || overlay.classList.contains('hidden')) return;
        
        try {
            // Ensure GPX parser is ready
            if (!this.mapRenderer.ensureGPXParserReady()) {
                return;
            }
            
            const progress = this.mapRenderer.getAnimationProgress();
            const currentPoint = this.mapRenderer.gpxParser.getInterpolatedPoint(progress);
            
            if (!currentPoint) return;
            
            // Calculate current distance (distance traveled so far)
            const totalDistance = this.currentTrackData.stats.totalDistance;
            const currentDistance = progress * totalDistance;
            
            // Calculate current elevation gain (accumulated elevation gain so far)
            const totalElevationGain = this.currentTrackData.stats.elevationGain || 0;
            const currentElevationGain = progress * totalElevationGain;
            
            // Format and update the display values
            const distanceElement = document.getElementById('liveDistance');
            const elevationElement = document.getElementById('liveElevation');
            
            if (distanceElement) {
                const formattedDistance = this.gpxParser.formatDistance(currentDistance);
                if (distanceElement.textContent !== formattedDistance) {
                    this.animateValueChange(distanceElement, formattedDistance);
                }
            }
            
            if (elevationElement) {
                const formattedElevation = this.gpxParser.formatElevation(currentElevationGain);
                if (elevationElement.textContent !== formattedElevation) {
                    this.animateValueChange(elevationElement, formattedElevation);
                }
            }
            
        } catch (error) {
            console.warn('Error updating live stats:', error);
        }
    }

    animateValueChange(element, newValue) {
        // Add updating class for animation
        element.classList.add('updating');
        
        // Update the value
        element.textContent = newValue;
        
        // Remove the animation class after animation
        setTimeout(() => {
            element.classList.remove('updating');
        }, 200);
    }
}

// Initialize the app when DOM is loaded
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new TrailReplayApp();
    window.app = app; // Make available globally for onclick handlers
}); 