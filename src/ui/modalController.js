import { byId } from '../utils/dom.js';

/**
 * Sets up modal controls and event listeners
 */
export function setupModals(app) {
    // Setup close buttons for all modals
    const closeButtons = document.querySelectorAll('.modal .close');
    closeButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            if (modal) {
                hideModal(modal.id);
            }
        });
    });

    // Close modals when clicking outside
    window.addEventListener('click', (e) => {
        // Only close if the click target is actually the modal backdrop
        if (e.target.classList.contains('modal') && e.isTrusted) {
            console.log('🎯 Modal backdrop clicked, closing modal:', e.target.id);
            hideModal(e.target.id);
        }
    });

    // Setup specific modal event listeners
    setupIconSelectionModal(app);
    setupAnnotationModal(app);
}

function setupIconSelectionModal(app) {
    const modal = byId('iconSelectionModal');
    if (!modal) return;

    const saveBtn = modal.querySelector('.save-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            if (window.app && window.app.annotations) {
                window.app.annotations.selectIcon(window.app.currentSelectedIcon);
            }
        });
    }

    const cancelBtn = modal.querySelector('.cancel-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            hideModal('iconSelectionModal');
        });
    }
}

function setupAnnotationModal(app) {
    const modal = byId('annotationModal');
    if (!modal) return;

    // Use the correct IDs from the HTML
    const saveBtn = byId('saveAnnotationBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            if (app && app.notes) {
                app.notes.saveAnnotation();
            }
        });
    }

    const cancelBtn = byId('cancelAnnotationBtn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            if (app && app.notes) {
                app.notes.closeAnnotationModal();
            }
        });
    }

    // Also setup close button
    const closeBtn = byId('closeAnnotationModal');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            if (app && app.notes) {
                app.notes.closeAnnotationModal();
            }
        });
    }

    // Setup annotation icon selection
    const annotationIcons = modal.querySelectorAll('.annotation-icon');
    annotationIcons.forEach(icon => {
        icon.addEventListener('click', () => {
            // Remove previous selection
            annotationIcons.forEach(i => i.classList.remove('selected'));
            // Mark as selected
            icon.classList.add('selected');
            // Store the selected icon
            if (!app.currentAnnotation) app.currentAnnotation = {};
            app.currentAnnotation.icon = icon.getAttribute('data-icon');
        });
    });
}

// Utility functions for modal management
export function showModal(modalId) {
    const modal = byId(modalId);
    if (modal) {
        modal.style.display = 'block';
        // Add animation class if needed
        modal.classList.add('modal-show');
    }
}

export function hideModal(modalId) {
    console.log('🎯 modalController.hideModal() called for:', modalId);
    const modal = byId(modalId);
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('modal-show');
        
        // If it's the icon change modal, notify the IconController
        if (modalId === 'iconChangeModal' && window.app && window.app.icon) {
            console.log('🎯 Notifying IconController that icon change modal was closed by modalController');
            window.app.icon.closeIconChangeModal();
        }
    }
}

export function toggleModal(modalId) {
    const modal = byId(modalId);
    if (modal) {
        if (modal.style.display === 'none' || !modal.style.display) {
            showModal(modalId);
        } else {
            hideModal(modalId);
        }
    }
} 