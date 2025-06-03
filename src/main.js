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
        
        // Settings
        this.gpxOnlyStats = true; // Default to exclude transfer distances
        
        this.initializeApp();

        this.currentIcon = '🏃‍♂️';
        this.isDrawingMode = false;
        this.isAnnotationMode = false;
        this.totalAnimationTime = 30; // Default 30 seconds for simple tracks
        this.gpxOnlyStats = false; // New setting for GPX only statistics
    }

    async initializeApp() {
        // Initialize translations
        initializeTranslations();
        
        // Update placeholders with translations
        setTimeout(() => this.updatePlaceholders(), 100);
        
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

        // Initialize map renderer
        await this.initializeMapRenderer();

        // After all UI is set up, ensure live stats overlay is shown if toggle is on
        setTimeout(() => {
            const showLiveStatsToggle = document.getElementById('showLiveStats');
            if (showLiveStatsToggle && showLiveStatsToggle.checked) {
                this.toggleLiveStats(true);
                this.updateLiveStats();
            }
        }, 200);
    }

    async initializeMapRenderer() {
        if (!this.mapRenderer) {
            this.mapRenderer = new MapRenderer('map');
            await this.waitForMapLoad();
            
            // Enable 3D terrain by default
            setTimeout(() => {
                if (this.mapRenderer && this.mapRenderer.isTerrainSupported && this.mapRenderer.isTerrainSupported()) {
                    console.log('Auto-enabling 3D terrain on startup');
                    this.mapRenderer.enable3DTerrain();
                } else {
                    console.warn('3D terrain not supported, falling back to 2D');
                    // Uncheck the checkbox if terrain is not supported
                    const terrain3dToggle = document.getElementById('terrain3d');
                    if (terrain3dToggle) {
                        terrain3dToggle.checked = false;
                    }
                    // Hide terrain source group
                    const terrainSourceGroup = document.getElementById('terrainSourceGroup');
                    if (terrainSourceGroup) {
                        terrainSourceGroup.style.display = 'none';
                    }
                }
            }, 1000); // Small delay to ensure map is fully loaded
        }
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

        // GPX only stats toggle
        const gpxOnlyStatsToggle = document.getElementById('gpxOnlyStats');
        gpxOnlyStatsToggle.addEventListener('change', (e) => {
            this.gpxOnlyStats = e.target.checked;
            this.updateStatsDisplay();
            
            // Show feedback message
            if (e.target.checked) {
                this.showMessage(t('messages.gpxOnlyStatsEnabled'), 'info');
            } else {
                this.showMessage(t('messages.gpxOnlyStatsDisabled'), 'info');
            }
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
                        this.showMessage(t('messages.terrain3dEnabled'), 'success');
                    } else {
                        this.showMessage(t('messages.terrain3dNotSupported'), 'error');
                        e.target.checked = false;
                    }
                } else {
                    this.mapRenderer.disable3DTerrain();
                    terrainSourceGroup.style.display = 'none'; // Hide terrain source selector
                    this.showMessage(t('messages.terrain3dDisabled'), 'info');
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
                            this.showMessage(t('messages.elevationDataOpenTopo'), 'info');
                            break;
                        case 'mapzen':
                        default:
                            this.mapRenderer.setTerrainExaggeration && this.mapRenderer.setTerrainExaggeration(0.8);
                            this.showMessage(t('messages.elevationDataMapzen'), 'info');
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

        // Live stats toggle
        document.getElementById('showLiveStats').addEventListener('change', (e) => {
            this.toggleLiveStats(e.target.checked);
        });

        // GPX only stats toggle
        document.getElementById('gpxOnlyStats').addEventListener('change', (e) => {
            this.gpxOnlyStats = e.target.checked;
            this.updateStatsDisplay();
        });
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
            span.textContent = t('status.cancel');
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
                
                // Enable 3D terrain if checkbox is checked (should be by default)
                setTimeout(() => {
                    const terrain3dToggle = document.getElementById('terrain3d');
                    if (terrain3dToggle && terrain3dToggle.checked && !this.mapRenderer.is3DMode) {
                        if (this.mapRenderer.isTerrainSupported && this.mapRenderer.isTerrainSupported()) {
                            console.log('Auto-enabling 3D terrain after track load');
                            this.mapRenderer.enable3DTerrain();
                        }
                    }
                }, 500);
                
                // Update UI
                this.showVisualizationSection();
                this.updateStats(singleFileTrackData.stats);
            } else if (files.length > 1) {
                // Multiple files - guide user to journey builder
                this.showMessage(
                    t('messages.multipleTracksLoaded'), 
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
            this.showMessage(`${t('messages.errorProcessingFiles')} ${error.message}`, 'error');
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
        // Generate elevation profile
        this.generateElevationProfile();
        // If live stats toggle is on, show overlay and update
        const showLiveStatsToggle = document.getElementById('showLiveStats');
        if (showLiveStatsToggle && showLiveStatsToggle.checked) {
            this.toggleLiveStats(true);
            this.updateLiveStats();
        }
    }

    updateStats(stats) {
        document.getElementById('totalDistance').textContent = this.gpxParser.formatDistance(stats.totalDistance);
        document.getElementById('elevationGain').textContent = this.gpxParser.formatElevation(stats.elevationGain);
        
        // Update total time to show the selected animation duration in MM:SS format
        document.getElementById('totalTime').textContent = this.formatTimeInSeconds(this.totalAnimationTime);
    }

    // Method to update stats display based on GPX only setting
    updateStatsDisplay() {
        if (!this.currentTrackData || !this.currentTrackData.stats) {
            return;
        }

        let stats = { ...this.currentTrackData.stats };

        // If GPX only stats is enabled and this is a journey, recalculate stats
        if (this.gpxOnlyStats && this.currentTrackData.isJourney && this.currentTrackData.segments) {
            stats = this.calculateGpxOnlyStats(this.currentTrackData);
        }

        this.updateStats(stats);
        
        // Also trigger live stats update if they're visible
        if (!document.getElementById('liveStatsOverlay').classList.contains('hidden')) {
            this.updateLiveStats();
        }
    }

    // Calculate stats including only GPX track segments (excluding transportation)
    calculateGpxOnlyStats(journeyData) {
        let totalDistance = 0;
        let totalElevationGain = 0;

        if (journeyData.segments) {
            journeyData.segments.forEach(segment => {
                // Only include track segments, skip transportation segments
                if (segment.type === 'track' && segment.data && segment.data.stats) {
                    totalDistance += segment.data.stats.totalDistance || 0;
                    totalElevationGain += segment.data.stats.elevationGain || 0;
                }
            });
        }

        return {
            totalDistance: totalDistance,
            elevationGain: totalElevationGain
        };
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
        
        // Reset elevation profile progress
        this.updateElevationProgress(0);
        
        // Reset current time display
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
        // Skip expensive operations during recording
        if (this.recordingMode) {
            return;
        }
        
        const progress = this.mapRenderer.getAnimationProgress();
        const progressPercent = progress * 100;
        
        // Update the elevation profile progress (throttled)
        this.updateElevationProgress(progress);
        
        // Batch time updates for better performance
        const updateTimeDisplay = () => {
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
        };
        
        // Throttle time updates during animation
        if (!this.isPlaying || (this.frameCount % 5 === 0)) {
            updateTimeDisplay();
        }
        
        // Update live stats with throttling
        this.updateLiveStats();
    }

    // Generate elevation profile SVG path
    generateElevationProfile() {
        if (!this.currentTrackData || !this.currentTrackData.trackPoints) {
            console.log('No track data available for elevation profile');
            return;
        }

        // Create a unique cache key - for journeys, include segment composition
        let trackId;
        if (this.currentTrackData.isJourney && this.currentTrackData.segments) {
            // For journeys, create a cache key based on segment composition and order
            const segmentIds = this.currentTrackData.segments.map(segment => {
                if (segment.type === 'track') {
                    return `track_${segment.data.filename || segment.data.name}`;
                } else {
                    return `${segment.type}_${segment.mode || 'unknown'}`;
                }
            }).join('|');
            const trackPointsCount = this.currentTrackData.trackPoints.length;
            trackId = `journey_${segmentIds}_${trackPointsCount}pts`;
        } else {
            trackId = this.currentTrackData.filename || 'unknown';
        }

        // Check if we already have a cached profile for this exact journey composition
        if (this.cachedElevationProfiles && this.cachedElevationProfiles[trackId]) {
            this.elevationProfile = this.cachedElevationProfiles[trackId];
            document.getElementById('elevationPath').setAttribute('d', this.elevationProfile.pathData);
            console.log('Using cached elevation profile for:', trackId);
            return;
        }

        const trackPoints = this.currentTrackData.trackPoints;
        const svgWidth = 800; // SVG viewBox width
        const svgHeight = 60; // SVG viewBox height
        const padding = 5; // Padding from edges

        // Extract elevation data
        const elevations = trackPoints.map(point => point.elevation || 0);
        const minElevation = Math.min(...elevations);
        const maxElevation = Math.max(...elevations);
        const elevationRange = maxElevation - minElevation;

        // If no elevation variation, create a flat line
        if (elevationRange === 0) {
            const flatY = svgHeight / 2;
            const pathData = `M0,${flatY} L${svgWidth},${flatY} L${svgWidth},${svgHeight} L0,${svgHeight} Z`;
            
            document.getElementById('elevationPath').setAttribute('d', pathData);
            
            // Cache the flat profile
            this.elevationProfile = {
                points: [`0,${flatY}`, `${svgWidth},${flatY}`],
                minElevation,
                maxElevation,
                elevationRange,
                svgWidth,
                svgHeight,
                padding,
                pathData
            };
            
            console.log('Generated flat elevation profile (no elevation variation)');
            return;
        }

        // Generate path points with optimization for large datasets
        const pathPoints = [];
        const pointCount = trackPoints.length;
        
        // Optimize point generation for large tracks
        const step = pointCount > 1000 ? Math.ceil(pointCount / 800) : 1;
        
        for (let i = 0; i < pointCount; i += step) {
            const actualIndex = Math.min(i, pointCount - 1);
            const x = (actualIndex / (pointCount - 1)) * svgWidth;
            const normalizedElevation = (elevations[actualIndex] - minElevation) / elevationRange;
            const y = svgHeight - (normalizedElevation * (svgHeight - padding * 2)) - padding;
            pathPoints.push(`${x.toFixed(2)},${y.toFixed(2)}`);
        }

        // Create SVG path - filled area under the curve
        const pathData = `M0,${svgHeight} L${pathPoints.join(' L')} L${svgWidth},${svgHeight} Z`;
        
        // Update the elevation path
        document.getElementById('elevationPath').setAttribute('d', pathData);
        
        // Store elevation data for progress updates with caching
        this.elevationProfile = {
            points: pathPoints,
            minElevation,
            maxElevation,
            elevationRange,
            svgWidth,
            svgHeight,
            padding,
            pathData
        };

        // Cache the profile for future use
        if (!this.cachedElevationProfiles) {
            this.cachedElevationProfiles = {};
        }
        this.cachedElevationProfiles[trackId] = this.elevationProfile;

        console.log(`Generated elevation profile: ${elevations.length} points (optimized to ${pathPoints.length}), range: ${elevationRange.toFixed(1)}m`);
    }

    // Clear elevation profile cache (useful for journey updates)
    clearElevationProfileCache(trackId = null) {
        if (!this.cachedElevationProfiles) return;
        
        if (trackId) {
            // Clear specific cache entry
            delete this.cachedElevationProfiles[trackId];
            console.log('Cleared elevation profile cache for:', trackId);
        } else {
            // Clear all journey-related cache entries
            Object.keys(this.cachedElevationProfiles).forEach(key => {
                if (key.startsWith('journey_')) {
                    delete this.cachedElevationProfiles[key];
                }
            });
            console.log('Cleared all journey elevation profile caches');
        }
    }

    // Update elevation progress indicator
    updateElevationProgress(progress) {
        // Skip expensive operations during recording
        if (this.recordingMode) {
            return;
        }
        
        if (!this.elevationProfile) {
            // Fallback to flat progress bar behavior
            const progressFill = document.getElementById('progressFill');
            if (progressFill) {
                progressFill.style.width = `${progress * 100}%`;
            }
            return;
        }

        const { points, svgWidth, svgHeight } = this.elevationProfile;
        const progressIndex = Math.floor(progress * (points.length - 1));
        const currentPointIndex = Math.min(progressIndex, points.length - 1);

        // Get current position along the elevation profile
        let currentX = 0;
        let currentY = svgHeight / 2; // Default middle

        if (points.length > 0) {
            if (currentPointIndex < points.length) {
                const [x, y] = points[currentPointIndex].split(',').map(Number);
                currentX = x;
                currentY = y;

                // Interpolate between points if we're between indices
                const fraction = (progress * (points.length - 1)) - currentPointIndex;
                if (fraction > 0 && currentPointIndex < points.length - 1) {
                    const [nextX, nextY] = points[currentPointIndex + 1].split(',').map(Number);
                    currentX = x + (nextX - x) * fraction;
                    currentY = y + (nextY - y) * fraction;
                }
            }
        }

        // Batch DOM updates for better performance
        const progressIndicator = document.getElementById('progressIndicator');
        const progressPath = document.getElementById('progressPath');
        
        if (progressIndicator) {
            // Use transform instead of attribute change for better performance
            progressIndicator.style.transform = `translate(${currentX}px, ${currentY}px)`;
        }

        // Update progress path less frequently during animation for performance
        if (progressPath && points.length > 0) {
            // Only update every few frames during animation to reduce overhead
            const shouldUpdatePath = !this.isPlaying || (this.frameCount % 3 === 0);
            if (shouldUpdatePath) {
                const progressPoints = points.slice(0, currentPointIndex + 1);
                if (progressPoints.length > 0) {
                    // Add the current interpolated point
                    progressPoints.push(`${currentX.toFixed(2)},${currentY.toFixed(2)}`);
                    
                    // Create filled area from bottom to elevation profile
                    const progressPathData = `M0,${svgHeight} L${progressPoints.join(' L')} L${currentX},${svgHeight} Z`;
                    progressPath.setAttribute('d', progressPathData);
                }
            }
        }
        
        // Track frame count for throttling
        this.frameCount = (this.frameCount || 0) + 1;
    }

    // Update progress bar markers for elevation profile
    updateProgressBarMarkers() {
        // Skip during recording for performance
        if (this.recordingMode || !this.mapRenderer) {
            return;
        }

        // Throttle marker updates
        const now = performance.now();
        if (this.lastMarkerUpdate && (now - this.lastMarkerUpdate) < 200) {
            return; // Update markers max every 200ms
        }
        this.lastMarkerUpdate = now;

        // Update icon change markers
        const iconChangeMarkers = document.getElementById('iconChangeMarkers');
        if (iconChangeMarkers) {
            iconChangeMarkers.innerHTML = '';

            this.mapRenderer.getIconChanges().forEach(change => {
                const marker = document.createElement('div');
                marker.className = 'icon-change-marker';
                
                // Position marker based on elevation profile if available
                const markerPosition = this.getElevationMarkerPosition(change.progress);
                marker.style.left = `${markerPosition.x}%`;
                marker.style.top = `${markerPosition.y}px`;
                marker.title = `Icon change to ${change.icon}`;
                
                iconChangeMarkers.appendChild(marker);
            });
        }

        // Update annotation markers
        const annotationMarkers = document.getElementById('annotationMarkers');
        if (annotationMarkers) {
            annotationMarkers.innerHTML = '';

            this.mapRenderer.getAnnotations().forEach(annotation => {
                const marker = document.createElement('div');
                marker.className = 'annotation-marker';
                
                // Position marker based on elevation profile if available
                const markerPosition = this.getElevationMarkerPosition(annotation.progress);
                marker.style.left = `${markerPosition.x}%`;
                marker.style.top = `${markerPosition.y}px`;
                marker.title = annotation.title;
                
                annotationMarkers.appendChild(marker);
            });
        }
    }

    // Get marker position on elevation profile
    getElevationMarkerPosition(progress) {
        if (!this.elevationProfile) {
            // Fallback for flat progress bar
            return { x: progress * 100, y: -8 };
        }

        const { points } = this.elevationProfile;
        const progressIndex = Math.floor(progress * (points.length - 1));
        const currentPointIndex = Math.min(progressIndex, points.length - 1);

        let markerX = progress * 100; // Default to linear progress
        let markerY = -8; // Default top position

        if (points.length > 0 && currentPointIndex < points.length) {
            const [x, y] = points[currentPointIndex].split(',').map(Number);
            markerX = (x / this.elevationProfile.svgWidth) * 100;
            markerY = y - 8; // Position above the elevation curve
        }

        return { x: markerX, y: markerY };
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
            span.textContent = t('status.cancel');
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
        if (!this.mapRenderer || !this.currentTrackData) {
            this.showMessage(t('messages.noTrackForExport'), 'error');
            return;
        }

        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
            this.showMessage(t('messages.mediaDeviceNotSupported'), 'error');
            console.error('MediaDevices API or getDisplayMedia not supported.');
            return;
        }

        const mapElement = this.mapRenderer.map.getCanvas();
        if (!mapElement) {
            this.showMessage(t('messages.mapNotReady'), 'error');
            console.error('Map canvas element not found.');
            return;
        }

        let recordedChunks = [];
        let mediaRecorder;
        let stream;
        let performanceMode = false;
        let progressModal;

        // Create enhanced progress modal
        const createProgressModal = () => {
            const modal = document.createElement('div');
            modal.className = 'video-export-progress';
            modal.id = 'videoExportProgress';
            modal.innerHTML = `
                <h3>🎥 Exporting Video</h3>
                <div class="video-export-progress-bar">
                    <div class="video-export-progress-fill" id="exportProgressFill"></div>
                </div>
                <div class="video-export-status" id="exportStatus">Preparing for export...</div>
                <div class="video-export-tips">
                    <strong>💡 Tips for best results:</strong><br>
                    • Keep this browser tab active<br>
                    • Close other heavy applications<br>
                    • Let the process complete without interruption
                </div>
            `;
            document.body.appendChild(modal);
            return modal;
        };

        const updateProgress = (percent, status) => {
            const fillElement = document.getElementById('exportProgressFill');
            const statusElement = document.getElementById('exportStatus');
            if (fillElement) fillElement.style.width = `${percent}%`;
            if (statusElement) statusElement.textContent = status;
        };

        // Elements to hide during recording
        const elementsToHideSelectors = [
            '.header',
            '.controls-panel',
            '.stats-section',
            '.progress-bar-container',
            '.annotations-section',
            '.icon-timeline-section',
            '.journey-planning-section',
            '.journey-timeline-container',
            '.live-stats-overlay',
            '.language-switcher',
            '#toast-container',
            'footer'
        ];

        const hideUI = () => {
            document.body.classList.add('video-export-active');
            elementsToHideSelectors.forEach(selector => {
                document.querySelectorAll(selector).forEach(el => el.style.visibility = 'hidden');
            });
            const mapControls = mapElement.parentElement?.querySelectorAll('.maplibregl-ctrl-top-right, .maplibregl-ctrl-top-left, .maplibregl-ctrl-bottom-left, .maplibregl-ctrl-bottom-right');
            mapControls?.forEach(ctrl => ctrl.style.visibility = 'hidden');
        };

        const showUI = () => {
            document.body.classList.remove('video-export-active');
            elementsToHideSelectors.forEach(selector => {
                document.querySelectorAll(selector).forEach(el => el.style.visibility = 'visible');
            });
            const mapControls = mapElement.parentElement?.querySelectorAll('.maplibregl-ctrl-top-right, .maplibregl-ctrl-top-left, .maplibregl-ctrl-bottom-left, .maplibregl-ctrl-bottom-right');
            mapControls?.forEach(ctrl => ctrl.style.visibility = 'visible');
        };

        const enablePerformanceMode = () => {
            performanceMode = true;
            this.mapRenderer.setPerformanceMode(true);
            this.startPerformanceMonitoring();
        };

        const disablePerformanceMode = () => {
            performanceMode = false;
            this.mapRenderer.setPerformanceMode(false);
            this.stopPerformanceMonitoring();
        };

        const cleanup = () => {
            if (progressModal) {
                progressModal.remove();
            }
            showUI();
            disablePerformanceMode();
        };

        try {
            // Show enhanced progress modal
            progressModal = createProgressModal();
            updateProgress(0, 'Preparing for export...');
            
            // Step 1: Reset animation and hide UI
            this.resetAnimation();
            hideUI();
            await new Promise(resolve => setTimeout(resolve, 300));
            updateProgress(10, 'UI hidden, preparing map...');

            // Step 2: Enable performance mode
            enablePerformanceMode();
            updateProgress(15, 'Performance mode enabled...');

            // Step 3: Enhanced tile preloading
            updateProgress(20, 'Preloading map tiles...');
            await this.enhancedTilePreloading((progress) => {
                updateProgress(20 + (progress * 30), `Loading tiles... ${progress.toFixed(0)}%`);
            });
            
            // Step 4: Wait for tiles to load
            updateProgress(50, 'Waiting for all tiles to load...');
            await this.waitForMapTilesToLoadWithTimeout(5000);
            
            // Step 5: Final preparations
            updateProgress(60, 'Optimizing for recording...');
            await this.prepareForRecording();
            updateProgress(70, 'Starting video capture...');

            // Get stream from canvas
            if (!mapElement.captureStream) {
                cleanup();
                this.showMessage('Browser does not support canvas.captureStream()', 'error');
                return;
            }
            stream = mapElement.captureStream(30);

            const options = {
                mimeType: 'video/webm; codecs=vp9',
                videoBitsPerSecond: 3000000
            };
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                console.warn(`${options.mimeType} not supported, trying with default.`);
                delete options.mimeType;
            }

            mediaRecorder = new MediaRecorder(stream, options);

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    recordedChunks.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                updateProgress(95, 'Processing video file...');
                const blob = new Blob(recordedChunks, {
                    type: recordedChunks[0]?.type || 'video/webm'
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = 'trail-replay-animation.webm';
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                
                updateProgress(100, 'Video export complete!');
                setTimeout(() => {
                    this.showMessage(t('messages.exportComplete'), 'success');
                    cleanup();
                }, 1000);
            };

            mediaRecorder.onerror = (event) => {
                console.error('MediaRecorder error:', event.error);
                this.showMessage(`${t('messages.exportError')}: ${event.error.name}`, 'error');
                cleanup();
                stream.getTracks().forEach(track => track.stop());
            };

            // Start recording
            updateProgress(75, 'Recording animation...');
            mediaRecorder.start();
            this.togglePlayback();

            // Monitor recording progress
            await new Promise(resolve => {
                let frameCount = 0;
                const startTime = performance.now();
                
                const checkCompletion = () => {
                    const progress = this.mapRenderer.getAnimationProgress();
                    frameCount++;
                    
                    // Update progress every 30 frames
                    if (frameCount % 30 === 0) {
                        const recordingProgress = 75 + (progress * 20); // 75-95% range
                        const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
                        updateProgress(recordingProgress, `Recording... ${(progress * 100).toFixed(1)}% (${elapsed}s)`);
                        
                        // Log performance data
                        if (this.performanceData) {
                            console.log(`Recording performance: FPS: ${this.performanceData.fps}, Memory: ${this.performanceData.memory}MB`);
                        }
                    }
                    
                    if (progress >= 1 || !this.isPlaying) {
                        if (mediaRecorder.state === 'recording') {
                            mediaRecorder.stop();
                        }
                        resolve();
                    } else {
                        requestAnimationFrame(checkCompletion);
                    }
                };
                checkCompletion();
            });

        } catch (error) {
            console.error('Error exporting video:', error);
            this.showMessage(`${t('messages.exportError')}: ${error.message}`, 'error');
            cleanup();
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
            }
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        }
    }

    // Enhanced tile preloading with progress callback
    async enhancedTilePreloading(progressCallback) {
        if (!this.mapRenderer || !this.currentTrackData) return;
        
        const map = this.mapRenderer.map;
        const bounds = this.currentTrackData.bounds;
        
        if (!bounds) return;
        
        console.log('Starting enhanced tile preloading for route bounds:', bounds);
        
        // Calculate optimal zoom levels based on route characteristics
        const currentZoom = Math.floor(map.getZoom());
        const routeDistance = this.currentTrackData.stats.totalDistance;
        
        // Adjust zoom range based on route distance
        let maxZoom, minZoom;
        if (routeDistance < 5) {
            maxZoom = Math.min(currentZoom + 2, 17);
            minZoom = Math.max(currentZoom - 1, 10);
        } else if (routeDistance > 50) {
            maxZoom = Math.min(currentZoom + 1, 15);
            minZoom = Math.max(currentZoom - 2, 8);
        } else {
            maxZoom = Math.min(currentZoom + 1, 16);
            minZoom = Math.max(currentZoom - 1, 9);
        }
        
        // Fit to bounds with appropriate padding
        const padding = Math.min(100, Math.max(20, routeDistance * 2));
        map.fitBounds([
            [bounds.west, bounds.south],
            [bounds.east, bounds.north]
        ], {
            padding: padding,
            duration: 0,
            maxZoom: maxZoom
        });
        
        map.triggerRepaint();
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Strategic point sampling based on route characteristics
        const trackPoints = this.currentTrackData.trackPoints;
        const samplePoints = this.calculateStrategicSamplePoints(trackPoints, routeDistance);
        
        console.log(`Preloading tiles for ${samplePoints.length} strategic points`);
        
        // Visit each sample point with adaptive timing
        for (let i = 0; i < samplePoints.length; i++) {
            const point = samplePoints[i];
            
            // Pan to point
            map.setCenter([point.lon, point.lat]);
            map.triggerRepaint();
            
            // Adaptive delay based on point importance
            const delay = point.critical ? 100 : 50;
            await new Promise(resolve => setTimeout(resolve, delay));
            
            // Update progress
            if (i % 5 === 0) {
                const progress = ((i / samplePoints.length) * 100).toFixed(0);
                console.log(`Tile preloading progress: ${progress}%`);
            }
        }
        
        // Return to starting position
        if (trackPoints.length > 0) {
            map.setCenter([trackPoints[0].lon, trackPoints[0].lat]);
            map.triggerRepaint();
        }
        
        console.log('Enhanced tile preloading completed');
    }

    // Calculate strategic sample points for efficient tile loading
    calculateStrategicSamplePoints(trackPoints, routeDistance) {
        const samplePoints = [];
        
        // Always include start and end
        samplePoints.push({ ...trackPoints[0], critical: true });
        if (trackPoints.length > 1) {
            samplePoints.push({ ...trackPoints[trackPoints.length - 1], critical: true });
        }
        
        // Adaptive sampling based on route length
        let sampleRate;
        if (routeDistance < 5) {
            sampleRate = Math.max(1, Math.floor(trackPoints.length / 15)); // More samples for short routes
        } else if (routeDistance > 50) {
            sampleRate = Math.max(1, Math.floor(trackPoints.length / 8)); // Fewer samples for long routes
        } else {
            sampleRate = Math.max(1, Math.floor(trackPoints.length / 12)); // Medium sampling
        }
        
        // Sample points along the route
        for (let i = sampleRate; i < trackPoints.length - sampleRate; i += sampleRate) {
            samplePoints.push({ ...trackPoints[i], critical: false });
        }
        
        // Add elevation change points (peaks and valleys)
        if (trackPoints.length > 10) {
            const elevationPoints = this.findElevationChangePoints(trackPoints);
            elevationPoints.forEach(point => {
                samplePoints.push({ ...point, critical: true });
            });
        }
        
        // Remove duplicates and sort by index
        const uniquePoints = [];
        const seenIndices = new Set();
        
        samplePoints.forEach(point => {
            const index = trackPoints.findIndex(tp => tp.lon === point.lon && tp.lat === point.lat);
            if (!seenIndices.has(index)) {
                seenIndices.add(index);
                uniquePoints.push(point);
            }
        });
        
        return uniquePoints;
    }

    // Find significant elevation change points
    findElevationChangePoints(trackPoints) {
        const elevationPoints = [];
        const elevations = trackPoints.map(p => p.elevation || 0);
        
        if (elevations.length < 10) return elevationPoints;
        
        const minElevation = Math.min(...elevations);
        const maxElevation = Math.max(...elevations);
        const elevationRange = maxElevation - minElevation;
        
        // Only add elevation points if there's significant variation
        if (elevationRange < 50) return elevationPoints;
        
        // Find peaks and valleys
        for (let i = 5; i < trackPoints.length - 5; i++) {
            const current = elevations[i];
            const before = elevations.slice(i - 5, i);
            const after = elevations.slice(i + 1, i + 6);
            
            const isLocalMax = before.every(e => e <= current) && after.every(e => e <= current);
            const isLocalMin = before.every(e => e >= current) && after.every(e => e >= current);
            
            if (isLocalMax || isLocalMin) {
                elevationPoints.push(trackPoints[i]);
            }
        }
        
        return elevationPoints;
    }

    // Enhanced tile loading wait with timeout
    async waitForMapTilesToLoadWithTimeout(timeoutMs = 8000) {
        if (!this.mapRenderer) return;
        
        const map = this.mapRenderer.map;
        
        return new Promise((resolve) => {
            let isResolved = false;
            
            const resolveOnce = () => {
                if (!isResolved) {
                    isResolved = true;
                    console.log('Map tiles loading completed');
                    resolve();
                }
            };
            
            // Enhanced loading detection
            const checkLoading = () => {
                if (map.loaded() && map.isStyleLoaded() && !map.areTilesLoaded()) {
                    return false;
                }
                return true;
            };
            
            // Multiple event listeners for comprehensive detection
            const onLoad = () => {
                if (checkLoading()) {
                    setTimeout(resolveOnce, 100); // Small delay to ensure stability
                }
            };
            
            const onData = (e) => {
                if (e.dataType === 'source' && e.isSourceLoaded) {
                    setTimeout(() => {
                        if (checkLoading()) {
                            resolveOnce();
                        }
                    }, 50);
                }
            };
            
            const onIdle = () => {
                if (checkLoading()) {
                    resolveOnce();
                }
            };
            
            // Set up event listeners
            map.on('load', onLoad);
            map.on('data', onData);
            map.on('idle', onIdle);
            map.on('sourcedata', onData);
            
            // Initial check
            if (checkLoading()) {
                resolveOnce();
            }
            
            // Timeout with warning
            const timeout = setTimeout(() => {
                if (!isResolved) {
                    console.warn(`Tile loading timeout after ${timeoutMs}ms, proceeding anyway`);
                    resolveOnce();
                }
            }, timeoutMs);
            
            // Cleanup
            const cleanup = () => {
                clearTimeout(timeout);
                map.off('load', onLoad);
                map.off('data', onData);
                map.off('idle', onIdle);
                map.off('sourcedata', onData);
            };
            
            // Ensure cleanup happens
            setTimeout(cleanup, timeoutMs + 1000);
        });
    }

    // Prepare system for optimal recording performance
    async prepareForRecording() {
        // Memory cleanup
        if (window.gc) {
            window.gc(); // Force garbage collection if available
        }
        
        // Disable auto-refresh features during recording
        this.recordingMode = true;
        
        // Optimize map for recording
        if (this.mapRenderer) {
            this.mapRenderer.optimizeForRecording();
        }
        
        // Final stability wait
        await new Promise(resolve => setTimeout(resolve, 500));
        
        console.log('System prepared for optimal recording performance');
    }

    addLanguageSwitcher() {
        const languageSelect = document.getElementById('languageSelect');
        if (languageSelect) {
            // Add label if not present
            let label = document.getElementById('languageSelectLabel');
            if (!label) {
                label = document.createElement('label');
                label.id = 'languageSelectLabel';
                label.setAttribute('for', 'languageSelect');
                label.style.marginRight = '0.5rem';
                label.textContent = t('controls.language');
                languageSelect.parentNode.insertBefore(label, languageSelect);
            } else {
                label.textContent = t('controls.language');
            }
            // Set the current language as selected
            import('./translations.js').then(({ translations }) => {
                const currentLang = localStorage.getItem('trailReplayLang') || navigator.language.slice(0, 2);
                for (const option of languageSelect.options) {
                    option.selected = (option.value === currentLang);
                }
            });
            languageSelect.addEventListener('change', (e) => {
                import('./translations.js').then(({ setLanguage }) => {
                    setLanguage(e.target.value);
                    // Update placeholders after language change
                    this.updatePlaceholders();
                    // Update label
                    let label = document.getElementById('languageSelectLabel');
                    if (label) label.textContent = t('controls.language');
                });
            });
        }
    }
    
    updatePlaceholders() {
        // Update annotation form placeholders
        const annotationTitle = document.getElementById('annotationTitle');
        if (annotationTitle) {
            annotationTitle.placeholder = t('messages.annotationTitlePlaceholder');
        }
        
        const annotationDescription = document.getElementById('annotationDescription');
        if (annotationDescription) {
            annotationDescription.placeholder = t('messages.annotationDescriptionPlaceholder');
        }
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
            color: var(--canvas);
            font-weight: 600;
            z-index: 10000;
            animation: slideIn 0.3s ease;
            background: var(--evergreen);
        `;
        // Remove old color logic, always use main color
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
            
            // Update progress display immediately (this will update the elevation profile)
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
        
        // Add visual feedback for interaction - adapted for elevation profile
        progressBar.style.cursor = 'pointer';
        progressBar.addEventListener('mouseenter', () => {
            if (!isDragging) {
                progressBar.style.transform = 'scaleY(1.1)';
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
            // Clear elevation profile cache for journey updates
            this.clearElevationProfileCache();
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
                this.showMessage(t('messages.journeyUpdatedNewOrder'), 'success');
            }
        } catch (error) {
            console.error('Error rebuilding journey:', error);
            this.showMessage('Error updating journey', 'error');
        }
    }

    // Handle segment timing updates
    handleSegmentTimingUpdate(updateData) {
        if (!this.currentTrackData || !this.currentTrackData.isJourney) {
            console.log('🎯 MAIN APP: No journey data available for timing update, or not a journey.');
            return;
        }
        
        console.log('🎯 MAIN APP: Received segmentTimingUpdate event from JourneyBuilder:', updateData);

        // updateData.segments IS the array of segment objects from JourneyBuilder.buildCompleteJourney().segments
        // updateData.newSegmentTiming IS the summary {totalDuration, trackDuration, transportDuration} from JourneyBuilder.
        // updateData.totalDuration IS the same totalDuration from the summary.

        // CRITICAL: Always recalculate the detailed segment timing structure needed by MapRenderer.
        // this.calculateSegmentTiming uses updateData.segments and calls JourneyBuilder for default times.
        const detailedSegmentTimingForMapRenderer = this.calculateSegmentTiming(updateData.segments);

        console.log('🎯 MAIN APP: Recalculated detailed timing for MapRenderer:', detailedSegmentTimingForMapRenderer);
        
        // Now use this detailedSegmentTimingForMapRenderer for all state updates and MapRenderer setup.
        
        // 1. Update main app timing property
        this.totalAnimationTime = detailedSegmentTimingForMapRenderer.totalDuration;
        
        // 2. Update current track data (which might also be used by other parts of the app)
        this.currentTrackData.segmentTiming = detailedSegmentTimingForMapRenderer;
        // Ensure the segments in currentTrackData are also the most up-to-date ones from the event.
        this.currentTrackData.segments = updateData.segments; 
        
        // 3. Update MapRenderer timing if it exists
        if (this.mapRenderer) {
            console.log('🎯 MAIN APP: Updating MapRenderer with new detailed timing...');
            
            const wasPlaying = this.isPlaying;
            const currentProgress = this.mapRenderer.getAnimationProgress(); // Preserve current progress
            
            if (wasPlaying) {
                this.togglePlayback(); // Pause before re-setup
            }
            
            // Pass the raw segments from the event (updateData.segments) as the first argument,
            // and the NEWLY CALCULATED detailed timing object as the second argument.
            this.mapRenderer.setupSegmentAnimation(updateData.segments, detailedSegmentTimingForMapRenderer);
            
            // Restore position and UI after MapRenderer is updated
            setTimeout(() => {
                if (this.mapRenderer) { // Check again in case map was destroyed
                    this.mapRenderer.setAnimationProgress(currentProgress);
                }
                
                // 4. Synchronize all UI displays using the same detailed timing object.
                this.synchronizeAllTimingDisplays(detailedSegmentTimingForMapRenderer);
                
                if (wasPlaying && this.mapRenderer) {
                    setTimeout(() => this.togglePlayback(), 100); // Resume playback
                }
            }, 50);
        } else {
            // If no MapRenderer, still synchronize UI displays
            this.synchronizeAllTimingDisplays(detailedSegmentTimingForMapRenderer);
        }
        
        // Regenerate elevation profile since journey composition may have changed
        this.clearElevationProfileCache(); // Clear cache first
        this.generateElevationProfile();
        
        console.log('🎯 MAIN APP: Timing update handling completed. totalAnimationTime set to:', this.totalAnimationTime);
    }

    // New method to synchronize all timing displays at once
    synchronizeAllTimingDisplays(segmentTiming) {
        console.log('🔄 Synchronizing all timing displays with:', segmentTiming.totalDuration, 'seconds');
        
        const formattedTime = this.formatTimeInSeconds(segmentTiming.totalDuration);
        
        // Update main progress display total time
        const totalTimeElement = document.getElementById('totalTime');
        if (totalTimeElement) {
            totalTimeElement.textContent = formattedTime;
            console.log('✅ Updated main totalTime display:', formattedTime);
        }
        
        // Update journey animation timing panel
        this.showTimingBreakdown(segmentTiming);
        console.log('✅ Updated Journey Animation Timing panel');
        
        // DON'T re-render the timeline during synchronization to prevent recalculation conflicts
        // The timeline should already be showing the correct values from the user's input
        console.log('✅ Skipped timeline re-render to prevent timing conflicts');
        
        // Update current time display during progress updates
        this.updateProgressDisplay();
        console.log('✅ Updated progress display');
        
        // Validate all displays are synchronized
        this.validateAllTimingDisplaysSync(segmentTiming);
    }
    
    // New method to validate all timing displays are synchronized
    validateAllTimingDisplaysSync(expectedTiming) {
        const issues = [];
        const expectedFormattedTime = this.formatTimeInSeconds(expectedTiming.totalDuration);
        
        // Check main app timing
        if (this.totalAnimationTime !== expectedTiming.totalDuration) {
            issues.push(`totalAnimationTime: ${this.totalAnimationTime} ≠ ${expectedTiming.totalDuration}`);
        }
        
        // Check main UI display
        const totalTimeElement = document.getElementById('totalTime');
        if (totalTimeElement && totalTimeElement.textContent !== expectedFormattedTime) {
            issues.push(`Main totalTime display: "${totalTimeElement.textContent}" ≠ "${expectedFormattedTime}"`);
        }
        
        // Check track data timing
        if (this.currentTrackData?.segmentTiming?.totalDuration !== expectedTiming.totalDuration) {
            issues.push(`TrackData timing: ${this.currentTrackData?.segmentTiming?.totalDuration} ≠ ${expectedTiming.totalDuration}`);
        }
        
        // Check MapRenderer timing
        if (this.mapRenderer?.segmentTimings?.totalDuration !== expectedTiming.totalDuration) {
            issues.push(`MapRenderer timing: ${this.mapRenderer?.segmentTimings?.totalDuration} ≠ ${expectedTiming.totalDuration}`);
        }
        
        // Check journey animation timing panel
        const timingPanel = document.getElementById('journeyTimingPanel');
        if (timingPanel) {
            const panelDuration = timingPanel.querySelector('.total-duration');
            if (panelDuration && panelDuration.textContent !== expectedFormattedTime) {
                issues.push(`Animation Timing panel: "${panelDuration.textContent}" ≠ "${expectedFormattedTime}"`);
            }
        }
        
        if (issues.length === 0) {
            console.log('✅ ALL TIMING DISPLAYS SYNCHRONIZED:', expectedFormattedTime);
        } else {
            console.error('❌ TIMING SYNC ISSUES DETECTED:', issues);
            console.log('🔧 Expected timing:', expectedTiming);
        }
        
        return issues.length === 0;
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
            
            // CRITICAL: Synchronize all timing sources from the start
            console.log('🎯 INITIAL JOURNEY LOAD: Synchronizing all timing sources with:', segmentTiming.totalDuration);
            this.totalAnimationTime = segmentTiming.totalDuration;
            this.currentTrackData = trackData;
            
            // Initialize map renderer if not already done
            if (!this.mapRenderer) {
                this.mapRenderer = new MapRenderer('map');
                await this.waitForMapLoad();
            }
            
            // Load journey data into map
            this.mapRenderer.loadTrack(trackData);
            
            // Enable 3D terrain if checkbox is checked (should be by default)
            setTimeout(() => {
                const terrain3dToggle = document.getElementById('terrain3d');
                if (terrain3dToggle && terrain3dToggle.checked && !this.mapRenderer.is3DMode) {
                    if (this.mapRenderer.isTerrainSupported && this.mapRenderer.isTerrainSupported()) {
                        console.log('Auto-enabling 3D terrain after journey load');
                        this.mapRenderer.enable3DTerrain();
                    }
                }
            }, 500);
            
            // Set up segment-aware animation in MapRenderer
            this.mapRenderer.setupSegmentAnimation(journeyData.segments, segmentTiming);
            
            // Add automatic icon changes based on segments
            this.addSegmentIconChanges(trackData);
            
            // Update UI with synchronized timing
            this.showVisualizationSection();
            this.updateStats(trackData.stats);
            
            // Generate elevation profile for the journey
            this.generateElevationProfile();
            
            // Use the new synchronization method to ensure all displays match
            this.synchronizeAllTimingDisplays(segmentTiming);
            
            // Render timeline under the map (visual feedback)
            this.renderJourneyTimeline();
            
            // Keep journey builder section visible for configuration
            this.showJourneyPlanningSection();
            
            // Mark as journey and update stats with GPX only setting if applicable
            this.currentTrackData.isJourney = true;
            this.updateStatsDisplay();
            
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
            
            // Insert after the progress controls container (not the map container)
            const progressControlsContainer = document.querySelector('.progress-controls-container');
            if (progressControlsContainer) {
                progressControlsContainer.parentNode.insertBefore(timelineContainer, progressControlsContainer.nextSibling);
            } else {
                // Fallback: insert after the map container if progress controls not found
                const mapContainer = document.querySelector('.map-container');
                mapContainer.parentNode.insertBefore(timelineContainer, mapContainer.nextSibling);
            }
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
        // segments argument is the array from JourneyBuilder.buildCompleteJourney().segments

        let totalDuration = 0;
        let trackDuration = 0;
        let transportDuration = 0;
        const detailedSegmentTimings = []; // This will be MapRenderer's segmentTimings.segments

        console.log('MAIN APP: Calculating detailed segment timing for MapRenderer using JourneyBuilder defaults...');

        // First pass: calculate total coordinates to determine progress ratios
        let totalCoordinates = 0;
        segments.forEach(segment => {
            // Ensure segment.startIndex and segment.endIndex are valid numbers
            const len = (segment.endIndex - segment.startIndex + 1);
            totalCoordinates += (isNaN(len) || len < 0) ? 0 : len;
        });
        if (totalCoordinates === 0 && segments.length > 0) totalCoordinates = segments.length; // Basic fallback
        if (totalCoordinates === 0) totalCoordinates = 1; // Avoid division by zero

        let currentCoordIndex = 0;

        segments.forEach((segment, index) => {
            let segmentTime = 0;

            if (segment.type === 'track') {
                if (segment.userTime !== undefined && segment.userTime !== null) {
                    segmentTime = segment.userTime;
                } else {
                    // Use JourneyBuilder's method for default track time
                    segmentTime = this.journeyBuilder ? this.journeyBuilder.calculateTrackTime(segment.data) : 60; // Fallback if no JB
                }
                trackDuration += segmentTime;
            } else if (segment.type === 'transportation') {
                if (segment.route && segment.route.userTime !== undefined && segment.route.userTime !== null) {
                    segmentTime = segment.route.userTime;
                } else if (segment.userTime !== undefined && segment.userTime !== null) {
                    segmentTime = segment.userTime;
                } else {
                    // Use JourneyBuilder's method for default transport time
                    let distance = 0;
                    if (segment.startPoint && segment.endPoint && this.journeyBuilder) {
                        distance = this.journeyBuilder.calculateDistance(segment.startPoint, segment.endPoint);
                    }
                    segmentTime = this.journeyBuilder ? this.journeyBuilder.getDefaultTransportTime(segment.mode, distance) : 30;
                }
                transportDuration += segmentTime;
            }

            const segmentLength = (segment.endIndex - segment.startIndex + 1);
            const currentSegmentLength = (isNaN(segmentLength) || segmentLength < 0) ? 0 : segmentLength;
            
            // Ensure progress ratios are always valid numbers between 0 and 1
            const progressStartRatio = totalCoordinates > 1 ? currentCoordIndex / (totalCoordinates -1) : 0;
            const progressEndRatio = totalCoordinates > 1 ? (currentCoordIndex + Math.max(0, currentSegmentLength -1)) / (totalCoordinates -1) : 1;

            detailedSegmentTimings.push({
                ...segment, // Pass through original segment data (type, data, mode, route, etc.)
                duration: segmentTime,
                startTime: totalDuration,
                endTime: totalDuration + segmentTime,
                coordinateLength: currentSegmentLength,
                progressStartRatio: Math.max(0, Math.min(1, progressStartRatio)),
                progressEndRatio: Math.max(0, Math.min(1, progressEndRatio)),
                startCoordIndex: currentCoordIndex,
                endCoordIndex: currentCoordIndex + Math.max(0, currentSegmentLength -1)
            });

            totalDuration += segmentTime;
            currentCoordIndex += currentSegmentLength;
        });

        console.log('MAIN APP: Detailed segment timing calculation result:', {
            totalDuration: `${totalDuration}s`,
            trackDuration: `${trackDuration}s`,
            transportDuration: `${transportDuration}s`,
            segmentCount: detailedSegmentTimings.length
        });

        return {
            totalDuration,
            trackDuration,
            transportDuration,
            segments: detailedSegmentTimings // This is the crucial part for MapRenderer
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
                <h4>🎬 ${t('messages.journeyAnimationTiming')}</h4>
                <span class="total-duration">${this.formatTimeInSeconds(segmentTiming.totalDuration)}</span>
            </div>
            <div class="timing-breakdown">
                <div class="timing-item">
                    <span class="timing-label">${t('messages.timingTracks')}</span>
                    <span class="timing-value">${this.formatTimeInSeconds(segmentTiming.trackDuration)}</span>
                </div>
                <div class="timing-item">
                    <span class="timing-label">${t('messages.timingTransportation')}</span>
                    <span class="timing-value">${this.formatTimeInSeconds(segmentTiming.transportDuration)}</span>
                </div>
            </div>
            <div class="timing-note">
                <small>${t('messages.timingNote')}</small>
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

    toggleLiveStats(show) {
        const overlay = document.getElementById('liveStatsOverlay');
        if (overlay) {
            if (show) {
                overlay.classList.remove('hidden');
                overlay.style.display = '';
                // Show placeholders if no data
                if (!this.mapRenderer || !this.currentTrackData) {
                    document.getElementById('liveDistance').textContent = '–';
                    document.getElementById('liveElevation').textContent = '–';
                } else {
                    this.updateLiveStats(); // Update immediately when shown
                }
            } else {
                overlay.classList.add('hidden');
                overlay.style.display = 'none';
            }
        }
    }

    updateLiveStats() {
        const overlay = document.getElementById('liveStatsOverlay');
        if (!overlay || overlay.classList.contains('hidden')) return;
        
        // Skip expensive operations during recording
        if (this.recordingMode) {
            return;
        }
        
        // If no data, show placeholders
        if (!this.mapRenderer || !this.currentTrackData) {
            document.getElementById('liveDistance').textContent = '–';
            document.getElementById('liveElevation').textContent = '–';
            return;
        }
        
        try {
            // Throttle updates during animation for performance
            const now = performance.now();
            if (this.lastStatsUpdate && (now - this.lastStatsUpdate) < 100) {
                return; // Skip if updated less than 100ms ago
            }
            this.lastStatsUpdate = now;
            
            // Ensure GPX parser is ready
            if (!this.mapRenderer.ensureGPXParserReady()) {
                document.getElementById('liveDistance').textContent = '–';
                document.getElementById('liveElevation').textContent = '–';
                return;
            }
            
            const progress = this.mapRenderer.getAnimationProgress();
            const currentPoint = this.mapRenderer.gpxParser.getInterpolatedPoint(progress);
            
            if (!currentPoint) {
                document.getElementById('liveDistance').textContent = '–';
                document.getElementById('liveElevation').textContent = '–';
                return;
            }
            
            // Calculate current distance (distance traveled so far)
            let totalDistance = this.currentTrackData.stats.totalDistance;
            
            // If GPX only stats is enabled and this is a journey, use only GPX track distances
            if (this.gpxOnlyStats && this.currentTrackData.isJourney && this.currentTrackData.segments) {
                const gpxStats = this.calculateGpxOnlyStats(this.currentTrackData);
                totalDistance = gpxStats.totalDistance;
            }
            
            const currentDistance = progress * totalDistance;
            
            // Calculate actual elevation gain based on current position in track
            const currentElevationGain = this.calculateActualElevationGain(progress);
            
            // Format and update the display values with optimized DOM updates
            const distanceElement = document.getElementById('liveDistance');
            const elevationElement = document.getElementById('liveElevation');
            
            if (distanceElement) {
                const formattedDistance = this.gpxParser.formatDistance(currentDistance);
                if (distanceElement.textContent !== formattedDistance) {
                    // Skip animation during heavy operations
                    if (this.isPlaying && this.mapRenderer.isAnimating) {
                        distanceElement.textContent = formattedDistance;
                    } else {
                        this.animateValueChange(distanceElement, formattedDistance);
                    }
                }
            }
            
            if (elevationElement) {
                const formattedElevation = this.gpxParser.formatElevation(currentElevationGain);
                if (elevationElement.textContent !== formattedElevation) {
                    // Skip animation during heavy operations
                    if (this.isPlaying && this.mapRenderer.isAnimating) {
                        elevationElement.textContent = formattedElevation;
                    } else {
                        this.animateValueChange(elevationElement, formattedElevation);
                    }
                }
            }
            
        } catch (error) {
            document.getElementById('liveDistance').textContent = '–';
            document.getElementById('liveElevation').textContent = '–';
            console.warn('Error updating live stats:', error);
        }
    }

    // Calculate actual elevation gain based on current progress through the track
    calculateActualElevationGain(progress) {
        if (!this.currentTrackData || !this.currentTrackData.trackPoints) {
            return 0;
        }
        
        const trackPoints = this.currentTrackData.trackPoints;
        if (trackPoints.length === 0) {
            return 0;
        }
        
        // Debug: Check if we have elevation data (only once)
        if (!this._elevationDataChecked) {
            const hasElevationData = trackPoints.some(point => point.elevation && point.elevation > 0);
            if (!hasElevationData) {
                console.log('Warning: No elevation data found in track points');
                console.log('First 3 track points:', trackPoints.slice(0, 3).map(p => ({
                    lat: p.lat,
                    lon: p.lon,
                    elevation: p.elevation
                })));
            } else {
                console.log('Elevation data found in track points');
            }
            this._elevationDataChecked = true;
        }
        
        // Calculate the current point index based on progress
        const totalPoints = trackPoints.length;
        const currentIndex = Math.min(Math.floor(progress * (totalPoints - 1)), totalPoints - 1);
        
        // Calculate actual elevation gain up to the current point
        let elevationGain = 0;
        let previousElevation = trackPoints[0].elevation || 0;
        
        for (let i = 1; i <= currentIndex; i++) {
            const currentElevation = trackPoints[i].elevation || 0;
            
            // Only count positive elevation changes as gain
            if (currentElevation > previousElevation) {
                elevationGain += currentElevation - previousElevation;
            }
            
            previousElevation = currentElevation;
        }
        
        // If we're between two points, interpolate the elevation gain for the partial segment
        if (currentIndex < totalPoints - 1) {
            const fraction = (progress * (totalPoints - 1)) - currentIndex;
            if (fraction > 0) {
                const currentElevation = trackPoints[currentIndex].elevation || 0;
                const nextElevation = trackPoints[currentIndex + 1].elevation || 0;
                
                // Only add partial gain if the next point is higher
                if (nextElevation > currentElevation) {
                    const partialGain = (nextElevation - currentElevation) * fraction;
                    elevationGain += partialGain;
                }
            }
        }
        
        return elevationGain;
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
    // Move Buy Me a Coffee button next to GitHub button in the footer
    const footer = document.querySelector('footer .container');
    const githubBtn = footer?.querySelector('.github-link');
    // Remove previous Buy Me a Coffee button if present
    const oldCoffeeBtn = document.getElementById('buyMeCoffeeBtn');
    if (oldCoffeeBtn) oldCoffeeBtn.remove();
    if (footer && githubBtn && !document.getElementById('buyMeCoffeeBtn')) {
        const coffeeBtn = document.createElement('a');
        coffeeBtn.id = 'buyMeCoffeeBtn';
        coffeeBtn.href = 'https://ko-fi.com/alexalmansa';
        coffeeBtn.target = '_blank';
        coffeeBtn.rel = 'noopener noreferrer';
        coffeeBtn.className = 'buy-me-coffee-btn';
        coffeeBtn.textContent = t('messages.buyMeCoffee');
        coffeeBtn.style = 'display:inline-flex;align-items:center;gap:0.5rem;margin-left:1rem;padding:0.5rem 1rem;background:#ffdd00;color:#222;font-weight:700;border-radius:6px;text-decoration:none;font-size:1rem;box-shadow:0 2px 8px rgba(0,0,0,0.08);transition:background 0.2s;vertical-align:middle;';
        coffeeBtn.onmouseover = () => coffeeBtn.style.background = '#ffe66d';
        coffeeBtn.onmouseout = () => coffeeBtn.style.background = '#ffdd00';
        githubBtn.parentNode.insertBefore(coffeeBtn, githubBtn.nextSibling);
    }
}); 