import { AVAILABLE_ICONS } from '../utils/constants.js';
import { t } from '../translations.js';

export class AnnotationController {
    constructor(app) {
        this.app = app;
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
            
            this.app.updateProgressBarMarkers();
            this.app.showMessage(t('messages.annotationAdded'), 'success');
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
} 