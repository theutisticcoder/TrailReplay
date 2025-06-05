import { initializeTranslations, t } from './translations.js';
import { GPXParser } from './gpxParser.js';
import { MapRenderer } from './mapRenderer.js';
import { JourneyBuilder } from './journeyBuilder.js';

class TrailReplayApp {
    constructor() {
        this.gpxParser = new GPXParser();
        this.mapRenderer = null;
        this.currentTrackData = null;
        this.journeyData = null; // Add initialization for journeyData
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
        
        // Generate elevation profile
        this.generateElevationProfile();
        // If live stats toggle is on, show overlay and update
        const showLiveStatsToggle = document.getElementById('showLiveStats');
        if (showLiveStatsToggle && showLiveStatsToggle.checked) {
            this.toggleLiveStats(true);
            this.updateLiveStats();
        }
        
        // Asynchronously preload tiles for smoother animation (non-blocking)
        setTimeout(() => {
            this.basicTilePreloading().catch(error => {
                console.warn('Basic tile preloading failed:', error);
            });
        }, 500); // Small delay to not interfere with initial render
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
        // Export listeners will be set up when journey timing panel is created

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
            this.updateStatsDisplay(); // Refresh stats display
            
            // Update live stats if enabled
            if (document.getElementById('showLiveStats').checked) {
                this.updateLiveStats();
            }
            
            // Show user feedback about what this toggle does
            const message = e.target.checked ? 
                t('messages.gpxOnlyStatsEnabled') : 
                t('messages.gpxOnlyStatsDisabled');
            console.log(message);
        });

        // Camera info icon functionality
        this.setupCameraInfoIcon();

        // 3D terrain toggle
        const terrain3dToggle = document.getElementById('terrain3d');
        terrain3dToggle.addEventListener('change', (e) => {
            if (this.mapRenderer) {
                if (e.target.checked) {
                        this.mapRenderer.enable3DTerrain();
                } else {
                    this.mapRenderer.disable3DTerrain();
                }
                
                // Show/hide terrain source selection
                const terrainSourceGroup = document.getElementById('terrainSourceGroup');
                if (terrainSourceGroup) {
                    terrainSourceGroup.style.display = e.target.checked ? 'block' : 'none';
                }
            }
        });

        // Terrain source selection
        const terrainSourceSelect = document.getElementById('terrainSource');
            terrainSourceSelect.addEventListener('change', (e) => {
            if (this.mapRenderer) {
                this.mapRenderer.setTerrainSource(e.target.value);
                    
                // Show feedback message
                const sourceNames = {
                    'mapzen': 'Mapzen Terrarium',
                    'opentopo': 'OpenTopography SRTM'
                };
                this.showMessage(t('messages.elevationDataChanged', {
                    source: sourceNames[e.target.value] || e.target.value
                }), 'info');
                }
            });

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

    setupCameraInfoIcon() {
        // Set up camera info button event listeners for mobile click behavior
        document.addEventListener('click', (e) => {
            if (e.target.closest('#cameraInfoButton')) {
                const button = e.target.closest('#cameraInfoButton');
                
                // For mobile devices (touch), toggle the tooltip
                if (window.matchMedia('(hover: none)').matches || window.matchMedia('(pointer: coarse)').matches) {
                    button.classList.toggle('active');
                    
                    // Close other open tooltips
                    document.querySelectorAll('.camera-info-button.active').forEach(otherButton => {
                        if (otherButton !== button) {
                            otherButton.classList.remove('active');
                        }
                    });
                }
                
                e.stopPropagation();
            }
        });
        
        // Close camera tooltip when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.camera-info-section')) {
                document.querySelectorAll('.camera-info-button.active').forEach(button => {
                    button.classList.remove('active');
                });
            }
        });
        
        // Prevent tooltip from closing when clicking inside it
        document.addEventListener('click', (e) => {
            if (e.target.closest('.camera-info-tooltip')) {
                e.stopPropagation();
            }
        });
        
        console.log('Camera info button event listeners set up');
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
            
            // Don't clean up manual recording mode when paused - user might be getting ready to record
            // Manual recording mode will only be cleaned up when animation completes or is reset
        } else {
            // Preserve current position before starting
            const currentProgress = this.mapRenderer.getAnimationProgress();
            console.log('Starting playback from progress:', currentProgress.toFixed(3));
            
            // For journeys, ensure time and position are synchronized before starting
            if (this.currentTrackData.isJourney && this.currentTrackData.segmentTiming) {
                try {
                    const expectedSegmentTime = this.convertLinearProgressToSegmentTime(currentProgress);
                    
                    if (this.mapRenderer.journeyElapsedTime !== undefined && expectedSegmentTime !== null && !isNaN(expectedSegmentTime)) {
                        const timeDiff = Math.abs(this.mapRenderer.journeyElapsedTime - expectedSegmentTime);
                        if (timeDiff > 1) { // 1 second tolerance
                            console.log(`🔄 Synchronizing journey time: ${this.mapRenderer.journeyElapsedTime.toFixed(1)}s → ${expectedSegmentTime.toFixed(1)}s`);
                            if (this.mapRenderer.setJourneyElapsedTime) {
                                this.mapRenderer.setJourneyElapsedTime(expectedSegmentTime);
                            }
                        }
                    } else if (expectedSegmentTime === null || isNaN(expectedSegmentTime)) {
                        // Fallback synchronization for problematic segment data
                        const totalDuration = this.currentTrackData.segmentTiming.totalDuration || this.totalAnimationTime;
                        const fallbackTime = currentProgress * totalDuration;
                        if (this.mapRenderer.setJourneyElapsedTime) {
                            this.mapRenderer.setJourneyElapsedTime(fallbackTime);
                            console.log(`🔄 Fallback journey time sync: ${fallbackTime.toFixed(1)}s`);
                        }
                    }
                } catch (error) {
                    console.warn('Error synchronizing journey time, continuing with simple playback:', error);
                }
            }
            
            // Ensure position is properly set before starting animation
            this.mapRenderer.setAnimationProgress(currentProgress);
            this.mapRenderer.updateCurrentPosition();
            
            // Start animation from the preserved position
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
        
        // Clean up manual recording mode
        this.cleanupManualRecordingMode();
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
                
                // Clean up manual recording mode when animation completes
                this.cleanupManualRecordingMode();
            }
        };
        
        updateProgress();
    }

    cleanupManualRecordingMode() {
        // Only clean up if we're actually in manual recording mode
        if (this.recordingMode && this.overlayRecordingMode) {
            console.log('Cleaning up manual recording mode');
            
            // Reset recording flags
            this.recordingMode = false;
            this.overlayRecordingMode = false;
            
            // Remove the recording highlight
            const videoCaptureContainer = document.getElementById('videoCaptureContainer');
            if (videoCaptureContainer) {
                videoCaptureContainer.classList.remove('recording-highlight');
            }
            
            // Note: We don't disable live stats here as user might want to keep them visible
            console.log('Manual recording mode cleanup complete');
        }
    }

    updateProgressDisplay() {
        // Skip expensive operations during clean recording, but allow updates during overlay recording (manual mode)
        if (this.recordingMode && !this.overlayRecordingMode) {
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
                
                // Verify the synchronization between time and position for journeys
                const expectedProgress = this.convertSegmentTimeToLinearProgress(this.mapRenderer.journeyElapsedTime);
                const actualProgress = this.mapRenderer.getAnimationProgress();
                const progressDiff = Math.abs(expectedProgress - actualProgress);
                
                // If there's a significant mismatch, log it for debugging
                if (progressDiff > 0.01) { // 1% tolerance
                    console.log(`⚠️  Time/Position sync mismatch: time=${this.mapRenderer.journeyElapsedTime.toFixed(1)}s → expected progress=${expectedProgress.toFixed(3)}, actual progress=${actualProgress.toFixed(3)}, diff=${progressDiff.toFixed(3)}`);
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
        const progressPath = document.getElementById('progressPath');

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

    toggleExportHelp() {
        const exportHelp = document.getElementById('exportHelp');
        const toggle = document.getElementById('exportHelpToggle');
        
        if (exportHelp.style.display === 'none') {
            exportHelp.style.display = 'block';
            toggle.innerHTML = `<span data-i18n="controls.exportHelpHide">${t('controls.exportHelpHide')}</span>`;
        } else {
            exportHelp.style.display = 'none';
            toggle.innerHTML = `<span data-i18n="controls.exportHelp">${t('controls.exportHelp')}</span>`;
        }
    }

    async startManualRecordingMode() {
        // Show single combined instructions modal
        const shouldStart = await this.showManualRecordingInstructions();
        if (!shouldStart) return;

        // Show progress for preloading like in normal export
        let progressModal = null;
        
        const createProgressModal = () => {
            const modal = document.createElement('div');
            modal.className = 'modal enhanced-progress-modal';
            modal.innerHTML = `
                <div class="modal-content enhanced-progress-content">
                    <h3 style="margin-bottom: 1rem; color: var(--evergreen);">
                        🎥 Preparando Manual Mode con Estadísticas
                    </h3>
                    <div class="progress-container">
                        <div class="progress-bar" id="manualProgressBar">
                            <div class="progress-fill" style="width: 0%"></div>
                        </div>
                        <div class="progress-text" id="manualProgressText">Preparing map tiles...</div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            return modal;
        };

        const updateProgress = (percent, status) => {
            const progressBar = document.getElementById('manualProgressBar');
            const progressText = document.getElementById('manualProgressText');
            if (progressBar && progressText) {
                progressBar.querySelector('.progress-fill').style.width = percent + '%';
                progressText.textContent = status;
            }
        };

        try {
            progressModal = createProgressModal();
            
            // Highlight the capture area
            const videoCaptureContainer = document.getElementById('videoCaptureContainer');
            if (videoCaptureContainer) {
                videoCaptureContainer.classList.add('recording-highlight');
            }

            // Do the same tile preloading as the normal export
            updateProgress(10, 'Preparing for recording...');
            await this.prepareForRecording();
            
            updateProgress(50, 'Preloading map tiles...');
            await this.enhancedTilePreloading((progress) => {
                updateProgress(50 + (progress * 0.4), `Preloading tiles... ${Math.round(progress)}%`);
            });
            
            updateProgress(100, 'Ready for manual recording!');
            
            // Remove progress modal
            if (progressModal) {
                progressModal.remove();
                progressModal = null;
            }
            
            // Set recording mode flags for manual recording (enables overlay stats)
            this.recordingMode = true;
            this.overlayRecordingMode = true; // This ensures stats continue to update
            
            // Enable live stats display
            this.toggleLiveStats(true);
            
            // Start the animation for manual recording with all overlays visible
            this.resetAnimation();
            setTimeout(() => {
                this.togglePlayback(); // Start playback
                // Show user guidance for manual recording mode
                this.showMessage('🎥 Manual recording active - Press Escape to exit anytime', 'success');
                console.log('Manual recording mode ready - Press Escape to exit');
            }, 500);
            
        } catch (error) {
            console.error('Error preparing manual recording:', error);
            if (progressModal) {
                progressModal.remove();
            }
            this.showMessage('Error preparing manual recording: ' + error.message, 'error');
        }
    }

    async showManualRecordingInstructions() {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.zIndex = '10000';
            
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <h3>${t('controls.manualRecordingTitle')}</h3>
                        <button class="modal-close" id="manualRecordingClose">✕</button>
                    </div>
                    <div class="modal-body">
                        <div style="background: var(--trail-orange-15); padding: 1rem; border-radius: 6px; margin-bottom: 1rem; border-left: 4px solid var(--trail-orange);">
                            <strong>${t('controls.manualRecordingInstructions')}</strong><br><br>
                            
                            <strong>${t('controls.manualRecordingWindows')}</strong><br>
                            ${t('controls.manualRecordingWindowsKeys')}<br><br>
                            
                            <strong>${t('controls.manualRecordingMac')}</strong><br>
                            ${t('controls.manualRecordingMacKeys')}<br><br>
                            
                            <strong>${t('controls.manualRecordingHighlight')}</strong><br>
                            ${t('controls.manualRecordingHighlightDesc')}
                        </div>
                        
                        <p><strong>${t('controls.manualRecordingWhatHappens')}</strong></p>
                        <ul style="margin: 1rem 0; padding-left: 1.5rem; line-height: 1.6;">
                            <li>${t('controls.manualRecordingStep1')}</li>
                            <li>${t('controls.manualRecordingStep2')}</li>
                            <li>${t('controls.manualRecordingStep3')}</li>
                            <li>${t('controls.manualRecordingStep4')}</li>
                            <li style="color: var(--trail-orange); font-weight: 500;">${t('controls.manualRecordingStep5')}</li>
                        </ul>
                    </div>
                    <div class="modal-footer">
                        <button class="control-btn" id="manualRecordingCancel">${t('controls.manualRecordingCancel')}</button>
                        <button class="control-btn primary" id="manualRecordingStart">${t('controls.manualRecordingStart')}</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            const closeBtn = document.getElementById('manualRecordingClose');
            const cancelBtn = document.getElementById('manualRecordingCancel');
            const startBtn = document.getElementById('manualRecordingStart');
            
            const cleanup = () => {
                modal.remove();
            };
            
            closeBtn.addEventListener('click', () => {
                cleanup();
                resolve(false);
            });
            
            cancelBtn.addEventListener('click', () => {
                cleanup();
                resolve(false);
            });
            
            startBtn.addEventListener('click', () => {
                cleanup();
                resolve(true);
            });
            
            // Close on outside click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    cleanup();
                    resolve(false);
                }
            });
        });
    }

    async exportVideo(mode = 'auto-webm') {
        // Enhanced validation with better debugging
        console.log('Export video validation:');
        console.log('- mapRenderer exists:', !!this.mapRenderer);
        console.log('- currentTrackData exists:', !!this.currentTrackData);
        console.log('- journeyData exists:', !!this.journeyData);
        console.log('- journeyBuilder exists:', !!this.journeyBuilder);
        console.log('- export mode:', mode);
        
        // Check for any valid track data source
        const hasTrackData = this.currentTrackData || 
                           (this.journeyData && this.journeyData.coordinates && this.journeyData.coordinates.length > 0) ||
                           (this.journeyBuilder && this.journeyBuilder.hasValidJourney && this.journeyBuilder.hasValidJourney());
        
        if (!this.mapRenderer || !hasTrackData) {
            console.error('Export validation failed:');
            console.error('- mapRenderer:', this.mapRenderer);
            console.error('- currentTrackData:', this.currentTrackData);
            console.error('- journeyData:', this.journeyData);
            console.error('- hasValidJourney:', this.journeyBuilder?.hasValidJourney?.());
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

        // Determine export settings based on mode
        const includeOverlays = true; // Both remaining auto modes use overlays
        const useCropTarget = mode === 'auto-crop';
        
        // Show pre-recording confirmation dialog with export type info
        const shouldContinue = await this.showVideoExportConfirmation(mode);
        if (!shouldContinue) return;

        let progressModal = null;
        let mediaRecorder = null;
        let stream = null;
        let userCameraSettings = null; // Declare this early so cleanup can access it

        // Elements to hide during recording 
        let elementsToHideSelectors = [
            '.header',
            '.controls-panel',
            '.stats-section',
            '.progress-controls-container',
            '.annotations-section',
            '.icon-timeline-section',
            '.journey-planning-section',
            '.journey-timeline-container',
            '.language-switcher',
            '#toast-container',
            'footer'
        ];

        const createProgressModal = () => {
            const modal = document.createElement('div');
            modal.className = 'modal enhanced-progress-modal';
            modal.innerHTML = `
                <div class="modal-content enhanced-progress-content">
                    <h3 style="margin-bottom: 1rem; color: var(--evergreen);">
                        🎬 ${t('messages.exportVideoTitle')}
                    </h3>
                    <div class="progress-container">
                        <div class="progress-bar" id="exportProgressBar">
                            <div class="progress-fill" style="width: 0%"></div>
                </div>
                        <div class="progress-text" id="exportProgressText">Initializing...</div>
                    </div>
                    <div class="export-tips" style="margin-top: 1rem; font-size: 0.9rem; color: var(--text-secondary);">
                        <div style="margin-bottom: 0.5rem;">📱 ${t('messages.exportVideoKeepTabActive')}</div>
                        <div style="margin-bottom: 0.5rem;">🖥️ ${t('messages.exportVideoCloseOtherApps')}</div>
                        <div>⏳ ${t('messages.exportVideoLetComplete')}</div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            return modal;
        };

        const updateProgress = (percent, status) => {
            const progressBar = document.getElementById('exportProgressBar');
            const progressText = document.getElementById('exportProgressText');
            if (progressBar && progressText) {
                progressBar.querySelector('.progress-fill').style.width = percent + '%';
                progressText.textContent = status;
            }
        };

        const hideUI = () => {
            // Set recording mode flags
            this.recordingMode = true;
            this.overlayRecordingMode = includeOverlays;

            // For overlay recording, keep live stats and elevation profile visible
            if (!includeOverlays) {
                // Only hide UI elements for clean recording
                elementsToHideSelectors.forEach(selector => {
                    const elements = document.querySelectorAll(selector);
                    elements.forEach(element => {
                        element.style.display = 'none';
                    });
                });
            } else {
                // For overlay recording, hide most UI but keep stats and elevation visible
                const elementsToHideForOverlay = [
            '.header',
            '.controls-panel',
                    '.progress-controls-container',
            '.annotations-section',
            '.icon-timeline-section',
            '.journey-planning-section',
            '.journey-timeline-container',
            '.language-switcher',
            '#toast-container',
            'footer'
        ];

                elementsToHideForOverlay.forEach(selector => {
                    const elements = document.querySelectorAll(selector);
                    elements.forEach(element => {
                        element.style.display = 'none';
                    });
                });
                
                // Ensure live stats and elevation profile are visible for overlay recording
                const liveStatsOverlay = document.getElementById('liveStatsOverlay');
                const elevationContainer = document.querySelector('.elevation-profile-container');
                
                if (liveStatsOverlay) {
                    liveStatsOverlay.style.display = '';
                    liveStatsOverlay.classList.remove('hidden');
                }
                
                if (elevationContainer) {
                    elevationContainer.style.display = '';
                }
                
                console.log('UI hidden for overlay recording - keeping stats and elevation visible');
            }

            if (progressModal) {
                progressModal.style.visibility = 'hidden';
            }
        };

        const showUI = () => {
            // Reset recording mode flags
            this.recordingMode = false;
            this.overlayRecordingMode = false;
            
            // Restore all hidden UI elements
            elementsToHideSelectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    element.style.display = '';
                });
            });
            
            // Restore the progress modal visibility
            if (progressModal) {
                progressModal.style.visibility = 'visible';
            }
        };

        const enablePerformanceMode = () => {
            this.mapRenderer?.setPerformanceMode?.(true);
        };

        const disablePerformanceMode = () => {
            this.mapRenderer?.setPerformanceMode?.(false);
        };

        const cleanup = () => {
            if (progressModal) {
                progressModal.remove();
            }
            showUI();
            disablePerformanceMode();
            
            // Stop continuous rendering
            this.stopContinuousRendering();
            
            // Disable overlay rendering on map canvas
            if (this.mapRenderer && this.mapRenderer.enableOverlayRendering) {
                this.mapRenderer.enableOverlayRendering(false);
            }
            
            // Restore user's camera settings after video export
            if (userCameraSettings) {
                this.mapRenderer.setAutoZoom(userCameraSettings.autoZoom);
                this.mapRenderer.map.jumpTo({
                    center: userCameraSettings.center,
                    zoom: userCameraSettings.zoom,
                    pitch: userCameraSettings.pitch,
                    bearing: userCameraSettings.bearing
                });
                console.log('Restored user camera settings after video export');
            }
            
            // Restore original animation speed
            if (this.originalAnimationSpeed !== undefined && this.mapRenderer.setAnimationSpeed) {
                this.mapRenderer.setAnimationSpeed(this.originalAnimationSpeed);
                this.originalAnimationSpeed = undefined;
            }
            
            // Restore live stats state
            if (this.originalLiveStatsState !== undefined) {
                this.toggleLiveStats(this.originalLiveStatsState);
                this.originalLiveStatsState = undefined;
            }
        };

        try {
            // Show enhanced progress modal
            progressModal = createProgressModal();
            updateProgress(0, t('messages.exportVideoPrepare'));
            
            // Step 0: Preserve user's camera settings
            userCameraSettings = {
                zoom: this.mapRenderer.map.getZoom(),
                center: this.mapRenderer.map.getCenter(),
                pitch: this.mapRenderer.map.getPitch(),
                bearing: this.mapRenderer.map.getBearing(),
                autoZoom: this.mapRenderer.autoZoom
            };
            console.log('Preserved user camera settings for video export:', userCameraSettings);
            
            // Step 1: Reset animation and hide UI (but preserve camera position)
            this.resetAnimation();
            
            // Restore user's camera orientation settings, but handle center differently based on autofollow
            if (userCameraSettings.autoZoom) {
                // When autofollow is enabled: preserve zoom, pitch, bearing but let center follow the animation
                this.mapRenderer.map.jumpTo({
                    zoom: userCameraSettings.zoom,
                    pitch: userCameraSettings.pitch,
                    bearing: userCameraSettings.bearing
                    // Don't set center - let autofollow move the camera during animation
                });
                console.log('Video export: Autofollow enabled - camera will follow animation at user zoom/orientation');
            } else {
                // When autofollow is disabled: preserve exact camera position (fixed view)
                this.mapRenderer.map.jumpTo({
                    center: userCameraSettings.center,
                    zoom: userCameraSettings.zoom,
                    pitch: userCameraSettings.pitch,
                    bearing: userCameraSettings.bearing
                });
                console.log('Video export: Fixed camera view - preserving exact position');
            }
            
            hideUI();
            await new Promise(resolve => setTimeout(resolve, 300));
            updateProgress(10, 'UI hidden, preserving user camera settings...');

            // Step 2: Enable performance mode and optimize for recording
            enablePerformanceMode();
            this.mapRenderer.optimizeForRecording();
            updateProgress(15, 'Performance mode enabled...');

            // Step 3: Enhanced tile preloading
            updateProgress(20, 'Preloading map tiles...');
            await this.enhancedTilePreloading((progress) => {
                updateProgress(20 + (progress * 30), `Loading tiles... ${progress.toFixed(0)}%`);
            });
            
            // Step 3.5: Aggressive MapRenderer tile preloading for video smoothness
            updateProgress(50, 'Aggressive tile preloading for video...');
            if (this.mapRenderer.aggressiveTilePreload) {
                const routeCoordinates = this.currentTrackData.coordinates || this.currentTrackData.trackPoints;
                await this.mapRenderer.aggressiveTilePreload(routeCoordinates, (progress) => {
                    updateProgress(50 + (progress * 0.15), `Optimizing tiles... ${progress.toFixed(0)}%`);
                });
            }
            
            // Step 4: Wait for tiles to load with enhanced progress feedback
            updateProgress(65, 'Waiting for all tiles to load...');
            if (this.mapRenderer.waitForTilesWithProgress) {
                await this.mapRenderer.waitForTilesWithProgress(8000, (progress) => {
                    updateProgress(65 + (progress * 0.10), `Finalizing tiles... ${progress.toFixed(0)}%`);
                });
            } else {
                await this.waitForMapTilesToLoadWithTimeout(8000);
            }
            
            // Step 5: Final preparations
            updateProgress(70, 'Starting video capture...');

            // Debug: Check canvas state
            console.log('Canvas debugging info:');
            console.log('- Canvas element:', mapElement);
            console.log('- Canvas dimensions:', mapElement.width, 'x', mapElement.height);
            console.log('- Canvas style dimensions:', mapElement.style.width, 'x', mapElement.style.height);
            
            // Check WebGL context instead of 2D context (MapLibre uses WebGL)
            const gl = mapElement.getContext('webgl') || mapElement.getContext('experimental-webgl');
            if (!gl) {
                console.warn('⚠️ Could not get WebGL context - this is normal when MapLibre is using it');
            } else {
                console.log('- WebGL context available:', !!gl);
            }
            console.log('- Canvas context type: WebGL');
            
            // Check if map has rendered content by checking if map is loaded
            const mapLoaded = this.mapRenderer.map.loaded();
            console.log('- Map loaded status:', mapLoaded);
            
            // Disable map loading check - proceed with export regardless
            // if (!mapLoaded) {
            //     console.warn('⚠️ Map not fully loaded - forcing map load wait');
            //     await this.waitForMapLoad();
            //     console.log('- Map loaded after wait');
            // }
            console.log('- Skipping map load check - proceeding with export');
            
            // Check for canvas taint (CORS issues)
            try {
                // This will throw if canvas is tainted
                // ctx.getImageData(0, 0, 1, 1); // Skip CORS check for WebGL canvas
                console.log('✅ Skipping CORS check for WebGL canvas');
            } catch (e) {
                console.error('❌ Canvas is tainted (CORS issue):', e.message);
                throw new Error('Canvas is tainted by cross-origin content. Video export not possible.');
            }

            // Create video stream - both modes now use canvas capture
            let stream;
            let compositeCanvas;
            
            // Force map to render with preserveDrawingBuffer for video capture
            const forceMapRender = () => {
                this.mapRenderer.map.triggerRepaint();
                // Wait for repaint to complete
                return new Promise(resolve => {
                    this.mapRenderer.map.once('render', () => {
                        setTimeout(resolve, 100); // Additional delay for stability
                    });
                });
            };
            
            await forceMapRender();
            
            if (includeOverlays) {
                // For overlay capture, use CropTarget API for region capture
                updateProgress(72, 'Setting up region capture for overlays...');
                
                if (useCropTarget) {
                    // Check CropTarget support following the recipe
                    const supportsRegionCapture = 
                        'CropTarget' in window &&
                        'cropTo' in VideoTrack.prototype;   // Chrome 115+, Edge 115+
                    
                    if (!supportsRegionCapture) {
                        console.warn('Element cropping not supported; falling back to canvas overlay rendering.');
                        this.mapRenderer.enableOverlayRendering(true);
                        stream = mapElement.captureStream(30);
                        updateProgress(75, 'Canvas overlay rendering ready - will render overlays on map...');
                    } else {
                        try {
                            console.log('Using CropTarget API for HTML overlay capture...');
                            
                            // 1️⃣ Ask Chrome to capture "this" tab (user sees a prompt)
                            stream = await navigator.mediaDevices.getDisplayMedia({
                                video: { 
                                    displaySurface: 'browser', 
                                    preferCurrentTab: true,
                                    width: { ideal: 1920 },
                                    height: { ideal: 1080 },
                                    frameRate: { ideal: 30, max: 60 }
                                },
                                audio: false
                            });
                            
                            // 2️⃣ Tell the single video track to crop to videoCaptureContainer
                            const [track] = stream.getVideoTracks();
                            if (track.cropTo) {
                                const elem = document.getElementById('videoCaptureContainer');
                                if (!elem) {
                                    throw new Error('Video capture container not found');
                                }
                                const target = await CropTarget.fromElement(elem);
                                await track.cropTo(target);    // 🚀 region capture!
                                console.log('✅ CropTarget region capture enabled');
                                updateProgress(75, 'CropTarget region capture ready...');
                            } else {
                                throw new Error('Track does not support cropTo');
                            }
                            
                        } catch (error) {
                            console.warn('CropTarget failed, falling back to canvas overlay rendering:', error);
                            if (stream) {
                                stream.getTracks().forEach(track => track.stop());
                            }
                            this.mapRenderer.enableOverlayRendering(true);
                            stream = mapElement.captureStream(30);
                            updateProgress(75, 'Canvas overlay rendering ready - will render overlays on map...');
                        }
                    }
                } else {
                    // Auto-webm mode: use canvas overlay rendering
                    console.log('Using canvas overlay rendering for WebM mode');
                    this.mapRenderer.enableOverlayRendering(true);
                    stream = mapElement.captureStream(30);
                    updateProgress(75, 'Canvas overlay rendering ready - will render overlays on map...');
                }
            } else {
                // For clean capture, use the map canvas directly
                updateProgress(72, 'Setting up clean map capture...');
                
                // mapElement is already the canvas element from getCanvas()
                if (!mapElement) {
                    throw new Error('Map canvas not found');
                }
                
                console.log('Using map canvas directly:', mapElement.width, 'x', mapElement.height);
                
                // Check if canvas can be captured
                try {
                    // Test if canvas supports capture
                    if (typeof mapElement.captureStream !== 'function') {
                        throw new Error('Canvas captureStream not supported');
                    }
                    
                    // Create stream at 30fps
                    stream = mapElement.captureStream(30);
                    console.log('Map canvas stream created successfully');
                    
                    // Force an immediate frame to initialize the stream
                    const tempCtx = mapElement.getContext('2d', { willReadFrequently: true });
                    if (tempCtx) {
                        // This creates an initial frame
                        tempCtx.fillStyle = 'transparent';
                        tempCtx.fillRect(0, 0, 1, 1);
                        tempCtx.clearRect(0, 0, 1, 1);
                    }
                    
                } catch (error) {
                    console.error('Failed to create map canvas stream:', error);
                    throw new Error('Could not create map canvas stream: ' + error.message);
                }
                
                updateProgress(75, 'Clean map capture ready...');
            }
            
            // Debug stream
            console.log('Stream created:', stream);
            console.log('Stream tracks:', stream.getTracks());
            if (stream.getVideoTracks().length > 0) {
                console.log('Video track settings:', stream.getVideoTracks()[0]?.getSettings());
                
                // Test if stream is producing frames
                const videoTrack = stream.getVideoTracks()[0];
                console.log('Video track state:', videoTrack.readyState);
                console.log('Video track enabled:', videoTrack.enabled);
            } else {
                throw new Error('No video track in stream');
            }

                        // 3️⃣ Set up MediaRecorder with proper format detection based on export mode
            let mime;
            
            if (mode === 'auto-crop') {
                // MP4 mode - prefer MP4, fallback to WebM
                if (MediaRecorder.isTypeSupported('video/mp4')) {
                    mime = 'video/mp4';                         // Chrome 126+, Safari 17+
                } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
                    mime = 'video/webm;codecs=vp9';             // Chrome WebM VP9
                } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
                    mime = 'video/webm;codecs=vp8';             // Firefox WebM VP8
                } else {
                    mime = 'video/webm';                        // Basic WebM fallback
                }
            } else {
                // WebM mode - prefer WebM, fallback to MP4
                if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
                    mime = 'video/webm;codecs=vp9';             // Chrome WebM VP9
                } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
                    mime = 'video/webm;codecs=vp8';             // Firefox WebM VP8
                } else if (MediaRecorder.isTypeSupported('video/webm')) {
                    mime = 'video/webm';                        // Basic WebM
                } else if (MediaRecorder.isTypeSupported('video/mp4')) {
                    mime = 'video/mp4';                         // MP4 fallback
                } else {
                    mime = 'video/webm';                        // Last resort
                }
            }
                         
            const options = { 
                mimeType: mime,
                bitsPerSecond: 4000000  // 4 Mbps for good quality
            };
            
            const fileExtension = mime.includes('mp4') ? 'mp4' : 'webm';
            
            console.log('Selected MediaRecorder format:', mime);
            console.log('File extension will be:', fileExtension);
            
            console.log('MediaRecorder options:', options);
            console.log('MediaRecorder supported types check:');
            console.log('- video/webm: ', MediaRecorder.isTypeSupported('video/webm'));
            console.log('- video/webm;codecs=vp9: ', MediaRecorder.isTypeSupported('video/webm;codecs=vp9'));
            console.log('- video/webm;codecs=vp8: ', MediaRecorder.isTypeSupported('video/webm;codecs=vp8'));

            // 4️⃣ Record the stream (following the recipe pattern)
            mediaRecorder = new MediaRecorder(stream, options);
            console.log('MediaRecorder created with state:', mediaRecorder.state);

            const chunks = [];
            mediaRecorder.ondataavailable = e => {
                console.log('MediaRecorder data available:', e.data.size, 'bytes');
                chunks.push(e.data);
            };
            
            mediaRecorder.onstop = () => {
                console.log('MediaRecorder stopped. Total chunks:', chunks.length);
                
                updateProgress(95, 'Processing video file...');
                
                if (chunks.length === 0) {
                    console.error('No data chunks recorded!');
                    this.showMessage('No video data was recorded. Please try again.', 'error');
                    cleanup();
                    return;
                }
                
                // Create blob following the recipe
                const blob = new Blob(chunks, { type: mime });
                
                console.log('Final video blob size:', blob.size, 'bytes');
                console.log('Final video blob type:', blob.type);
                
                if (blob.size === 0) {
                    console.error('Generated video blob has 0 bytes!');
                    this.showMessage('Generated video is empty. Please try again.', 'error');
                    cleanup();
                    return;
                }
                
                // Download following the recipe pattern
                const url = URL.createObjectURL(blob);
                const a = Object.assign(document.createElement('a'), { 
                    href: url, 
                    download: `trail-replay-animation.${fileExtension}` 
                });
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 10000);
                
                updateProgress(100, 'Video export complete!');
                setTimeout(() => {
                    this.showMessage(t('messages.exportComplete'), 'success');
                    cleanup();
                }, 1000);
            };

            mediaRecorder.onerror = (event) => {
                console.error('MediaRecorder error:', event.error);
                this.showMessage(`Export error: ${event.error.name}`, 'error');
                cleanup();
                if (stream) {
                    stream.getTracks().forEach(track => track.stop());
                }
            };

            // Start recording
            updateProgress(75, 'Recording animation...');
            console.log('Starting MediaRecorder...');
            
            // Test that we can capture from the stream before starting MediaRecorder
            try {
                // Force a frame to be available in the stream
                if (includeOverlays && compositeCanvas) {
                    // For composite, we need to render at least one frame
                    const ctx = compositeCanvas.getContext('2d');
                    ctx.drawImage(mapElement, 0, 0);
                    console.log('Forced initial composite frame');
                } else {
                    // For direct canvas capture, trigger a repaint
                    this.mapRenderer.map.triggerRepaint();
                    await new Promise(resolve => setTimeout(resolve, 100));
                    console.log('Triggered map repaint for initial frame');
                }
                
                // Test stream properties
                const videoTrack = stream.getVideoTracks()[0];
                if (!videoTrack) {
                    throw new Error('No video track found in stream');
                }
                
                console.log('Pre-recording stream validation:');
                console.log('- Video track state:', videoTrack.readyState);
                console.log('- Video track enabled:', videoTrack.enabled);
                console.log('- Video track muted:', videoTrack.muted);
                console.log('- Stream active:', stream.active);
                
                if (videoTrack.readyState !== 'live') {
                    console.warn('Video track is not live, attempting to start it');
                    // Try to get the track to go live
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
                
            } catch (streamError) {
                console.error('Stream validation failed:', streamError);
                throw new Error('Stream is not ready for recording: ' + streamError.message);
            }
            
            mediaRecorder.start(1000); // Request data every second for debugging
            console.log('MediaRecorder started with state:', mediaRecorder.state);
            
            // Enhanced stream monitoring
            setTimeout(() => {
                console.log('Stream status after 1s:');
                const videoTrack = stream.getVideoTracks()[0];
                if (videoTrack) {
                    console.log('- Video track state:', videoTrack.readyState);
                    console.log('- Video track enabled:', videoTrack.enabled);
                    console.log('- Video track muted:', videoTrack.muted);
                }
                console.log('- MediaRecorder state:', mediaRecorder.state);
                console.log('- Recorded chunks so far:', recordedChunks.length);
                
                // If still no chunks after 1 second, there's likely an issue
                if (recordedChunks.length === 0 && mediaRecorder.state === 'recording') {
                    console.warn('⚠️ No data chunks received after 1 second - this may indicate a capture issue');
                    console.log('This could be due to:');
                    console.log('- preserveDrawingBuffer not enabled');
                    console.log('- Canvas not actively rendering');
                    console.log('- Browser compatibility issues');
                }
            }, 1000);
            
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

            // Step 6: Setup recording
            updateProgress(80, 'Setting up video recording...');
            
            // Force continuous rendering to ensure frames are captured
            this.startContinuousRendering();

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

    // Render overlay elements (live stats, elevation profile) to canvas for video export
    async renderOverlaysToCanvas(ctx, canvasWidth, canvasHeight) {
        try {
            // Render live stats overlay
            const liveStatsOverlay = document.getElementById('liveStatsOverlay');
            if (liveStatsOverlay && !liveStatsOverlay.classList.contains('hidden')) {
                await this.renderElementToCanvas(ctx, liveStatsOverlay, canvasWidth, canvasHeight);
            }

            // Render elevation profile
            const elevationProfileContainer = document.querySelector('.elevation-profile-container');
            if (elevationProfileContainer && elevationProfileContainer.style.display !== 'none') {
                await this.renderElementToCanvas(ctx, elevationProfileContainer, canvasWidth, canvasHeight);
            }

        } catch (error) {
            console.warn('Error rendering overlays to canvas:', error);
        }
    }

    // Helper function to render a DOM element to canvas
    async renderElementToCanvas(ctx, element, canvasWidth, canvasHeight) {
        try {
            const rect = element.getBoundingClientRect();
            const mapContainer = document.querySelector('.map-container');
            const mapRect = mapContainer.getBoundingClientRect();
        
            // Calculate relative position within the map container
            const relativeX = rect.left - mapRect.left;
            const relativeY = rect.top - mapRect.top;

            // Ensure the element is within the map bounds
            if (relativeX < 0 || relativeY < 0 || relativeX > mapRect.width || relativeY > mapRect.height) {
                return;
            }

            // Get computed styles
            const styles = window.getComputedStyle(element);
            
            // Draw background
            if (styles.backgroundColor && styles.backgroundColor !== 'rgba(0, 0, 0, 0)') {
                ctx.fillStyle = styles.backgroundColor;
                ctx.fillRect(relativeX, relativeY, rect.width, rect.height);
            }

            // Draw border
            if (styles.border && styles.border !== 'none') {
                ctx.strokeStyle = styles.borderColor || '#000';
                ctx.lineWidth = parseInt(styles.borderWidth) || 1;
                ctx.strokeRect(relativeX, relativeY, rect.width, rect.height);
        }
        
            // Draw text content
            const textContent = element.textContent || element.innerText;
            if (textContent) {
                ctx.fillStyle = styles.color || '#000';
                ctx.font = `${styles.fontSize || '14px'} ${styles.fontFamily || 'Arial'}`;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'top';

                // Handle multi-line text
                const lines = this.wrapText(ctx, textContent, rect.width - 20);
                let lineHeight = parseInt(styles.lineHeight) || parseInt(styles.fontSize) * 1.2 || 16;
                
                lines.forEach((line, index) => {
                    ctx.fillText(line, relativeX + 10, relativeY + 10 + (index * lineHeight));
                });
            }

            // Handle child elements for complex layouts (like elevation profile)
            if (element.classList.contains('elevation-profile-container')) {
                await this.renderElevationProfileToCanvas(ctx, element, relativeX, relativeY, rect.width, rect.height);
            }

        } catch (error) {
            console.warn('Error rendering element to canvas:', error);
        }
    }

    // Specialized rendering for elevation profile
    async renderElevationProfileToCanvas(ctx, container, x, y, width, height) {
        try {
            // Find the SVG or canvas element within the elevation profile
            const svgElement = container.querySelector('svg');
            const canvasElement = container.querySelector('canvas');
            
            if (svgElement) {
                // Convert SVG to image and draw it
                const svgData = new XMLSerializer().serializeToString(svgElement);
                const svgBlob = new Blob([svgData], { type: 'image/svg+xml' });
                const svgUrl = URL.createObjectURL(svgBlob);
                
                const img = new Image();
                img.onload = () => {
                    ctx.drawImage(img, x, y, width, height);
                    URL.revokeObjectURL(svgUrl);
                };
                img.src = svgUrl;
                
                // Wait for image to load
                await new Promise(resolve => {
                    img.onload = () => {
                        ctx.drawImage(img, x, y, width, height);
                        URL.revokeObjectURL(svgUrl);
                        resolve();
                    };
                });
                
            } else if (canvasElement) {
                // Draw canvas directly
                ctx.drawImage(canvasElement, x, y, width, height);
            }
        } catch (error) {
            console.warn('Error rendering elevation profile to canvas:', error);
        }
    }

    // Helper function to wrap text within a given width
    wrapText(ctx, text, maxWidth) {
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';

        words.forEach(word => {
            const testLine = currentLine + word + ' ';
            const metrics = ctx.measureText(testLine);
            const testWidth = metrics.width;

            if (testWidth > maxWidth && currentLine !== '') {
                lines.push(currentLine);
                currentLine = word + ' ';
            } else {
                currentLine = testLine;
            }
        });

        lines.push(currentLine);
        return lines;
    }

    // Simple tile preloading for video export at user's chosen zoom level
    async enhancedTilePreloading(progressCallback) {
        if (!this.mapRenderer || !this.currentTrackData) return;
        
        const trackPoints = this.currentTrackData.trackPoints;
        
        if (!trackPoints || trackPoints.length === 0) return;
        
        console.log('Starting simple tile preloading at user zoom level:', this.mapRenderer.map.getZoom().toFixed(1));
        
        // Use the efficient route-based preloading from mapRenderer
        if (this.mapRenderer.aggressiveTilePreload) {
            await this.mapRenderer.aggressiveTilePreload(trackPoints, progressCallback);
        }
        
        console.log('Simple tile preloading completed');
    }
    
    // Preload tiles along the route corridor for smoother animation
    async preloadRouteCorridorTiles(trackPoints, baseZoom, progressCallback) {
        if (!this.mapRenderer || trackPoints.length < 10) return;
        
        const map = this.mapRenderer.map;
        console.log('Preloading route corridor tiles for smooth animation');
        
        // Create a buffer corridor around the route
        const corridorPoints = this.generateRouteCorridorPoints(trackPoints);
        
        // Set to animation zoom level
        map.setZoom(baseZoom);
        
        // Quick pass through corridor points
        for (let i = 0; i < corridorPoints.length; i++) {
            const point = corridorPoints[i];
            map.setCenter([point.lon, point.lat]);
            map.triggerRepaint();
            
            // Faster timing for corridor preloading
            await new Promise(resolve => setTimeout(resolve, 60));
            
            if (i % 8 === 0 && progressCallback) {
                const progress = 85 + ((i / corridorPoints.length) * 10); // 85-95% range
                progressCallback(progress);
            }
        }
        
        console.log('Route corridor tile preloading completed');
    }
    
    // Generate points along a corridor around the route
    generateRouteCorridorPoints(trackPoints) {
        const corridorPoints = [];
        const corridorWidth = 0.002; // Degrees offset (roughly 200m)
        
        for (let i = 0; i < trackPoints.length; i += Math.max(1, Math.floor(trackPoints.length / 25))) {
            const point = trackPoints[i];
            
            // Add the main route point
            corridorPoints.push(point);
            
            // Add offset points to create a corridor
            if (i < trackPoints.length - 1) {
                const nextPoint = trackPoints[i + 1];
                const bearing = this.calculateBearing(point, nextPoint);
                
                // Add perpendicular offset points
                const leftOffset = this.offsetPoint(point, bearing + 90, corridorWidth);
                const rightOffset = this.offsetPoint(point, bearing - 90, corridorWidth);
                
                corridorPoints.push(leftOffset);
                corridorPoints.push(rightOffset);
            }
        }
        
        return corridorPoints;
    }
    
    // Calculate bearing between two points
    calculateBearing(point1, point2) {
        const dLon = (point2.lon - point1.lon) * Math.PI / 180;
        const lat1 = point1.lat * Math.PI / 180;
        const lat2 = point2.lat * Math.PI / 180;
        
        const y = Math.sin(dLon) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
        
        const bearing = Math.atan2(y, x) * 180 / Math.PI;
        return (bearing + 360) % 360; // Normalize to 0-360
    }
    
    // Offset a point by distance in a given bearing
    offsetPoint(point, bearing, distance) {
        const lat1 = point.lat * Math.PI / 180;
        const lon1 = point.lon * Math.PI / 180;
        const bearingRad = bearing * Math.PI / 180;
        
        const lat2 = lat1 + (distance * Math.cos(bearingRad));
        const lon2 = lon1 + (distance * Math.sin(bearingRad) / Math.cos(lat1));
        
        return {
            lat: lat2 * 180 / Math.PI,
            lon: lon2 * 180 / Math.PI
        };
    }

    // Enhanced strategic sample points with better coverage patterns
    calculateEnhancedStrategicSamplePoints(trackPoints, routeDistance) {
        const samplePoints = [];
        
        // Always include start and end as critical points
        samplePoints.push({ ...trackPoints[0], critical: true });
        if (trackPoints.length > 1) {
            samplePoints.push({ ...trackPoints[trackPoints.length - 1], critical: true });
        }
        
        // More aggressive sampling based on route characteristics
        let primarySampleRate, secondarySampleRate;
        if (routeDistance < 5) {
            primarySampleRate = Math.max(1, Math.floor(trackPoints.length / 25)); // Much higher density
            secondarySampleRate = Math.max(1, Math.floor(trackPoints.length / 40));
        } else if (routeDistance > 50) {
            primarySampleRate = Math.max(1, Math.floor(trackPoints.length / 12));
            secondarySampleRate = Math.max(1, Math.floor(trackPoints.length / 20));
        } else {
            primarySampleRate = Math.max(1, Math.floor(trackPoints.length / 18));
            secondarySampleRate = Math.max(1, Math.floor(trackPoints.length / 30));
        }
        
        // Primary sampling - main route coverage
        for (let i = primarySampleRate; i < trackPoints.length - primarySampleRate; i += primarySampleRate) {
            samplePoints.push({ ...trackPoints[i], critical: false });
        }
        
        // Secondary sampling - fill gaps for smoother animation
        for (let i = secondarySampleRate; i < trackPoints.length - secondarySampleRate; i += secondarySampleRate) {
            samplePoints.push({ ...trackPoints[i], critical: false });
        }
        
        // Add direction change points (turns and curves)
        const directionChangePoints = this.findDirectionChangePoints(trackPoints);
        directionChangePoints.forEach(point => {
            samplePoints.push({ ...point, critical: true });
        });
        
        // Add elevation change points (peaks and valleys) - enhanced version
        const elevationPoints = this.findEnhancedElevationChangePoints(trackPoints);
        elevationPoints.forEach(point => {
            samplePoints.push({ ...point, critical: true });
        });
        
        // Add intermediate points for very long segments
        const segmentPoints = this.addIntermediateSegmentPoints(trackPoints);
        segmentPoints.forEach(point => {
            samplePoints.push({ ...point, critical: false });
        });
        
        // Remove duplicates and sort by route progression
        const uniquePoints = this.deduplicateAndSortPoints(samplePoints, trackPoints);
        
        console.log(`Generated ${uniquePoints.length} strategic sample points for enhanced tile preloading`);
        return uniquePoints;
    }
    
    // Find points where the route changes direction significantly
    findDirectionChangePoints(trackPoints) {
        const directionPoints = [];
        const minAngleChange = 30; // Minimum angle change in degrees
        
        if (trackPoints.length < 5) return directionPoints;
        
        for (let i = 2; i < trackPoints.length - 2; i++) {
            const prevPoint = trackPoints[i - 2];
            const currentPoint = trackPoints[i];
            const nextPoint = trackPoints[i + 2];
            
            const bearing1 = this.calculateBearing(prevPoint, currentPoint);
            const bearing2 = this.calculateBearing(currentPoint, nextPoint);
            
            let angleDiff = Math.abs(bearing2 - bearing1);
            if (angleDiff > 180) {
                angleDiff = 360 - angleDiff;
            }
            
            if (angleDiff > minAngleChange) {
                directionPoints.push(trackPoints[i]);
            }
        }
        
        return directionPoints;
    }
    
    // Enhanced elevation change detection
    findEnhancedElevationChangePoints(trackPoints) {
        const elevationPoints = [];
        const elevations = trackPoints.map(p => p.elevation || 0);
        
        if (elevations.length < 10) return elevationPoints;
        
        const minElevation = Math.min(...elevations);
        const maxElevation = Math.max(...elevations);
        const elevationRange = maxElevation - minElevation;
        
        // Lower threshold for more sensitivity
        if (elevationRange < 25) return elevationPoints;
        
        const significantChange = elevationRange * 0.1; // 10% of total range
        
        // Find peaks, valleys, and significant elevation changes
        for (let i = 5; i < trackPoints.length - 5; i++) {
            const current = elevations[i];
            const window = 5;
            const before = elevations.slice(i - window, i);
            const after = elevations.slice(i + 1, i + window + 1);
            
            const avgBefore = before.reduce((a, b) => a + b, 0) / before.length;
            const avgAfter = after.reduce((a, b) => a + b, 0) / after.length;
            
            const isLocalMax = before.every(e => e <= current) && after.every(e => e <= current);
            const isLocalMin = before.every(e => e >= current) && after.every(e => e >= current);
            const isSignificantChange = Math.abs(current - avgBefore) > significantChange || 
                                       Math.abs(current - avgAfter) > significantChange;
            
            if (isLocalMax || isLocalMin || isSignificantChange) {
                elevationPoints.push(trackPoints[i]);
            }
        }
        
        return elevationPoints;
    }
    
    // Add intermediate points for long segments to ensure coverage
    addIntermediateSegmentPoints(trackPoints) {
        const intermediatePoints = [];
        const maxSegmentLength = 0.01; // degrees (roughly 1km)
        
        for (let i = 0; i < trackPoints.length - 1; i++) {
            const point1 = trackPoints[i];
            const point2 = trackPoints[i + 1];
            
            const distance = Math.sqrt(
                Math.pow(point2.lat - point1.lat, 2) + 
                Math.pow(point2.lon - point1.lon, 2)
            );
            
            if (distance > maxSegmentLength) {
                // Add intermediate points
                const numIntermediate = Math.ceil(distance / maxSegmentLength) - 1;
                for (let j = 1; j <= numIntermediate; j++) {
                    const ratio = j / (numIntermediate + 1);
                    const intermediatePoint = {
                        lat: point1.lat + (point2.lat - point1.lat) * ratio,
                        lon: point1.lon + (point2.lon - point1.lon) * ratio,
                        elevation: point1.elevation + (point2.elevation - point1.elevation) * ratio
                    };
                    intermediatePoints.push(intermediatePoint);
                }
            }
        }
        
        return intermediatePoints;
    }
    
    // Deduplicate and sort points by route progression
    deduplicateAndSortPoints(samplePoints, trackPoints) {
        const uniquePoints = [];
        const tolerance = 0.0001; // Coordinate tolerance for duplicates
        
        // Create a map of original track points for sorting
        const trackPointMap = new Map();
        trackPoints.forEach((point, index) => {
            const key = `${point.lat.toFixed(6)},${point.lon.toFixed(6)}`;
            trackPointMap.set(key, index);
        });
        
        // Deduplicate sample points
        const seenKeys = new Set();
        samplePoints.forEach(point => {
            const key = `${point.lat.toFixed(6)},${point.lon.toFixed(6)}`;
            if (!seenKeys.has(key)) {
                seenKeys.add(key);
                uniquePoints.push({
                    ...point,
                    originalIndex: trackPointMap.get(key) || -1
                });
            }
        });
        
        // Sort by original route progression
        uniquePoints.sort((a, b) => {
            if (a.originalIndex !== -1 && b.originalIndex !== -1) {
                return a.originalIndex - b.originalIndex;
            }
            // Fallback to distance from start for interpolated points
            const start = trackPoints[0];
            const distA = Math.sqrt(Math.pow(a.lat - start.lat, 2) + Math.pow(a.lon - start.lon, 2));
            const distB = Math.sqrt(Math.pow(b.lat - start.lat, 2) + Math.pow(b.lon - start.lon, 2));
            return distA - distB;
        });
        
        return uniquePoints;
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
        console.log('Preparing system for optimal video recording performance...');
        
        // Memory cleanup
        if (window.gc) {
            window.gc(); // Force garbage collection if available
        }
        
        // Clear any unnecessary caches
        this.clearElevationProfileCache();
        
        // Disable auto-refresh features during recording
        this.recordingMode = true;
        
        // Optimize map for recording
        if (this.mapRenderer) {
            this.mapRenderer.optimizeForRecording();
            
            // Set performance mode to reduce map update frequency
            this.mapRenderer.setPerformanceMode(true);
            
            // Preload additional tiles at current position with smaller area
            const currentZoom = this.mapRenderer.map.getZoom();
            const routeCoordinates = this.currentTrackData.coordinates || this.currentTrackData.trackPoints;
            
            if (routeCoordinates && routeCoordinates.length > 0) {
                // Quick corridor preload at recording zoom level
                const corridorPoints = this.generateRouteCorridorPoints(routeCoordinates.slice(0, Math.min(50, routeCoordinates.length)));
                for (let i = 0; i < corridorPoints.length; i += 3) { // Every 3rd point for speed
                    const point = corridorPoints[i];
                    this.mapRenderer.map.setCenter([point.lon, point.lat]);
                    this.mapRenderer.map.triggerRepaint();
                    await new Promise(resolve => setTimeout(resolve, 20)); // Very quick
                }
                
                // Return to start position
                this.mapRenderer.map.setCenter([routeCoordinates[0].lon || routeCoordinates[0][0], 
                                               routeCoordinates[0].lat || routeCoordinates[0][1]]);
            }
        }
        
        // Reduce animation frame rate slightly for smoother recording
        if (this.mapRenderer.setAnimationSpeed) {
            this.originalAnimationSpeed = this.mapRenderer.animationSpeed || 1;
            this.mapRenderer.setAnimationSpeed(0.9); // Slightly slower for stability
        }
        
        // For clean recording, disable live stats. For overlay recording, keep them enabled
        this.originalLiveStatsState = !document.getElementById('liveStatsOverlay').classList.contains('hidden');
        // Don't disable live stats here - it will be handled in the hideUI function based on recording mode
        
        // Final stability wait
        await new Promise(resolve => setTimeout(resolve, 300));
        
        console.log('System optimally prepared for video recording');
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
            
            // Normal seeking - set the animation progress first
            this.mapRenderer.setAnimationProgress(progress);
            
            // For journeys, synchronize the segment timing with error handling
            if (this.currentTrackData.isJourney && this.currentTrackData.segmentTiming) {
                try {
                    const segmentTime = this.convertLinearProgressToSegmentTime(progress);
                    if (this.mapRenderer.setJourneyElapsedTime && segmentTime !== null && !isNaN(segmentTime)) {
                        this.mapRenderer.setJourneyElapsedTime(segmentTime);
                        console.log(`Journey seeking: progress ${progress.toFixed(3)} → time ${segmentTime.toFixed(1)}s`);
                    } else {
                        // Fallback: use proportional time mapping
                        const totalDuration = this.currentTrackData.segmentTiming.totalDuration || this.totalAnimationTime;
                        const fallbackTime = progress * totalDuration;
                        if (this.mapRenderer.setJourneyElapsedTime) {
                            this.mapRenderer.setJourneyElapsedTime(fallbackTime);
                            console.log(`Journey seeking fallback: progress ${progress.toFixed(3)} → time ${fallbackTime.toFixed(1)}s`);
                        }
                    }
                } catch (error) {
                    console.warn('Error during journey seeking, using simple progress:', error);
                    // Continue with simple progress-based seeking
                }
            }
            
            // Update the current position to match the new progress
            this.mapRenderer.updateCurrentPosition();
            
            // Update progress display
            this.updateProgressDisplay();
            
            // Update timeline progress indicator if available
            if (this.currentTrackData.isJourney) {
                this.updateTimelineProgressIndicator(progress);
            }
            
            // Auto-center view on new position if enabled
            if (this.currentTrackData && this.currentTrackData.trackPoints) {
                const currentPoint = this.mapRenderer.gpxParser.getInterpolatedPoint(progress);
                if (currentPoint && this.mapRenderer.map) {
                    this.mapRenderer.map.easeTo({
                        center: [currentPoint.lon, currentPoint.lat],
                        duration: 300
                    });
                }
            }
            
            console.log('Seek completed to progress:', progress.toFixed(3));
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
                // Use a longer delay to ensure seek is fully complete
                setTimeout(() => {
                    if (!this.isPlaying) { // Double-check we're still not playing
                        this.togglePlayback();
                    }
                }, 150);
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
                // Use a longer delay to ensure seek is fully complete
                setTimeout(() => {
                    if (!this.isPlaying) { // Double-check we're still not playing
                        this.togglePlayback();
                    }
                }, 150);
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
        
        // Add keyboard shortcut for debugging synchronization (Ctrl+Shift+D)
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'D') {
                e.preventDefault();
                if (this.currentTrackData && this.currentTrackData.isJourney) {
                    console.log('🔧 Manual synchronization validation triggered...');
                    this.validateJourneySynchronization();
                } else {
                    console.log('❌ No journey loaded - synchronization validation requires a multi-track journey');
                }
            }
            
            // Add keyboard shortcut for forcing synchronization (Ctrl+Shift+F)
            if (e.ctrlKey && e.shiftKey && e.key === 'F') {
                e.preventDefault();
                if (this.currentTrackData && this.currentTrackData.isJourney) {
                    console.log('🔧 Manual synchronization fix triggered...');
                    this.forceSynchronization();
                } else {
                    console.log('❌ No journey loaded - synchronization fix requires a multi-track journey');
                }
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
                
                // Seek to the position using enhanced synchronization
                this.mapRenderer.setAnimationProgress(progress);
                
                // For journeys, also synchronize the segment timing
                if (this.currentTrackData.isJourney && this.currentTrackData.segmentTiming) {
                    const segmentTime = this.convertLinearProgressToSegmentTime(progress);
                    if (this.mapRenderer.setJourneyElapsedTime && segmentTime !== null) {
                        this.mapRenderer.setJourneyElapsedTime(segmentTime);
                        console.log(`Timeline seeking: linear progress ${progress.toFixed(3)} → segment time ${segmentTime.toFixed(1)}s`);
                    }
                }
                
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
            // Store the original journey data
            this.journeyData = journeyData;
            
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
                <div class="camera-info-section">
                    <button class="camera-info-button" id="cameraInfoButton">
                        <span class="camera-info-text">📹 ${t('cameraInfo.title')}</span>
                        <div class="camera-info-tooltip" id="cameraInfoTooltip">
                            <div class="camera-info-content">
                                ${this.getCameraControlsContent()}
                            </div>
                        </div>
                    </button>
                </div>
            </div>
        `;
        timingPanel.style.display = 'block';
        
        // Create or update separate export panel
        this.createExportPanel();
    }

    createExportPanel() {
        // Check if export panel already exists
        let exportPanel = document.getElementById('exportPanel');
        if (!exportPanel) {
            // Create new export panel
            exportPanel = document.createElement('div');
            exportPanel.id = 'exportPanel';
            exportPanel.className = 'journey-timing-panel'; // Use same styling as timing panel
            
            // Insert after the timing panel
            const timingPanel = document.getElementById('journeyTimingPanel');
            if (timingPanel && timingPanel.parentNode) {
                timingPanel.parentNode.insertBefore(exportPanel, timingPanel.nextSibling);
            } else {
                // Fallback: insert after controls panel
                const controlsPanel = document.querySelector('.controls-panel');
                if (controlsPanel && controlsPanel.parentNode) {
                    controlsPanel.parentNode.insertBefore(exportPanel, controlsPanel.nextSibling);
                }
            }
        }
        
        // Set content for export panel
        exportPanel.innerHTML = `
            <div class="export-section">
                <div class="export-header">
                    <h4>📹 ${t('controls.videoExport')}</h4>
                    <button class="export-help-toggle" id="exportHelpToggle">
                        <span>${t('controls.exportHelp')}</span>
                    </button>
                </div>
                
                <!-- Collapsible help section -->
                <div class="export-help" id="exportHelp" style="display: none;">
                    <div class="export-option-info">
                        <div class="export-option">
                            <strong>${t('controls.exportAutoTitle')}</strong>
                            <p>${t('controls.exportAutoDesc')}</p>
                        </div>
                        <div class="export-option">
                            <strong>${t('controls.exportCropTitle')}</strong>
                            <p>${t('controls.exportCropDesc')}</p>
                        </div>
                        <div class="export-option">
                            <strong>${t('controls.exportManualTitle')}</strong>
                            <p>${t('controls.exportManualDesc')}</p>
                            <div class="manual-instructions">
                                <p><strong>${t('controls.manualWindows')}</strong> <kbd>Win</kbd> + <kbd>G</kbd> → Game Bar → Record</p>
                                <p><strong>${t('controls.manualMac')}</strong> <kbd>⌘</kbd> + <kbd>⇧</kbd> + <kbd>5</kbd> → Record Selected Portion</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Export Buttons -->
                <div class="export-buttons">
                    <button id="exportAutoWebmBtn" class="export-btn">
                        <span>${t('controls.exportAutoWebm')}</span>
                    </button>
                    <button id="exportAutoCropBtn" class="export-btn">
                        <span>${t('controls.exportAutoCrop')}</span>
                    </button>
                    <button id="exportManualBtn" class="export-btn export-manual">
                        <span>${t('controls.exportManual')}</span>
                    </button>
                </div>
            </div>
        `;
        
        exportPanel.style.display = 'block';
        
        // Set up event listeners for the export section
        this.setupExportEventListeners();
    }

    setupExportEventListeners() {
        // Check if elements exist before adding listeners
        const exportHelpToggle = document.getElementById('exportHelpToggle');
        const exportAutoWebmBtn = document.getElementById('exportAutoWebmBtn');
        const exportAutoCropBtn = document.getElementById('exportAutoCropBtn');
        const exportManualBtn = document.getElementById('exportManualBtn');

        if (exportHelpToggle) {
            exportHelpToggle.addEventListener('click', this.toggleExportHelp.bind(this));
        }
        
        if (exportAutoWebmBtn) {
            exportAutoWebmBtn.addEventListener('click', () => this.exportVideo('auto-webm'));
        }
        
        if (exportAutoCropBtn) {
            exportAutoCropBtn.addEventListener('click', () => this.exportVideo('auto-crop'));
        }
        
        if (exportManualBtn) {
            exportManualBtn.addEventListener('click', () => this.startManualRecordingMode());
        }

        // Setup global keyboard handler for manual recording mode
        this.setupManualRecordingKeyboardHandler();
    }

    setupManualRecordingKeyboardHandler() {
        // Remove existing listener if any
        if (this._manualRecordingEscapeListener) {
            document.removeEventListener('keydown', this._manualRecordingEscapeListener);
        }

        this._manualRecordingEscapeListener = (e) => {
            // Only handle Escape key during manual recording mode
            if (e.key === 'Escape' && this.recordingMode && this.overlayRecordingMode) {
                console.log('Escape pressed - exiting manual recording mode');
                this.cleanupManualRecordingMode();
                this.showMessage('Manual recording mode cancelled', 'info');
            }
        };

        document.addEventListener('keydown', this._manualRecordingEscapeListener);
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
        
        // Skip expensive operations during clean recording, but allow updates during overlay recording
        if (this.recordingMode && !this.overlayRecordingMode) {
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

    // Convert linear progress (0-1) to segment timing for journeys
    convertLinearProgressToSegmentTime(linearProgress) {
        if (!this.currentTrackData || !this.currentTrackData.isJourney || !this.currentTrackData.segmentTiming) {
            return null;
        }

        // Ensure progress is within bounds
        linearProgress = Math.max(0, Math.min(1, linearProgress));

        const segments = this.currentTrackData.segmentTiming.segments;
        if (!segments || segments.length === 0) {
            return linearProgress * (this.currentTrackData.segmentTiming.totalDuration || this.totalAnimationTime);
        }

        // Find which segment this linear progress falls into
        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];
            
            // Validate segment data
            if (typeof segment.progressStartRatio !== 'number' || typeof segment.progressEndRatio !== 'number' ||
                typeof segment.startTime !== 'number' || typeof segment.duration !== 'number') {
                console.warn(`Invalid segment data at index ${i}:`, segment);
                continue;
            }
            
            // Check if the linear progress falls within this segment's coordinate range
            if (linearProgress >= segment.progressStartRatio && linearProgress <= segment.progressEndRatio) {
                // Calculate the relative position within this segment
                const segmentProgressRange = segment.progressEndRatio - segment.progressStartRatio;
                let relativeProgressInSegment = 0;
                
                if (segmentProgressRange > 0) {
                    relativeProgressInSegment = (linearProgress - segment.progressStartRatio) / segmentProgressRange;
                }
                
                // Convert to time within this segment
                const timeInSegment = relativeProgressInSegment * segment.duration;
                const totalTime = segment.startTime + timeInSegment;
                
                if (isNaN(totalTime)) {
                    console.warn(`Invalid time calculation for segment ${i}:`, { timeInSegment, totalTime, segment });
                    break; // Fall through to fallback
                }
                
                return totalTime;
            }
        }

        // Fallback: if not found in any segment, use proportional mapping
        const fallbackTime = linearProgress * (this.currentTrackData.segmentTiming.totalDuration || this.totalAnimationTime);
        return isNaN(fallbackTime) ? linearProgress * this.totalAnimationTime : fallbackTime;
    }

    // Convert segment time to linear progress for journeys (reverse mapping)
    convertSegmentTimeToLinearProgress(segmentTime) {
        if (!this.currentTrackData || !this.currentTrackData.isJourney || !this.currentTrackData.segmentTiming) {
            return null;
        }

        // Ensure time is valid
        if (typeof segmentTime !== 'number' || isNaN(segmentTime)) {
            return null;
        }

        const segments = this.currentTrackData.segmentTiming.segments;
        if (!segments || segments.length === 0) {
            const totalDuration = this.currentTrackData.segmentTiming.totalDuration || this.totalAnimationTime;
            return totalDuration > 0 ? Math.max(0, Math.min(1, segmentTime / totalDuration)) : 0;
        }

        // Find which segment this time falls into
        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];
            
            // Validate segment data
            if (typeof segment.startTime !== 'number' || typeof segment.endTime !== 'number' ||
                typeof segment.duration !== 'number' || typeof segment.progressStartRatio !== 'number' ||
                typeof segment.progressEndRatio !== 'number') {
                console.warn(`Invalid segment data for time conversion at index ${i}:`, segment);
                continue;
            }
            
            if (segmentTime >= segment.startTime && segmentTime <= segment.endTime) {
                // Calculate relative position within this segment's time
                const relativeTimeInSegment = segmentTime - segment.startTime;
                const relativeProgressInSegment = segment.duration > 0 ? relativeTimeInSegment / segment.duration : 0;
                
                // Convert to linear progress
                const segmentProgressRange = segment.progressEndRatio - segment.progressStartRatio;
                const linearProgress = segment.progressStartRatio + (relativeProgressInSegment * segmentProgressRange);
                
                if (isNaN(linearProgress)) {
                    console.warn(`Invalid progress calculation for segment ${i}:`, { relativeProgressInSegment, linearProgress, segment });
                    break; // Fall through to fallback
                }
                
                return Math.max(0, Math.min(1, linearProgress));
            }
        }

        // Fallback: if not found in any segment, use proportional mapping
        const totalDuration = this.currentTrackData.segmentTiming.totalDuration || this.totalAnimationTime;
        const fallbackProgress = totalDuration > 0 ? segmentTime / totalDuration : 0;
        return Math.max(0, Math.min(1, fallbackProgress));
    }

    // Debug method to validate and log current synchronization state
    validateJourneySynchronization() {
        if (!this.currentTrackData || !this.currentTrackData.isJourney || !this.mapRenderer) {
            console.log('❌ Not a journey or no map renderer - synchronization validation skipped');
            return false;
        }

        const progress = this.mapRenderer.getAnimationProgress();
        const journeyTime = this.mapRenderer.journeyElapsedTime;
        
        // Convert progress to expected time
        const expectedTime = this.convertLinearProgressToSegmentTime(progress);
        
        // Convert time to expected progress  
        const expectedProgress = this.convertSegmentTimeToLinearProgress(journeyTime);
        
        const timeDiff = Math.abs(expectedTime - journeyTime);
        const progressDiff = Math.abs(expectedProgress - progress);
        
        console.log('🔍 Journey Synchronization Status:');
        console.log(`   Current Progress: ${progress.toFixed(3)}`);
        console.log(`   Current Journey Time: ${journeyTime?.toFixed(1)}s`);
        console.log(`   Expected Time from Progress: ${expectedTime?.toFixed(1)}s (diff: ${timeDiff?.toFixed(1)}s)`);
        console.log(`   Expected Progress from Time: ${expectedProgress?.toFixed(3)} (diff: ${progressDiff?.toFixed(3)})`);
        
        const isTimeSynced = timeDiff < 2; // 2 second tolerance
        const isProgressSynced = progressDiff < 0.02; // 2% tolerance
        const isFullySynced = isTimeSynced && isProgressSynced;
        
        console.log(`   Time Sync: ${isTimeSynced ? '✅' : '❌'}, Progress Sync: ${isProgressSynced ? '✅' : '❌'}, Overall: ${isFullySynced ? '✅' : '❌'}`);
        
        if (!isFullySynced) {
            console.log('⚠️  Synchronization issues detected - this may cause position/time mismatches');
            
            // Suggest fixes
            if (!isTimeSynced) {
                console.log(`   💡 Consider calling: app.mapRenderer.setJourneyElapsedTime(${expectedTime?.toFixed(1)})`);
            }
            if (!isProgressSynced) {
                console.log(`   💡 Consider calling: app.mapRenderer.setAnimationProgress(${expectedProgress?.toFixed(3)})`);
            }
        }
        
        return isFullySynced;
    }

    // Force synchronization between position and time for journeys
    forceSynchronization() {
        if (!this.currentTrackData || !this.currentTrackData.isJourney || !this.mapRenderer) {
            console.log('❌ Cannot force synchronization - not a journey or no map renderer');
            return false;
        }

        const progress = this.mapRenderer.getAnimationProgress();
        const expectedTime = this.convertLinearProgressToSegmentTime(progress);
        
        console.log(`🔧 Forcing synchronization: progress=${progress.toFixed(3)} → time=${expectedTime?.toFixed(1)}s`);
        
        if (expectedTime !== null && this.mapRenderer.setJourneyElapsedTime) {
            this.mapRenderer.setJourneyElapsedTime(expectedTime);
            this.updateProgressDisplay();
            this.updateTimelineProgressIndicator(progress);
            console.log('✅ Synchronization forced successfully');
            return true;
        } else {
            console.log('❌ Failed to force synchronization');
            return false;
        }
    }

    // Simple tile preloading for regular animation (not video export)
    async basicTilePreloading() {
        if (!this.mapRenderer || !this.currentTrackData) return;
        
        const map = this.mapRenderer.map;
        const bounds = this.currentTrackData.bounds;
        
        if (!bounds) return;
        
        console.log('Starting basic tile preloading for smooth animation');
        
        try {
            const currentZoom = Math.floor(map.getZoom());
            const trackPoints = this.currentTrackData.trackPoints;
            
            // Sample fewer points for basic preloading (every 20th point)
            const sampleRate = Math.max(1, Math.floor(trackPoints.length / 20));
            const samplePoints = [];
            
            for (let i = 0; i < trackPoints.length; i += sampleRate) {
                samplePoints.push(trackPoints[i]);
            }
            
            // Quick pass through sample points at current zoom
            for (let i = 0; i < samplePoints.length; i++) {
                const point = samplePoints[i];
                map.setCenter([point.lon, point.lat]);
                map.triggerRepaint();
                
                // Very quick timing for basic preloading
                await new Promise(resolve => setTimeout(resolve, 30));
                
                // Don't block UI for too long
                if (i % 10 === 0) {
                    await new Promise(resolve => requestAnimationFrame(resolve));
                }
            }
            
            // Return to start
            if (trackPoints.length > 0) {
                map.setCenter([trackPoints[0].lon, trackPoints[0].lat]);
                map.triggerRepaint();
            }
            
            console.log('Basic tile preloading completed');
            
        } catch (error) {
            console.warn('Error during basic tile preloading:', error);
        }
    }

    getCameraControlsContent() {
        // Detect if the user is on a mobile/touch device
        const isMobile = window.matchMedia('(hover: none)').matches || 
                        window.matchMedia('(pointer: coarse)').matches ||
                        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (isMobile) {
            // Show only mobile instructions
            return `
                <div class="camera-controls-section">
                    <h5>${t('cameraInfo.mobile.title')}</h5>
                    <p>${t('cameraInfo.mobile.pan')}</p>
                    <p>${t('cameraInfo.mobile.zoom')}</p>
                    <p>${t('cameraInfo.mobile.rotate')}</p>
                    <p>${t('cameraInfo.mobile.tilt')}</p>
                </div>
            `;
        } else {
            // Show only desktop instructions
            return `
                <div class="camera-controls-section">
                    <h5>${t('cameraInfo.desktop.title')}</h5>
                    <p>${t('cameraInfo.desktop.pan')}</p>
                    <p>${t('cameraInfo.desktop.zoom')}</p>
                    <p>${t('cameraInfo.desktop.rotate')}</p>
                    <p>${t('cameraInfo.desktop.tilt')}</p>
                </div>
            `;
        }
    }

    // Show video export confirmation dialog
    async showVideoExportConfirmation(mode = 'clean') {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.id = 'videoExportConfirmation';
            
            const exportTypeTitles = {
                'auto-webm': 'Auto Recording (WebM)',
                'auto-crop': 'Auto Recording (MP4)',
                'manual': 'Manual Mode con Estadísticas'
            };
            const exportTypeIcons = {
                'auto-webm': '🔧',
                'auto-crop': '🚀',
                'manual': '🎥'
            };
            
            const exportTypeTitle = exportTypeTitles[mode] || 'Video Export';
            const exportTypeIcon = exportTypeIcons[mode] || '🎬';
            
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>${exportTypeIcon} ${exportTypeTitle}</h3>
                        <button class="modal-close" id="confirmationClose">✕</button>
                    </div>
                    <div class="modal-body">
                        <p><strong>${t('messages.exportVideoWhatHappens')}</strong></p>
                        <ul style="margin: 1rem 0; padding-left: 1.5rem; line-height: 1.6;">
                            <li>${t('messages.exportVideoStep1')}</li>
                            <li>${t('messages.exportVideoStep2')}</li>
                            <li>${t('messages.exportVideoStep3')}</li>
                            <li>${t('messages.exportVideoStep4')}</li>
                            <li>${t('messages.exportVideoStep5')}</li>
                        </ul>
                        <div style="background: var(--trail-orange-15); padding: 1rem; border-radius: 6px; margin: 1rem 0;">
                            <strong>${exportTypeIcon} ${exportTypeTitle}</strong><br><br>
                            ${mode === 'auto-webm' ?
                                'Automatic recording with overlays rendered on canvas. Works on all browsers (WebM format).' :
                                mode === 'auto-crop' ?
                                'Modern browser recording using CropTarget API for perfect overlay capture (MP4 format, Chrome 115+).' :
                                'Best quality with all statistics and overlays. The map will be preloaded and highlighted for manual screen recording.'
                            }
                        </div>
                        <div style="background: var(--trail-orange-15); padding: 1rem; border-radius: 6px; margin: 1rem 0;">
                            <strong>⚠️ ${t('messages.exportVideoImportant')}</strong><br>
                            ${t('messages.exportVideoStayActive')}
                        </div>
                        <p><strong>${t('messages.exportVideoQuality')}</strong> ${t('messages.exportVideoQualityDesc')}</p>
                    </div>
                    <div class="modal-footer">
                        <button class="control-btn" id="confirmationCancel">${t('buttons.cancel')}</button>
                        <button class="control-btn primary" id="confirmationStart">${t('messages.exportVideoStart')}</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Highlight the capture area for manual mode
            const videoCaptureContainer = document.getElementById('videoCaptureContainer');
            if (mode === 'manual' && videoCaptureContainer) {
                videoCaptureContainer.classList.add('recording-highlight');
            }
            
            const closeBtn = document.getElementById('confirmationClose');
            const cancelBtn = document.getElementById('confirmationCancel');
            const startBtn = document.getElementById('confirmationStart');
            
            const cleanup = () => {
                // Remove highlight when closing modal
                if (videoCaptureContainer) {
                    videoCaptureContainer.classList.remove('recording-highlight');
                }
                modal.remove();
            };
            
            closeBtn.addEventListener('click', () => {
                cleanup();
                resolve(false);
            });
            
            cancelBtn.addEventListener('click', () => {
                cleanup();
                resolve(false);
            });
            
            startBtn.addEventListener('click', () => {
                cleanup();
                resolve(true);
            });
            
            // Close on outside click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    cleanup();
                    resolve(false);
                }
            });
        });
    }

    // Canvas overlay rendering for video export - captures actual HTML elements
    startOverlayRendering(compositeCanvas, mapCanvas) {
        const ctx = compositeCanvas.getContext('2d');
        
        const renderFrame = async () => {
            if (!this.recordingMode) return; // Stop when recording ends
            
            try {
                // Clear the composite canvas
                ctx.clearRect(0, 0, compositeCanvas.width, compositeCanvas.height);
                
                // Draw the map canvas first
                ctx.drawImage(mapCanvas, 0, 0);
                
                // Capture and render actual HTML overlays
                await this.renderActualHTMLOverlays(ctx, compositeCanvas.width, compositeCanvas.height);
                
            } catch (error) {
                console.warn('Error in overlay rendering frame:', error);
                // Fallback to just drawing the map
                ctx.clearRect(0, 0, compositeCanvas.width, compositeCanvas.height);
                ctx.drawImage(mapCanvas, 0, 0);
            }
            
            // Continue rendering
            if (this.recordingMode) {
                requestAnimationFrame(renderFrame);
            }
        };
        
        requestAnimationFrame(renderFrame);
    }
    
    // Render actual HTML elements onto the canvas
    async renderActualHTMLOverlays(ctx, canvasWidth, canvasHeight) {
        // Get the map container to determine positioning
        const mapContainer = document.getElementById('map');
        const mapRect = mapContainer.getBoundingClientRect();
        
        // Live stats overlay
        const liveStatsOverlay = document.getElementById('liveStatsOverlay');
        if (liveStatsOverlay && !liveStatsOverlay.classList.contains('hidden')) {
            await this.renderHTMLElementToCanvas(ctx, liveStatsOverlay, mapRect);
        }
        
        // Elevation profile container
        const elevationContainer = document.querySelector('.elevation-profile-container');
        if (elevationContainer && elevationContainer.style.display !== 'none') {
            await this.renderHTMLElementToCanvas(ctx, elevationContainer, mapRect);
        }
    }
    
    // Convert HTML element to canvas using DOM rendering
    async renderHTMLElementToCanvas(ctx, element, mapRect) {
        try {
            const rect = element.getBoundingClientRect();
            
            // Calculate position relative to map
            const x = rect.left - mapRect.left;
            const y = rect.top - mapRect.top;
            
            // Create a temporary canvas to render the element
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = rect.width;
            tempCanvas.height = rect.height;
            const tempCtx = tempCanvas.getContext('2d');
            
            // Capture the element's styling and content
            await this.renderElementStyling(tempCtx, element, rect.width, rect.height);
            
            // Draw the temp canvas onto the main canvas
            ctx.drawImage(tempCanvas, x, y);
            
        } catch (error) {
            console.warn('Error rendering HTML element to canvas:', error);
        }
    }
    
    // Render element styling and content to canvas
    async renderElementStyling(ctx, element, width, height) {
        const computedStyle = window.getComputedStyle(element);
        
        // Fill background
        const bgColor = computedStyle.backgroundColor;
        if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, width, height);
        }
        
        // Draw border if present
        const borderWidth = parseFloat(computedStyle.borderWidth) || 0;
        if (borderWidth > 0) {
            ctx.strokeStyle = computedStyle.borderColor || '#000';
            ctx.lineWidth = borderWidth;
            ctx.strokeRect(borderWidth / 2, borderWidth / 2, width - borderWidth, height - borderWidth);
        }
        
        // Render text content
        const color = computedStyle.color || '#000';
        const fontSize = computedStyle.fontSize || '14px';
        const fontFamily = computedStyle.fontFamily || 'Arial';
        const fontWeight = computedStyle.fontWeight || 'normal';
        
        ctx.fillStyle = color;
        ctx.font = `${fontWeight} ${fontSize} ${fontFamily}`;
        
        // Get text content and render it
        const textContent = this.extractTextContent(element);
        if (textContent.length > 0) {
            const padding = 10;
            let y = padding + parseFloat(fontSize);
            
            textContent.forEach(text => {
                ctx.fillText(text, padding, y);
                y += parseFloat(fontSize) * 1.2; // Line height
            });
        }
    }
    
    // Extract text content from element with proper formatting
    extractTextContent(element) {
        const texts = [];
        
        if (element.id === 'liveStatsOverlay') {
            // For live stats, extract the current values
            const distanceElement = element.querySelector('#liveDistance') || element.querySelector('.live-stat-value');
            const elevationElement = element.querySelector('#liveElevation') || element.querySelectorAll('.live-stat-value')[1];
            
            if (distanceElement) {
                texts.push(`Distance: ${distanceElement.textContent}`);
            }
            if (elevationElement) {
                texts.push(`Elevation: ${elevationElement.textContent}`);
            }
        } else {
            // For other elements, extract all text
            const walker = document.createTreeWalker(
                element,
                NodeFilter.SHOW_TEXT,
                null,
                false
            );
            
            let node;
            while (node = walker.nextNode()) {
                const text = node.textContent.trim();
                if (text) {
                    texts.push(text);
                }
            }
        }
        
        return texts;
    }
    
    renderLiveStatsOverlay(ctx, width, height) {
        if (!this.currentTrackData || !this.mapRenderer) return;
        
        const currentDistance = this.mapRenderer.getCurrentDistance() || 0;
        const currentElevation = this.mapRenderer.getCurrentElevation() || 0;
        const currentSpeed = this.mapRenderer.getCurrentSpeed() || 0;
        
        // Style the stats overlay
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
        ctx.fillText(`Elevation: ${Math.round(currentElevation)} m`, x + padding, textY);
        textY += lineHeight;
        ctx.fillText(`Speed: ${currentSpeed.toFixed(1)} km/h`, x + padding, textY);
        
        ctx.restore();
    }
    
    renderElevationProfileOverlay(ctx, width, height) {
        if (!this.currentTrackData || !this.mapRenderer) return;
        
        const elevationData = this.mapRenderer.getElevationData?.() || [];
        if (elevationData.length === 0) return;
        
        ctx.save();
        
        // Position at bottom of canvas
        const margin = 20;
        const profileHeight = 100;
        const profileWidth = width - (margin * 2);
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
        if (elevationData.length > 1) {
            const minElevation = Math.min(...elevationData);
            const maxElevation = Math.max(...elevationData);
            const elevationRange = maxElevation - minElevation || 1;
            
            ctx.beginPath();
            ctx.strokeStyle = '#1B2A20';
            ctx.lineWidth = 2;
            
            elevationData.forEach((elevation, index) => {
                const x = profileX + (index / (elevationData.length - 1)) * profileWidth;
                const normalizedElevation = (elevation - minElevation) / elevationRange;
                const y = profileY + profileHeight - (normalizedElevation * (profileHeight - 20)) - 10;
                
                if (index === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            });
            
            ctx.stroke();
            
            // Draw current position indicator
            const currentProgress = this.mapRenderer.getCurrentProgress?.() || 0;
            const currentX = profileX + (currentProgress * profileWidth);
            
            ctx.beginPath();
            ctx.strokeStyle = '#C1652F';
            ctx.lineWidth = 3;
            ctx.moveTo(currentX, profileY);
            ctx.lineTo(currentX, profileY + profileHeight);
            ctx.stroke();
            
            // Draw current position circle
            const currentElevationIndex = Math.floor(currentProgress * (elevationData.length - 1));
            if (elevationData[currentElevationIndex] !== undefined) {
                const currentElevation = elevationData[currentElevationIndex];
                const normalizedElevation = (currentElevation - minElevation) / elevationRange;
                const currentY = profileY + profileHeight - (normalizedElevation * (profileHeight - 20)) - 10;
                
                ctx.beginPath();
                ctx.fillStyle = '#C1652F';
                ctx.arc(currentX, currentY, 6, 0, 2 * Math.PI);
                ctx.fill();
            }
        }
        
        ctx.restore();
    }
    
    // Force continuous rendering to ensure video capture works
    startContinuousRendering() {
        if (this.continuousRenderingId) {
            cancelAnimationFrame(this.continuousRenderingId);
        }
        
        const renderLoop = () => {
            if (!this.recordingMode) {
                this.continuousRenderingId = null;
                return; // Stop when recording ends
            }
            
            // Force map to render a frame
            if (this.mapRenderer && this.mapRenderer.map) {
                this.mapRenderer.map.triggerRepaint();
            }
            
            // Continue the render loop
            this.continuousRenderingId = requestAnimationFrame(renderLoop);
        };
        
        console.log('Starting continuous rendering for video capture');
        this.continuousRenderingId = requestAnimationFrame(renderLoop);
    }
    
    // Stop continuous rendering
    stopContinuousRendering() {
        if (this.continuousRenderingId) {
            cancelAnimationFrame(this.continuousRenderingId);
            this.continuousRenderingId = null;
            console.log('Stopped continuous rendering');
        }
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

}); 