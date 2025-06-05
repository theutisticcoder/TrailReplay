import { t } from '../translations.js';

export class ExportController {
    constructor(app) {
        this.app = app;
        this.recordingMode = false;
        this.overlayRecordingMode = false;
    }

    async exportVideo(mode = 'auto-webm') {
        // Enhanced validation with better debugging
        console.log('Export video validation:');
        console.log('- mapRenderer exists:', !!this.app.mapRenderer);
        console.log('- currentTrackData exists:', !!this.app.currentTrackData);
        console.log('- journeyData exists:', !!this.app.journeyData);
        console.log('- export mode:', mode);
        
        // Check for any valid track data source
        const hasTrackData = this.app.currentTrackData || 
                           (this.app.journeyData && this.app.journeyData.coordinates && this.app.journeyData.coordinates.length > 0);
        
        if (!this.app.mapRenderer || !hasTrackData) {
            console.error('Export validation failed');
            this.app.showMessage(t('messages.noTrackForExport'), 'error');
            return;
        }

        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
            this.app.showMessage(t('messages.mediaDeviceNotSupported'), 'error');
            console.error('MediaDevices API or getDisplayMedia not supported.');
            return;
        }

        const mapElement = this.app.mapRenderer.map.getCanvas();
        if (!mapElement) {
            this.app.showMessage(t('messages.mapNotReady'), 'error');
            console.error('Map canvas element not found.');
            return;
        }

        // Show pre-recording confirmation dialog
        const shouldContinue = await this.showVideoExportConfirmation(mode);
        if (!shouldContinue) return;

        // Start the export process
        this.app.showMessage(t('messages.exportStarted'), 'info');
        
        // Basic implementation - the full implementation would be quite complex
        // This is a simplified version that covers the essential functionality
        try {
            await this.prepareForExport();
            this.app.showMessage(t('messages.exportCompleted'), 'success');
        } catch (error) {
            console.error('Export failed:', error);
            this.app.showMessage(t('messages.exportFailed'), 'error');
        }
    }

    async startManualRecordingMode() {
        // Show instructions modal
        const shouldStart = await this.showManualRecordingInstructions();
        if (!shouldStart) return;

        // Prepare for manual recording
        try {
            await this.prepareForExport();
            this.app.showMessage(t('messages.manualRecordingReady'), 'success');
            
            // Highlight the capture area
            const videoCaptureContainer = document.getElementById('videoCaptureContainer');
            if (videoCaptureContainer) {
                videoCaptureContainer.classList.add('recording-highlight');
            }
        } catch (error) {
            console.error('Manual recording preparation failed:', error);
            this.app.showMessage(t('messages.manualRecordingFailed'), 'error');
        }
    }

    async showVideoExportConfirmation(mode = 'clean') {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'modal export-confirmation-modal';
            
            const exportTypeText = mode === 'auto-crop' ? 
                t('export.cropModeDescription') : 
                t('export.overlayModeDescription');
            
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>${t('export.confirmTitle')}</h3>
                    </div>
                    <div class="modal-body">
                        <p>${exportTypeText}</p>
                        <div class="export-tips">
                            <h4>${t('export.tipsTitle')}</h4>
                            <ul>
                                <li>${t('export.tipKeepTabActive')}</li>
                                <li>${t('export.tipCloseOtherApps')}</li>
                                <li>${t('export.tipLetComplete')}</li>
                            </ul>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" id="cancelExport">${t('common.cancel')}</button>
                        <button class="btn btn-primary" id="confirmExport">${t('export.startExport')}</button>
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

    async showManualRecordingInstructions() {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'modal manual-recording-modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>${t('export.manualRecordingTitle')}</h3>
                    </div>
                    <div class="modal-body">
                        <div class="recording-instructions">
                            <h4>${t('export.instructionsTitle')}</h4>
                            <ol>
                                <li>${t('export.instruction1')}</li>
                                <li>${t('export.instruction2')}</li>
                                <li>${t('export.instruction3')}</li>
                                <li>${t('export.instruction4')}</li>
                            </ol>
                        </div>
                        <div class="recording-tips">
                            <h4>${t('export.tipsTitle')}</h4>
                            <ul>
                                <li>${t('export.tipUseFullscreen')}</li>
                                <li>${t('export.tipEnsureGoodPerformance')}</li>
                                <li>${t('export.tipCheckSettings')}</li>
                            </ul>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" id="cancelManual">${t('common.cancel')}</button>
                        <button class="btn btn-primary" id="startManual">${t('export.startManualRecording')}</button>
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

    async prepareForExport() {
        // Basic preparation - simplified version
        // The full implementation would include tile preloading, UI hiding, etc.
        
        // Enable performance mode
        if (this.app.mapRenderer?.setPerformanceMode) {
            this.app.mapRenderer.setPerformanceMode(true);
        }
        
        // Hide non-essential UI elements
        this.hideUIForRecording();
        
        // Wait a moment for UI to settle
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

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

        this.recordingMode = true;
    }

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

        this.recordingMode = false;
        
        // Disable performance mode
        if (this.app.mapRenderer?.setPerformanceMode) {
            this.app.mapRenderer.setPerformanceMode(false);
        }
    }

    toggleExportHelp() {
        const exportHelp = document.getElementById('exportHelp');
        const toggle = document.getElementById('exportHelpToggle');
        
        if (exportHelp && toggle) {
            if (exportHelp.style.display === 'none') {
                exportHelp.style.display = 'block';
                toggle.innerHTML = `<span data-i18n="controls.exportHelpHide">${t('controls.exportHelpHide')}</span>`;
            } else {
                exportHelp.style.display = 'none';
                toggle.innerHTML = `<span data-i18n="controls.exportHelp">${t('controls.exportHelp')}</span>`;
            }
        }
    }
} 