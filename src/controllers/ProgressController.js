export class ProgressController {
    constructor(app) {
        this.app = app;
        this.isDragging = false;
        this.wasPlaying = false;
        this.progressBar = null;
    }

    initialize() {
        this.progressBar = document.getElementById('progressBar');
        if (this.progressBar) {
            this.setupProgressBarScrubbing();
            this.setupSegmentVisualization();
        }
    }

    // Enhanced Progress bar scrubbing functionality
    setupProgressBarScrubbing() {
        if (!this.progressBar) return;

        // Add visual feedback for interaction
        this.progressBar.style.cursor = 'pointer';
        
        // Mouse events
        this.progressBar.addEventListener('mousedown', this.handleMouseDown.bind(this));
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));
        
        // Touch events for mobile
        this.progressBar.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        document.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        document.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
        
        // Handle mouse leave to stop dragging if mouse leaves the window
        document.addEventListener('mouseleave', this.handleMouseLeave.bind(this));
        
        // Visual feedback on hover
        this.progressBar.addEventListener('mouseenter', this.handleMouseEnter.bind(this));
        this.progressBar.addEventListener('mouseleave', this.handleMouseLeaveProgressBar.bind(this));
    }

    // Helper function to calculate progress from mouse/touch position
    getProgressFromEvent(e) {
        if (!this.progressBar) return 0;
        
        const rect = this.progressBar.getBoundingClientRect();
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
    }

    // Helper function to handle seeking to a specific progress
    seekToProgress(progress) {
        if (!this.app.mapRenderer || !this.app.currentTrackData) return;
        
        console.log('Seeking to progress:', progress.toFixed(3));
        
        // Check if in special modes (icon change or annotation)
        if (this.app.mapRenderer.isIconChangeMode) {
            const iconChangeEvent = new CustomEvent('iconChangeClick', {
                detail: { progress, coordinates: null }
            });
            document.dispatchEvent(iconChangeEvent);
            return;
        }
        
        if (this.app.mapRenderer.isAnnotationMode) {
            const annotationEvent = new CustomEvent('annotationClick', {
                detail: { progress, coordinates: null }
            });
            document.dispatchEvent(annotationEvent);
            return;
        }
        
        // Normal seeking - set the animation progress first
        this.app.mapRenderer.setAnimationProgress(progress);
        
        // Emit progress seek event for timing synchronization
        const progressSeekEvent = new CustomEvent('progressSeek', {
            detail: { progress }
        });
        document.dispatchEvent(progressSeekEvent);
        
        // For journeys, synchronize the segment timing with error handling
        if (this.app.currentTrackData.isJourney && this.app.currentTrackData.segmentTiming) {
            try {
                const segmentTime = this.app.convertLinearProgressToSegmentTime(progress);
                if (this.app.mapRenderer.setJourneyElapsedTime && segmentTime !== null && !isNaN(segmentTime)) {
                    this.app.mapRenderer.setJourneyElapsedTime(segmentTime);
                    console.log(`Journey seeking: progress ${progress.toFixed(3)} → time ${segmentTime.toFixed(1)}s`);
                } else {
                    // Fallback: use proportional time mapping
                    const totalDuration = this.app.currentTrackData.segmentTiming.totalDuration || this.app.state.totalAnimationTime;
                    const fallbackTime = progress * totalDuration;
                    if (this.app.mapRenderer.setJourneyElapsedTime) {
                        this.app.mapRenderer.setJourneyElapsedTime(fallbackTime);
                        console.log(`Journey seeking fallback: progress ${progress.toFixed(3)} → time ${fallbackTime.toFixed(1)}s`);
                    }
                }
            } catch (error) {
                console.warn('Error during journey seeking, using simple progress:', error);
                // Continue with simple progress-based seeking
            }
        }
        
        // Update the current position to match the new progress
        this.app.mapRenderer.updateCurrentPosition();
        
        // Update progress display
        this.app.updateProgressDisplay();
        
        // Update timeline progress indicator if available
        if (this.app.currentTrackData.isJourney) {
            this.app.updateTimelineProgressIndicator?.(progress);
        }
        
        // Auto-center view on new position if enabled
        if (this.app.currentTrackData?.trackPoints) {
            const currentPoint = this.app.mapRenderer.gpxParser.getInterpolatedPoint(progress);
            if (currentPoint && this.app.mapRenderer.map) {
                this.app.mapRenderer.map.easeTo({
                    center: [currentPoint.lon, currentPoint.lat],
                    duration: 300
                });
            }
        }
        
        console.log('Seek completed to progress:', progress.toFixed(3));
    }

    // Mouse event handlers
    handleMouseDown(e) {
        if (!this.app.mapRenderer || !this.app.currentTrackData) return;
        
        this.isDragging = true;
        this.wasPlaying = this.app.state.isPlaying;
        
        // Pause animation while dragging
        if (this.app.state.isPlaying) {
            this.app.playback.pause();
        }
        
        // Immediately seek to clicked position
        const progress = this.getProgressFromEvent(e);
        this.seekToProgress(progress);
        
        // Prevent text selection while dragging
        e.preventDefault();
    }

    handleMouseMove(e) {
        if (!this.isDragging || !this.app.mapRenderer || !this.app.currentTrackData) return;
        
        const progress = this.getProgressFromEvent(e);
        this.seekToProgress(progress);
        e.preventDefault();
    }

    handleMouseUp(e) {
        if (!this.isDragging) return;
        
        this.isDragging = false;
        
        // Get final position after dragging
        const finalProgress = this.getProgressFromEvent(e);
        this.seekToProgress(finalProgress);
        
        console.log(`Mouse released at progress: ${finalProgress.toFixed(3)}, wasPlaying: ${this.wasPlaying}`);
        
        // Resume playback if it was playing before dragging
        if (this.wasPlaying && !this.app.state.isPlaying) {
            console.log('Resuming playback from seeked position');
            // Use a longer delay to ensure seek is fully complete
            setTimeout(() => {
                if (!this.app.state.isPlaying) { // Double-check we're still not playing
                    this.app.playback.play();
                }
            }, 150);
        }
        
        e.preventDefault();
    }

    // Touch event handlers for mobile support
    handleTouchStart(e) {
        if (!this.app.mapRenderer || !this.app.currentTrackData) return;
        
        this.isDragging = true;
        this.wasPlaying = this.app.state.isPlaying;
        
        // Pause animation while dragging
        if (this.app.state.isPlaying) {
            this.app.playback.pause();
        }
        
        // Immediately seek to touched position
        const progress = this.getProgressFromEvent(e);
        this.seekToProgress(progress);
        
        e.preventDefault();
    }

    handleTouchMove(e) {
        if (!this.isDragging || !this.app.mapRenderer || !this.app.currentTrackData) return;
        
        const progress = this.getProgressFromEvent(e);
        this.seekToProgress(progress);
        e.preventDefault();
    }

    handleTouchEnd(e) {
        if (!this.isDragging) return;
        
        this.isDragging = false;
        
        // Get final position after dragging
        if (e.changedTouches && e.changedTouches.length > 0) {
            const finalProgress = this.getProgressFromEvent(e);
            this.seekToProgress(finalProgress);
            console.log(`Touch ended at progress: ${finalProgress.toFixed(3)}, wasPlaying: ${this.wasPlaying}`);
        }
        
        // Resume playback if it was playing before dragging
        if (this.wasPlaying && !this.app.state.isPlaying) {
            console.log('Resuming playback from seeked position (touch)');
            // Use a longer delay to ensure seek is fully complete
            setTimeout(() => {
                if (!this.app.state.isPlaying) { // Double-check we're still not playing
                    this.app.playback.play();
                }
            }, 150);
        }
        
        e.preventDefault();
    }

    // Visual feedback handlers
    handleMouseEnter() {
        if (!this.isDragging && this.progressBar) {
            this.progressBar.style.transform = 'scaleY(1.1)';
            this.progressBar.style.transition = 'transform 0.2s ease';
        }
    }

    handleMouseLeaveProgressBar() {
        if (!this.isDragging && this.progressBar) {
            this.progressBar.style.transform = 'scaleY(1)';
        }
    }

    handleMouseLeave() {
        if (this.isDragging) {
            this.isDragging = false;
            if (this.wasPlaying && !this.app.state.isPlaying) {
                this.app.playback.play();
            }
        }
    }

    // Clean up event listeners when needed
    destroy() {
        if (this.progressBar) {
            this.progressBar.removeEventListener('mousedown', this.handleMouseDown);
            this.progressBar.removeEventListener('touchstart', this.handleTouchStart);
            this.progressBar.removeEventListener('mouseenter', this.handleMouseEnter);
            this.progressBar.removeEventListener('mouseleave', this.handleMouseLeaveProgressBar);
        }
        
        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('mouseup', this.handleMouseUp);
        document.removeEventListener('touchmove', this.handleTouchMove);
        document.removeEventListener('touchend', this.handleTouchEnd);
        document.removeEventListener('mouseleave', this.handleMouseLeave);
    }

    // Set up visualization for journey segments on progress bar
    setupSegmentVisualization() {
        // Listen for journey data loaded to visualize segments
        document.addEventListener('journeyDataLoaded', (e) => {
            this.updateSegmentVisualization();
        });
    }

    // Update segment visualization on progress bar
    updateSegmentVisualization() {
        if (!this.app.currentTrackData?.isJourney || !this.app.currentTrackData?.segments) {
            return;
        }

        // Find or create segment markers container
        let segmentMarkers = document.getElementById('segmentMarkers');
        if (!segmentMarkers) {
            segmentMarkers = document.createElement('div');
            segmentMarkers.id = 'segmentMarkers';
            segmentMarkers.className = 'segment-markers';
            
            // Insert after progress bar
            const progressContainer = this.progressBar.parentNode;
            progressContainer.appendChild(segmentMarkers);
        }

        segmentMarkers.innerHTML = '';

        const segments = this.app.currentTrackData.segments;
        const totalCoordinates = this.app.currentTrackData.trackPoints.length;
        let currentIndex = 0;

        segments.forEach((segment, index) => {
            const segmentLength = segment.endIndex - segment.startIndex + 1;
            const startProgress = currentIndex / (totalCoordinates - 1);
            const endProgress = (currentIndex + segmentLength - 1) / (totalCoordinates - 1);

            // Create segment indicator
            const segmentIndicator = document.createElement('div');
            segmentIndicator.className = `segment-indicator ${segment.type}`;
            segmentIndicator.style.left = `${startProgress * 100}%`;
            segmentIndicator.style.width = `${(endProgress - startProgress) * 100}%`;
            
            // Add tooltip
            let tooltipText = '';
            if (segment.type === 'track') {
                const activity = segment.data?.data?.activityType || segment.data?.activityType || 'activity';
                tooltipText = `Track: ${activity}`;
            } else if (segment.type === 'transportation') {
                tooltipText = `Transport: ${segment.mode}`;
            }
            
            segmentIndicator.title = tooltipText;
            segmentIndicator.setAttribute('data-segment-type', segment.type);
            segmentIndicator.setAttribute('data-segment-index', index);

            segmentMarkers.appendChild(segmentIndicator);
            currentIndex = segment.endIndex + 1;
        });

        console.log('Updated segment visualization for', segments.length, 'segments');
    }
} 