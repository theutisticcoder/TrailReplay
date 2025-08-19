import { AnalyticsTracker } from '../utils/analytics.js';
import { t } from '../translations.js';

/**
 * Cookie Consent Manager for TrailReplay
 * Handles GDPR/privacy compliance for analytics
 */
export class CookieConsentManager {
    static STORAGE_KEY = 'trailreplay_analytics_consent';
    static isInitialized = false;
    
    /**
     * Initialize the cookie consent system
     */
    static init() {
        if (this.isInitialized) return;
        
        const consent = this.getConsent();
        if (consent === null) {
            // No consent decision made yet, show banner
            this.showConsentBanner();
        } else if (consent === true) {
            // Consent given, enable analytics
            AnalyticsTracker.setEnabled(true);
        } else {
            // Consent denied, keep analytics disabled
            AnalyticsTracker.setEnabled(false);
        }
        
        this.isInitialized = true;
    }
    
    /**
     * Get current consent status
     * @returns {boolean|null} true=accepted, false=declined, null=not decided
     */
    static getConsent() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored === null) return null;
            return JSON.parse(stored);
        } catch (e) {
            return null;
        }
    }
    
    /**
     * Set consent status
     * @param {boolean} consent - true to accept, false to decline
     */
    static setConsent(consent) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(consent));
            AnalyticsTracker.setEnabled(consent);
            
            if (consent) {
                // Track consent acceptance
                AnalyticsTracker.track('privacy_consent', { action: 'accepted' });
            }
        } catch (e) {
            console.warn('Could not save consent preference:', e);
        }
    }
    
    /**
     * Show the cookie consent banner
     */
    static showConsentBanner() {
        // Remove existing banner if any
        this.removeConsentBanner();
        
        const banner = document.createElement('div');
        banner.id = 'cookie-consent-banner';
        banner.className = 'cookie-consent-banner';
        banner.innerHTML = `
            <div class="cookie-consent-content">
                <div class="cookie-consent-text">
                    <h4>${t('privacy.cookieTitle', 'We use analytics to improve your experience')}</h4>
                    <p>${t('privacy.cookieMessage', 'We use Google Analytics to understand how you use TrailReplay and improve the app. No personal data is collected.')}</p>
                </div>
                <div class="cookie-consent-buttons">
                    <button id="cookie-accept" class="btn btn-primary btn-sm">
                        ${t('privacy.accept', 'Accept')}
                    </button>
                    <button id="cookie-decline" class="btn btn-secondary btn-sm">
                        ${t('privacy.decline', 'Decline')}
                    </button>
                    <button id="cookie-learn-more" class="btn btn-link btn-sm">
                        ${t('privacy.learnMore', 'Learn More')}
                    </button>
                </div>
            </div>
        `;
        
        // Add CSS styles
        this.addConsentStyles();
        
        // Add to page
        document.body.appendChild(banner);
        
        // Add event listeners
        document.getElementById('cookie-accept').addEventListener('click', () => {
            this.setConsent(true);
            this.removeConsentBanner();
        });
        
        document.getElementById('cookie-decline').addEventListener('click', () => {
            this.setConsent(false);
            this.removeConsentBanner();
        });
        
        document.getElementById('cookie-learn-more').addEventListener('click', () => {
            this.showPrivacyModal();
        });
    }
    
    /**
     * Remove the consent banner
     */
    static removeConsentBanner() {
        const banner = document.getElementById('cookie-consent-banner');
        if (banner) {
            banner.remove();
        }
    }
    
    /**
     * Add CSS styles for the consent banner
     */
    static addConsentStyles() {
        if (document.getElementById('cookie-consent-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'cookie-consent-styles';
        styles.textContent = `
            .cookie-consent-banner {
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                background: rgba(0, 0, 0, 0.95);
                color: white;
                z-index: 10000;
                padding: 1rem;
                box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.3);
            }
            
            .cookie-consent-content {
                max-width: 1200px;
                margin: 0 auto;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 1rem;
            }
            
            @media (max-width: 768px) {
                .cookie-consent-content {
                    flex-direction: column;
                    text-align: center;
                }
            }
            
            .cookie-consent-text h4 {
                margin: 0 0 0.5rem 0;
                font-size: 1.1rem;
            }
            
            .cookie-consent-text p {
                margin: 0;
                font-size: 0.9rem;
                opacity: 0.9;
            }
            
            .cookie-consent-buttons {
                display: flex;
                gap: 0.5rem;
                flex-shrink: 0;
            }
            
            @media (max-width: 768px) {
                .cookie-consent-buttons {
                    justify-content: center;
                    margin-top: 1rem;
                }
            }
            
            .cookie-consent-banner .btn {
                padding: 0.5rem 1rem;
                border-radius: 4px;
                border: none;
                cursor: pointer;
                font-size: 0.85rem;
                text-decoration: none;
            }
            
            .cookie-consent-banner .btn-primary {
                background: #007bff;
                color: white;
            }
            
            .cookie-consent-banner .btn-primary:hover {
                background: #0056b3;
            }
            
            .cookie-consent-banner .btn-secondary {
                background: #6c757d;
                color: white;
            }
            
            .cookie-consent-banner .btn-secondary:hover {
                background: #545b62;
            }
            
            .cookie-consent-banner .btn-link {
                background: transparent;
                color: #ccc;
                text-decoration: underline;
            }
            
            .cookie-consent-banner .btn-link:hover {
                color: white;
            }
        `;
        
        document.head.appendChild(styles);
    }
    
    /**
     * Show privacy information modal
     */
    static showPrivacyModal() {
        const modal = document.createElement('div');
        modal.id = 'privacy-modal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h3>${t('privacy.privacyTitle', 'Privacy & Analytics')}</h3>
                    <button class="modal-close" id="privacy-modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <h4>${t('privacy.whatWeCollect', 'What we collect')}</h4>
                    <ul>
                        <li>${t('privacy.collect1', 'How you use TrailReplay features (play, pause, export, etc.)')}</li>
                        <li>${t('privacy.collect2', 'General usage patterns and popular features')}</li>
                        <li>${t('privacy.collect3', 'Technical information like browser type and screen size')}</li>
                    </ul>
                    
                    <h4>${t('privacy.whatWeDontCollect', 'What we DON\'T collect')}</h4>
                    <ul>
                        <li>${t('privacy.dontCollect1', 'Your GPS tracks or personal location data')}</li>
                        <li>${t('privacy.dontCollect2', 'Personal information like names or emails')}</li>
                        <li>${t('privacy.dontCollect3', 'Any data that could identify you personally')}</li>
                    </ul>
                    
                    <h4>${t('privacy.whyWeCollect', 'Why we collect this data')}</h4>
                    <p>${t('privacy.whyCollectText', 'We use this information to understand which features are most useful and improve TrailReplay for everyone.')}</p>
                    
                    <h4>${t('privacy.yourChoice', 'Your choice')}</h4>
                    <p>${t('privacy.yourChoiceText', 'You can decline analytics and TrailReplay will work exactly the same. You can change your mind anytime in the settings.')}</p>
                </div>
                <div class="modal-footer">
                    <button id="privacy-accept-modal" class="btn btn-primary">
                        ${t('privacy.acceptAnalytics', 'Accept Analytics')}
                    </button>
                    <button id="privacy-decline-modal" class="btn btn-secondary">
                        ${t('privacy.declineAnalytics', 'Decline Analytics')}
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Event listeners
        const closeModal = () => {
            modal.remove();
        };
        
        document.getElementById('privacy-modal-close').addEventListener('click', closeModal);
        document.getElementById('privacy-accept-modal').addEventListener('click', () => {
            this.setConsent(true);
            this.removeConsentBanner();
            closeModal();
        });
        document.getElementById('privacy-decline-modal').addEventListener('click', () => {
            this.setConsent(false);
            this.removeConsentBanner();
            closeModal();
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }
    
    /**
     * Reset consent (for testing or settings)
     */
    static resetConsent() {
        try {
            localStorage.removeItem(this.STORAGE_KEY);
            this.isInitialized = false;
            this.removeConsentBanner();
            AnalyticsTracker.setEnabled(false);
        } catch (e) {
            console.warn('Could not reset consent:', e);
        }
    }
    
    /**
     * Get privacy settings for display in settings UI
     */
    static getPrivacySettings() {
        return {
            analyticsEnabled: AnalyticsTracker.isEnabled,
            consentGiven: this.getConsent(),
            canOptOut: true
        };
    }
}


