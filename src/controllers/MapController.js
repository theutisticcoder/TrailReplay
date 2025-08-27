import { MapRenderer } from '../map/MapRenderer.js';

export class MapController {
    constructor(app) {
        this.app = app;
        this.mapRenderer = null;
    }

    async init() {
        if (!this.mapRenderer) {
            this.mapRenderer = new MapRenderer('map');
            await this.waitForMapLoad();
            
            // Enable 3D terrain by default
            setTimeout(() => {
                if (this.mapRenderer && this.mapRenderer.isTerrainSupported && this.mapRenderer.isTerrainSupported()) {
                    console.log('Auto-enabling 3D terrain on startup');
                    this.mapRenderer.enable3DTerrain();
                } else {
                    console.warn('3D terrain not supported, falling back to 2D');
                    // Uncheck the checkbox if terrain is not supported
                    const terrain3dToggle = document.getElementById('terrain3d');
                    if (terrain3dToggle) {
                        terrain3dToggle.checked = false;
                    }
                    // Hide terrain source group
                    const terrainSourceGroup = document.getElementById('terrainSourceGroup');
                    if (terrainSourceGroup) {
                        terrainSourceGroup.style.display = 'none';
                    }
                }
            }, 1000); // Small delay to ensure map is fully loaded
        }
    }

    async waitForMapLoad() {
        return new Promise((resolve) => {
            if (this.mapRenderer && this.mapRenderer.map && this.mapRenderer.map.loaded()) {
                resolve();
                return;
            }

            const checkMapLoaded = () => {
                if (this.mapRenderer && this.mapRenderer.map && this.mapRenderer.map.loaded()) {
                    resolve();
                } else {
                    setTimeout(checkMapLoaded, 100);
                }
            };

            checkMapLoaded();
        });
    }

    // Delegate methods to mapRenderer
    changeMapStyle(style) {
        if (this.mapRenderer) {
            this.mapRenderer.changeMapStyle(style);
        }
    }

    setPathColor(color) {
        if (this.mapRenderer) {
            this.mapRenderer.setPathColor(color);
        }
    }

    setMarkerSize(size) {
        if (this.mapRenderer) {
            this.mapRenderer.setMarkerSize(size);
        }
    }

    setAutoZoom(enabled) {
        if (this.mapRenderer) {
            this.mapRenderer.setAutoZoom(enabled);
        }
    }

    setShowCircle(enabled) {
        if (this.mapRenderer) {
            this.mapRenderer.setShowCircle(enabled);
        }
    }

    setShowMarker(enabled) {
        if (this.mapRenderer) {
            this.mapRenderer.setShowMarker(enabled);
        }
    }

    setCameraMode(mode) {
        console.log('🎬 MapController.setCameraMode called with:', mode);
        if (this.mapRenderer) {
            console.log('🎬 MapController delegating to MapRenderer.setCameraMode');
            this.mapRenderer.setCameraMode(mode);
        } else {
            console.warn('🎬 MapRenderer not available in MapController');
        }
    }

    setFollowBehindZoomPreset(presetName) {
        console.log('🎬 MapController.setFollowBehindZoomPreset called with:', presetName);
        if (this.mapRenderer && this.mapRenderer.followBehindCamera) {
            this.mapRenderer.followBehindCamera.setZoomPreset(presetName);
        } else {
            console.warn('🎬 FollowBehindCamera not available in MapController');
        }
    }

    enable3DTerrain() {
        if (this.mapRenderer) {
            this.mapRenderer.enable3DTerrain();
        }
    }

    disable3DTerrain() {
        if (this.mapRenderer) {
            this.mapRenderer.disable3DTerrain();
        }
    }

    loadTrackData(trackData) {
        if (this.mapRenderer) {
            this.mapRenderer.loadTrack(trackData);
        }
    }

    loadJourneyData(journeyData) {
        if (this.mapRenderer) {
            // Journey data is also loaded using loadTrack, similar to how main.js does it
            this.mapRenderer.loadTrack(journeyData);
        }
    }

    startAnimation() {
        if (this.mapRenderer) {
            this.mapRenderer.startAnimation();
        }
    }

    stopAnimation() {
        if (this.mapRenderer) {
            this.mapRenderer.stopAnimation();
        }
    }

    resetAnimation() {
        if (this.mapRenderer) {
            this.mapRenderer.resetAnimation();
        }
    }

    resetPosition() {
        if (this.mapRenderer) {
            this.mapRenderer.resetPosition();
        }
    }

    getCurrentProgress() {
        return this.mapRenderer ? this.mapRenderer.getAnimationProgress() : 0;
    }

    seekToProgress(progress) {
        if (this.mapRenderer) {
            this.mapRenderer.setAnimationProgress(progress);
        }
    }

    setAnimationProgress(progress) {
        if (this.mapRenderer) {
            this.mapRenderer.setAnimationProgress(progress);
        }
    }

    // Setup segment animation for journeys - critical for proper timing
    setupSegmentAnimation(segments, segmentTiming) {
        if (this.mapRenderer && this.mapRenderer.setupSegmentAnimation) {
            console.log('🎯 MapController: Delegating setupSegmentAnimation to MapRenderer');
            this.mapRenderer.setupSegmentAnimation(segments, segmentTiming);
        } else {
            console.warn('MapRenderer setupSegmentAnimation method not available');
        }
    }

    // Get journey elapsed time
    getJourneyElapsedTime() {
        return this.mapRenderer?.journeyElapsedTime;
    }

    // Set journey elapsed time
    setJourneyElapsedTime(time) {
        if (this.mapRenderer && this.mapRenderer.setJourneyElapsedTime) {
            this.mapRenderer.setJourneyElapsedTime(time);
        }
    }
} 