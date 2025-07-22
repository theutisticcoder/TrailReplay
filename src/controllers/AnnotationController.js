import { AVAILABLE_ICONS } from '../utils/constants.js';
import { t } from '../translations.js';

export class AnnotationController {
    constructor(app) {
        this.app = app;
        this.selectedImageForAnnotation = null;
    }

    toggleAnnotationMode() {
        const mapRenderer = this.app.mapRenderer;
        if (!mapRenderer) return;

        const btn = document.getElementById('addAnnotationBtn');
        const span = btn.querySelector('span');
        
        if (mapRenderer.isAnnotationMode) {
            mapRenderer.disableAnnotationMode();
            span.textContent = t('controls.addAnnotation');
            btn.classList.remove('primary');
        } else {
            mapRenderer.enableAnnotationMode();
            span.textContent = t('status.cancel');
            btn.classList.add('primary');
            this.app.showMessage(t('messages.clickMapToAnnotate'), 'info');
        }
    }





    showAnnotationModal() {
        const modal = document.getElementById('annotationModal');
        if (modal) {
            modal.style.display = 'flex';
            const titleInput = document.getElementById('annotationTitle');
            if (titleInput) titleInput.focus();
        }
    }

    closeAnnotationModal() {
        const modal = document.getElementById('annotationModal');
        if (modal) {
            modal.style.display = 'none';
        }
        
        const titleInput = document.getElementById('annotationTitle');
        const descInput = document.getElementById('annotationDescription');
        if (titleInput) titleInput.value = '';
        if (descInput) descInput.value = '';
        
        // Reset annotation mode
        const mapRenderer = this.app.mapRenderer;
        if (mapRenderer) {
            mapRenderer.disableAnnotationMode();
            const btn = document.getElementById('addAnnotationBtn');
            if (btn) {
                btn.querySelector('span').textContent = t('controls.addAnnotation');
                btn.classList.remove('primary');
            }
        }
    }

    saveAnnotation() {
        const title = document.getElementById('annotationTitle').value.trim();
        const description = document.getElementById('annotationDescription').value.trim();
        
        if (!title) {
            document.getElementById('annotationTitle').focus();
            return;
        }

        const mapRenderer = this.app.mapRenderer;
        if (mapRenderer && this.app.currentAnnotation.progress !== undefined) {
            // Check if this is a picture annotation
            if (this.selectedImageForAnnotation) {
                // Create picture annotation
                const pictureAnnotation = mapRenderer.addPictureAnnotation(
                    this.app.currentAnnotation.progress,
                    title,
                    description,
                    this.selectedImageForAnnotation,
                    this.getPictureDisplayDuration()
                );

                // Add to unified timeline
                this.app.timeline.addTimelineEvent({
                    id: pictureAnnotation.id,
                    type: 'pictureAnnotation',
                    progress: pictureAnnotation.progress,
                    timestamp: pictureAnnotation.timestamp,
                    icon: '📸',
                    title: pictureAnnotation.title,
                    description: pictureAnnotation.description
                });

                this.app.showMessage(t('messages.pictureAnnotationAdded') || 'Picture annotation added!', 'success');
            } else {
                // Create regular annotation
                const annotation = mapRenderer.addAnnotation(
                    this.app.currentAnnotation.progress,
                    title,
                    description,
                    this.app.currentAnnotation.icon || '📍'
                );

                // Add to unified timeline
                this.app.timeline.addTimelineEvent({
                    id: annotation.id,
                    type: 'annotation',
                    progress: annotation.progress,
                    timestamp: annotation.timestamp,
                    icon: annotation.icon,
                    title: annotation.title,
                    description: annotation.description
                });

                this.app.showMessage(t('messages.annotationAdded'), 'success');
            }
            
            this.app.updateProgressBarMarkers();
        }

        this.closeAnnotationModal();
    }

    addAnnotationToList(annotation) {
        const annotationsSection = document.getElementById('annotationsSection');
        const annotationsList = document.getElementById('annotationsList');
        
        // Show annotations section if hidden
        if (annotationsSection.style.display === 'none') {
            annotationsSection.style.display = 'block';
            annotationsSection.classList.add('fade-in');
        }

        const progressPercent = (annotation.progress * 100).toFixed(1);
        const timeFromStart = this.app.currentTrackData ? 
            this.app.gpxParser.formatDuration(annotation.progress * this.app.currentTrackData.stats.totalDuration) : 
            `${progressPercent}%`;

        const annotationElement = document.createElement('div');
        annotationElement.className = 'annotation-item';
        annotationElement.setAttribute('data-id', annotation.id);
        annotationElement.innerHTML = `
            <div class="annotation-header">
                <span class="annotation-icon">${annotation.icon}</span>
                <span class="annotation-title">${annotation.title}</span>
                <span class="annotation-time">At ${timeFromStart}</span>
                <div class="annotation-actions">
                    <button class="annotation-action" onclick="window.app.annotations.removeAnnotationFromList(${annotation.id})" title="Delete">🗑️</button>
                </div>
            </div>
            ${annotation.description ? `<div class="annotation-description">${annotation.description}</div>` : ''}
        `;

        // Add click handler to jump to annotation
        annotationElement.addEventListener('click', (e) => {
            // Don't trigger if clicking on delete button
            if (!e.target.classList.contains('annotation-action')) {
                const mapRenderer = this.app.mapRenderer;
                if (mapRenderer) {
                    mapRenderer.setAnimationProgress(annotation.progress);
                    this.app.updateProgressDisplay();
                }
            }
        });

        annotationsList.appendChild(annotationElement);
    }

    removeAnnotationFromList(id) {
        // Use the unified timeline controller to remove
        this.app.timeline.removeTimelineEvent(id);
        this.app.updateProgressBarMarkers();
    }



    saveIconChange() {
        const selectedIcon = this.app.currentSelectedIcon;
        const progress = this.app.currentIconChangeProgress;
        
        if (selectedIcon && progress !== undefined) {
            const iconChange = {
                id: Date.now(),
                progress: progress,
                icon: selectedIcon,
                timestamp: Date.now()
            };
            
            // Delegate to icon controller
            if (this.app.icon && this.app.icon.addIconChangeToTimeline) {
                this.app.icon.addIconChangeToTimeline(iconChange);
            }
            this.app.showMessage(t('messages.iconChangeAdded'), 'success');
        }
        
        this.closeIconSelectionModal();
        // Reset selection mode
        this.app.state.isSelectingForChange = false;
        const btn = document.getElementById('toggleIconChangeModeBtn');
        if (btn) {
            btn.querySelector('span').textContent = t('controls.changeIcon');
            btn.classList.remove('primary');
        }
    }

    // Picture annotation methods
    updateImageLibrary(uploadedImages) {
        console.log('Updating image library with', uploadedImages.length, 'images');
        
        // Store reference to uploaded images
        this.app.uploadedImages = uploadedImages;
        
        // Update annotation modal if it exists
        const modal = document.getElementById('annotationModal');
        if (!modal) return;
        
        // Find or create image selection section
        let imageSection = modal.querySelector('.annotation-image-library');
        if (!imageSection) {
            // Create image library section
            const modalBody = modal.querySelector('.modal-body');
            if (modalBody) {
                // Add image library after existing content
                imageSection = document.createElement('div');
                imageSection.className = 'annotation-image-library';
                imageSection.innerHTML = `
                    <h4>Select Image for Annotation:</h4>
                    <div class="annotation-image-grid" id="annotationImageGrid">
                        <!-- Images will be populated here -->
                    </div>
                    <div class="picture-settings">
                        <label for="pictureDisplayDuration">Display Duration (seconds):</label>
                        <input type="number" id="pictureDisplayDuration" value="3" min="1" max="10" step="1">
                    </div>
                `;
                modalBody.appendChild(imageSection);
            }
        }
        
        // Populate image grid
        const imageGrid = imageSection.querySelector('#annotationImageGrid');
        if (imageGrid && uploadedImages.length > 0) {
            imageGrid.innerHTML = uploadedImages.map(image => `
                <div class="annotation-image-item" data-image-id="${image.id}">
                    <img src="${image.url}" alt="${image.name}" class="annotation-image-thumbnail">
                    <span class="annotation-image-name">${image.name}</span>
                </div>
            `).join('');
            
            // Add click handlers to image items
            imageGrid.querySelectorAll('.annotation-image-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    this.selectImageForAnnotation(item.dataset.imageId);
                });
            });
        } else if (imageGrid) {
            imageGrid.innerHTML = '<p class="no-images-message">No images uploaded. Drag and drop image files to add them.</p>';
        }
    }

    selectImageForAnnotation(imageId) {
        // Find the selected image
        const selectedImage = this.app.uploadedImages?.find(img => img.id == imageId);
        if (!selectedImage) return;
        
        this.selectedImageForAnnotation = selectedImage;
        
        // Update visual selection in the UI
        document.querySelectorAll('.annotation-image-item').forEach(item => {
            item.classList.remove('selected');
        });
        
        const selectedItem = document.querySelector(`[data-image-id="${imageId}"]`);
        if (selectedItem) {
            selectedItem.classList.add('selected');
        }
        
        console.log('Selected image for annotation:', selectedImage.name);
    }

    getPictureDisplayDuration() {
        const durationInput = document.getElementById('pictureDisplayDuration');
        if (durationInput) {
            return Math.max(1, Math.min(10, parseInt(durationInput.value))) * 1000; // Convert to milliseconds
        }
        return 3000; // Default 3 seconds
    }

    closeAnnotationModal() {
        const modal = document.getElementById('annotationModal');
        if (modal) {
            modal.style.display = 'none';
        }
        
        // Reset selection
        this.selectedImageForAnnotation = null;
        
        // Clear form
        const titleInput = document.getElementById('annotationTitle');
        const descriptionInput = document.getElementById('annotationDescription');
        if (titleInput) titleInput.value = '';
        if (descriptionInput) descriptionInput.value = '';
        
        // Reset image selection visual state
        document.querySelectorAll('.annotation-image-item').forEach(item => {
            item.classList.remove('selected');
        });
    }

    showAnnotationModal() {
        const modal = document.getElementById('annotationModal');
        if (modal) {
            modal.style.display = 'block';
            
            // Update image library if images are available
            if (this.app.uploadedImages && this.app.uploadedImages.length > 0) {
                this.updateImageLibrary(this.app.uploadedImages);
            }
        }
    }
} 