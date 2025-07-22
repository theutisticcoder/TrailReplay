import { GPXParser } from '../gpxParser.js';
import { AnalyticsTracker } from '../utils/analytics.js';

export class FileController {
    constructor(app) {
        this.app = app;
        this.gpxParser = new GPXParser();
    }

    async handleFiles(files) {
        if (!files || files.length === 0) return;
        
        // Separate GPX files and image files
        const gpxFiles = Array.from(files).filter(file => 
            file.name.toLowerCase().endsWith('.gpx')
        );
        
        const imageFiles = Array.from(files).filter(file => 
            file.type.startsWith('image/')
        );
        
        // Handle GPX files first
        if (gpxFiles.length > 0) {
            await this.handleGPXFiles(gpxFiles);
        }
        
        // Handle image files for annotations
        if (imageFiles.length > 0) {
            await this.handleImageFiles(imageFiles);
        }
        
        // If no valid files
        if (gpxFiles.length === 0 && imageFiles.length === 0) {
            console.error('Please select GPX or image files');
            this.app.showMessage?.('Please select valid GPX or image files', 'error');
            return;
        }
    }

    async handleGPXFiles(gpxFiles) {
        // Track file upload
        AnalyticsTracker.trackFileUpload(gpxFiles.length, gpxFiles.length === 1 ? 'single' : 'multiple');

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
                    console.log('🏔️ Generating elevation profile for track data...');
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

    async handleImageFiles(imageFiles) {
        try {
            console.log(`Processing ${imageFiles.length} image files for annotations...`);
            
            // Store images for later use in annotations
            if (!this.app.uploadedImages) {
                this.app.uploadedImages = [];
            }
            
            for (const file of imageFiles) {
                // Create object URL for the image
                const imageUrl = URL.createObjectURL(file);
                const imageData = {
                    id: Date.now() + Math.random(),
                    file: file,
                    url: imageUrl,
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    uploaded: new Date()
                };
                
                this.app.uploadedImages.push(imageData);
                console.log('Image processed:', imageData.name);
            }
            
            // Show message about images being ready for annotations
            this.app.showMessage?.(`${imageFiles.length} images ready for annotation. Click "Add Annotation" to place them on your route.`, 'success');
            
            // Update the annotation modal to show available images
            if (this.app.notes && this.app.notes.updateImageLibrary) {
                this.app.notes.updateImageLibrary(this.app.uploadedImages);
            }
            
        } catch (error) {
            console.error('Error processing image files:', error);
            this.app.showMessage?.('Error processing image files: ' + error.message, 'error');
        }
    }
    
    // Show guidance for journey planning
    showJourneyPlanningGuidance() {
        // Multiple files - guide user to journey builder
        this.app.showMessage?.('Multiple GPX files loaded! Use the Journey Planning section below to arrange tracks and add transportation between them.', 'info');
        
        // Auto-scroll to journey builder
        const journeySection = document.getElementById('journeyPlanningSection');
        if (journeySection) {
            journeySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
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