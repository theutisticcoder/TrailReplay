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

            // Step 3: Setup canvas recording infrastructure
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

            // Step 7: Initialize MediaRecorder with optimal settings
            this.updateProgress(70, 'Initializing video encoder...');
            console.log('🎬 Starting MediaRecorder initialization...');
            await this.initializeAdvancedMediaRecorder();
            console.log('✅ MediaRecorder initialization complete');
            
            // Step 8: Start the recording process
            this.updateProgress(80, 'Starting MP4 recording...');
            console.log('🎬 Starting recording process...');
            await this.startAdvancedRecording();
            console.log('✅ Recording process started');

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
     * Setup canvas recording infrastructure similar to MapDirector
     */
    async setupCanvasRecording() {
        // Get the map canvas
        const mapCanvas = this.app.mapRenderer.map.getCanvas();
        if (!mapCanvas) {
            throw new Error('Map canvas not available');
        }

        // Get optimal recording settings based on device capabilities
        const optimalSettings = MP4Utils.getOptimalRecordingSettings();
        console.log('Using optimal recording settings:', optimalSettings);

        // Create a composite canvas for recording (similar to MapDirector's approach)
        this.recordingCanvas = document.createElement('canvas');
        this.recordingContext = this.recordingCanvas.getContext('2d');
        
        // Set high resolution for better quality
        const { width, height, devicePixelRatio } = optimalSettings;
        
        this.recordingCanvas.width = width * devicePixelRatio;
        this.recordingCanvas.height = height * devicePixelRatio;
        this.recordingCanvas.style.width = width + 'px';
        this.recordingCanvas.style.height = height + 'px';
        
        // Scale context to match device pixel ratio
        this.recordingContext.scale(devicePixelRatio, devicePixelRatio);
        
        // Store dimensions and settings for later use
        this.recordingDimensions = optimalSettings;
        this.optimalSettings = optimalSettings;
        
        // Add canvas to hidden container for reference (don't display it)
        this.recordingCanvas.style.position = 'absolute';
        this.recordingCanvas.style.left = '-9999px';
        this.recordingCanvas.style.top = '-9999px';
        document.body.appendChild(this.recordingCanvas);
        
        console.log(`Recording canvas created: ${width}x${height} (${devicePixelRatio}x DPI) @ ${optimalSettings.bitrate/1000000}Mbps`);
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

        // Create a stream from our recording canvas
        const stream = this.recordingCanvas.captureStream(this.optimalSettings.framerate);
        
        // Create optimized MediaRecorder options
        const options = MP4Utils.createMediaRecorderOptions(this.mp4CodecInfo, this.optimalSettings);
        
        // Estimate file size for user information
        console.log('📊 Estimating file size...');
        const estimatedDuration = this.estimateAnimationDuration();
        const sizeEstimate = MP4Utils.estimateFileSize(estimatedDuration, this.optimalSettings.bitrate);
        console.log(`📊 Estimated file size: ${sizeEstimate.displaySize} for ${estimatedDuration}s video`);

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

        console.log(`Advanced MediaRecorder initialized with: ${this.mp4CodecInfo.description} @ ${this.optimalSettings.bitrate/1000000}Mbps`);
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

        // Configure encoder for MP4/H.264
        const config = {
            codec: 'avc1.42E01E', // H.264 baseline profile
            width: this.recordingDimensions.width,
            height: this.recordingDimensions.height,
            bitrate: 8000000, // 8 Mbps
            framerate: 30,
            hardwareAcceleration: 'prefer-hardware'
        };

        this.webCodecsEncoder.configure(config);
        console.log('WebCodecs encoder configured for MP4');
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

            const renderFrame = (currentTime) => {
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
                        this.captureFrame(frameCount);
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
     * Capture a single frame to the recording canvas
     */
    captureFrame(frameNumber) {
        const mapCanvas = this.app.mapRenderer.map.getCanvas();
        const { width, height } = this.recordingDimensions;

        // Clear the recording canvas
        this.recordingContext.clearRect(0, 0, width, height);

        // Draw the map canvas
        this.recordingContext.drawImage(mapCanvas, 0, 0, width, height);

        // Add any overlays (stats, progress bar, etc.)
        this.renderOverlays();

        // If using WebCodecs, encode this frame
        if (this.webCodecsEncoder) {
            this.encodeFrameWithWebCodecs(frameNumber);
        }
    }

    /**
     * Render overlays on the recording canvas
     */
    renderOverlays() {
        const ctx = this.recordingContext;
        const { width, height } = this.recordingDimensions;

        // Get current stats
        const progress = this.getAnimationProgress();
        const stats = this.getCurrentStats();

        // Render progress indicator
        if (progress > 0) {
            const barWidth = width * 0.8;
            const barHeight = 6;
            const barX = (width - barWidth) / 2;
            const barY = height - 30;

            // Background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(barX, barY, barWidth, barHeight);

            // Progress
            ctx.fillStyle = '#4CAF50';
            ctx.fillRect(barX, barY, barWidth * progress, barHeight);
        }

        // Render stats if available
        if (stats) {
            ctx.font = '16px Arial';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.lineWidth = 2;

            const statsText = [
                `Speed: ${stats.speed || '0 km/h'}`,
                `Distance: ${stats.distance || '0 km'}`,
                `Elevation: ${stats.elevation || '0 m'}`
            ];

            statsText.forEach((text, index) => {
                const x = 20;
                const y = 30 + (index * 25);
                ctx.strokeText(text, x, y);
                ctx.fillText(text, x, y);
            });
        }
    }

    /**
     * Encode frame using WebCodecs
     */
    encodeFrameWithWebCodecs(frameNumber) {
        if (!this.webCodecsEncoder) return;

        // Create VideoFrame from canvas
        const frame = new VideoFrame(this.recordingCanvas, {
            timestamp: frameNumber * (1000000 / 30) // microseconds, 30 FPS
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