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