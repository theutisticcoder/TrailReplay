// Feedback Solicitation Popup - Lightweight component to ask users for feedback
// Integrated with existing feedback modal and uses localStorage for one-time display
// "Maybe later" option implements 24-hour cooldown before showing popup again

import { t } from '../translations.js';

class FeedbackSolicitation {
    static STORAGE_KEY = 'trailreplay_feedback_solicited';
    static ACTIVITY_KEY = 'trailreplay_user_activity';
    static MAYBE_LATER_KEY = 'trailreplay_maybe_later_timestamp';
    static MIN_ACTIVITY_THRESHOLD = 3; // Show after 3 interactions
    static ACTIVITY_TIMEOUT = 300000; // 5 minutes timeout for activity tracking
    static MAYBE_LATER_COOLDOWN = 86400000; // 24 hours in milliseconds

    /**
     * Initialize feedback solicitation system
     */
    static init() {
        // Only initialize on main app pages (not landing page)
        if (this.isOnAppPage()) {
            this.checkAndShowSolicitation();
        }
    }

    /**
     * Check if we're on the main app page (not landing)
     */
    static isOnAppPage() {
        return window.location.pathname.includes('app') ||
               window.location.pathname === '/' ||
               window.location.pathname === '/index.html';
    }

    /**
     * Track user activity for showing feedback solicitation
     */
    static trackActivity(action = 'interaction') {
        try {
            const activity = this.getActivityData();
            activity.count += 1;
            activity.lastActivity = Date.now();
            activity.actions.push({ action, timestamp: Date.now() });

            // Keep only last 10 actions to avoid storage bloat
            if (activity.actions.length > 10) {
                activity.actions = activity.actions.slice(-10);
            }

            localStorage.setItem(this.ACTIVITY_KEY, JSON.stringify(activity));

            // Check if we should show the solicitation after this activity
            this.checkAndShowSolicitation();
        } catch (e) {
            console.warn('Could not track activity:', e);
        }
    }

    /**
     * Get activity data from localStorage
     */
    static getActivityData() {
        try {
            const stored = localStorage.getItem(this.ACTIVITY_KEY);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (e) {
            console.warn('Could not read activity data:', e);
        }

        // Return default activity data
        return {
            count: 0,
            lastActivity: Date.now(),
            actions: [],
            firstVisit: Date.now()
        };
    }

    /**
     * Check if we should show the feedback solicitation
     */
    static shouldShowSolicitation() {
        // Don't show if already solicited
        if (this.hasBeenSolicited()) {
            return false;
        }

        const now = Date.now();

        // Check if user recently clicked "Maybe later" (24-hour cooldown)
        const maybeLaterTimestamp = this.getMaybeLaterTimestamp();
        if (maybeLaterTimestamp && (now - maybeLaterTimestamp) < this.MAYBE_LATER_COOLDOWN) {
            return false;
        }

        const activity = this.getActivityData();

        // Check if enough activity has occurred
        if (activity.count < this.MIN_ACTIVITY_THRESHOLD) {
            return false;
        }

        // Check if activity is recent (within timeout period)
        if (now - activity.lastActivity > this.ACTIVITY_TIMEOUT) {
            return false;
        }

        // Check if user has been using the app for at least 1 minute
        if (now - activity.firstVisit < 60000) { // 1 minute
            return false;
        }

        return true;
    }

    /**
     * Check if user has already been solicited for feedback
     */
    static hasBeenSolicited() {
        try {
            const solicited = localStorage.getItem(this.STORAGE_KEY);
            return solicited === 'true';
        } catch (e) {
            return false;
        }
    }

    /**
     * Get the timestamp when user last clicked "Maybe later"
     */
    static getMaybeLaterTimestamp() {
        try {
            const timestamp = localStorage.getItem(this.MAYBE_LATER_KEY);
            return timestamp ? parseInt(timestamp) : null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Set the timestamp when user clicks "Maybe later"
     */
    static setMaybeLaterTimestamp() {
        try {
            localStorage.setItem(this.MAYBE_LATER_KEY, Date.now().toString());
        } catch (e) {
            console.warn('Could not save maybe later timestamp:', e);
        }
    }

    /**
     * Mark user as having been solicited
     */
    static markAsSolicited() {
        try {
            localStorage.setItem(this.STORAGE_KEY, 'true');
        } catch (e) {
            console.warn('Could not mark as solicited:', e);
        }
    }

    /**
     * Check and show solicitation if conditions are met
     */
    static checkAndShowSolicitation() {
        if (this.shouldShowSolicitation()) {
            // Small delay to not interrupt user workflow immediately
            setTimeout(() => {
                this.showSolicitationPopup();
            }, 2000); // 2 second delay
        }
    }

    /**
     * Show the feedback solicitation popup
     */
    static showSolicitationPopup() {
        // Remove any existing solicitation popup
        this.removeSolicitationPopup();

        const popup = document.createElement('div');
        popup.id = 'feedback-solicitation-popup';
        popup.className = 'feedback-solicitation-popup';
        popup.innerHTML = `
            <div class="feedback-solicitation-content">
                <div class="feedback-solicitation-text">
                    <h3>${t('feedback.solicitation.title')}</h3>
                    <p>${t('feedback.solicitation.message')}</p>
                </div>
                <div class="feedback-solicitation-buttons">
                    <button id="feedback-solicitation-yes" class="btn btn-primary btn-sm">
                        ${t('feedback.solicitation.yes')}
                    </button>
                    <button id="feedback-solicitation-no" class="btn btn-secondary btn-sm">
                        ${t('feedback.solicitation.no')}
                    </button>
                    <button id="feedback-solicitation-dismiss" class="btn btn-link btn-sm">
                        ${t('feedback.solicitation.dontShowAgain')}
                    </button>
                </div>
            </div>
        `;

        // Add styles
        this.addSolicitationStyles();

        // Add to page
        document.body.appendChild(popup);

        // Add event listeners
        document.getElementById('feedback-solicitation-yes').addEventListener('click', () => {
            this.handleYesResponse();
        });

        document.getElementById('feedback-solicitation-no').addEventListener('click', () => {
            this.handleNoResponse();
        });

        document.getElementById('feedback-solicitation-dismiss').addEventListener('click', () => {
            this.handleDismissResponse();
        });

        // Auto-hide after 30 seconds if no interaction
        setTimeout(() => {
            if (popup.parentNode) {
                this.removeSolicitationPopup();
            }
        }, 30000);
    }

    /**
     * Handle "Yes" response - open feedback modal
     */
    static handleYesResponse() {
        this.markAsSolicited();
        this.removeSolicitationPopup();

        // Open the existing feedback modal
        const feedbackLink = document.getElementById('feedbackLink');
        if (feedbackLink) {
            feedbackLink.click();
        } else {
            // Fallback: try to open modal directly
            const modal = document.getElementById('feedbackModal');
            if (modal) {
                modal.style.display = 'block';
            }
        }

        // Track the response
        this.trackSolicitationResponse('yes');
    }

    /**
     * Handle "Maybe later" response - hide popup for 24 hours
     */
    static handleNoResponse() {
        // Record timestamp for 24-hour cooldown
        this.setMaybeLaterTimestamp();

        this.removeSolicitationPopup();
        this.trackSolicitationResponse('no');
    }

    /**
     * Handle dismiss response - hide and don't show again
     */
    static handleDismissResponse() {
        this.markAsSolicited();
        this.removeSolicitationPopup();
        this.trackSolicitationResponse('dismiss');
    }

    /**
     * Track solicitation response for analytics
     */
    static trackSolicitationResponse(response) {
        try {
            // Import analytics if available
            import('../utils/analytics.js').then(({ AnalyticsTracker }) => {
                if (AnalyticsTracker.isEnabled) {
                    AnalyticsTracker.track('feedback_solicitation_response', {
                        response: response,
                        activity_count: this.getActivityData().count
                    });
                }
            }).catch(() => {
                // Silently fail if analytics not available
                console.log('📊 Feedback solicitation response tracked (analytics not available)');
            });
        } catch (e) {
            // Silently fail
        }
    }

    /**
     * Remove the solicitation popup
     */
    static removeSolicitationPopup() {
        const popup = document.getElementById('feedback-solicitation-popup');
        if (popup) {
            popup.remove();
        }
    }

    /**
     * Add CSS styles for the solicitation popup
     */
    static addSolicitationStyles() {
        if (document.getElementById('feedback-solicitation-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'feedback-solicitation-styles';
        styles.textContent = `
            .feedback-solicitation-popup {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0, 0, 0, 0.9);
                color: white;
                z-index: 10001;
                border-radius: 12px;
                padding: 0;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
                max-width: 400px;
                width: 90%;
                animation: fadeInUp 0.3s ease-out;
            }

            @keyframes fadeInUp {
                from {
                    opacity: 0;
                    transform: translate(-50%, -60%);
                }
                to {
                    opacity: 1;
                    transform: translate(-50%, -50%);
                }
            }

            .feedback-solicitation-content {
                padding: 1.5rem;
                display: flex;
                flex-direction: column;
                gap: 1rem;
            }

            .feedback-solicitation-text h3 {
                margin: 0 0 0.5rem 0;
                font-size: 1.2rem;
                font-weight: 600;
                color: var(--trail-orange, #ff6b35);
            }

            .feedback-solicitation-text p {
                margin: 0;
                font-size: 0.95rem;
                line-height: 1.4;
                opacity: 0.9;
            }

            .feedback-solicitation-buttons {
                display: flex;
                gap: 0.5rem;
                flex-wrap: wrap;
                justify-content: flex-end;
            }

            @media (max-width: 480px) {
                .feedback-solicitation-buttons {
                    flex-direction: column;
                }

                .feedback-solicitation-buttons .btn {
                    width: 100%;
                    text-align: center;
                }
            }

            .feedback-solicitation-popup .btn {
                padding: 0.5rem 1rem;
                border-radius: 6px;
                border: none;
                cursor: pointer;
                font-size: 0.85rem;
                text-decoration: none;
                transition: all 0.2s ease;
                flex: 1;
                min-width: 100px;
            }

            .feedback-solicitation-popup .btn-primary {
                background: var(--trail-orange, #ff6b35);
                color: white;
            }

            .feedback-solicitation-popup .btn-primary:hover {
                background: var(--trail-orange-dark, #e55a2b);
                transform: translateY(-1px);
            }

            .feedback-solicitation-popup .btn-secondary {
                background: rgba(255, 255, 255, 0.1);
                color: white;
                border: 1px solid rgba(255, 255, 255, 0.2);
            }

            .feedback-solicitation-popup .btn-secondary:hover {
                background: rgba(255, 255, 255, 0.2);
            }

            .feedback-solicitation-popup .btn-link {
                background: transparent;
                color: #ccc;
                text-decoration: underline;
                font-size: 0.8rem;
                flex: none;
                min-width: auto;
            }

            .feedback-solicitation-popup .btn-link:hover {
                color: white;
                background: transparent;
            }

            /* Dark mode adjustments */
            @media (prefers-color-scheme: dark) {
                .feedback-solicitation-popup {
                    background: rgba(0, 0, 0, 0.95);
                }
            }
        `;

        document.head.appendChild(styles);
    }

}

export { FeedbackSolicitation };
