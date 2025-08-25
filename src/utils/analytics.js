/**
 * Analytics utility for tracking TrailReplay user events
 * Now using Google Analytics 4 (GA4) for free analytics tracking
 */
export class AnalyticsTracker {
    static isInitialized = false;
    static isEnabled = true; // Can be toggled for privacy compliance
    
    /**
     * Initialize Google Analytics 4
     * @param {string} measurementId - Your GA4 Measurement ID (G-XXXXXXXXXX)
     */
    static init(measurementId) {
        if (this.isInitialized || !measurementId) return;
        
        // Load Google Analytics script
        const script1 = document.createElement('script');
        script1.async = true;
        script1.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
        document.head.appendChild(script1);
        
        // Initialize gtag
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        window.gtag = gtag;
        gtag('js', new Date());
        gtag('config', measurementId, {
            // Privacy-friendly settings
            anonymize_ip: true,
            cookie_flags: 'SameSite=None;Secure'
        });
        
        this.isInitialized = true;
        console.log('🔍 Analytics initialized with GA4');
    }
    
    /**
     * Generic tracking method that sends events to GA4
     * @param {string} eventName - Event name
     * @param {Object} parameters - Event parameters
     */
    static track(eventName, parameters = {}) {
        if (!this.isEnabled || !this.isInitialized || typeof window.gtag !== 'function') {
            console.log(`📊 Analytics disabled or not initialized: ${eventName}`, parameters);
            return;
        }
        
        // Send event to Google Analytics
        window.gtag('event', eventName, {
            ...parameters,
            // Add some default parameters
            app_name: 'TrailReplay',
            timestamp: new Date().toISOString()
        });
        
        console.log(`📊 Event tracked: ${eventName}`, parameters);
    }
    
    /**
     * Enable or disable analytics tracking
     * @param {boolean} enabled - Whether to enable tracking
     */
    static setEnabled(enabled) {
        this.isEnabled = enabled;
        console.log(`📊 Analytics ${enabled ? 'enabled' : 'disabled'}`);
    }
    /**
     * Track GPX file upload events
     * @param {number} fileCount - Number of files uploaded
     * @param {string} source - Upload source (single, multiple, journey)
     */
    static trackFileUpload(fileCount = 1, source = 'single') {
        this.track('gpx_file_upload', {
            file_count: fileCount,
            upload_source: source
        });
    }

    /**
     * Track animation playback events
     * @param {string} action - play, pause, reset
     * @param {number} duration - Track duration in seconds
     */
    static trackPlayback(action, duration = 0) {
        this.track('animation_playback', {
            action: action,
            track_duration: duration
        });
    }

    /**
     * Track video export events
     * @param {string} format - webm, mp4, manual
     * @param {string} aspectRatio - 16:9, 1:1, 9:16
     */
    static trackVideoExport(format, aspectRatio = '1:1') {
        this.track('video_export', {
            export_format: format,
            aspect_ratio: aspectRatio
        });
    }

    /**
     * Track journey creation events
     * @param {number} trackCount - Number of tracks in journey
     * @param {boolean} hasTransportation - Whether transportation segments were added
     */
    static trackJourneyCreation(trackCount, hasTransportation = false) {
        this.track('journey_creation', {
            track_count: trackCount,
            has_transportation: hasTransportation
        });
    }

    /**
     * Track map customization events
     * @param {string} setting - terrain3d, pathColor, markerSize, etc.
     * @param {any} value - The setting value
     */
    static trackMapCustomization(setting, value) {
        this.track('map_customization', {
            setting: setting,
            value: String(value)
        });
    }

    /**
     * Track annotation and icon change events
     * @param {string} type - annotation, icon_change
     * @param {string} icon - The icon used
     */
    static trackInteractiveFeature(type, icon = '') {
        this.track('interactive_feature', {
            feature_type: type,
            icon_used: icon
        });
    }

    /**
     * Track language changes
     * @param {string} language - en, es
     */
    static trackLanguageChange(language) {
        this.track('language_change', {
            language: language
        });
    }

    /**
     * Track tutorial page visits and interactions
     * @param {string} section - Section of tutorial visited
     */
    static trackTutorial(section) {
        this.track('tutorial_interaction', {
            section: section
        });
    }

    /**
     * Track terrain and visual setting changes
     * @param {string} terrainStyle - satellite, terrain, street
     * @param {boolean} terrain3d - Whether 3D terrain is enabled
     * @param {string} terrainSource - mapzen, opentopo
     */
    static trackTerrainSettings(terrainStyle, terrain3d, terrainSource) {
        this.track('terrain_settings', {
            style: terrainStyle,
            terrain_3d: terrain3d,
            source: terrainSource
        });
    }

    /**
     * Generic event tracking method
     * @param {string} event - Event name
     * @param {Object} properties - Event properties
     */
    static trackEvent(event, properties = {}) {
        this.track(event, properties);
    }

    /**
     * Track Strava integration events
     * @param {string} action - auth_initiated, auth_success, auth_failed, activities_loaded, activity_imported, logout
     * @param {Object} properties - Additional properties
     */
    static trackStravaEvent(action, properties = {}) {
        this.track('strava_integration', {
            action: action,
            ...properties
        });
    }

    /**
     * Track donation/support button clicks
     * @param {string} platform - ko-fi, buymeacoffee, etc.
     * @param {string} location - footer, modal, etc.
     */
    static trackDonationClick(platform = 'ko-fi', location = 'footer') {
        this.track('donation_click', {
            platform: platform,
            location: location,
            timestamp: new Date().toISOString()
        });
    }
}

// Legacy function export for backwards compatibility
export const trackEvent = (event, properties = {}) => {
    AnalyticsTracker.track(event, properties);
}; 