import { GPXParser } from '../gpxParser.js';
import { AnalyticsTracker } from '../utils/analytics.js';
import { t } from '../translations.js';

export class URLController {
    constructor(app) {
        this.app = app;
        this.gpxParser = new GPXParser();
        this.isLoading = false;
    }

    initialize() {
        // Wait for DOM to be fully ready before setting up event listeners
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupEventListeners());
        } else {
            // DOM is already loaded, but use requestAnimationFrame to ensure elements are rendered
            requestAnimationFrame(() => this.setupEventListeners());
        }
    }

    setupEventListeners() {
        const urlInput = document.getElementById('wikilocUrl');
        const loadBtn = document.getElementById('loadFromUrlBtn');
        const showExternalBtn = document.getElementById('showExternalImportBtn');
        const externalSection = document.getElementById('externalImportSection');
        const instructionsSection = document.getElementById('platformInstructions');

        if (showExternalBtn && externalSection && instructionsSection) {
            showExternalBtn.addEventListener('click', () => {
                const isHidden = externalSection.style.display === 'none';
                externalSection.style.display = isHidden ? 'block' : 'none';
                instructionsSection.style.display = isHidden ? 'grid' : 'none';

                // Update button text with proper translation
                const buttonText = showExternalBtn.querySelector('span:not(.btn-icon)');
                if (buttonText) {
                    // Set the data-i18n attribute (don't set textContent directly)
                    buttonText.setAttribute('data-i18n', isHidden ? 'upload.hideExternalImport' : 'upload.externalImport');

                    // Apply the new translation immediately
                    if (typeof window !== 'undefined' && window.updatePageTranslations) {
                        window.updatePageTranslations();
                    }
                }
            });
        }

        if (urlInput && loadBtn) {
            loadBtn.addEventListener('click', () => this.handleUrlSubmit());
            urlInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleUrlSubmit();
                }
            });
        } else {
            console.warn('URLController: Could not find required DOM elements');
        }
    }

    async handleUrlSubmit() {
        const urlInput = document.getElementById('wikilocUrl');
        const url = urlInput.value.trim();

        if (!url) {
            this.showStatus('Please enter a URL', 'error');
            return;
        }

        if (!this.isValidUrl(url)) {
            this.showStatus('Please enter a valid URL', 'error');
            return;
        }

        this.setLoading(true);
        console.log('🚀 Starting URL processing for:', url);

        try {
            const downloadUrl = this.extractGpxUrl(url);
            if (downloadUrl) {
                console.log('📄 Generated download URL:', downloadUrl);

                // Open the download page directly - this is the most reliable approach
                console.log('🔗 Opening download page...');
                const success = await this.tryProgrammaticDownload(null, downloadUrl);

                if (success) {
                    const platform = this.detectPlatform(url);
                    AnalyticsTracker.trackUrlDownload(url, `page_redirect_${platform}`);
                    urlInput.value = '';
                }
            } else {
                // Fallback: show download instructions
                this.showDownloadInstructions(url);
            }
        } catch (error) {
            console.error('Error processing URL:', error);
            this.showStatus('Failed to process URL: ' + error.message, 'error');
        } finally {
            this.setLoading(false);
        }
    }

    isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }



    async tryProgrammaticDownload(trailId, downloadPageUrl) {
        try {
            console.log('🔗 Opening Wikiloc download page directly...');

            // The most reliable approach: just open the download page
            // This bypasses all CORS and programmatic download issues
            console.log('📄 Opening download page:', downloadPageUrl);

            // Open the download page in a new tab
            const newTab = window.open(downloadPageUrl, '_blank');

            if (newTab) {
                console.log('✅ Download page opened successfully');

                // Show platform-specific success message with detailed instructions
                const platform = this.detectPlatform(downloadPageUrl);
                if (platform === 'strava') {
                    this.showStatus(`${t('upload.platformInstructions.strava.title')} ${t('upload.urlStatus.pageOpened').toLowerCase()} ${t('upload.stravaInstructions')}`, 'success');
                } else if (platform === 'wikiloc') {
                    this.showStatus(`${t('upload.urlStatus.pageOpened')} ${t('upload.wikilocInstructions')}`, 'success');
                } else if (platform === 'garmin') {
                    this.showStatus(`Garmin ${t('upload.urlStatus.pageOpened').toLowerCase()} ${t('upload.platformInstructions.otherPlatforms.step3')}`, 'success');
                } else if (platform === 'alltrails') {
                    this.showStatus(`AllTrails ${t('upload.urlStatus.pageOpened').toLowerCase()} ${t('upload.platformInstructions.otherPlatforms.step3')}`, 'success');
                } else if (platform === 'komoot') {
                    this.showStatus(`Komoot ${t('upload.urlStatus.pageOpened').toLowerCase()} ${t('upload.platformInstructions.otherPlatforms.step3')}`, 'success');
                } else if (platform === 'dropbox' || platform === 'google-drive') {
                    this.showStatus(`${t('upload.urlStatus.pageOpened')} ${t('upload.platformInstructions.otherPlatforms.step5')}`, 'success');
                } else {
                    this.showStatus(`${t('upload.urlStatus.pageOpened')} ${t('upload.platformInstructions.otherPlatforms.step3')}`, 'success');
                }

                return true;
            } else {
                console.log('⚠️ Popup blocked - falling back to same tab');
                // If popup is blocked, try opening in same tab
                window.location.href = downloadPageUrl;
                return true;
            }

        } catch (error) {
            console.log('❌ Failed to open download page:', error.message);
            return false;
        }
    }

    extractGpxUrl(url) {
        if (!url || typeof url !== 'string') return null;

        // Detect platform and handle accordingly
        if (url.includes('strava.com')) {
            return this.handleStravaUrl(url);
        } else if (url.includes('wikiloc.com')) {
            return this.handleWikilocUrl(url);
        }

        // Try other common patterns
        if (url.includes('gpx') || url.includes('download')) {
            return url;
        }

        return null;
    }

    handleStravaUrl(url) {
        // Strava activity URL: https://www.strava.com/activities/1234567890
        const activityMatch = url.match(/strava\.com\/activities\/(\d+)/);
        if (activityMatch) {
            const activityId = activityMatch[1];
            // Return the activity page URL for Strava
            return `https://www.strava.com/activities/${activityId}`;
        }

        return null;
    }

    handleWikilocUrl(url) {
        // Parse Wikiloc URLs to extract GPX download URLs
        // Format 1: https://www.wikiloc.com/trails/view/29346587
        const viewMatch = url.match(/wikiloc\.com\/trails\/view\/(\d+)/);
        if (viewMatch) {
            const trailId = viewMatch[1];
            return `https://es.wikiloc.com/wikiloc/download.do?id=${trailId}`;
        }

        // Format 2: https://es.wikiloc.com/rutas-senderismo/sant-feliu-de-guixols-sagaro-camino-de-ronda-29346587
        const routeMatch = url.match(/wikiloc\.com\/.*?-(\d+)(?:\?.*)?$/);
        if (routeMatch) {
            const trailId = routeMatch[1];
            return `https://es.wikiloc.com/wikiloc/download.do?id=${trailId}`;
        }

        return null;
    }

    detectPlatform(url) {
        if (url.includes('strava.com')) return 'strava';
        if (url.includes('wikiloc.com')) return 'wikiloc';
        if (url.includes('garmin.com') || url.includes('connect.garmin.com')) return 'garmin';
        if (url.includes('alltrails.com')) return 'alltrails';
        if (url.includes('komoot.com')) return 'komoot';
        if (url.includes('suunto.com')) return 'suunto';
        if (url.includes('polar.com')) return 'polar';
        if (url.includes('coros.com')) return 'coros';
        if (url.includes('endomondo.com')) return 'endomondo';
        if (url.includes('nike.com') || url.includes('nrc-app')) return 'nike';
        if (url.includes('adidas')) return 'adidas';
        if (url.includes('fitbit.com')) return 'fitbit';
        if (url.includes('dropbox.com')) return 'dropbox';
        if (url.includes('drive.google.com')) return 'google-drive';
        return 'unknown';
    }



    showDownloadInstructions(url, error = null) {
        const statusDiv = document.getElementById('urlStatus');

        if (!statusDiv) {
            console.warn('Status div not found, cannot show download instructions');
            return;
        }

        const platform = this.detectPlatform(url || '');
        let message = '';

        if (error) {
            message = `<div class="status-error">
                <p>❌ <strong>${t('messages.urlProcessingError')}:</strong> ${error}</p>
                <p>${t('messages.validUrlsFrom')}:</p>
                <ul>
                    <li><strong>${t('upload.platformInstructions.wikiloc.title')}:</strong> <code>https://www.wikiloc.com/trails/view/123456</code></li>
                    <li><strong>${t('upload.platformInstructions.strava.title')}:</strong> <code>https://www.strava.com/activities/1234567890</code></li>
                </ul>
            </div>`;
        } else {
            if (platform === 'strava') {
                message = `<div class="status-info">
                    <p>📋 <strong>${t('upload.platformInstructions.strava.title')}:</strong></p>
                    <ol>
                        <li>${t('upload.platformInstructions.strava.step1')}</li>
                        <li>${t('upload.platformInstructions.strava.step2')}</li>
                        <li>${t('upload.platformInstructions.strava.step3')}</li>
                        <li>${t('upload.platformInstructions.strava.step4')}</li>
                        <li>${t('upload.platformInstructions.strava.step5')}</li>
                    </ol>
                    <p class="tip">💡 <strong>${t('upload.platformInstructions.strava.tryIt')}:</strong> ${t('upload.platformInstructions.strava.exampleActivity')}</p>
                </div>`;
            } else if (platform === 'wikiloc') {
                message = `<div class="status-info">
                    <p>📋 <strong>${t('upload.platformInstructions.wikiloc.title')}:</strong></p>
                    <ol>
                        <li>${t('upload.platformInstructions.wikiloc.step1')}</li>
                        <li>${t('upload.platformInstructions.wikiloc.step2')}</li>
                        <li>${t('upload.platformInstructions.wikiloc.step3')}</li>
                        <li>${t('upload.platformInstructions.wikiloc.step4')}</li>
                        <li>${t('upload.platformInstructions.wikiloc.step5')}</li>
                    </ol>
                    <p class="tip">💡 <strong>${t('upload.platformInstructions.wikiloc.otherExamples')}:</strong> ${t('upload.platformInstructions.wikiloc.santFeliuRace')}, ${t('upload.platformInstructions.wikiloc.anotherTrail')}</p>
                </div>`;
            } else if (platform === 'garmin') {
                message = `<div class="status-info">
                    <p>📋 <strong>${t('upload.platformInstructions.otherPlatforms.title')} (Garmin Connect):</strong></p>
                    <ol>
                        <li>${t('upload.platformInstructions.otherPlatforms.step1')}</li>
                        <li>${t('upload.platformInstructions.otherPlatforms.step2')}</li>
                        <li>${t('upload.platformInstructions.otherPlatforms.step3')}</li>
                        <li>${t('upload.platformInstructions.otherPlatforms.step4')}</li>
                        <li>${t('upload.platformInstructions.otherPlatforms.step5')}</li>
                    </ol>
                    <p class="tip">💡 <strong>${t('upload.platformInstructions.otherPlatforms.supported')}:</strong> ${t('upload.platformInstructions.otherPlatforms.supportedPlatforms')}</p>
                </div>`;
            } else if (platform === 'alltrails') {
                message = `<div class="status-info">
                    <p>📋 <strong>${t('upload.platformInstructions.otherPlatforms.title')} (AllTrails):</strong></p>
                    <ol>
                        <li>${t('upload.platformInstructions.otherPlatforms.step1')}</li>
                        <li>${t('upload.platformInstructions.otherPlatforms.step2')}</li>
                        <li>${t('upload.platformInstructions.otherPlatforms.step3')}</li>
                        <li>${t('upload.platformInstructions.otherPlatforms.step4')}</li>
                        <li>${t('upload.platformInstructions.otherPlatforms.step5')}</li>
                    </ol>
                    <p class="tip">💡 <strong>${t('upload.platformInstructions.otherPlatforms.supported')}:</strong> ${t('upload.platformInstructions.otherPlatforms.supportedPlatforms')}</p>
                </div>`;
            } else if (platform === 'komoot') {
                message = `<div class="status-info">
                    <p>📋 <strong>${t('upload.platformInstructions.otherPlatforms.title')} (Komoot):</strong></p>
                    <ol>
                        <li>${t('upload.platformInstructions.otherPlatforms.step1')}</li>
                        <li>${t('upload.platformInstructions.otherPlatforms.step2')}</li>
                        <li>${t('upload.platformInstructions.otherPlatforms.step3')}</li>
                        <li>${t('upload.platformInstructions.otherPlatforms.step4')}</li>
                        <li>${t('upload.platformInstructions.otherPlatforms.step5')}</li>
                    </ol>
                    <p class="tip">💡 <strong>${t('upload.platformInstructions.otherPlatforms.supported')}:</strong> ${t('upload.platformInstructions.otherPlatforms.supportedPlatforms')}</p>
                </div>`;
            } else {
                message = `<div class="status-info">
                    <p>📋 <strong>${t('upload.externalImport')}:</strong></p>
                    <p>${t('upload.platformInstructions.otherPlatforms.supported')}:</p>
                    <ul>
                        <li><strong>🏃‍♂️ ${t('upload.platformInstructions.strava.title')}:</strong> ${t('upload.stravaInstructions')}</li>
                        <li><strong>🥾 ${t('upload.platformInstructions.wikiloc.title')}:</strong> ${t('upload.wikilocInstructions')}</li>
                        <li><strong>🏔️ Garmin Connect:</strong> ${t('upload.platformInstructions.otherPlatforms.step3')}</li>
                        <li><strong>🌲 AllTrails:</strong> ${t('upload.platformInstructions.otherPlatforms.step3')}</li>
                        <li><strong>🚴 Komoot:</strong> ${t('upload.platformInstructions.otherPlatforms.step3')}</li>
                        <li><strong>📁 Dropbox/Google Drive:</strong> ${t('upload.platformInstructions.otherPlatforms.step5')}</li>
                        <li><strong>📱 Suunto/Polar/Coros:</strong> ${t('upload.platformInstructions.otherPlatforms.step5')}</li>
                    </ul>
                    <p class="tip">💡 <strong>Tip:</strong> ${t('upload.platformInstructions.otherPlatforms.step1')}</p>
                </div>`;
            }
        }

        statusDiv.innerHTML = message;
        statusDiv.style.display = 'block';
        statusDiv.className = 'url-status visible';

        // Scroll to show instructions
        statusDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    showStatus(message, type = 'info') {
        const statusDiv = document.getElementById('urlStatus');

        if (!statusDiv) {
            console.warn('Status div not found, cannot show status message');
            return;
        }

        const statusClasses = {
            success: 'status-success',
            error: 'status-error',
            info: 'status-info',
            warning: 'status-warning'
        };

        const icon = {
            success: '✅',
            error: '❌',
            info: 'ℹ️',
            warning: '⚠️'
        };

        statusDiv.innerHTML = `<p class="${statusClasses[type]}">${icon[type]} ${message}</p>`;
        statusDiv.style.display = 'block';
        statusDiv.className = 'url-status visible';

        // Auto-hide success messages after 5 seconds
        if (type === 'success') {
            setTimeout(() => {
                statusDiv.style.display = 'none';
            }, 5000);
        }
    }

    setLoading(loading) {
        this.isLoading = loading;
        const loadBtn = document.getElementById('loadFromUrlBtn');

        if (!loadBtn) {
            console.warn('Load button not found, skipping loading state update');
            return;
        }

        const btnText = loadBtn.querySelector('.btn-text');
        const loadingText = loadBtn.querySelector('.loading-text');

        if (loading) {
            loadBtn.disabled = true;
            if (btnText) btnText.style.display = 'none';
            if (loadingText) loadingText.style.display = 'inline';
        } else {
            loadBtn.disabled = false;
            if (btnText) btnText.style.display = 'inline';
            if (loadingText) loadingText.style.display = 'none';
        }
    }
}
