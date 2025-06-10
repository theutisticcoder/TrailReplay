import { t } from '../translations.js';
import { MP4Utils } from '../utils/MP4Utils.js';

export class VideoExportController {
    constructor(app) {
        this.app = app;
        this.isExporting = false;
        this.currentExportMode = null;
        this.mediaRecorder = null;
        this.stream = null;
        this.progressModal = null;
        this.recordedChunks = [];
        
        // Export mode configurations
        this.exportModes = {
            webm: {
                name: 'Auto Recording (WebM)',
                icon: '🔧',
                mimeTypes: ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'],
                extension: 'webm',
                description: 'Automatic recording with overlays rendered on canvas. Works on all browsers.'
            },
            mp4: {
                name: 'Auto Recording (MP4)',
                icon: '🚀',
                mimeTypes: ['video/mp4', 'video/webm;codecs=vp9', 'video/webm'],
                extension: 'mp4',
                description: 'Advanced client-side MP4 generation with canvas rendering. Optimized for quality and compatibility. Auto-detects best codec and settings for your device.'
            },
            manual: {
                name: 'Manual Screen Recording',
                icon: '🎥',
                description: 'Best quality with all statistics and overlays. Use your system\'s screen recorder to capture the highlighted area while the animation plays.'
            }
        };
    }

    /**
     * Initialize export UI and event listeners
     */
    initialize() {
        this.createExportUI();
        this.setupEventListeners();
        
        // Ensure aspect ratio is applied after everything is set up
        setTimeout(() => {
            this.ensureInitialAspectRatio();
        }, 1000); // Increased delay to ensure page is fully rendered
    }

    /**
     * Ensure initial aspect ratio is applied
     */
    ensureInitialAspectRatio() {
        console.log('🔄 Ensuring initial aspect ratio is applied...');
        
        // Check if the map container is ready
        const mapContainer = document.querySelector('.map-container');
        if (!mapContainer) {
            console.warn('⚠️ Map container not ready, retrying in 1 second...');
            setTimeout(() => {
                this.ensureInitialAspectRatio();
            }, 1000);
            return;
        }

        const containerRect = mapContainer.getBoundingClientRect();
        if (containerRect.width === 0 || containerRect.height === 0) {
            console.warn('⚠️ Map container has no dimensions, retrying in 1 second...');
            setTimeout(() => {
                this.ensureInitialAspectRatio();
            }, 1000);
            return;
        }

        const selectedAspect = this.getSelectedAspectRatio();
        console.log(`📐 Applying initial aspect ratio: ${selectedAspect}`);
        console.log(`Map container ready with dimensions: ${containerRect.width}x${containerRect.height}`);
        this.resizeContainerForAspectRatio(selectedAspect);
    }

    /**
     * Create the export panel UI
     */
    createExportUI() {
        // Check if export panel already exists
        let exportPanel = document.getElementById('exportPanel');
        if (!exportPanel) {
            exportPanel = document.createElement('div');
            exportPanel.id = 'exportPanel';
            exportPanel.className = 'export-panel';
            
            // Find a good place to insert it (after controls panel)
            const controlsPanel = document.querySelector('.controls-panel');
            if (controlsPanel && controlsPanel.parentNode) {
                controlsPanel.parentNode.insertBefore(exportPanel, controlsPanel.nextSibling);
            } else {
                document.body.appendChild(exportPanel);
            }
        }

        exportPanel.innerHTML = `
            <style>
                .aspect-ratio-section {
                    margin: 15px 0;
                    padding: 12px;
                }
                .section-label {
                    display: block;
                    margin-bottom: 10px;
                    font-weight: 600;
                    color: rgba(46, 125, 50, 0.1);
                    font-size: 14px;
                }
                .aspect-ratio-options {
                    display: flex;
                    gap: 15px;
                    flex-wrap: wrap;
                }
                .aspect-option {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    cursor: pointer;
                    padding: 8px;
                    border-radius: 6px;
                    transition: all 0.2s ease;
                    min-width: 80px;
                    background: rgba(46, 125, 50, 0.05);
                }
                .aspect-option:hover {
                    background: rgba(46, 125, 50, 0.1);
                    transform: translateY(-1px);
                }
                .aspect-option input[type="radio"] {
                    display: none;
                }
                .aspect-option input[type="radio"]:checked + .aspect-visual {
                    border-color: #2E7D32;
                    background: rgba(46, 125, 50, 0.15);
                    box-shadow: 0 0 8px rgba(46, 125, 50, 0.3);
                }
                .aspect-option input[type="radio"]:checked {
                    background: rgba(46, 125, 50, 0.08);
                }
                .aspect-visual {
                    width: 40px;
                    height: 30px;
                    border: 2px solid rgba(46, 125, 50, 0.4);
                    border-radius: 4px;
                    margin-bottom: 5px;
                    transition: all 0.2s ease;
                    position: relative;
                    background: rgba(46, 125, 50, 0.08);
                }
                .aspect-16-9 {
                    width: 40px;
                    height: 22px;
                }
                .aspect-1-1 {
                    width: 30px;
                    height: 30px;
                }
                .aspect-9-16 {
                    width: 22px;
                    height: 40px;
                }
                .aspect-label {
                    font-size: 11px;
                    color:#1B2A20;
                    text-align: center;
                    white-space: nowrap;
                    font-weight: 500;
                }
                .aspect-option input[type="radio"]:checked ~ .aspect-label {
                    color: #1B2A20;
                    font-weight: 700;
                }
                
                /* Video capture container responsive styles */
                .video-capture-container {
                    transition: all 0.3s ease;
                    margin: 0 auto;
                    position: relative;
                    display: flex;
                    flex-direction: column;
                }
                
                /* Ensure map fills the container properly */
                .video-capture-container .map {
                    width: 100% !important;
                    height: 100% !important;
                    flex: 1;
                }
                
                /* Make sure overlays scale with container */
                .video-capture-container .elevation-profile-container,
                .video-capture-container .live-stats-overlay,
                .video-capture-container .map-watermark {
                    position: absolute;
                }
            </style>
            <div class="export-section">
                <div class="export-header">
                    <h4>📹 Video Export</h4>
                    <button class="export-help-toggle" id="exportHelpToggle">
                        <span>Export Help</span>
                    </button>
                </div>
                
                <!-- Collapsible help section -->
                <div class="export-help" id="exportHelp" style="display: none;">
                    <div class="export-option-info">
                        <div class="export-option">
                            <strong>${this.exportModes.webm.icon} ${this.exportModes.webm.name}</strong>
                            <p>${this.exportModes.webm.description}</p>
                        </div>
                        <div class="export-option">
                            <strong>${this.exportModes.mp4.icon} ${this.exportModes.mp4.name}</strong>
                            <p>${this.exportModes.mp4.description}</p>
                        </div>
                        <div class="export-option">
                            <strong>${this.exportModes.manual.icon} ${this.exportModes.manual.name}</strong>
                            <p>${this.exportModes.manual.description}</p>
                            <div class="manual-instructions">
                                <p><strong>Windows:</strong> <kbd>Win</kbd> + <kbd>G</kbd> → Game Bar → Record</p>
                                <p><strong>Mac:</strong> <kbd>⌘</kbd> + <kbd>⇧</kbd> + <kbd>5</kbd> → Record Selected Portion</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Aspect Ratio Selection -->
                <div class="aspect-ratio-section">
                    <label class="section-label">Video Ratio:</label>
                    <div class="aspect-ratio-options">
                        <label class="aspect-option">
                            <input type="radio" name="aspectRatio" value="16:9">
                            <span class="aspect-visual aspect-16-9"></span>
                            <span class="aspect-label">16:9 Landscape</span>
                        </label>
                        <label class="aspect-option">
                            <input type="radio" name="aspectRatio" value="1:1" checked>
                            <span class="aspect-visual aspect-1-1"></span>
                            <span class="aspect-label">1:1 Square</span>
                        </label>
                        <label class="aspect-option">
                            <input type="radio" name="aspectRatio" value="9:16">
                            <span class="aspect-visual aspect-9-16"></span>
                            <span class="aspect-label">9:16 Mobile</span>
                        </label>
                    </div>
                </div>

                <!-- Export Buttons -->
                <div class="export-buttons">
                    <button id="exportWebmBtn" class="export-btn">
                        <span>${this.exportModes.webm.icon}</span>
                        <span>Auto (WebM)</span>
                    </button>
                    <button id="exportMp4Btn" class="export-btn">
                        <span>${this.exportModes.mp4.icon}</span>
                        <span>Auto (MP4)</span>
                    </button>
                    <button id="exportManualBtn" class="export-btn">
                        <span>${this.exportModes.manual.icon}</span>
                        <span>Manual Mode</span>
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Setup event listeners for export buttons
     */
    setupEventListeners() {
        const exportHelpToggle = document.getElementById('exportHelpToggle');
        const exportWebmBtn = document.getElementById('exportWebmBtn');
        const exportMp4Btn = document.getElementById('exportMp4Btn');
        const exportManualBtn = document.getElementById('exportManualBtn');

        if (exportHelpToggle) {
            exportHelpToggle.addEventListener('click', this.toggleExportHelp.bind(this));
        }
        
        if (exportWebmBtn) {
            exportWebmBtn.addEventListener('click', () => this.startExport('webm'));
        }
        
        if (exportMp4Btn) {
            exportMp4Btn.addEventListener('click', () => this.startExport('mp4'));
        }
        
        if (exportManualBtn) {
            exportManualBtn.addEventListener('click', () => this.startManualRecording());
        }

        // Setup keyboard handler for manual recording
        this.setupManualRecordingKeyboardHandler();

        // Setup aspect ratio change handlers after UI is rendered
        setTimeout(() => {
            this.setupAspectRatioHandlers();
        }, 100);

        // Also listen for track load events to apply aspect ratio when map is ready
        if (this.app) {
            this.app.addEventListener('journeyDataLoaded', () => {
                console.log('🎯 Track loaded, applying aspect ratio...');
                setTimeout(() => {
                    this.ensureInitialAspectRatio();
                }, 500);
            });
        }
    }

    /**
     * Setup aspect ratio change handlers
     */
    setupAspectRatioHandlers() {
        console.log('🔧 Setting up aspect ratio handlers...');
        
        const aspectRatioInputs = document.querySelectorAll('input[name="aspectRatio"]');
        console.log(`Found ${aspectRatioInputs.length} aspect ratio inputs`);
        
        if (aspectRatioInputs.length === 0) {
            console.warn('⚠️ No aspect ratio inputs found - UI may not be rendered yet');
            // Try again after a short delay, but with a maximum number of retries
            if (!this.aspectRetryCount) this.aspectRetryCount = 0;
            if (this.aspectRetryCount < 10) {
                this.aspectRetryCount++;
                setTimeout(() => {
                    this.setupAspectRatioHandlers();
                }, 500);
            } else {
                console.error('❌ Failed to setup aspect ratio handlers after multiple retries');
            }
            return;
        }
        
        // Reset retry count on success
        this.aspectRetryCount = 0;
        
        aspectRatioInputs.forEach((input, index) => {
            console.log(`Setting up handler for aspect ratio input ${index}: ${input.value}`);
            input.addEventListener('change', () => {
                if (input.checked) {
                    console.log(`📐 Aspect ratio changed to: ${input.value}`);
                    this.resizeContainerForAspectRatio(input.value);
                }
            });
        });

        // Set initial aspect ratio (square by default)
        const selectedAspect = this.getSelectedAspectRatio();
        console.log(`📐 Setting initial aspect ratio: ${selectedAspect}`);
        
        // Apply the initial resize immediately
        this.resizeContainerForAspectRatio(selectedAspect);
        
        console.log('✅ Aspect ratio handlers setup complete');
    }

    /**
     * Resize the videoCaptureContainer to match selected aspect ratio
     */
    resizeContainerForAspectRatio(aspectRatio) {
        const videoCaptureContainer = document.getElementById('videoCaptureContainer');
        if (!videoCaptureContainer) {
            console.warn('videoCaptureContainer not found, retrying...');
            setTimeout(() => {
                this.resizeContainerForAspectRatio(aspectRatio);
            }, 500);
            return;
        }

        // Get the available space (viewport or parent container)
        const mapContainer = document.querySelector('.map-container');
        if (!mapContainer) {
            console.warn('map-container not found, retrying...');
            setTimeout(() => {
                this.resizeContainerForAspectRatio(aspectRatio);
            }, 500);
            return;
        }

        const parentRect = mapContainer.getBoundingClientRect();
        let availableWidth = parentRect.width;
        let availableHeight = parentRect.height;

        // If dimensions are still 0, use fallback dimensions or try viewport
        if (availableWidth === 0 || availableHeight === 0) {
            console.warn('Container dimensions are 0, using viewport fallback');
            availableWidth = window.innerWidth * 0.8; // 80% of viewport
            availableHeight = window.innerHeight * 0.7; // 70% of viewport
            
            // If still 0, use fixed fallback
            if (availableWidth === 0 || availableHeight === 0) {
                availableWidth = 1200;
                availableHeight = 800;
                console.warn('Using fixed fallback dimensions: 1200x800');
            }
        }

        let targetWidth, targetHeight;

        console.log(`🔄 Resizing container for ${aspectRatio} aspect ratio`);
        console.log(`Available space: ${availableWidth}x${availableHeight}`);

        switch (aspectRatio) {
            case '16:9':
                // Landscape - fit to available width, calculate height
                targetWidth = availableWidth;
                targetHeight = Math.round(targetWidth * (9/16));
                
                // If height exceeds available space, fit to height instead
                if (targetHeight > availableHeight) {
                    targetHeight = availableHeight;
                    targetWidth = Math.round(targetHeight * (16/9));
                }
                break;
                
            case '1:1':
                // Square - use the smaller dimension
                const squareSize = Math.min(availableWidth, availableHeight);
                targetWidth = squareSize;
                targetHeight = squareSize;
                break;
                
            case '9:16':
                // Portrait - fit to available height, calculate width
                targetHeight = availableHeight;
                targetWidth = Math.round(targetHeight * (9/16));
                
                // If width exceeds available space, fit to width instead
                if (targetWidth > availableWidth) {
                    targetWidth = availableWidth;
                    targetHeight = Math.round(targetWidth * (16/9));
                }
                break;
                
            default:
                targetWidth = availableWidth;
                targetHeight = availableHeight;
        }

        // Apply the new dimensions
        videoCaptureContainer.style.width = `${targetWidth}px`;
        videoCaptureContainer.style.height = `${targetHeight}px`;
        
        // Center the container if it's smaller than available space
        const offsetX = (availableWidth - targetWidth) / 2;
        const offsetY = (availableHeight - targetHeight) / 2;
        
        videoCaptureContainer.style.marginLeft = `${offsetX}px`;
        videoCaptureContainer.style.marginTop = `${offsetY}px`;

        console.log(`✅ Container resized to: ${targetWidth}x${targetHeight}`);
        console.log(`Container positioned with offset: ${offsetX}x${offsetY}`);

        // Trigger map resize to fit new container
        setTimeout(() => {
            this.resizeMapToContainer();
        }, 100);
    }

    /**
     * Resize the map to fit the container perfectly
     */
    resizeMapToContainer() {
        try {
            if (this.app.mapRenderer && this.app.mapRenderer.map) {
                console.log('🗺️ Resizing map to fit container...');
                
                // Trigger map resize
                this.app.mapRenderer.map.resize();
                
                // Force a repaint
                this.app.mapRenderer.map.getCanvas().style.width = '100%';
                this.app.mapRenderer.map.getCanvas().style.height = '100%';
                
                console.log('✅ Map resized successfully');
            }
        } catch (error) {
            console.warn('Failed to resize map:', error);
        }
    }

    /**
     * Toggle export help section visibility
     */
    toggleExportHelp() {
        const exportHelp = document.getElementById('exportHelp');
        if (exportHelp) {
            const isVisible = exportHelp.style.display !== 'none';
            exportHelp.style.display = isVisible ? 'none' : 'block';
        }
    }

    /**
     * Validate if export is possible
     */
    validateExportPrerequisites() {
        // Check for valid track data
        const hasTrackData = this.app.currentTrackData || 
                           (this.app.journeyData && this.app.journeyData.coordinates && this.app.journeyData.coordinates.length > 0);
        
        if (!this.app.mapRenderer || !hasTrackData) {
            this.app.showMessage('No track data available for export', 'error');
            return false;
        }

        // Check for browser support
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
            this.app.showMessage('Media recording not supported in this browser', 'error');
            return false;
        }

        // Check map canvas
        const mapElement = this.app.mapRenderer.map.getCanvas();
        if (!mapElement) {
            this.app.showMessage('Map not ready for export', 'error');
            return false;
        }

        return true;
    }

    /**
     * Start video export process
     */
    async startExport(mode) {
        if (this.isExporting) {
            this.app.showMessage('Export already in progress', 'warning');
            return;
        }

        if (!this.validateExportPrerequisites()) {
            return;
        }

        // Show confirmation dialog
        const shouldContinue = await this.showExportConfirmation(mode);
        if (!shouldContinue) return;

        try {
            this.isExporting = true;
            this.currentExportMode = mode;
            
            console.log(`🎬 Starting ${this.exportModes[mode].name} export`);
            
            if (mode === 'webm') {
                await this.exportAutoWebM();
            } else if (mode === 'mp4') {
                await this.exportAutoMP4();
            }
            
        } catch (error) {
            console.error('Export failed:', error);
            this.app.showMessage(`Export error: ${error.message}`, 'error');
            this.cleanup();
        }
    }

    /**
     * Export video in WebM format (canvas capture)
     */
    async exportAutoWebM() {
        console.log('🔧 Starting WebM export...');
        
        this.createProgressModal();
        this.updateProgress(5, 'Preparing for WebM export...');

        try {
            // Step 1: Prepare the environment
            await this.prepareForExport();
            this.updateProgress(20, 'Environment prepared...');

            // Step 2: Hide UI elements
            this.hideUIForRecording();
            this.updateProgress(25, 'UI optimized...');

            // Step 3: Preload tiles
            this.updateProgress(30, 'Preloading map tiles...');
            await this.preloadTiles((progress) => {
                this.updateProgress(30 + (progress * 30), `Loading tiles... ${Math.round(progress)}%`);
            });

            // Step 4: Setup canvas capture
            this.updateProgress(65, 'Setting up canvas capture...');
            const mapCanvas = this.app.mapRenderer.map.getCanvas();
            
            // Create stream from canvas
            this.stream = mapCanvas.captureStream(30);
            this.updateProgress(70, 'Canvas capture ready...');

            // Step 5: Setup MediaRecorder for WebM
            const mimeType = this.getBestMimeType(this.exportModes.webm.mimeTypes);
            await this.setupMediaRecorder(mimeType, 'webm');
            
            // Step 6: Start recording
            this.updateProgress(75, 'Starting recording...');
            await this.startRecording();

        } catch (error) {
            console.error('WebM export failed:', error);
            throw error;
        }
    }

    /**
     * Export video in MP4 format (experimental CropTarget API)
     */
    async exportAutoMP4() {
        console.log('🚀 Starting advanced MP4 export...');

        this.createProgressModal();
        this.updateProgress(5, 'Initializing MP4 export...');

        try {
            // Step 1: Validate browser capabilities
            const canRecordMP4 = this.validateMP4Support();
            if (!canRecordMP4) {
                // Fallback to WebM with automatic conversion message
                this.app.showMessage('MP4 not directly supported, using WebM format instead', 'warning');
                return this.exportAutoWebM();
            }

            // Step 2: Prepare the environment
            await this.prepareForExport();
            this.updateProgress(15, 'Environment prepared...');

            // Step 3: Load html2canvas library if needed
            await this.loadHtml2Canvas();
            this.updateProgress(20, 'Capture libraries loaded...');

            // Step 4: Setup canvas recording infrastructure
            await this.setupCanvasRecording();
            this.updateProgress(25, 'Canvas recording setup complete...');

            // Step 4: Hide UI elements for clean recording
            this.hideUIForRecording();
            this.updateProgress(30, 'UI optimized for recording...');

            // Step 5: Preload all necessary tiles
            this.updateProgress(35, 'Preloading map tiles...');
            await this.preloadTiles((progress) => {
                this.updateProgress(35 + (progress * 25), `Loading tiles... ${Math.round(progress * 100)}%`);
            });

            // Step 6: Setup high-performance rendering
            this.updateProgress(60, 'Setting up high-performance rendering...');
            console.log('🎬 Starting high-performance rendering setup...');
            try {
                await this.setupHighPerformanceRendering();
                console.log('✅ High-performance rendering setup complete');
            } catch (error) {
                console.warn('⚠️ High-performance rendering setup failed, but continuing anyway:', error.message);
                // Don't throw - the map might still work fine for recording
            }

            // Step 7: Phase 1 - Capture high-quality frames during animation playback
            this.updateProgress(65, 'Phase 1: Capturing high-quality frames...');
            console.log('🎬 Starting Phase 1: Frame capture...');
            await this.captureAnimationFrames();
            console.log('✅ Phase 1 complete: All frames captured');

            // Step 8: Phase 2 - Create video from captured frames
            this.updateProgress(85, 'Phase 2: Creating video from frames...');
            console.log('🎬 Starting Phase 2: Video creation...');
            await this.createVideoFromFrames();
            console.log('✅ Phase 2 complete: Video created');

            this.updateProgress(100, 'MP4 export complete!');

        } catch (error) {
            console.error('Advanced MP4 export failed:', error);
            this.app.showMessage(`MP4 export failed: ${error.message}`, 'error');
            this.cleanup();
            throw error;
        }
    }

    /**
     * Validate MP4 recording capabilities using advanced detection
     */
    validateMP4Support() {
        // Check browser compatibility
        const compatibility = MP4Utils.validateBrowserCompatibility();
        console.log('Browser compatibility:', compatibility);

        // Show compatibility info to user if there are recommendations
        if (compatibility.recommendations.length > 0) {
            console.warn('MP4 compatibility recommendations:', compatibility.recommendations);
        }

        // Check for best MP4 codec
        const bestCodec = MP4Utils.getBestMP4Codec();
        if (bestCodec) {
            this.selectedMP4Codec = bestCodec.mime;
            this.mp4CodecInfo = bestCodec;
            console.log(`Selected MP4 codec: ${bestCodec.description}`);
            return true;
        }

        // Check for WebCodecs API as alternative
        if (compatibility.webCodecsSupport) {
            console.log('WebCodecs API available for MP4 generation');
            this.useWebCodecs = true;
            return true;
        }

        console.warn('No MP4 recording capabilities available');
        return false;
    }

    /**
     * Load html2canvas if not already available
     */
    async loadHtml2Canvas() {
        if (window.html2canvas) {
            return true;
        }

        try {
            console.log('Loading html2canvas library...');
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
            script.crossOrigin = 'anonymous';
            
            await new Promise((resolve, reject) => {
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
            
            console.log('html2canvas loaded successfully');
            return window.html2canvas !== undefined;
        } catch (error) {
            console.warn('Failed to load html2canvas:', error);
            return false;
        }
    }

        /**
     * Get selected aspect ratio from UI
     */
    getSelectedAspectRatio() {
        const selectedAspect = document.querySelector('input[name="aspectRatio"]:checked');
        return selectedAspect ? selectedAspect.value : '1:1'; // Default to square
    }

    /**
     * Calculate dimensions for selected aspect ratio
     */
    calculateAspectRatioDimensions(containerRect, aspectRatio) {
        let width, height;
        const containerWidth = containerRect.width;
        const containerHeight = containerRect.height;

        console.log(`Original container size: ${containerWidth}x${containerHeight}`);

        switch (aspectRatio) {
            case '16:9':
                // Landscape - fit to container width, adjust height
                width = Math.max(containerWidth, 1280);
                height = Math.round(width * (9/16));
                break;
            case '1:1':
                // Square - use smaller dimension
                const squareSize = Math.max(Math.min(containerWidth, containerHeight), 720);
                width = squareSize;
                height = squareSize;
                break;
            case '9:16':
                // Portrait/Mobile - fit to container height, adjust width
                height = Math.max(containerHeight, 720);
                width = Math.round(height * (9/16));
                break;
            default:
                width = Math.max(containerWidth, 1280);
                height = Math.max(containerHeight, 720);
        }

        // Ensure dimensions are even numbers (some codecs require this)
        width = Math.floor(width / 2) * 2;
        height = Math.floor(height / 2) * 2;

        console.log(`Calculated ${aspectRatio} dimensions: ${width}x${height}`);
        return { width, height };
    }

    /**
     * Setup canvas recording infrastructure to capture the entire videoCaptureContainer
     */
    async setupCanvasRecording() {
        // Get the video capture container (this contains map + overlays + stats)
            const videoCaptureContainer = document.getElementById('videoCaptureContainer');
            if (!videoCaptureContainer) {
            throw new Error('Video capture container not available');
        }

        // Get optimal recording settings based on device capabilities
        const optimalSettings = MP4Utils.getOptimalRecordingSettings();
        console.log('Using optimal recording settings:', optimalSettings);

        // Get the actual container dimensions
        const containerRect = videoCaptureContainer.getBoundingClientRect();
        console.log('Video capture container size:', containerRect);

        // Get selected aspect ratio and calculate dimensions
        const selectedAspectRatio = this.getSelectedAspectRatio();
        const { width, height } = this.calculateAspectRatioDimensions(containerRect, selectedAspectRatio);

        // Create a composite canvas for recording (similar to MapDirector's approach)
        this.recordingCanvas = document.createElement('canvas');
        this.recordingContext = this.recordingCanvas.getContext('2d');
        
        // Set canvas dimensions with device pixel ratio for crisp rendering
        const { devicePixelRatio } = optimalSettings;
        this.recordingCanvas.width = width * devicePixelRatio;
        this.recordingCanvas.height = height * devicePixelRatio;
        this.recordingCanvas.style.width = width + 'px';
        this.recordingCanvas.style.height = height + 'px';
        
        // Scale context to match device pixel ratio
        this.recordingContext.scale(devicePixelRatio, devicePixelRatio);
        
        // Since container is already resized to match aspect ratio, use direct mapping
        const scale = 1.0; // No scaling needed since container matches target size
        const scaledWidth = width;
        const scaledHeight = height;
        const offsetX = 0;
        const offsetY = 0;

        console.log(`Direct container mapping - no scaling needed (container already matches ${selectedAspectRatio})`);

        // Store dimensions and settings for later use
        this.recordingDimensions = { 
            ...optimalSettings, 
            width, 
            height,
            containerRect,
            scale,
            offsetX,
            offsetY,
            scaledWidth,
            scaledHeight,
            aspectRatio: selectedAspectRatio
        };
        this.optimalSettings = optimalSettings;
        this.videoCaptureContainer = videoCaptureContainer;
        
        // Add canvas to hidden container for reference (don't display it)
        this.recordingCanvas.style.position = 'absolute';
        this.recordingCanvas.style.left = '-9999px';
        this.recordingCanvas.style.top = '-9999px';
        document.body.appendChild(this.recordingCanvas);
        
        console.log(`Recording canvas created: ${width}x${height} (${selectedAspectRatio}) (${devicePixelRatio}x DPI) @ ${optimalSettings.bitrate/1000000}Mbps`);
        console.log(`Content scaling: ${scale.toFixed(2)}x, offset: ${offsetX.toFixed(1)}, ${offsetY.toFixed(1)}`);
    }

    /**
     * Setup high-performance rendering optimizations
     */
    async setupHighPerformanceRendering() {
        try {
            // Optimize map rendering for recording
            const map = this.app.mapRenderer.map;
            console.log('🗺️ Configuring map for high-performance rendering...');
            
            // Increase render resolution for better quality
            map.getCanvas().style.transformOrigin = 'top left';
            
            // Ensure smooth animations
            map.setRenderWorldCopies(false);
            
            // Optimize performance
            map.setMaxZoom(18);
            map.setMinZoom(1);
            
            console.log('🗺️ Map configuration complete, waiting for map ready...');
            
            // Wait for any pending operations with multiple check methods
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    console.warn('⚠️ Map ready timeout, but proceeding anyway as map appears functional');
                    resolve(); // Don't reject, just proceed
                }, 3000); // Reduced timeout

                // Check multiple indicators of map readiness
                const checkMapReady = () => {
                    const isLoaded = map.loaded();
                    const hasCanvas = map.getCanvas();
                    const hasStyle = map.getStyle();
                    
                    console.log(`🗺️ Map status - loaded: ${isLoaded}, hasCanvas: ${!!hasCanvas}, hasStyle: ${!!hasStyle}`);
                    
                    if (isLoaded || (hasCanvas && hasStyle)) {
                        clearTimeout(timeout);
                        console.log('🗺️ Map is ready for recording');
                        resolve();
                        return true;
                    }
                    return false;
                };

                // Immediate check
                if (checkMapReady()) return;
                
                // Listen for various ready events
                const events = ['load', 'idle', 'render'];
                let eventHandlers = [];
                
                events.forEach(eventName => {
                    const handler = () => {
                        console.log(`🗺️ Map event: ${eventName}`);
                        if (checkMapReady()) {
                            // Clean up all event listeners
                            eventHandlers.forEach(({event, handler}) => {
                                map.off(event, handler);
                            });
                        }
                    };
                    map.on(eventName, handler);
                    eventHandlers.push({event: eventName, handler});
                });
                
                // Fallback check every 500ms
                const intervalCheck = setInterval(() => {
                    if (checkMapReady()) {
                        clearInterval(intervalCheck);
                    }
                }, 500);
                
                // Clean up interval on timeout
                setTimeout(() => clearInterval(intervalCheck), 3000);
            });
        } catch (error) {
            console.error('❌ High-performance rendering setup failed:', error);
            throw error;
        }
    }

    /**
     * Initialize advanced MediaRecorder with optimal settings
     */
    async initializeAdvancedMediaRecorder() {
        if (this.useWebCodecs) {
            return this.initializeWebCodecsRecorder();
        }

        // Create a stream from our recording canvas at exactly 30 FPS
        const targetFPS = 30;
        const stream = this.recordingCanvas.captureStream(targetFPS);
        
        // Create optimized MediaRecorder options with 30 FPS
        const customSettings = {
            ...this.optimalSettings,
            framerate: targetFPS
        };
        const options = MP4Utils.createMediaRecorderOptions(this.mp4CodecInfo, customSettings);
        
        // Estimate file size for user information
        console.log('📊 Estimating file size...');
        const estimatedDuration = this.estimateAnimationDuration();
        const sizeEstimate = MP4Utils.estimateFileSize(estimatedDuration, customSettings.bitrate);
        console.log(`📊 Estimated file size: ${sizeEstimate.displaySize} for ${estimatedDuration}s video at ${targetFPS} FPS`);

        this.mediaRecorder = new MediaRecorder(stream, options);
        this.recordedChunks = [];

        // Enhanced event handlers
        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                this.recordedChunks.push(event.data);
                const currentSize = MP4Utils.formatFileSize(this.recordedChunks.reduce((total, chunk) => total + chunk.size, 0));
                console.log(`MP4 chunk: ${MP4Utils.formatFileSize(event.data.size)}, total: ${currentSize}`);
            }
        };

        this.mediaRecorder.onstop = () => {
            console.log('MP4 MediaRecorder stopped, processing video...');
            this.processAdvancedRecordedVideo();
        };

        this.mediaRecorder.onerror = (event) => {
            console.error('MP4 MediaRecorder error:', event.error);
            this.app.showMessage(`MP4 recording error: ${event.error.name}`, 'error');
            this.cleanup();
        };

        console.log(`Advanced MediaRecorder initialized with: ${this.mp4CodecInfo.description} @ ${customSettings.bitrate/1000000}Mbps, ${targetFPS} FPS`);
    }

    /**
     * Initialize WebCodecs-based recorder for better MP4 support
     */
    async initializeWebCodecsRecorder() {
        if (!window.VideoEncoder) {
            throw new Error('WebCodecs not available');
        }

        this.webCodecsFrames = [];
        this.webCodecsEncoder = new VideoEncoder({
            output: (chunk, config) => {
                this.webCodecsFrames.push({ chunk, config });
            },
            error: (error) => {
                console.error('WebCodecs encoder error:', error);
                this.app.showMessage(`Video encoding error: ${error.message}`, 'error');
            }
        });

        // Configure encoder for MP4/H.264 at exactly 30 FPS
        const targetFPS = 30;
        const config = {
            codec: 'avc1.42E01E', // H.264 baseline profile
            width: this.recordingDimensions.width,
            height: this.recordingDimensions.height,
            bitrate: 8000000, // 8 Mbps
            framerate: targetFPS,
            hardwareAcceleration: 'prefer-hardware'
        };

        this.webCodecsEncoder.configure(config);
        console.log(`WebCodecs encoder configured for MP4 at ${targetFPS} FPS`);
    }

    /**
     * Start advanced recording process similar to MapDirector
     */
    async startAdvancedRecording() {
        if (!this.mediaRecorder && !this.webCodecsEncoder) {
            throw new Error('No recorder initialized');
        }

        // Start MediaRecorder if using traditional approach
        if (this.mediaRecorder) {
            this.mediaRecorder.start(100); // Collect data every 100ms for smoother recording
        }

        // Reset animation to start
        console.log('🎬 Resetting animation to start...');
        if (this.app.playback && this.app.playback.reset) {
            this.app.playback.reset();
        } else if (this.app.map && this.app.map.resetAnimation) {
            this.app.map.resetAnimation();
        }
        
        await this.waitForMapReady();

        // Start the frame-by-frame recording process
        this.updateProgress(85, 'Recording animation frames...');
        await this.recordAnimationFrames();
    }

    /**
     * Record animation frames similar to MapDirector's approach
     */
    async recordAnimationFrames() {
        return new Promise((resolve, reject) => {
            let frameCount = 0;
            let lastProgressUpdate = 0;
            const targetFPS = this.optimalSettings.framerate || 30;
            const frameInterval = 1000 / targetFPS;
            let lastFrameTime = 0;
            const startTime = Date.now();
            const maxRecordingTime = 600000; // 10 minutes max

            console.log(`🎬 Starting frame recording at ${targetFPS} FPS...`);

            const renderFrame = async (currentTime) => {
                try {
                    // Safety timeout
                    if (Date.now() - startTime > maxRecordingTime) {
                        console.warn('⚠️ Recording timeout reached, stopping...');
                        this.finishRecording();
                        resolve();
                        return;
                    }

                    // Throttle to target FPS
                    if (currentTime - lastFrameTime >= frameInterval) {
                        await this.captureFrame(frameCount);
                        frameCount++;
                        lastFrameTime = currentTime;

                        // Update progress periodically
                        const now = Date.now();
                        if (now - lastProgressUpdate > 1000) { // Update every second
                            const progress = this.getAnimationProgress();
                            this.updateProgress(85 + (progress * 10), `Recording frame ${frameCount}... ${Math.round(progress * 100)}% complete`);
                            lastProgressUpdate = now;
                            console.log(`📹 Frame ${frameCount}, Progress: ${Math.round(progress * 100)}%`);
                        }
                    }

                    // Continue recording if animation is still playing
                    if (this.isAnimationPlaying()) {
                        requestAnimationFrame(renderFrame);
                    } else {
                        // Animation complete
                        console.log(`✅ Recording complete. Captured ${frameCount} frames in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
                        this.finishRecording();
                        resolve();
                    }
        } catch (error) {
                    console.error('❌ Frame recording error:', error);
                    reject(error);
                }
            };

            // Start animation and recording
            console.log('🎬 Starting animation playback...');
            if (this.app.playback && this.app.playback.play) {
                this.app.playback.play();
            } else if (this.app.map && this.app.map.startAnimation) {
                this.app.map.startAnimation();
            }
            
            // Delay slightly to ensure animation has started
            setTimeout(() => {
                console.log('🎬 Starting frame capture loop...');
                requestAnimationFrame(renderFrame);
            }, 100);
        });
    }

    /**
     * Capture a single frame of the entire videoCaptureContainer
     */
    async captureFrame(frameNumber) {
        const { width, height } = this.recordingDimensions;

        try {
            // Clear the recording canvas
            this.recordingContext.clearRect(0, 0, width, height);

            // Capture the entire videoCaptureContainer using DOM-to-canvas approach
            await this.captureContainerToCanvas();

            // If using WebCodecs, encode this frame
            if (this.webCodecsEncoder) {
                this.encodeFrameWithWebCodecs(frameNumber);
            }
        } catch (error) {
            console.warn(`Frame ${frameNumber} capture failed:`, error);
            // Fallback: just draw the map canvas if container capture fails
            this.fallbackMapCapture();
        }
    }

    /**
     * Capture the videoCaptureContainer content to the recording canvas
     */
    async captureContainerToCanvas() {
        const { width, height, scale, offsetX, offsetY, scaledWidth, scaledHeight, containerRect } = this.recordingDimensions;
        
        // Clear canvas with background color
        this.recordingContext.fillStyle = '#000000';
        this.recordingContext.fillRect(0, 0, width, height);
        
        // Method 1: Try using html2canvas if available
        if (window.html2canvas) {
            try {
                const canvas = await html2canvas(this.videoCaptureContainer, {
                    width: width,
                    height: height,
                    backgroundColor: null,
                    allowTaint: true,
                    useCORS: true,
                    logging: false,
                    scale: 1,
                    ignoreElements: (element) => {
                        // Ignore certain elements that might cause issues
                        return element.tagName === 'SCRIPT' || element.tagName === 'STYLE';
                    }
                });
                
                // Draw the html2canvas result directly (no scaling needed)
                this.recordingContext.drawImage(canvas, 0, 0, width, height);
                return;
            } catch (error) {
                console.warn('html2canvas failed, using manual method:', error);
            }
        } else {
            console.log('html2canvas not available, using manual DOM capture');
        }

        // Method 2: Manual DOM element capture with proper scaling
        await this.manualDOMCapture();
    }

    /**
     * Manual DOM capture approach - captures elements individually (direct mapping)
     */
    async manualDOMCapture() {
        const { width, height } = this.recordingDimensions;

        // 1. Draw the map canvas first (direct mapping since container matches target size)
        const mapCanvas = this.app.mapRenderer.map.getCanvas();
        if (mapCanvas) {
            this.recordingContext.drawImage(mapCanvas, 0, 0, width, height);
        }

        // 2. Capture and draw the live stats overlay
        await this.drawLiveStatsOverlay();

        // 3. Capture and draw the elevation profile
        await this.drawElevationProfile();

        // 4. Draw the logo watermark
        await this.drawLogoWatermark();

        // 5. Draw any active annotations
        await this.drawActiveAnnotations();
    }

    /**
     * Fallback method: just capture the map canvas
     */
    fallbackMapCapture() {
        const mapCanvas = this.app.mapRenderer.map.getCanvas();
        const { width, height } = this.recordingDimensions;
        
        if (mapCanvas) {
            this.recordingContext.drawImage(mapCanvas, 0, 0, width, height);
        }
    }

    /**
     * Phase 1: Capture high-quality frames during animation playback
     */
    async captureAnimationFrames() {
        // Initialize frame storage
        this.capturedFrames = [];
        this.captureQuality = 2; // Higher quality multiplier
        
        return new Promise((resolve, reject) => {
            let frameCount = 0;
            let lastProgressUpdate = 0;
            const targetFPS = 30; // Fixed at 30 FPS for consistent timing
            const frameInterval = 1000 / targetFPS; // 33.33ms per frame
            let lastFrameTime = 0;
            const startTime = Date.now();
            const maxRecordingTime = 600000; // 10 minutes max

            // Get animation duration to calculate total expected frames
            const animationDuration = this.estimateAnimationDuration();
            const expectedFrames = Math.ceil(animationDuration * targetFPS);
            
            console.log(`🎬 Phase 1: Starting frame capture at ${targetFPS} FPS...`);
            console.log(`🎬 Expected duration: ${animationDuration}s, Expected frames: ${expectedFrames}`);

            const captureFrame = async (currentTime) => {
                try {
                    // Safety timeout
                    if (Date.now() - startTime > maxRecordingTime) {
                        console.warn('⚠️ Frame capture timeout reached, processing captured frames...');
                        resolve();
                        return;
                    }

                    // Throttle to exact target FPS timing
                    if (currentTime - lastFrameTime >= frameInterval) {
                        // Capture high-quality frame
                        const frameData = await this.captureHighQualityFrame(frameCount);
                        this.capturedFrames.push(frameData);
                        
                        frameCount++;
                        lastFrameTime = currentTime;

                        // Update progress periodically
                        const now = Date.now();
                        if (now - lastProgressUpdate > 1000) { // Update every second
                            const progress = this.getAnimationProgress();
                            const captureProgress = frameCount / expectedFrames;
                            this.updateProgress(65 + (Math.min(progress, captureProgress) * 15), `Capturing frame ${frameCount}/${expectedFrames}... ${Math.round(progress * 100)}% complete`);
                            lastProgressUpdate = now;
                            console.log(`📹 Captured frame ${frameCount}/${expectedFrames}, Animation: ${Math.round(progress * 100)}%`);
                        }
                    }

                    // Continue recording if animation is still playing AND we haven't captured all expected frames
                    const animationStillPlaying = this.isAnimationPlaying();
                    const hasMoreFramesToCapture = frameCount < expectedFrames;
                    
                    if (animationStillPlaying && hasMoreFramesToCapture) {
                        requestAnimationFrame(captureFrame);
                    } else {
                        // Animation complete or expected frames captured
                        const actualDuration = (Date.now() - startTime) / 1000;
                        const calculatedDuration = frameCount / targetFPS;
                        console.log(`✅ Frame capture complete. Captured ${frameCount} frames in ${actualDuration.toFixed(1)}s`);
                        console.log(`✅ Video duration will be: ${calculatedDuration.toFixed(1)}s at ${targetFPS} FPS`);
                        resolve();
                    }
                } catch (error) {
                    console.error('❌ Frame capture error:', error);
                    reject(error);
                }
            };

            // Start animation and capture
            console.log('🎬 Starting animation playback for frame capture...');
            if (this.app.playback && this.app.playback.play) {
                this.app.playback.play();
            } else if (this.app.map && this.app.map.startAnimation) {
                this.app.map.startAnimation();
            }
            
            // Delay slightly to ensure animation has started
            setTimeout(() => {
                console.log('🎬 Starting frame capture loop...');
                requestAnimationFrame(captureFrame);
            }, 100);
        });
    }

    /**
     * Capture a high-quality frame of the videoCaptureContainer
     */
    async captureHighQualityFrame(frameNumber) {
        const { width, height, scale, offsetX, offsetY, scaledWidth, scaledHeight, containerRect } = this.recordingDimensions;

        try {
            // Create a high-quality capture canvas
            const captureCanvas = document.createElement('canvas');
            const captureContext = captureCanvas.getContext('2d');
            
            // Use higher resolution for better quality
            const qualityMultiplier = this.captureQuality || 2;
            captureCanvas.width = width * qualityMultiplier;
            captureCanvas.height = height * qualityMultiplier;
            captureContext.scale(qualityMultiplier, qualityMultiplier);

            // Clear with black background
            captureContext.fillStyle = '#000000';
            captureContext.fillRect(0, 0, width, height);

            // Method 1: Try using html2canvas if available
            if (window.html2canvas) {
                try {
                    const canvas = await html2canvas(this.videoCaptureContainer, {
                        width: containerRect.width,
                        height: containerRect.height,
                        backgroundColor: null,
                        allowTaint: true,
                        useCORS: true,
                        logging: false,
                        scale: qualityMultiplier,
                        ignoreElements: (element) => {
                            return element.tagName === 'SCRIPT' || element.tagName === 'STYLE';
                        }
                    });
                    
                                    // Draw the captured content directly (no scaling needed)
                captureContext.drawImage(canvas, 0, 0, width, height);
                    
                    return {
                        canvas: captureCanvas,
                        frameNumber: frameNumber,
                        timestamp: Date.now()
                    };
                } catch (error) {
                    console.warn('html2canvas failed for high-quality capture, using manual method:', error);
                }
            }

            // Method 2: Manual high-quality DOM capture
            await this.manualHighQualityCapture(captureContext, width, height);

            return {
                canvas: captureCanvas,
                frameNumber: frameNumber,
                timestamp: Date.now()
            };
        } catch (error) {
            console.warn(`High-quality frame ${frameNumber} capture failed:`, error);
            // Fallback to regular capture
            return this.fallbackFrameCapture(frameNumber);
        }
    }

    /**
     * Manual high-quality DOM capture (direct mapping)
     */
    async manualHighQualityCapture(context, width, height) {
        // 1. Draw the map canvas first (direct mapping)
        const mapCanvas = this.app.mapRenderer.map.getCanvas();
        if (mapCanvas) {
            context.drawImage(mapCanvas, 0, 0, width, height);
        }

        // 2. Capture and draw the live stats overlay
        await this.drawHighQualityLiveStats(context);

        // 3. Capture and draw the elevation profile
        await this.drawHighQualityElevationProfile(context);

        // 4. Draw the logo watermark
        await this.drawHighQualityLogo(context);

        // 5. Draw any active annotations
        await this.drawHighQualityAnnotations(context);
    }

    /**
     * Phase 2: Create video from captured high-quality frames
     */
    async createVideoFromFrames() {
        if (!this.capturedFrames || this.capturedFrames.length === 0) {
            throw new Error('No frames captured to create video');
        }

        console.log(`🎬 Phase 2: Creating video from ${this.capturedFrames.length} frames...`);

        // Initialize MediaRecorder with optimal settings
        await this.initializeAdvancedMediaRecorder();
        
        // Start MediaRecorder
        this.mediaRecorder.start();
        const startTime = Date.now();

        // Stream frames to MediaRecorder at exact 30 FPS
        const targetFPS = 30; // Fixed at 30 FPS to match capture
        const frameInterval = 1000 / targetFPS; // 33.33ms per frame
        
        console.log(`🎬 Processing ${this.capturedFrames.length} frames at ${targetFPS} FPS (${frameInterval.toFixed(2)}ms per frame)`);
        
        for (let i = 0; i < this.capturedFrames.length; i++) {
            const frameData = this.capturedFrames[i];
            
            // Clear and draw frame to recording canvas
            const { width, height } = this.recordingDimensions;
            this.recordingContext.clearRect(0, 0, width, height);
            
            if (frameData.imageData) {
                // Draw captured ImageData
                this.recordingContext.putImageData(frameData.imageData, 0, 0);
            } else if (frameData.canvas) {
                // Draw captured canvas
                this.recordingContext.drawImage(frameData.canvas, 0, 0, width, height);
            }

            // Let MediaRecorder capture this frame with precise timing
            await new Promise(resolve => {
                setTimeout(() => {
                    const progress = (i / this.capturedFrames.length) * 100;
                    this.updateProgress(85 + (progress * 0.1), `Encoding frame ${i + 1}/${this.capturedFrames.length}...`);
                    resolve();
                }, frameInterval);
            });
        }

        // Stop recording and finalize
        this.mediaRecorder.stop();
        await this.finishRecording();
        
        // Calculate final video duration
        const finalDuration = this.capturedFrames.length / targetFPS;
        console.log(`✅ Video creation complete in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
        console.log(`✅ Final video duration: ${finalDuration.toFixed(1)}s at ${targetFPS} FPS`);
        
        // Clean up captured frames to free memory
        this.capturedFrames = [];
    }

    /**
     * Fallback frame capture method
     */
    fallbackFrameCapture(frameNumber) {
        const { width, height } = this.recordingDimensions;
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        canvas.width = width;
        canvas.height = height;
        
        // Just capture the map canvas as fallback
        const mapCanvas = this.app.mapRenderer.map.getCanvas();
        if (mapCanvas) {
            context.drawImage(mapCanvas, 0, 0, width, height);
        }

        return {
            canvas: canvas,
            frameNumber: frameNumber,
            timestamp: Date.now()
        };
    }

    /**
     * High-quality live stats drawing
     */
    async drawHighQualityLiveStats(context) {
        const liveStatsOverlay = document.getElementById('liveStatsOverlay');
        if (!liveStatsOverlay || liveStatsOverlay.style.display === 'none') return;

        const rect = liveStatsOverlay.getBoundingClientRect();
        const containerRect = this.videoCaptureContainer.getBoundingClientRect();
        
        const x = rect.left - containerRect.left;
        const y = rect.top - containerRect.top;

        const distanceElement = document.getElementById('liveDistance');
        const elevationElement = document.getElementById('liveElevation');
        
        if (distanceElement && elevationElement) {
            context.font = 'bold 18px Arial';
            context.fillStyle = 'rgba(255, 255, 255, 0.95)';
            context.strokeStyle = 'rgba(0, 0, 0, 0.8)';
            context.lineWidth = 3;

            // Draw distance with better styling
            const distanceText = `Distance: ${distanceElement.textContent}`;
            context.strokeText(distanceText, x + 10, y + 30);
            context.fillText(distanceText, x + 10, y + 30);

            // Draw elevation with better styling
            const elevationText = `Elevation: ${elevationElement.textContent}`;
            context.strokeText(elevationText, x + 10, y + 60);
            context.fillText(elevationText, x + 10, y + 60);
        }
    }

    /**
     * High-quality elevation profile drawing
     */
    async drawHighQualityElevationProfile(context) {
        const elevationContainer = document.querySelector('.elevation-profile-container');
        if (!elevationContainer || elevationContainer.style.display === 'none') return;

        const rect = elevationContainer.getBoundingClientRect();
        const containerRect = this.videoCaptureContainer.getBoundingClientRect();
        
        const x = rect.left - containerRect.left;
        const y = rect.top - containerRect.top;

        const progress = this.getAnimationProgress();
        const { width, height } = this.recordingDimensions;

        if (progress > 0) {
            const barWidth = Math.min(rect.width, width * 0.9);
            const barHeight = 8; // Slightly thicker for better visibility
            const barX = x;
            const barY = y + rect.height - 25;

            // Background with gradient
            const gradient = context.createLinearGradient(0, barY, 0, barY + barHeight);
            gradient.addColorStop(0, 'rgba(76, 175, 80, 0.4)');
            gradient.addColorStop(1, 'rgba(76, 175, 80, 0.2)');
            context.fillStyle = gradient;
            context.fillRect(barX, barY, barWidth, barHeight);

            // Progress with gradient
            const progressGradient = context.createLinearGradient(0, barY, 0, barY + barHeight);
            progressGradient.addColorStop(0, 'rgba(193, 101, 47, 0.9)');
            progressGradient.addColorStop(1, 'rgba(193, 101, 47, 0.7)');
            context.fillStyle = progressGradient;
            context.fillRect(barX, barY, barWidth * progress, barHeight);

            // Add border
            context.strokeStyle = '#4CAF50';
            context.lineWidth = 1;
            context.strokeRect(barX, barY, barWidth, barHeight);
        }
    }

    /**
     * High-quality logo drawing
     */
    async drawHighQualityLogo(context) {
        const logoElement = document.querySelector('.map-watermark img');
        if (!logoElement || logoElement.style.display === 'none') return;

        try {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            return new Promise((resolve) => {
                img.onload = () => {
                    const rect = logoElement.getBoundingClientRect();
                    const containerRect = this.videoCaptureContainer.getBoundingClientRect();
                    
                    const x = rect.left - containerRect.left;
                    const y = rect.top - containerRect.top;
                    
                    // Draw with high quality
                    context.imageSmoothingEnabled = true;
                    context.imageSmoothingQuality = 'high';
                    context.drawImage(img, x, y, rect.width, rect.height);
                    resolve();
                };
                img.onerror = () => resolve();
                img.src = logoElement.src;
            });
        } catch (error) {
            console.warn('Failed to draw high-quality logo:', error);
        }
    }

    /**
     * High-quality annotations drawing
     */
    async drawHighQualityAnnotations(context) {
        const activeAnnotation = document.getElementById('activeAnnotation');
        if (!activeAnnotation || activeAnnotation.style.display === 'none') return;

        const rect = activeAnnotation.getBoundingClientRect();
        const containerRect = this.videoCaptureContainer.getBoundingClientRect();
        
        const x = rect.left - containerRect.left;
        const y = rect.top - containerRect.top;

        const titleElement = activeAnnotation.querySelector('.annotation-popup-title');
        const descElement = activeAnnotation.querySelector('.annotation-popup-description');

        if (titleElement || descElement) {
            // Draw background with rounded corners effect
            context.fillStyle = 'rgba(0, 0, 0, 0.85)';
            context.fillRect(x, y, Math.min(rect.width, 350), Math.min(rect.height, 120));

            // Draw border
            context.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            context.lineWidth = 1;
            context.strokeRect(x, y, Math.min(rect.width, 350), Math.min(rect.height, 120));

            // Draw text with high quality
            context.textAlign = 'left';
            context.textBaseline = 'top';
            
            if (titleElement && titleElement.textContent) {
                context.font = 'bold 16px Arial';
                context.fillStyle = 'white';
                context.fillText(titleElement.textContent, x + 15, y + 15);
            }
            
            if (descElement && descElement.textContent) {
                context.font = '14px Arial';
                context.fillStyle = 'rgba(255, 255, 255, 0.9)';
                context.fillText(descElement.textContent, x + 15, y + 45);
            }
        }
    }

    /**
     * Draw the live stats overlay from DOM
     */
    async drawLiveStatsOverlay() {
        const liveStatsOverlay = document.getElementById('liveStatsOverlay');
        if (!liveStatsOverlay || liveStatsOverlay.style.display === 'none') return;

        const rect = liveStatsOverlay.getBoundingClientRect();
        const containerRect = this.videoCaptureContainer.getBoundingClientRect();
        
        // Calculate relative position within the container
        const x = rect.left - containerRect.left;
        const y = rect.top - containerRect.top;

        // Get the stats text from DOM
        const distanceElement = document.getElementById('liveDistance');
        const elevationElement = document.getElementById('liveElevation');
        
        if (distanceElement && elevationElement) {
            const ctx = this.recordingContext;
            ctx.font = '16px Arial';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.lineWidth = 2;

            // Draw distance
            const distanceText = `Distance: ${distanceElement.textContent}`;
            ctx.strokeText(distanceText, x + 10, y + 25);
            ctx.fillText(distanceText, x + 10, y + 25);

            // Draw elevation
            const elevationText = `Elevation: ${elevationElement.textContent}`;
            ctx.strokeText(elevationText, x + 10, y + 50);
            ctx.fillText(elevationText, x + 10, y + 50);
        }
    }

    /**
     * Draw the elevation profile from DOM
     */
    async drawElevationProfile() {
        const elevationContainer = document.querySelector('.elevation-profile-container');
        if (!elevationContainer || elevationContainer.style.display === 'none') return;

        const rect = elevationContainer.getBoundingClientRect();
        const containerRect = this.videoCaptureContainer.getBoundingClientRect();
        
        // Calculate relative position within the container
        const x = rect.left - containerRect.left;
        const y = rect.top - containerRect.top;

        // Get current progress for the progress bar
        const progress = this.getAnimationProgress();
        const { width, height } = this.recordingDimensions;

        if (progress > 0) {
            const ctx = this.recordingContext;
            const barWidth = Math.min(rect.width, width * 0.9);
            const barHeight = 6;
            const barX = x;
            const barY = y + rect.height - 20;

            // Background
            ctx.fillStyle = 'rgba(76, 175, 80, 0.3)';
            ctx.fillRect(barX, barY, barWidth, barHeight);

            // Progress
            ctx.fillStyle = '#C1652F';
            ctx.fillRect(barX, barY, barWidth * progress, barHeight);
        }
    }

    /**
     * Draw the logo watermark from DOM
     */
    async drawLogoWatermark() {
        const logoElement = document.querySelector('.map-watermark img');
        if (!logoElement || logoElement.style.display === 'none') return;

        try {
            // Create an image element and draw it
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            return new Promise((resolve) => {
                img.onload = () => {
                    const rect = logoElement.getBoundingClientRect();
                    const containerRect = this.videoCaptureContainer.getBoundingClientRect();
                    
                    const x = rect.left - containerRect.left;
                    const y = rect.top - containerRect.top;
                    
                    this.recordingContext.drawImage(img, x, y, rect.width, rect.height);
                    resolve();
                };
                img.onerror = () => resolve(); // Continue even if logo fails to load
                img.src = logoElement.src;
            });
        } catch (error) {
            console.warn('Failed to draw logo watermark:', error);
        }
    }

    /**
     * Draw any active annotations from DOM
     */
    async drawActiveAnnotations() {
        const activeAnnotation = document.getElementById('activeAnnotation');
        if (!activeAnnotation || activeAnnotation.style.display === 'none') return;

        const rect = activeAnnotation.getBoundingClientRect();
        const containerRect = this.videoCaptureContainer.getBoundingClientRect();
        
        // Calculate relative position within the container
        const x = rect.left - containerRect.left;
        const y = rect.top - containerRect.top;

        // Draw annotation popup (simplified version)
        const ctx = this.recordingContext;
        const titleElement = activeAnnotation.querySelector('.annotation-popup-title');
        const descElement = activeAnnotation.querySelector('.annotation-popup-description');

        if (titleElement || descElement) {
            // Draw background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.fillRect(x, y, Math.min(rect.width, 300), Math.min(rect.height, 100));

            // Draw text
            ctx.font = '14px Arial';
            ctx.fillStyle = 'white';
            
            if (titleElement && titleElement.textContent) {
                ctx.fillText(titleElement.textContent, x + 10, y + 20);
            }
            
            if (descElement && descElement.textContent) {
                ctx.font = '12px Arial';
                ctx.fillText(descElement.textContent, x + 10, y + 40);
            }
        }
    }

    /**
     * Encode frame using WebCodecs
     */
    encodeFrameWithWebCodecs(frameNumber) {
        if (!this.webCodecsEncoder) return;

        const targetFPS = 30;
        // Create VideoFrame from canvas with precise timing
        const frame = new VideoFrame(this.recordingCanvas, {
            timestamp: frameNumber * (1000000 / targetFPS) // microseconds, exactly 30 FPS
        });

        // Encode the frame
        this.webCodecsEncoder.encode(frame);
        frame.close();
    }

    /**
     * Finish recording process
     */
    async finishRecording() {
        this.updateProgress(95, 'Finalizing recording...');

        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
        }

        if (this.webCodecsEncoder) {
            await this.webCodecsEncoder.flush();
            this.webCodecsEncoder.close();
            this.processWebCodecsVideo();
        }
    }

    /**
     * Get current animation progress (0-1)
     */
    getAnimationProgress() {
        try {
            if (this.app.mapRenderer && this.app.mapRenderer.getAnimationProgress) {
                return this.app.mapRenderer.getAnimationProgress();
            } else if (this.app.map && this.app.map.getCurrentProgress) {
                return this.app.map.getCurrentProgress();
            }
            return 0;
        } catch (error) {
            console.warn('Error getting animation progress:', error);
            return 0;
        }
    }

    /**
     * Check if animation is currently playing
     */
    isAnimationPlaying() {
        try {
            // Check multiple possible sources
            if (this.app.state && typeof this.app.state.isPlaying === 'boolean') {
                return this.app.state.isPlaying;
            } else if (typeof this.app.isPlaying === 'boolean') {
                return this.app.isPlaying;
            } else if (this.app.playback && typeof this.app.playback.isPlaying === 'boolean') {
                return this.app.playback.isPlaying;
            }
            return false;
        } catch (error) {
            console.warn('Error checking animation state:', error);
            return false;
        }
    }

    /**
     * Get current stats for overlay rendering
     */
    getCurrentStats() {
        try {
            if (!this.app.mapRenderer || !this.app.currentTrackData) {
                return null;
            }

            const progress = this.getAnimationProgress();
            
            // Calculate current distance
            let currentDistance = 0;
            if (this.app.currentTrackData.isJourney && this.app.currentTrackData.segments) {
                // For journeys, use the stats controller method if available
                if (this.app.stats && this.app.stats.calculateJourneyCurrentDistance) {
                    currentDistance = this.app.stats.calculateJourneyCurrentDistance(progress);
                }
            } else {
                // For single tracks
                const totalDistance = this.app.currentTrackData.stats?.totalDistance || 0;
                currentDistance = progress * totalDistance;
            }

            // Calculate current elevation gain
            let currentElevationGain = 0;
            if (this.app.stats && this.app.stats.calculateActualElevationGain) {
                currentElevationGain = this.app.stats.calculateActualElevationGain(progress);
            }

            // Get current speed (if available from journey data)
            let currentSpeed = 0;
            if (this.app.mapRenderer.gpxParser && this.app.mapRenderer.gpxParser.getInterpolatedPoint) {
                const currentPoint = this.app.mapRenderer.gpxParser.getInterpolatedPoint(progress);
                if (currentPoint && currentPoint.speed) {
                    currentSpeed = currentPoint.speed;
                }
            }

            return {
                distance: this.app.gpxParser ? this.app.gpxParser.formatDistance(currentDistance) : currentDistance.toFixed(1) + ' km',
                elevation: this.app.gpxParser ? this.app.gpxParser.formatElevation(currentElevationGain) : currentElevationGain.toFixed(0) + ' m',
                speed: currentSpeed > 0 ? currentSpeed.toFixed(1) + ' km/h' : '0 km/h'
            };
        } catch (error) {
            console.warn('Error getting current stats:', error);
            return null;
        }
    }

    /**
     * Estimate animation duration for file size calculation
     */
    estimateAnimationDuration() {
        try {
            // Try to get actual duration from playback controller
            if (this.app.playback && this.app.playback.getTotalDuration) {
                const duration = this.app.playback.getTotalDuration();
                if (duration > 0) {
                    console.log(`Using actual animation duration: ${duration}s`);
                    return duration;
                }
            }

            // Fallback: estimate based on track data
            if (this.app.currentTrackData && this.app.currentTrackData.coordinates) {
                // Assume ~2-5 seconds per coordinate depending on track complexity
                const pointCount = this.app.currentTrackData.coordinates.length;
                const estimated = Math.max(10, Math.min(300, pointCount * 3)); // 10s min, 300s max
                console.log(`Estimated duration from ${pointCount} coordinates: ${estimated}s`);
                return estimated;
            }

            // Default fallback
            console.log('Using default duration fallback: 60s');
            return 60; // 1 minute default
        } catch (error) {
            console.warn('Error estimating animation duration:', error);
            return 60; // Safe fallback
        }
    }

    /**
     * Process the recorded video with enhanced features
     */
    processAdvancedRecordedVideo() {
        if (this.recordedChunks.length === 0) {
            this.app.showMessage('No video data recorded', 'error');
            this.cleanup();
            return;
        }

        this.updateProgress(98, 'Processing MP4 file...');

        // Create blob with MP4 mime type
        const mimeType = this.selectedMP4Codec || 'video/mp4';
        const blob = new Blob(this.recordedChunks, { type: mimeType });
        
        // Log final file size
        const finalSize = MP4Utils.formatFileSize(blob.size);
        console.log(`Final MP4 file size: ${finalSize}`);
        
        // Generate optimized filename
        const filename = MP4Utils.generateFilename('trail-replay', 'mp4', true);

        // Download using enhanced method
        MP4Utils.downloadBlob(blob, filename, (progress) => {
            if (progress <= 100) {
                this.updateProgress(98 + (progress * 0.02), `Downloading... ${progress}%`);
            }
        }).then(() => {
            this.updateProgress(100, 'MP4 export complete!');
            this.app.showMessage(`MP4 video exported successfully: ${filename} (${finalSize})`, 'success');
            
            // Clean up after delay
            setTimeout(() => {
                this.cleanup();
            }, 2000);
        }).catch((error) => {
            console.error('Download failed:', error);
            this.app.showMessage('Failed to download MP4 file', 'error');
            this.cleanup();
        });
    }

    /**
     * Process WebCodecs encoded video
     */
    processWebCodecsVideo() {
        if (this.webCodecsFrames.length === 0) {
            this.app.showMessage('No encoded frames available', 'error');
            this.cleanup();
            return;
        }

        // This would typically require additional MP4 muxing
        // For now, fallback to MediaRecorder approach
        console.log('WebCodecs frames encoded:', this.webCodecsFrames.length);
        this.app.showMessage('WebCodecs encoding complete, but MP4 muxing not yet implemented. Please use WebM format.', 'warning');
        this.cleanup();
    }

    /**
     * Start manual recording mode
     */
    async startManualRecording() {
        console.log('🎥 Starting manual recording mode...');

        // Show instructions
        const shouldStart = await this.showManualRecordingInstructions();
        if (!shouldStart) return;

        try {
            this.isExporting = true;
            this.currentExportMode = 'manual';

            this.createProgressModal();
            this.updateProgress(10, 'Preparing for manual recording...');

            // Prepare environment
            await this.prepareForExport();
            this.updateProgress(30, 'Environment prepared...');

            // Preload tiles
            this.updateProgress(50, 'Preloading map tiles...');
            await this.preloadTiles((progress) => {
                this.updateProgress(50 + (progress * 40), `Loading tiles... ${Math.round(progress)}%`);
            });

            // Hide progress modal
            if (this.progressModal) {
                this.progressModal.remove();
                this.progressModal = null;
            }

            // Enable manual recording mode
            this.enableManualRecordingMode();

            // Show recording area highlight
            this.highlightRecordingArea();

            // Auto-start animation
            this.app.playback.reset();
            setTimeout(() => {
                this.app.playback.play();
                this.app.showMessage('🎥 Manual recording active - Press Escape or Reset to exit anytime', 'success');
            }, 500);

        } catch (error) {
            console.error('Manual recording setup failed:', error);
            this.app.showMessage(`Manual recording setup failed: ${error.message}`, 'error');
            this.cleanup();
        }
    }

    /**
     * Get the best supported MIME type from a list
     */
    getBestMimeType(mimeTypes) {
        for (const mimeType of mimeTypes) {
            if (MediaRecorder.isTypeSupported(mimeType)) {
                console.log(`Selected MIME type: ${mimeType}`);
                return mimeType;
            }
        }
        
        // Fallback
        console.warn('No preferred MIME types supported, using fallback');
        return 'video/webm';
    }

    /**
     * Setup MediaRecorder with the specified MIME type
     */
    async setupMediaRecorder(mimeType, expectedExtension) {
        if (!this.stream) {
            throw new Error('No stream available for recording');
        }

        const options = {
            mimeType: mimeType,
            bitsPerSecond: 4000000  // 4 Mbps for good quality
        };

        this.mediaRecorder = new MediaRecorder(this.stream, options);
        this.recordedChunks = [];

        // Setup event handlers
        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                this.recordedChunks.push(event.data);
                console.log(`Data chunk received: ${event.data.size} bytes`);
            }
        };

        this.mediaRecorder.onstop = () => {
            console.log('MediaRecorder stopped');
            this.processRecordedVideo(mimeType, expectedExtension);
        };

        this.mediaRecorder.onerror = (event) => {
            console.error('MediaRecorder error:', event.error);
            this.app.showMessage(`Recording error: ${event.error.name}`, 'error');
            this.cleanup();
        };

        console.log(`MediaRecorder created with MIME type: ${mimeType}`);
    }

    /**
     * Start the actual recording process
     */
    async startRecording() {
        if (!this.mediaRecorder) {
            throw new Error('MediaRecorder not initialized');
        }

        // Start MediaRecorder
        this.mediaRecorder.start(1000); // Request data every second
        console.log('MediaRecorder started');

        // Start animation
        this.app.playback.reset();
        this.app.playback.play();

        // Monitor recording progress
        await this.monitorRecording();
    }

    /**
     * Monitor recording progress until animation completes
     */
    async monitorRecording() {
        return new Promise((resolve) => {
            const startTime = performance.now();
            let frameCount = 0;

            const checkProgress = () => {
                const progress = this.app.mapRenderer.getAnimationProgress();
                frameCount++;

                // Update progress every 30 frames
                if (frameCount % 30 === 0) {
                    const recordingProgress = 75 + (progress * 20); // 75-95% range
                    const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
                    this.updateProgress(recordingProgress, `Recording... ${(progress * 100).toFixed(1)}% (${elapsed}s)`);
                }

                // Check if animation is complete
                if (progress >= 1 || !this.app.state.isPlaying) {
                    if (this.mediaRecorder.state === 'recording') {
                        this.mediaRecorder.stop();
                    }
                    resolve();
                } else {
                    requestAnimationFrame(checkProgress);
                }
            };

            checkProgress();
        });
    }

    /**
     * Process recorded video data and create download
     */
    processRecordedVideo(mimeType, expectedExtension) {
        this.updateProgress(95, 'Processing video file...');

        if (this.recordedChunks.length === 0) {
            console.error('No recorded chunks available');
            this.app.showMessage('No video data was recorded. Please try again.', 'error');
            this.cleanup();
            return;
        }

        // Create blob
        const blob = new Blob(this.recordedChunks, { type: mimeType });
        console.log(`Video blob created: ${blob.size} bytes, type: ${blob.type}`);

        if (blob.size === 0) {
            console.error('Generated video blob has 0 bytes');
            this.app.showMessage('Generated video is empty. Please try again.', 'error');
            this.cleanup();
            return;
        }

        // Determine file extension
        const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';
        const filename = `trail-replay-animation.${extension}`;

        // Create download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();

        // Cleanup URL after delay
        setTimeout(() => URL.revokeObjectURL(url), 10000);

        this.updateProgress(100, 'Video export complete!');
        
        setTimeout(() => {
            this.app.showMessage('Export complete!', 'success');
            this.cleanup();
        }, 1000);
    }

    /**
     * Prepare environment for export
     */
    async prepareForExport() {
        // Reset animation to beginning
        this.app.playback.reset();
        
        // Enable performance mode if available
        if (this.app.mapRenderer.setPerformanceMode) {
            this.app.mapRenderer.setPerformanceMode(true);
        }

        // Ensure map is ready
        await this.waitForMapReady();
    }

    /**
     * Preload map tiles for smooth recording
     */
    async preloadTiles(progressCallback) {
        if (this.app.enhancedTilePreloading) {
            await this.app.enhancedTilePreloading(progressCallback);
        } else {
            // Basic preloading fallback
            progressCallback(100);
        }
    }

    /**
     * Wait for map to be ready
     */
    async waitForMapReady() {
        if (this.app.waitForMapTilesToLoadWithTimeout) {
            await this.app.waitForMapTilesToLoadWithTimeout(8000);
        }
    }

    /**
     * Hide UI elements during recording
     */
    hideUIForRecording() {
        const elementsToHide = [
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

        elementsToHide.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                element.style.display = 'none';
            });
        });

        // Hide progress modal during recording
        if (this.progressModal) {
            this.progressModal.style.visibility = 'hidden';
        }

        // Set recording mode flags
        this.app.recordingMode = true;
        this.app.overlayRecordingMode = true;
    }

    /**
     * Show UI elements after recording
     */
    showUIAfterRecording() {
        const elementsToShow = [
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

        elementsToShow.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                element.style.display = '';
            });
        });

        // Show progress modal
        if (this.progressModal) {
            this.progressModal.style.visibility = 'visible';
        }

        // Reset recording mode flags
        this.app.recordingMode = false;
        this.app.overlayRecordingMode = false;
    }

    /**
     * Enable manual recording mode
     */
    enableManualRecordingMode() {
        // Enable live stats display
        if (this.app.stats && this.app.stats.toggleLiveStats) {
            this.app.stats.toggleLiveStats(true);
        }
        
        // Set recording mode flags for overlays
        this.app.recordingMode = true;
        this.app.overlayRecordingMode = true;
    }

    /**
     * Highlight the recording area for manual recording
     */
    highlightRecordingArea() {
        const videoCaptureContainer = document.getElementById('videoCaptureContainer');
        if (videoCaptureContainer) {
            videoCaptureContainer.classList.add('recording-highlight');
        }
    }

    /**
     * Remove recording area highlight
     */
    removeRecordingHighlight() {
        const videoCaptureContainer = document.getElementById('videoCaptureContainer');
        if (videoCaptureContainer) {
            videoCaptureContainer.classList.remove('recording-highlight');
        }
    }

    /**
     * Create progress modal
     */
    createProgressModal() {
        this.progressModal = document.createElement('div');
        this.progressModal.className = 'modal enhanced-progress-modal';
        this.progressModal.innerHTML = `
            <div class="modal-content enhanced-progress-content">
                <h3 style="margin-bottom: 1rem; color: var(--evergreen);">
                    🎬 Video Export
                </h3>
                <div class="progress-container">
                    <div class="progress-bar" id="exportProgressBar">
                        <div class="progress-fill" style="width: 0%"></div>
                    </div>
                    <div class="progress-text" id="exportProgressText">Initializing...</div>
                </div>
                <div class="export-tips" style="margin-top: 1rem; font-size: 0.9rem; color: var(--text-secondary);">
                    <div style="margin-bottom: 0.5rem;">📱 Keep this browser tab active</div>
                    <div style="margin-bottom: 0.5rem;">🖥️ Close other applications for best performance</div>
                    <div>⏳ Let the export complete without interruption</div>
                </div>
            </div>
        `;
        document.body.appendChild(this.progressModal);
    }

    /**
     * Update progress modal
     */
    updateProgress(percent, status) {
        const progressBar = document.getElementById('exportProgressBar');
        const progressText = document.getElementById('exportProgressText');
        if (progressBar && progressText) {
            progressBar.querySelector('.progress-fill').style.width = percent + '%';
            progressText.textContent = status;
        }
    }

    /**
     * Show export confirmation dialog
     */
    async showExportConfirmation(mode) {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>${this.exportModes[mode].icon} ${this.exportModes[mode].name}</h3>
                    </div>
                    <div class="modal-body">
                        <p>${this.exportModes[mode].description}</p>
                        <div class="export-confirmation-tips">
                            <h4>Before exporting:</h4>
                            <ul>
                                <li>Ensure good system performance</li>
                                <li>Close unnecessary applications</li>
                                <li>Keep this browser tab active during export</li>
                            </ul>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" id="cancelExport">Cancel</button>
                        <button class="btn btn-primary" id="confirmExport">Start Export</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            const cleanup = () => {
                document.body.removeChild(modal);
            };
            
            modal.querySelector('#cancelExport').addEventListener('click', () => {
                cleanup();
                resolve(false);
            });
            
            modal.querySelector('#confirmExport').addEventListener('click', () => {
                cleanup();
                resolve(true);
            });
        });
    }

    /**
     * Show manual recording instructions
     */
    async showManualRecordingInstructions() {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'modal manual-recording-modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Manual Recording Instructions</h3>
                    </div>
                    <div class="modal-body">
                        <div class="recording-instructions">
                            <h4>How to record:</h4>
                            <ol>
                                <li>The recording area will be highlighted in orange</li>
                                <li>Use your system's screen recorder to capture the highlighted area</li>
                                <li>Animation will start automatically with all statistics visible</li>
                                <li>Record until the animation completes</li>
                                <li>Press <kbd>Escape</kbd> or <kbd>Reset</kbd> to exit recording mode anytime</li>
                            </ol>
                        </div>
                        <div class="recording-tips">
                            <h4>Screen recording shortcuts:</h4>
                            <ul>
                                <li><strong>Windows:</strong> <kbd>Win</kbd> + <kbd>G</kbd> → Game Bar → Record</li>
                                <li><strong>Mac:</strong> <kbd>⌘</kbd> + <kbd>⇧</kbd> + <kbd>5</kbd> → Record Selected Portion</li>
                                <li>Use fullscreen mode for best quality</li>
                                <li>Ensure good system performance</li>
                            </ul>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" id="cancelManual">Cancel</button>
                        <button class="btn btn-primary" id="startManual">Start Preparation</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            const cleanup = () => {
                document.body.removeChild(modal);
            };
            
            modal.querySelector('#cancelManual').addEventListener('click', () => {
                cleanup();
                resolve(false);
            });
            
            modal.querySelector('#startManual').addEventListener('click', () => {
                cleanup();
                resolve(true);
            });
        });
    }

    /**
     * Setup keyboard handler for manual recording mode
     */
    setupManualRecordingKeyboardHandler() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.currentExportMode === 'manual' && this.isExporting) {
                console.log('Escape pressed - exiting manual recording mode');
                this.cleanup();
                this.app.showMessage('Manual recording mode exited', 'info');
            }
        });

        // Listen for reset button clicks to exit manual recording mode
        this.setupResetListener();
    }

    /**
     * Setup reset button listener to exit manual recording mode
     */
    setupResetListener() {
        const resetBtn = document.getElementById('resetBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (this.currentExportMode === 'manual' && this.isExporting) {
                    console.log('Reset pressed during manual recording - exiting manual recording mode');
                    this.cleanup();
                    this.app.showMessage('Manual recording mode exited', 'info');
                }
            });
        }
    }

    /**
     * Cleanup export resources
     */
    cleanup() {
        console.log('🧹 Cleaning up video export...');

        this.isExporting = false;
        this.currentExportMode = null;

        // Stop MediaRecorder
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
        }
        this.mediaRecorder = null;

        // Clean up WebCodecs encoder
        if (this.webCodecsEncoder) {
            try {
                this.webCodecsEncoder.close();
                this.webCodecsEncoder = null;
            } catch (error) {
                console.warn('Error closing WebCodecs encoder:', error);
            }
        }

        // Clean up recording canvas
        if (this.recordingCanvas) {
            if (this.recordingCanvas.parentNode) {
                this.recordingCanvas.parentNode.removeChild(this.recordingCanvas);
            }
            this.recordingCanvas = null;
            this.recordingContext = null;
        }

        // Stop stream
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        // Remove progress modal
        if (this.progressModal) {
            this.progressModal.remove();
            this.progressModal = null;
        }

        // Show UI elements
        this.showUIAfterRecording();

        // Remove recording highlight
        this.removeRecordingHighlight();

        // Disable performance mode
        if (this.app.mapRenderer && this.app.mapRenderer.setPerformanceMode) {
            this.app.mapRenderer.setPerformanceMode(false);
        }

        // Clear recorded chunks and frames
        this.recordedChunks = [];
        this.webCodecsFrames = [];

        // Reset recording flags
        this.selectedMP4Codec = null;
        this.useWebCodecs = false;
        this.recordingDimensions = null;

        console.log('✅ Video export cleanup complete');
    }

    /**
     * Destroy the controller
     */
    destroy() {
        this.cleanup();
        
        // Remove event listeners
        const exportPanel = document.getElementById('exportPanel');
        if (exportPanel) {
            exportPanel.remove();
        }
    }
} 