import { JourneyCore } from './JourneyCore.js';
import { JourneyTracksUI } from './JourneyTracksUI.js';
import { JourneySegmentsUI } from './JourneySegmentsUI.js';
import { JourneyRouteManager } from './JourneyRouteManager.js';
import { JourneyTiming } from './JourneyTiming.js';
import { t } from '../translations.js';

export class JourneyBuilder {
    constructor() {
        // Initialize core components
        this.core = new JourneyCore();
        this.routeManager = new JourneyRouteManager(this.core);
        this.timing = new JourneyTiming(this.core);
        this.tracksUI = new JourneyTracksUI(this.core);
        this.segmentsUI = new JourneySegmentsUI(this.core, this.routeManager, this.timing);
        
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Listen for main app events
        document.addEventListener('showJourneyPlanningSection', () => {
            this.showJourneyPlanningSection();
        });

        document.addEventListener('hideJourneyPlanningSection', () => {
            this.hideJourneyPlanningSection();
        });

        document.addEventListener('journeyPreview', (e) => {
            this.handleJourneyPreview(e.detail.journey);
        });

        document.addEventListener('showMessage', (e) => {
            this.showMessage(e.detail.message, e.detail.type);
        });

        // Listen for timing updates to sync with main app
        document.addEventListener('journeyTimingUpdated', (e) => {
            this.handleTimingUpdate(e.detail);
        });

        // Listen for file selection from tracks UI
        document.addEventListener('filesSelected', (e) => {
            this.handleFilesSelected(e.detail.files);
        });

        // Timeline scrubbing
        document.addEventListener('timelineScrub', (e) => {
            this.handleTimelineScrub(e.detail);
        });
    }

    // Set map instance for route drawing
    setMapInstance(mapInstance) {
        this.routeManager.setMapInstance(mapInstance);
    }

    // Set API key for routing services
    setApiKey(apiKey) {
        this.routeManager.setApiKey(apiKey);
    }

    // Add a GPX track to the journey (main public API method)
    addTrack(trackData, filename) {
        return this.core.addTrack(trackData, filename);
    }

    // Remove a track (main public API method)
    removeTrack(trackId) {
        this.core.removeTrack(trackId);
    }

    // Clear all tracks (main public API method)
    clearAllTracks() {
        this.core.clearAllTracks();
    }

    // Move track up or down (main public API method)
    moveTrack(trackId, direction) {
        this.core.moveTrack(trackId, direction);
    }

    // Get current journey data (main public API method)
    getCurrentJourney() {
        return this.core.getCurrentJourney();
    }

    // Build complete journey (main public API method)
    buildCompleteJourney() {
        return this.core.buildCompleteJourney();
    }

    // Preview journey (main public API method)
    previewJourney() {
        return this.core.previewJourney();
    }

    // Show message (for UI feedback)
    showMessage(message, type = 'info') {
        // Use the same message system as the main app
        const event = new CustomEvent('showMessage', {
            detail: { message, type }
        });
        document.dispatchEvent(event);
    }

    // Handle journey preview
    handleJourneyPreview(journey) {
        // Emit event for main app to handle
        const event = new CustomEvent('journeyBuilt', {
            detail: { journey }
        });
        document.dispatchEvent(event);
    }

    // Handle timing updates
    handleTimingUpdate(timingData) {
        // Emit event with timing data for main app integration
        const event = new CustomEvent('segmentTimingUpdate', {
            detail: {
                totalDuration: timingData.totalDuration,
                segmentTiming: timingData.segmentTiming
            }
        });
        document.dispatchEvent(event);
    }

    // Handle file selection
    async handleFilesSelected(files) {
        for (const file of files) {
            try {
                // Emit event for main app to handle GPX parsing
                const event = new CustomEvent('gpxFileSelected', {
                    detail: { file }
                });
                document.dispatchEvent(event);
            } catch (error) {
                console.error('Error processing file:', file.name, error);
                this.showMessage(t('messages.fileProcessingError').replace('{filename}', file.name), 'error');
            }
        }
    }

    // Handle timeline scrubbing
    handleTimelineScrub(scrubData) {
        const { time, totalDuration } = scrubData;
        const progress = totalDuration > 0 ? time / totalDuration : 0;
        
        // Emit event for main app to handle playback seeking
        const event = new CustomEvent('timelineSeek', {
            detail: { 
                progress,
                journeyTime: time
            }
        });
        document.dispatchEvent(event);
    }

    // Show journey planning section
    showJourneyPlanningSection() {
        const journeySection = document.getElementById('journeyPlanningSection');
        if (journeySection) {
            journeySection.style.display = 'block';
        }

        // Update UI components
        this.tracksUI.showTracksSection();
        
        // Calculate initial timing
        this.timing.calculateJourneyTiming();
    }

    // Hide journey planning section
    hideJourneyPlanningSection() {
        const journeySection = document.getElementById('journeyPlanningSection');
        if (journeySection) {
            journeySection.style.display = 'none';
        }

        this.tracksUI.hideTracksSection();
    }

    // Show message
    showMessage(message, type = 'info') {
        // Create a simple message display
        const messageEl = document.createElement('div');
        messageEl.className = `message message-${type}`;
        messageEl.textContent = message;
        messageEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 4px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            max-width: 400px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;

        // Set background color based on type
        const colors = {
            info: '#3498db',
            success: '#2ecc71',
            warning: '#f39c12',
            error: '#e74c3c'
        };
        messageEl.style.backgroundColor = colors[type] || colors.info;
        
        document.body.appendChild(messageEl);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (document.body.contains(messageEl)) {
                messageEl.style.opacity = '0';
                messageEl.style.transform = 'translateX(100%)';
                messageEl.style.transition = 'all 0.3s ease';
                
                setTimeout(() => {
                    if (document.body.contains(messageEl)) {
                        document.body.removeChild(messageEl);
                    }
                }, 300);
            }
        }, 3000);
    }

    // Enable/disable auto-preview
    setAutoPreview(enabled) {
        this.core.setAutoPreview(enabled);
    }

    // Get tracks
    getTracks() {
        return this.core.getTracks();
    }

    // Get segments
    getSegments() {
        return this.core.getSegments();
    }

    // Get journey timing
    getJourneyTiming() {
        return this.timing.getCurrentTiming();
    }

    // Get journey timing breakdown
    getJourneyTimingBreakdown() {
        return this.timing.getJourneyTimingBreakdown();
    }

    // Convert time to progress
    timeToProgress(journeyTime) {
        return this.timing.timeToProgress(journeyTime);
    }

    // Convert progress to time
    progressToTime(progress) {
        return this.timing.progressToTime(progress);
    }

    // Get segment at specific time
    getSegmentAtTime(journeyTime) {
        return this.timing.getSegmentAtTime(journeyTime);
    }

    // Format time for display
    formatTime(seconds) {
        return this.timing.formatTime(seconds);
    }

    // Format distance for display
    formatDistance(distanceKm) {
        return this.timing.formatDistance(distanceKm);
    }

    // Format elevation for display
    formatElevation(elevationM) {
        return this.timing.formatElevation(elevationM);
    }

    // Get journey statistics
    getJourneyStats() {
        return this.core.calculateJourneyStats();
    }

    // Calculate segment timing
    calculateSegmentTiming() {
        return this.timing.calculateJourneyTiming();
    }

    // Refresh all UI components
    refreshUI() {
        this.tracksUI.renderTracksList();
        this.segmentsUI.renderSegmentsList();
        this.segmentsUI.renderTimelineEditor();
        this.timing.calculateJourneyTiming();
    }

    // Public method to force UI refresh (for external integration)
    forceUIRefresh() {
        // Emit events to trigger UI updates
        this.core.emitEvent('tracksChanged', { tracks: this.core.getTracks() });
        this.core.emitEvent('segmentsChanged', { segments: this.core.getSegments() });
    }

    // Export journey configuration
    exportJourneyConfig() {
        return {
            tracks: this.core.getTracks(),
            segments: this.core.getSegments(),
            timing: this.timing.getCurrentTiming(),
            journey: this.core.getCurrentJourney()
        };
    }

    // Import journey configuration
    importJourneyConfig(config) {
        try {
            // Clear current state
            this.core.clearAllTracks();
            
            // Import tracks
            if (config.tracks) {
                this.core.tracks = [...config.tracks];
            }
            
            // Import segments
            if (config.segments) {
                this.core.segments = [...config.segments];
            }
            
            // Refresh UI and timing
            this.forceUIRefresh();
            this.timing.calculateJourneyTiming();
            
            return true;
        } catch (error) {
            console.error('Error importing journey config:', error);
            this.showMessage(t('journeyBuilder.importError'), 'error');
            return false;
        }
    }

    // Destroy and cleanup
    destroy() {
        // Cleanup any ongoing operations
        if (this.routeManager.isDrawingRoute) {
            this.routeManager.cancelRouteDrawing();
        }
        
        // Clear any timeouts
        if (this.core.previewTimeout) {
            clearTimeout(this.core.previewTimeout);
        }
    }
} 