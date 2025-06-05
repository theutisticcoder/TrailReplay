export class PlaybackController {
    constructor(app) {
        this.app = app;
    }

    toggle() {
        if (this.app.state.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    play() {
        if (!this.app.currentTrackData && !this.app.journeyData) {
            console.warn('No track data loaded');
            return;
        }

        this.app.state.isPlaying = true;
        this.app.isPlaying = true; // Legacy compatibility
        
        // Update UI
        const playBtn = document.getElementById('playBtn');
        if (playBtn) {
            playBtn.innerHTML = '<i class="fa fa-pause"></i> Pause';
        }

        // Start the animation through map controller
        if (this.app.map && this.app.map.mapRenderer) {
            this.app.map.mapRenderer.startAnimation();
            this.app.startProgressUpdate();
        }
    }

    pause() {
        this.app.state.isPlaying = false;
        this.app.isPlaying = false; // Legacy compatibility
        
        // Update UI
        const playBtn = document.getElementById('playBtn');
        if (playBtn) {
            playBtn.innerHTML = '<i class="fa fa-play"></i> Play';
        }

        // Stop the animation through map controller
        if (this.app.map && this.app.map.mapRenderer) {
            this.app.map.mapRenderer.stopAnimation();
        }
    }

    reset() {
        this.pause();
        
        // Reset animation through map controller
        if (this.app.map && this.app.map.mapRenderer) {
            this.app.map.mapRenderer.resetAnimation();
        }

        // Reset stats
        this.app.stats.resetLiveStats();
        
        // Update progress display
        this.app.updateProgressDisplay();
        
        // Update elevation progress
        this.app.updateElevationProgress(0);
    }
} 