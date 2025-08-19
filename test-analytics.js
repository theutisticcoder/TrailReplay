/**
 * Analytics Testing Script
 * 
 * This script tests all the analytics events that were previously tracked
 * with Vercel Analytics to ensure they work with the new GA4 setup.
 * 
 * To use:
 * 1. Set up your GA4 Measurement ID in src/config/analytics.js
 * 2. Open your app in the browser
 * 3. Open browser dev tools (F12) > Console tab
 * 4. Copy and paste this script into the console
 * 5. Run it to test all events
 */

console.log('🧪 Starting Analytics Test Suite...');

// Import the analytics tracker (assuming it's available globally)
const { AnalyticsTracker } = await import('./src/utils/analytics.js');

// Test all event types
const testEvents = [
    // File upload events
    () => AnalyticsTracker.trackFileUpload(1, 'single'),
    () => AnalyticsTracker.trackFileUpload(3, 'multiple'),
    () => AnalyticsTracker.trackFileUpload(5, 'journey'),
    
    // Playback events
    () => AnalyticsTracker.trackPlayback('play', 120),
    () => AnalyticsTracker.trackPlayback('pause'),
    () => AnalyticsTracker.trackPlayback('reset'),
    
    // Video export events
    () => AnalyticsTracker.trackVideoExport('webm', '16:9'),
    () => AnalyticsTracker.trackVideoExport('mp4', '1:1'),
    () => AnalyticsTracker.trackVideoExport('manual', '9:16'),
    
    // Journey creation
    () => AnalyticsTracker.trackJourneyCreation(3, true),
    () => AnalyticsTracker.trackJourneyCreation(1, false),
    
    // Map customization
    () => AnalyticsTracker.trackMapCustomization('terrain3d', true),
    () => AnalyticsTracker.trackMapCustomization('pathColor', '#ff0000'),
    () => AnalyticsTracker.trackMapCustomization('markerSize', 'large'),
    
    // Interactive features
    () => AnalyticsTracker.trackInteractiveFeature('annotation', 'pin'),
    () => AnalyticsTracker.trackInteractiveFeature('icon_change', 'runner'),
    
    // Language changes
    () => AnalyticsTracker.trackLanguageChange('en'),
    () => AnalyticsTracker.trackLanguageChange('es'),
    
    // Tutorial interactions
    () => AnalyticsTracker.trackTutorial('getting_started'),
    () => AnalyticsTracker.trackTutorial('advanced_features'),
    
    // Terrain settings
    () => AnalyticsTracker.trackTerrainSettings('satellite', true, 'mapzen'),
    () => AnalyticsTracker.trackTerrainSettings('terrain', false, 'opentopo'),
    
    // Strava events
    () => AnalyticsTracker.trackStravaEvent('auth_initiated'),
    () => AnalyticsTracker.trackStravaEvent('auth_success', { activities_count: 50 }),
    () => AnalyticsTracker.trackStravaEvent('activity_imported', { activity_type: 'running' }),
    
    // Generic events
    () => AnalyticsTracker.trackEvent('custom_test_event', { test: true, timestamp: Date.now() })
];

// Run all tests with a small delay between each
async function runTests() {
    console.log(`📊 Testing ${testEvents.length} different event types...`);
    
    for (let i = 0; i < testEvents.length; i++) {
        const testFn = testEvents[i];
        try {
            testFn();
            console.log(`✅ Test ${i + 1}/${testEvents.length} passed`);
        } catch (error) {
            console.error(`❌ Test ${i + 1}/${testEvents.length} failed:`, error);
        }
        
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('🎉 Analytics test suite completed!');
    console.log('📈 Check your Google Analytics Real-time reports to see the events');
    console.log('🔍 Events should appear within a few seconds in GA4 Real-time view');
}

// Run the tests
runTests();


