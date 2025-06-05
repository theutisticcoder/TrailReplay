import { GPXParser } from '../gpxParser.js';

export class FileController {
    constructor(app) {
        this.app = app;
        this.gpxParser = new GPXParser();
    }

    async handleFiles(files) {
        if (!files || files.length === 0) return;
        
        // Filter GPX files
        const gpxFiles = Array.from(files).filter(file => 
            file.name.toLowerCase().endsWith('.gpx')
        );
        
        if (gpxFiles.length === 0) {
            console.error('Please select GPX files');
            this.app.showMessage?.('Please select valid GPX files', 'error');
            return;
        }

        try {
            // Show loading state
            this.app.showLoading(true);
            
            if (gpxFiles.length === 1) {
                // Single file - load directly
                const file = gpxFiles[0];
                const trackData = await this.gpxParser.parseFile(file);
                
                if (trackData) {
                    this.app.currentTrackData = trackData;
                    
                    // Load track data to map
                    this.app.map.loadTrackData(trackData);
                    
                    // Show visualization section
                    this.app.showVisualizationSection();
                    
                    // Update stats
                    this.app.updateStats(trackData.stats);
                    
                    // Generate elevation profile after loading track data
                    this.app.generateElevationProfile();
                    
                    console.log('GPX file loaded successfully');
                    
                    // Add to journey builder if we have journey functionality
                    if (this.app.journey) {
                        console.log('Adding track to journey builder...');
                        this.app.journey.addTrack(trackData, file.name);
                    }
                }
            } else {
                // Multiple files - process all and add to journey builder
                console.log(`Processing ${gpxFiles.length} GPX files for journey...`);
                
                let processedCount = 0;
                for (const file of gpxFiles) {
                    try {
                        const trackData = await this.gpxParser.parseFile(file);
                        if (trackData && this.app.journey) {
                            this.app.journey.addTrack(trackData, file.name);
                            processedCount++;
                        }
                    } catch (error) {
                        console.error(`Error processing file ${file.name}:`, error);
                        this.app.showMessage?.(`Error loading ${file.name}: ${error.message}`, 'error');
                    }
                }
                
                if (processedCount > 0) {
                    console.log(`${processedCount} files added to journey builder`);
                    
                    // Show journey planning guidance
                    this.showJourneyPlanningGuidance();
                } else {
                    this.app.showMessage?.('No valid GPX files could be processed', 'error');
                }
            }
        } catch (error) {
            console.error('Error loading GPX files:', error);
            this.app.showMessage?.('Error processing GPX files: ' + error.message, 'error');
        } finally {
            this.app.showLoading(false);
        }
    }
    
    // Show guidance for journey planning
    showJourneyPlanningGuidance() {
        // Multiple files - guide user to journey builder
        this.app.showMessage?.('Multiple GPX files loaded! Use the Journey Planning section below to arrange tracks and add transportation between them.', 'info');
        
        // Auto-scroll to journey builder
        setTimeout(() => {
            const journeySection = document.getElementById('journeyPlanningSection');
            if (journeySection) {
                journeySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 500);
    }

    async handleDrop(event) {
        event.preventDefault();
        const files = event.dataTransfer.files;
        await this.handleFiles(files);
    }



    // Journey building is now handled by JourneyController
    async buildJourney(segments) {
        console.warn('buildJourney called on FileController - this should be handled by JourneyController');
        return this.app.journey?.journeyBuilder?.buildJourney(segments);
    }
} 