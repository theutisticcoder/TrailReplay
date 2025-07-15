import { track } from '@vercel/analytics';

/**
 * Analytics utility for tracking TrailReplay user events
 */
export class AnalyticsTracker {
    /**
     * Track GPX file upload events
     * @param {number} fileCount - Number of files uploaded
     * @param {string} source - Upload source (single, multiple, journey)
     */
    static trackFileUpload(fileCount = 1, source = 'single') {
        track('gpx_file_upload', {
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
        track('animation_playback', {
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
        track('video_export', {
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
        track('journey_creation', {
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
        track('map_customization', {
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
        track('interactive_feature', {
            feature_type: type,
            icon_used: icon
        });
    }

    /**
     * Track language changes
     * @param {string} language - en, es
     */
    static trackLanguageChange(language) {
        track('language_change', {
            language: language
        });
    }

    /**
     * Track tutorial page visits and interactions
     * @param {string} section - Section of tutorial visited
     */
    static trackTutorial(section) {
        track('tutorial_interaction', {
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
        track('terrain_settings', {
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
        track(event, properties);
    }

    /**
     * Track Strava integration events
     * @param {string} action - auth_initiated, auth_success, auth_failed, activities_loaded, activity_imported, logout
     * @param {Object} properties - Additional properties
     */
    static trackStravaEvent(action, properties = {}) {
        track('strava_integration', {
            action: action,
            ...properties
        });
    }
}

// Legacy function export for backwards compatibility
export const trackEvent = (event, properties = {}) => {
    track(event, properties);
}; 