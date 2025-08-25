/**
 * Analytics Configuration for TrailReplay
 * 
 * To set up Google Analytics 4:
 * 1. Go to https://analytics.google.com/
 * 2. Create a new GA4 property for your website
 * 3. Copy your Measurement ID (starts with G-XXXXXXXXXX)
 * 4. Replace the MEASUREMENT_ID below with your actual ID
 */

// Your actual GA4 Measurement ID
export const GA4_MEASUREMENT_ID = 'G-0JN6P31VV9';

// Analytics configuration
export const ANALYTICS_CONFIG = {
    // Set to true to enable analytics in development
    enableInDevelopment: false,
    
    // Set to false to disable analytics completely
    enabled: true,
    
    // Cookie consent configuration (disabled for universal tracking)
    requireConsent: false,
    
    // Privacy settings
    anonymizeIp: true,
    
    // Custom dimensions (optional)
    customDimensions: {
        // Add custom dimensions here if needed
        // user_type: 'custom_dimension_1',
        // session_type: 'custom_dimension_2'
    }
};

/**
 * Check if analytics should be enabled based on environment and configuration
 */
export function shouldEnableAnalytics() {
    // Don't enable in development unless explicitly configured
    const isDevelopment = window.location.hostname === 'localhost' || 
                         window.location.hostname === '127.0.0.1' ||
                         window.location.hostname.includes('vercel.app');
    
    if (isDevelopment && !ANALYTICS_CONFIG.enableInDevelopment) {
        return false;
    }
    
    return ANALYTICS_CONFIG.enabled && GA4_MEASUREMENT_ID !== 'G-XXXXXXXXXX';
}
