import { t } from '../translations.js';

export class TimelineController {
    constructor(app) {
        this.app = app;
        this.timelineEvents = []; // Unified list of annotations and icon changes
    }

    // Add a new timeline event (annotation or icon change)
    addTimelineEvent(event) {
        // Check if event already exists to prevent duplicates
        const existingEvent = this.timelineEvents.find(e => e.id === event.id);
        if (existingEvent) {
            console.warn('Timeline event already exists:', event.id);
            return existingEvent;
        }

        // Ensure the event has required properties
        const timelineEvent = {
            id: event.id || Date.now(),
            type: event.type, // 'annotation' or 'iconChange'
            progress: event.progress,
            timestamp: event.timestamp || new Date(),
            icon: event.icon,
            // Annotation-specific properties
            title: event.title || null,
            description: event.description || null,
            // Icon change-specific properties
            // (icon is already included above)
        };

        this.timelineEvents.push(timelineEvent);
        this.sortTimelineEvents();
        this.renderTimelineEvents();
        
        return timelineEvent;
    }

    // Remove a timeline event
    removeTimelineEvent(id) {
        // Find the event before removing it to know its type
        const eventToRemove = this.timelineEvents.find(e => e.id === id);
        
        this.timelineEvents = this.timelineEvents.filter(event => event.id !== id);
        this.renderTimelineEvents();
        
        // Also remove from map renderer
        const mapRenderer = this.app.map?.mapRenderer || this.app.mapRenderer;
        if (mapRenderer) {
            if (eventToRemove) {
                if (eventToRemove.type === 'annotation') {
                    mapRenderer.removeAnnotation(id);
                } else if (eventToRemove.type === 'iconChange') {
                    mapRenderer.removeIconChange(id);
                }
            } else {
                // Event was already removed, try both
                mapRenderer.removeAnnotation(id);
                mapRenderer.removeIconChange(id);
            }
            
            // Always update progress bar markers after removing any event
            if (this.app.updateProgressBarMarkers) {
                this.app.updateProgressBarMarkers();
            } else if (this.app.icon && this.app.icon.updateProgressBarMarkers) {
                this.app.icon.updateProgressBarMarkers();
            }
        }
    }

    // Sort events by progress (chronological order)
    sortTimelineEvents() {
        this.timelineEvents.sort((a, b) => a.progress - b.progress);
    }

    // Render the unified timeline
    renderTimelineEvents() {
        let timelineSection = document.getElementById('timelineEventsSection');
        let timelineList = document.getElementById('timelineEventsList');

        // Create timeline section if it doesn't exist
        if (!timelineSection) {
            this.createTimelineSection();
            timelineSection = document.getElementById('timelineEventsSection');
            timelineList = document.getElementById('timelineEventsList');
        }

        // Double-check elements exist before proceeding
        if (!timelineSection || !timelineList) {
            console.warn('Timeline elements not found, skipping render');
            return;
        }

        // Clear existing events
        timelineList.innerHTML = '';

        // Show/hide section based on events
        if (this.timelineEvents.length === 0) {
            timelineSection.style.display = 'none';
            return;
        }

        timelineSection.style.display = 'block';

        // Render each event
        this.timelineEvents.forEach(event => {
            const eventElement = this.createTimelineEventElement(event);
            timelineList.appendChild(eventElement);
        });

        // Update translations for newly created elements
        import('../translations.js').then(({ updatePageTranslations }) => {
            updatePageTranslations();
        });
    }

    // Create the timeline section HTML
    createTimelineSection() {
        // Find where to insert the timeline section (after annotations section or before stats)
        const annotationsSection = document.getElementById('annotationsSection');
        const iconTimelineSection = document.getElementById('iconTimelineSection');
        const statsSection = document.getElementById('statsSection');
        
        // Hide the old separate sections
        if (annotationsSection) annotationsSection.style.display = 'none';
        if (iconTimelineSection) iconTimelineSection.style.display = 'none';

        const timelineSection = document.createElement('section');
        timelineSection.className = 'timeline-events-section';
        timelineSection.id = 'timelineEventsSection';
        timelineSection.style.display = 'none';
        
        timelineSection.innerHTML = `
            <h3 data-i18n="timeline.title">Timeline Events</h3>
            <div class="timeline-events-list" id="timelineEventsList">
                <!-- Timeline events will be added dynamically -->
            </div>
        `;

        // Update translations for the newly created elements
        import('../translations.js').then(({ updatePageTranslations }) => {
            updatePageTranslations();
        });

        // Insert before stats section
        if (statsSection && statsSection.parentNode) {
            statsSection.parentNode.insertBefore(timelineSection, statsSection);
        } else {
            // Fallback: append to main container
            const mainContainer = document.querySelector('main .container');
            if (mainContainer) {
                mainContainer.appendChild(timelineSection);
            }
        }
    }

    // Create HTML element for a timeline event
    createTimelineEventElement(event) {
        const eventElement = document.createElement('div');
        eventElement.className = `timeline-event-item timeline-event-${event.type}`;
        eventElement.setAttribute('data-id', event.id);

        const progressPercent = (event.progress * 100).toFixed(1);
        
        // Try multiple ways to get track duration and format time
        let timeFromStart = `${progressPercent}%`;
        
        // Method 1: Use currentTrackData
        if (this.app.currentTrackData?.stats?.totalDuration && this.app.gpxParser?.formatDuration) {
            const totalSeconds = this.app.currentTrackData.stats.totalDuration;
            const eventSeconds = event.progress * totalSeconds;
            timeFromStart = this.app.gpxParser.formatDuration(eventSeconds);
        }
        // Method 2: Use mapRenderer trackData
        else if (this.app.mapRenderer?.trackData?.stats?.totalDuration) {
            const totalSeconds = this.app.mapRenderer.trackData.stats.totalDuration;
            const eventSeconds = event.progress * totalSeconds;
            timeFromStart = this.formatDuration(eventSeconds);
        }
        // Method 3: Use map.mapRenderer trackData
        else if (this.app.map?.mapRenderer?.trackData?.stats?.totalDuration) {
            const totalSeconds = this.app.map.mapRenderer.trackData.stats.totalDuration;
            const eventSeconds = event.progress * totalSeconds;
            timeFromStart = this.formatDuration(eventSeconds);
        }

        let eventContent = '';
        
        if (event.type === 'annotation') {
            eventContent = `
                <div class="timeline-event-icon">${event.icon}</div>
                <div class="timeline-event-content">
                    <div class="timeline-event-title">${event.title}</div>
                    ${event.description ? `<div class="timeline-event-description">${event.description}</div>` : ''}
                    <div class="timeline-event-time">At ${timeFromStart}</div>
                </div>
            `;
        } else if (event.type === 'iconChange') {
            eventContent = `
                <div class="timeline-event-icon">${event.icon}</div>
                <div class="timeline-event-content">
                    <div class="timeline-event-title"><span data-i18n="timeline.iconChangeTo">Change icon to</span> ${event.icon}</div>
                    <div class="timeline-event-time">At ${timeFromStart}</div>
                </div>
            `;
        }

        eventElement.innerHTML = `
            ${eventContent}
            <div class="timeline-event-actions">
                <button class="timeline-event-action" onclick="window.app.timeline.removeTimelineEvent(${event.id})" data-i18n-title="buttons.delete" title="Delete">🗑️</button>
            </div>
        `;

        // Add click handler to jump to this time
        eventElement.addEventListener('click', (e) => {
            // Don't trigger if clicking on delete button
            if (!e.target.classList.contains('timeline-event-action')) {
                const mapRenderer = this.app.mapRenderer;
                if (mapRenderer) {
                    mapRenderer.setAnimationProgress(event.progress);
                    this.app.updateProgressDisplay();
                }
            }
        });

        return eventElement;
    }

    // Convert existing annotations and icon changes to timeline events
    migrateExistingEvents() {
        const mapRenderer = this.app.mapRenderer;
        if (!mapRenderer) return;

        // Clear current timeline to avoid duplicates
        this.timelineEvents = [];

        // Migrate annotations (but don't re-render during migration)
        const annotations = mapRenderer.getAnnotations();
        annotations.forEach(annotation => {
            const timelineEvent = {
                id: annotation.id,
                type: 'annotation',
                progress: annotation.progress,
                timestamp: annotation.timestamp || new Date(),
                icon: annotation.icon,
                title: annotation.title,
                description: annotation.description
            };
            this.timelineEvents.push(timelineEvent);
        });

        // Migrate icon changes (but don't re-render during migration)
        const iconChanges = mapRenderer.getIconChanges();
        iconChanges.forEach(iconChange => {
            const timelineEvent = {
                id: iconChange.id,
                type: 'iconChange',
                progress: iconChange.progress,
                timestamp: iconChange.timestamp || new Date(),
                icon: iconChange.icon
            };
            this.timelineEvents.push(timelineEvent);
        });

        // Sort and render once after all events are added
        this.sortTimelineEvents();
        this.renderTimelineEvents();

        console.log(`Migrated ${annotations.length} annotations and ${iconChanges.length} icon changes to unified timeline`);
    }

    // Get all timeline events
    getTimelineEvents() {
        return this.timelineEvents;
    }

    // Get events of a specific type
    getEventsByType(type) {
        return this.timelineEvents.filter(event => event.type === type);
    }

    // Find event by ID
    findEventById(id) {
        return this.timelineEvents.find(event => event.id === id);
    }

    // Helper method to format duration in seconds to MM:SS
    formatDuration(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
} 