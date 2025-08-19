import { TrailReplayApp } from './core/TrailReplayApp.js';
import { AnalyticsTracker } from './utils/analytics.js';
import { GA4_MEASUREMENT_ID, shouldEnableAnalytics, ANALYTICS_CONFIG } from './config/analytics.js';
import { CookieConsentManager } from './ui/cookieConsent.js';
import { setupFeedbackForm } from './ui/feedback.js';

window.addEventListener('DOMContentLoaded', async () => {
  // Initialize Google Analytics 4 if enabled
  if (shouldEnableAnalytics()) {
    AnalyticsTracker.init(GA4_MEASUREMENT_ID);
    
    // Always enable analytics (no consent check)
    AnalyticsTracker.setEnabled(true);
    
    // Track page view for all users
    AnalyticsTracker.track('page_view', {
      page_title: document.title,
      page_location: window.location.href
    });
  } else {
    console.log('📊 Analytics disabled (check config/analytics.js)');
  }
  
  const app = new TrailReplayApp();
  window.app = app; // Make app globally accessible
  await app.init();
  
  // Wire feedback form after header/footer load
  setupFeedbackForm();
}); 