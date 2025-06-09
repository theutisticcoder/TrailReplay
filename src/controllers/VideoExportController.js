import { t } from '../translations.js';

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
                description: '⚠️ EXPERIMENTAL: Chrome 126+ only. Uses experimental CropTarget API. May not work reliably - use WebM mode if you encounter issues.'
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
        console.log('🚀 Starting MP4 export...');
        
        // Check for CropTarget support
        const supportsRegionCapture = 'CropTarget' in window && 'cropTo' in VideoTrack.prototype;
        
        if (!supportsRegionCapture) {
            this.app.showMessage('MP4 export requires Chrome 126+ with CropTarget API support', 'error');
            throw new Error('CropTarget API not supported');
        }

        this.createProgressModal();
        this.updateProgress(5, 'Preparing for MP4 export...');

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

            // Step 4: Setup screen capture with crop target
            this.updateProgress(65, 'Setting up screen capture...');
            
            // Get the video capture container
            const videoCaptureContainer = document.getElementById('videoCaptureContainer');
            if (!videoCaptureContainer) {
                throw new Error('Video capture container not found');
            }

            // Request display media
            this.stream = await navigator.mediaDevices.getDisplayMedia({
                video: { 
                    displaySurface: 'browser', 
                    preferCurrentTab: true,
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                    frameRate: { ideal: 30, max: 60 }
                },
                audio: false
            });

            // Apply crop target
            const [videoTrack] = this.stream.getVideoTracks();
            const cropTarget = await CropTarget.fromElement(videoCaptureContainer);
            await videoTrack.cropTo(cropTarget);
            
            this.updateProgress(70, 'Screen capture with crop target ready...');

            // Step 5: Setup MediaRecorder for MP4
            const mimeType = this.getBestMimeType(this.exportModes.mp4.mimeTypes);
            await this.setupMediaRecorder(mimeType, 'mp4');
            
            // Step 6: Start recording
            this.updateProgress(75, 'Starting recording...');
            await this.startRecording();

        } catch (error) {
            console.error('MP4 export failed:', error);
            throw error;
        }
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

        // Clear recorded chunks
        this.recordedChunks = [];

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