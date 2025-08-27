import { byId } from '../utils/dom.js';

/**
 * Centralized DOM → Controller wiring. All callbacks call public methods on
 * the controllers – the UI layer never reaches into internals.
 */
export function setupEventListeners(app) {

    // File picker / drag-and-drop
    const fileInput = byId('gpxFileInput');
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            app.file.handleFiles(e.target.files);
        });
    }

    // Playback controls
    const playBtn = byId('playBtn');
    if (playBtn) {
        playBtn.addEventListener('click', () => app.playback.toggle());
    }

    const resetBtn = byId('resetBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => app.playback.reset());
    }



    // Icon controls
    const changeIconBtn = byId('changeIconBtn');
    if (changeIconBtn) {
        changeIconBtn.addEventListener('click', () => app.icon.showIconSelectionModal());
    }

    const addIconChangeBtn = byId('addIconChangeBtn');
    if (addIconChangeBtn) {
        addIconChangeBtn.addEventListener('click', () => app.icon.toggleIconChangeMode());
    }

    const addAnnotationBtn = byId('addAnnotationBtn');
    if (addAnnotationBtn) {
        addAnnotationBtn.addEventListener('click', () => app.notes.toggleAnnotationMode());
    }

    // Map controls
    const terrainStyleSelect = byId('terrainStyle');
    if (terrainStyleSelect) {
        terrainStyleSelect.addEventListener('change', (e) => {
            app.map.changeMapStyle(e.target.value);
        });
    }

    // Path color controls
    const pathColorInput = byId('pathColor');
    if (pathColorInput) {
        pathColorInput.addEventListener('change', (e) => {
            app.map.setPathColor(e.target.value);
        });
    }

    // Color presets
    document.querySelectorAll('.color-preset').forEach(preset => {
        preset.addEventListener('click', (e) => {
            const color = e.target.getAttribute('data-color');
            if (pathColorInput) pathColorInput.value = color;
            app.map.setPathColor(color);
        });
    });

    // Marker size slider
    const markerSizeSlider = byId('markerSize');
    if (markerSizeSlider) {
        markerSizeSlider.addEventListener('input', (e) => {
            const size = parseFloat(e.target.value);
            const sizeDisplay = byId('markerSizeValue');
            if (sizeDisplay) {
                sizeDisplay.textContent = `${size}x`;
            }
            app.map.setMarkerSize(size);
        });
    }

    // Auto zoom toggle
    const autoZoomToggle = byId('autoZoom');
    if (autoZoomToggle) {
        autoZoomToggle.addEventListener('change', (e) => {
            app.map.setAutoZoom(e.target.checked);
        });
    }

    // Show circle toggle
    const showCircleToggle = byId('showCircle');
    if (showCircleToggle) {
        showCircleToggle.addEventListener('change', (e) => {
            app.map.setShowCircle(e.target.checked);
        });
    }

    // Show marker toggle
    const showMarkerToggle = byId('showMarker');
    if (showMarkerToggle) {
        showMarkerToggle.addEventListener('change', (e) => {
            app.map.setShowMarker(e.target.checked);
        });
    }

    // Camera mode dropdown
    const cameraModeSelect = byId('cameraMode');
    if (cameraModeSelect) {
        console.log('🎬 Setting up camera mode event listener');
        
        // Function to update UI based on camera mode
        const updateCameraModeUI = (mode) => {
            // Show/hide follow-behind zoom preset dropdown
            const followBehindZoomGroup = byId('followBehindZoomGroup');
            if (followBehindZoomGroup) {
                followBehindZoomGroup.style.display = mode === 'followBehind' ? 'block' : 'none';
            }
            
            // Show/hide camera controls info tooltip (only for standard mode)
            const cameraControlsInfo = byId('cameraControlsInfo');
            if (cameraControlsInfo) {
                cameraControlsInfo.style.display = mode === 'standard' ? 'inline-block' : 'none';
            }
        };
        
        cameraModeSelect.addEventListener('change', (e) => {
            console.log('🎬 Camera mode changed to:', e.target.value);
            app.map.setCameraMode(e.target.value);
            
            // Update UI elements
            updateCameraModeUI(e.target.value);
        });
        
        // Set initial state based on default selection
        const initialValue = cameraModeSelect.value;
        updateCameraModeUI(initialValue);
        
        console.log('🎬 Camera mode event listener set up successfully');
    } else {
        console.warn('🎬 Camera mode dropdown not found in DOM');
    }

    // Follow-behind zoom preset dropdown
    const followBehindZoomSelect = byId('followBehindZoom');
    if (followBehindZoomSelect) {
        console.log('🎬 Setting up follow-behind zoom preset event listener');
        followBehindZoomSelect.addEventListener('change', (e) => {
            console.log('🎬 Follow-behind zoom preset changed to:', e.target.value);
            app.map.setFollowBehindZoomPreset(e.target.value);
        });
        console.log('🎬 Follow-behind zoom preset event listener set up successfully');
    }

    // 3D terrain toggle
    const terrain3dToggle = byId('terrain3d');
    if (terrain3dToggle) {
        terrain3dToggle.addEventListener('change', (e) => {
            if (e.target.checked) {
                app.map.enable3DTerrain();
            } else {
                app.map.disable3DTerrain();
            }
        });
    }

    // Camera controls info tooltip
    const cameraControlsInfo = byId('cameraControlsInfo');
    if (cameraControlsInfo) {
        // Mobile/touch behavior - toggle tooltip on click
        cameraControlsInfo.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            cameraControlsInfo.classList.toggle('active');
        });

        // Close tooltip when clicking outside on mobile
        document.addEventListener('click', (e) => {
            if (!cameraControlsInfo.contains(e.target)) {
                cameraControlsInfo.classList.remove('active');
            }
        });
    }

    // Drag and drop functionality
    setupDragAndDrop(app);
}

function setupDragAndDrop(app) {
    const dropZone = document.body;

    const preventDefaults = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    // Highlight drop zone when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.add('drag-over');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.remove('drag-over');
        }, false);
    });

    // Handle dropped files
    dropZone.addEventListener('drop', (e) => {
        app.file.handleDrop(e);
    }, false);
} 