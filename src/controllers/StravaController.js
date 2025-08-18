import { AnalyticsTracker } from '../utils/analytics.js';
import { t } from '../translations.js';

export class StravaController {
    constructor(app) {
        this.app = app;
        this.accessToken = null;
        this.refreshToken = null;
        this.activities = [];
        this.isAuthenticated = false;
        this.currentPage = 1;
        this.hasMoreActivities = true;
        this.isLoading = false;
        this.processedCode = null;
        
        // Strava OAuth configuration from environment variables
        this.stravaConfig = {
            clientId: import.meta.env.VITE_STRAVA_CLIENT_ID,
            redirectUri: this.getRedirectUri(),
            scope: 'read,activity:read',
            apiBaseUrl: 'https://www.strava.com/api/v3',
            authUrl: 'https://www.strava.com/oauth/authorize',
            tokenUrl: 'https://www.strava.com/oauth/token'
        };
        
        // Validate configuration
        if (!this.stravaConfig.clientId) {
            console.warn('🚨 Strava integration not configured. Please set up your .env file with VITE_STRAVA_CLIENT_ID and VITE_STRAVA_CLIENT_SECRET');
        }
        
        // Check for existing token in localStorage
        this.loadStoredToken();
        
        this.initialize();
    }

    /**
     * Initialize Strava integration
     */
    initialize() {
        console.log('🔧 Initializing Strava integration...');
        
        this.createStravaUI();
        this.setupEventListeners();
        this.handleOAuthCallback();
        // Listen for OAuth code from popup
        window.addEventListener('message', (event) => {
            if (event.data && event.data.stravaCode) {
                if (!this.isAuthenticated && event.data.stravaCode) {
                    this.exchangeCodeForToken(event.data.stravaCode);
                }
            }
            if (event.data && event.data.stravaError) {
                this.showError('Strava authentication failed: ' + event.data.stravaError);
            }
        });
        
        // Check if user is already authenticated
        if (this.isAuthenticated) {
            console.log('✅ User already authenticated, updating UI');
            this.updateUIAfterAuth();
        }
        
        console.log('✅ Strava integration initialized');
    }

    /**
     * Create Strava UI elements
     */
    createStravaUI() {
        const uploadSection = document.getElementById('uploadSection');
        if (!uploadSection) return;

        // Add Strava option to upload section
        const uploadCard = uploadSection.querySelector('.upload-card');
        if (!uploadCard) return;

        // Check if Strava section already exists
        const existingStravaSection = uploadCard.querySelector('.strava-integration');
        if (existingStravaSection) {
            console.log('🔄 Strava UI already exists, updating state only');
            return;
        }

        // Create Strava integration UI
        const stravaSection = document.createElement('div');
        stravaSection.className = 'strava-integration';
        stravaSection.innerHTML = `
            <div class="upload-divider">
                <span data-i18n="strava.or">or</span>
            </div>
            <div class="strava-auth-section" id="stravaAuthSection">
                <div class="strava-icon">🚴</div>
                <h3 data-i18n="strava.title">Import from Strava</h3>
                <p data-i18n="strava.description">Connect your Strava account to import your activities</p>
                <button class="strava-auth-btn official-strava-btn" id="stravaAuthBtn">
                    <img src="media/stravaResources/1.1 Connect with Strava Buttons/Connect with Strava Orange/btn_strava_connect_with_orange.svg" alt="Connect with Strava" class="strava-connect-logo">
                </button>
                <p style="margin-top:0.75rem; font-size:0.85rem; color:#666;">
                    By connecting, you agree to our <a href="/terms" style="color:#FC5200;">Terms</a> and <a href="/privacy" style="color:#FC5200;">Privacy Policy</a>.
                </p>
            </div>
            <div class="strava-authenticated-section" id="stravaAuthenticatedSection" style="display: none;">
                <div class="strava-branding">
                    <img src="media/stravaResources/1.2-Strava-API-Logos/Powered by Strava/pwrdBy_strava_orange/api_logo_pwrdBy_strava_horiz_orange.svg" alt="Powered by Strava" class="powered-by-strava-logo">
                </div>
                <div class="strava-user-info" id="stravaUserInfo">
                    <div class="strava-user-avatar">
                        <img id="stravaUserAvatar" src="" alt="Profile">
                    </div>
                    <div class="strava-user-details">
                        <h4 id="stravaUserName"></h4>
                        <p id="stravaUserStats"></p>
                    </div>
                    <button class="btn-secondary" id="stravaLogoutBtn">
                        <span data-i18n="strava.logout">Logout</span>
                    </button>
                </div>
                <div class="strava-activities-section">
                    <div class="strava-activities-header">
                        <h4>📊 Activities</h4>
                        <button class="btn-primary" id="stravaLoadActivitiesBtn">
                            <span data-i18n="strava.loadActivities">Load Activities</span>
                        </button>
                    </div>
                    <div class="strava-activities-info">
                        <p style="color: #666; font-size: 0.9em; margin-bottom: 1rem;">
                            <span data-i18n="strava.activitiesInfo">Activities from the past 2 years with GPS data</span>
                        </p>
                    </div>
                    <div class="strava-activities-list" id="stravaActivitiesList">
                        <div class="strava-loading">Click "Load Activities" to see your activities</div>
                    </div>
                    <div class="strava-load-more-container" style="text-align: center; margin-top: 1rem;">
                        <button class="btn-secondary" id="stravaLoadMoreBtn" style="display: none;">
                            <span data-i18n="strava.loadMore">Load More Activities</span>
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Add CSS styles only if they don't already exist
        if (!document.getElementById('strava-styles')) {
            const styles = document.createElement('style');
            styles.id = 'strava-styles';
            styles.textContent = `
                .strava-integration {
                    margin-top: 2rem;
                    padding-top: 2rem;
                }
                
                .upload-divider {
                    display: flex;
                    align-items: center;
                    margin: 2rem 0;
                    text-align: center;
                }
                
                .upload-divider::before,
                .upload-divider::after {
                    content: '';
                    flex: 1;
                    height: 1px;
                    background: #e0e0e0;
                }
                
                .upload-divider span {
                    padding: 0 1rem;
                    color: #666;
                    font-weight: 500;
                }
                
                .strava-auth-section {
                    text-align: center;
                    padding: 2rem;
                    background: #f8f9fa;
                    border-radius: 12px;
                    border: 2px solid #e9ecef;
                }
                
                .strava-icon {
                    font-size: 3rem;
                    margin-bottom: 1rem;
                }
                
                .strava-auth-btn {
                    background: transparent;
                    border: none;
                    padding: 0;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                
                .strava-auth-btn:hover {
                    transform: translateY(-1px);
                }
                
                .strava-connect-logo {
                    height: 48px;
                    width: auto;
                }
                
                .strava-branding {
                    text-align: center;
                    margin-bottom: 1rem;
                }
                
                .powered-by-strava-logo {
                    height: 20px;
                    width: auto;
                }
                
                .strava-authenticated-section {
                    background: #f8f9fa;
                    border-radius: 12px;
                    border: 2px solid #e9ecef;
                    padding: 1.5rem;
                }
                
                .strava-user-info {
                    display: flex;
                    align-items: center;
                    padding: 1rem;
                    background: white;
                    border-radius: 8px;
                    margin-bottom: 1.5rem;
                }
                
                .strava-user-avatar {
                    width: 60px;
                    height: 60px;
                    border-radius: 50%;
                    overflow: hidden;
                    margin-right: 1rem;
                    border: 3px solid #FC4C02;
                }
                
                .strava-user-avatar img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }
                
                .strava-user-details {
                    flex: 1;
                }
                
                .strava-user-details h4 {
                    margin: 0 0 0.25rem 0;
                    color: #333;
                }
                
                .strava-user-details p {
                    margin: 0;
                    color: #666;
                    font-size: 0.9rem;
                }
                
                .strava-activities-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                }
                
                .strava-activities-list {
                    max-height: 400px;
                    overflow-y: auto;
                    border: 1px solid #e0e0e0;
                    border-radius: 8px;
                    background: white;
                }
                
                .strava-activity-item {
                    display: flex;
                    align-items: center;
                    padding: 1rem;
                    border-bottom: 1px solid #f0f0f0;
                    transition: background 0.2s ease;
                    cursor: pointer;
                }
                
                .strava-activity-item:last-child {
                    border-bottom: none;
                }
                
                .strava-activity-item:hover {
                    background: #f8f9fa;
                }
                
                .strava-activity-item.selected {
                    background: rgba(252, 76, 2, 0.1);
                    border-left: 4px solid #FC4C02;
                }
                
                .strava-activity-icon {
                    font-size: 1.5rem;
                    margin-right: 1rem;
                }
                
                .strava-activity-details {
                    flex: 1;
                }
                
                .strava-activity-name {
                    font-weight: 600;
                    margin-bottom: 0.25rem;
                }
                
                .strava-activity-stats {
                    display: flex;
                    gap: 1rem;
                    font-size: 0.9rem;
                    color: #666;
                }
                
                .strava-activity-stats span {
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                }
                
                .strava-activity-links {
                    margin-top: 0.5rem;
                }
                
                .view-on-strava-link {
                    color: #FC5200;
                    text-decoration: none;
                    font-weight: 600;
                    font-size: 0.9rem;
                    border: 1px solid #FC5200;
                    padding: 0.25rem 0.5rem;
                    border-radius: 4px;
                    display: inline-block;
                    transition: all 0.2s ease;
                }
                
                .view-on-strava-link:hover {
                    background: #FC5200;
                    color: white;
                    text-decoration: underline;
                }
                
                .strava-activity-actions {
                    display: flex;
                    gap: 0.5rem;
                }
                
                .strava-activity-import-btn {
                    background: #28a745;
                    color: white;
                    border: none;
                    padding: 0.5rem 1rem;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 0.9rem;
                    transition: background 0.2s ease;
                }
                
                .strava-activity-import-btn:hover {
                    background: #218838;
                }
                
                .strava-activity-import-btn:disabled {
                    background: #6c757d;
                    cursor: not-allowed;
                }
                
                .strava-loading {
                    text-align: center;
                    padding: 2rem;
                    color: #666;
                }
                
                .strava-error {
                    background: #ffebee;
                    color: #c62828;
                    padding: 1rem;
                    border-radius: 6px;
                    margin: 1rem 0;
                }
            `;

            document.head.appendChild(styles);
        }
        
        uploadCard.appendChild(stravaSection);
    }

    /**
     * Setup event listeners for Strava integration
     */
    setupEventListeners() {
        console.log('🎬 Setting up Strava event listeners...');
        
        // Only add once
        if (this.eventListenersAdded) return;
        
        const authBtn = document.getElementById('stravaAuthBtn');
        const logoutBtn = document.getElementById('stravaLogoutBtn');
        const loadActivitiesBtn = document.getElementById('stravaLoadActivitiesBtn');
        const loadMoreBtn = document.getElementById('stravaLoadMoreBtn');
        
        if (authBtn) {
            authBtn.addEventListener('click', () => this.initiateOAuth());
        }
        
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }
        
        if (loadActivitiesBtn) {
            loadActivitiesBtn.addEventListener('click', () => this.loadActivities());
        }
        
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => this.loadMoreActivities());
        }
        
        this.eventListenersAdded = true;
        console.log('✅ Strava event listeners setup complete');
    }

    /**
     * Load stored authentication token
     */
    loadStoredToken() {
        const stored = localStorage.getItem('strava_auth');
        if (stored) {
            try {
                const authData = JSON.parse(stored);
                const now = Date.now() / 1000;
                
                if (authData.expiresAt > now) {
                    this.accessToken = authData.accessToken;
                    this.user = authData.user;
                    this.isAuthenticated = true;
                    console.log('✅ Strava: Loaded stored authentication');
                } else {
                    // Token expired, try to refresh
                    this.refreshToken(authData.refreshToken);
                }
            } catch (error) {
                console.warn('Failed to load stored Strava auth:', error);
                localStorage.removeItem('strava_auth');
            }
        }
    }

    /**
     * Initiate OAuth flow
     */
    initiateOAuth() {
        const authUrl = `https://www.strava.com/oauth/authorize?` +
            `client_id=${this.stravaConfig.clientId}&` +
            `redirect_uri=${encodeURIComponent(this.stravaConfig.redirectUri)}&` +
            `response_type=code&` +
            `scope=${this.stravaConfig.scope}&` +
            `approval_prompt=auto`;

        // Track authentication attempt
        AnalyticsTracker.trackStravaEvent('auth_initiated');

        // Open OAuth popup
        const popup = window.open(authUrl, 'strava_auth', 'width=600,height=600');
        
        // Listen for popup completion
        const checkClosed = setInterval(() => {
            if (popup.closed) {
                clearInterval(checkClosed);
                // Check if authentication was successful
                setTimeout(() => {
                    if (this.isAuthenticated) {
                        this.updateUIAfterAuth();
                    }
                }, 1000);
            }
        }, 1000);
    }

    /**
     * Handle OAuth callback
     */
    handleOAuthCallback() {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const error = urlParams.get('error');

        if (error) {
            console.error('Strava OAuth error:', error);
            this.showError('Authentication failed. Please try again.');
            return;
        }

        if (code) {
            // Prevent duplicate token exchange attempts
            if (this.isAuthenticated) {
                console.log('🔄 Already authenticated, skipping token exchange');
                return;
            }
            
            // Check if this code has already been processed
            if (this.processedCode === code) {
                console.log('🔄 Code already processed, skipping token exchange');
                return;
            }
            
            this.processedCode = code;
            this.exchangeCodeForToken(code);
        }
    }

    /**
     * Exchange authorization code for access token
     */
    async exchangeCodeForToken(code) {
        try {
            const response = await fetch('/api/strava/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, redirectUri: this.stravaConfig.redirectUri })
            });

            if (!response.ok) {
                throw new Error('Failed to exchange code for token');
            }

            const data = await response.json();
            
            this.accessToken = data.access_token;
            this.user = data.athlete;
            this.isAuthenticated = true;

            // Store authentication data
            const authData = {
                accessToken: data.access_token,
                refreshToken: data.refresh_token,
                expiresAt: data.expires_at,
                user: data.athlete
            };
            localStorage.setItem('strava_auth', JSON.stringify(authData));

            console.log('✅ Strava: Authentication successful');
            AnalyticsTracker.trackStravaEvent('auth_success');
            
            // Update UI
            this.updateUIAfterAuth();
            
            // Clear URL parameters
            window.history.replaceState({}, document.title, window.location.pathname);
            
        } catch (error) {
            console.error('Strava token exchange failed:', error);
            this.showError('Authentication failed. Please try again.');
        }
    }

    /**
     * Refresh access token
     */
    async refreshToken(refreshToken) {
        try {
            const response = await fetch('/api/strava/refresh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh_token: refreshToken })
            });

            if (!response.ok) {
                throw new Error('Failed to refresh token');
            }

            const data = await response.json();
            
            this.accessToken = data.access_token;
            this.isAuthenticated = true;

            // Update stored auth data
            const authData = {
                accessToken: data.access_token,
                refreshToken: data.refresh_token,
                expiresAt: data.expires_at,
                user: this.user
            };
            localStorage.setItem('strava_auth', JSON.stringify(authData));

            console.log('✅ Strava: Token refreshed');
            
        } catch (error) {
            console.error('Strava token refresh failed:', error);
            this.logout();
        }
    }

    /**
     * Update UI after successful authentication
     */
    updateUIAfterAuth() {
        // Hide all auth sections and show all authenticated sections
        const authSections = document.querySelectorAll('#stravaAuthSection');
        const authenticatedSections = document.querySelectorAll('#stravaAuthenticatedSection');
        
        authSections.forEach(section => {
            if (section) section.style.display = 'none';
        });
        
        authenticatedSections.forEach(section => {
            if (section) section.style.display = 'block';
        });

        // Update user info in all instances
        if (this.user) {
            const avatars = document.querySelectorAll('#stravaUserAvatar');
            const names = document.querySelectorAll('#stravaUserName');
            const stats = document.querySelectorAll('#stravaUserStats');

            avatars.forEach(avatar => {
                if (avatar) avatar.src = this.user.profile || this.user.profile_medium || '/default-avatar.png';
            });
            
            names.forEach(name => {
                if (name) name.textContent = `${this.user.firstname} ${this.user.lastname}`;
            });
            
            stats.forEach(stat => {
                if (stat) stat.textContent = `${this.user.city || ''} ${this.user.state || ''}`.trim();
            });
        }
    }

    /**
     * Load Strava activities with pagination support
     */
    async loadActivities(reset = true) {
        if (!this.isAuthenticated) {
            this.showError('Please authenticate with Strava first.');
            return;
        }

        if (this.isLoading) return;
        this.isLoading = true;

        const loadBtn = document.getElementById('stravaLoadActivitiesBtn');
        const loadMoreBtn = document.getElementById('stravaLoadMoreBtn');
        const activitiesList = document.getElementById('stravaActivitiesList');

        try {
            // Reset pagination if this is a fresh load
            if (reset) {
                this.currentPage = 1;
                this.hasMoreActivities = true;
                this.activities = [];
            }

            // Show loading state
            if (loadBtn) loadBtn.disabled = true;
            if (loadMoreBtn) loadMoreBtn.disabled = true;
            
            if (reset && activitiesList) {
                activitiesList.innerHTML = '<div class="strava-loading">Loading activities...</div>';
            }

            // Calculate date range (2 years ago to now)
            const now = Math.floor(Date.now() / 1000);
            const twoYearsAgo = now - (2 * 365 * 24 * 60 * 60);

            // Fetch activities from Strava API with pagination
            const perPage = 30;
            const url = `${this.stravaConfig.apiBaseUrl}/athlete/activities?per_page=${perPage}&page=${this.currentPage}&after=${twoYearsAgo}`;
            
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load activities');
            }

            const newActivities = await response.json();
            
            // Filter to only include activities with GPS data
            const gpsActivities = newActivities.filter(activity => 
                activity.map && activity.map.summary_polyline // Only activities with GPS data
            );

            // Add to existing activities
            if (reset) {
                // On first load, show latest activities first
                this.activities = [...gpsActivities];
            } else {
                // On load more, append older activities at the end
                this.activities = [...this.activities, ...gpsActivities];
            }
            // Always keep latest activity at the top
            this.activities.sort((a, b) => new Date(b.start_date) - new Date(a.start_date));

            // Check if there are more activities to load
            this.hasMoreActivities = newActivities.length === perPage;

            this.renderActivities();
            
            // Show/hide load more button
            if (loadMoreBtn) {
                loadMoreBtn.style.display = this.hasMoreActivities ? 'block' : 'none';
            }
            
            AnalyticsTracker.trackStravaEvent('activities_loaded', { 
                count: gpsActivities.length, 
                total: this.activities.length,
                page: this.currentPage
            });

        } catch (error) {
            console.error('Error loading Strava activities:', error);
            this.showError('Failed to load activities. Please try again.');
        } finally {
            this.isLoading = false;
            if (loadBtn) loadBtn.disabled = false;
            if (loadMoreBtn) loadMoreBtn.disabled = false;
        }
    }

    /**
     * Load more activities (next page)
     */
    async loadMoreActivities() {
        if (!this.hasMoreActivities || this.isLoading) return;
        
        this.currentPage++;
        await this.loadActivities(false); // Don't reset, just append
    }

    /**
     * Render activities list
     */
    renderActivities() {
        const activitiesList = document.getElementById('stravaActivitiesList');
        if (!activitiesList) return;

        if (this.activities.length === 0) {
            activitiesList.innerHTML = '<div class="strava-loading">No activities with GPS data found in the past 2 years.</div>';
            return;
        }

        const activitiesHtml = this.activities.map(activity => {
            const activityType = this.getActivityIcon(activity.type);
            const distance = (activity.distance / 1000).toFixed(1);
            const movingTime = this.formatDuration(activity.moving_time);
            const elevationGain = activity.total_elevation_gain || 0;
            const date = new Date(activity.start_date).toLocaleDateString();

            return `
                <div class="strava-activity-item" data-activity-id="${activity.id}">
                    <div class="strava-activity-icon">${activityType}</div>
                    <div class="strava-activity-details">
                        <div class="strava-activity-name">${activity.name}</div>
                        <div class="strava-activity-stats">
                            <span>📅 ${date}</span>
                            <span>📏 ${distance} km</span>
                            <span>⏱️ ${movingTime}</span>
                            <span>⬆️ ${elevationGain.toFixed(0)} m</span>
                        </div>
                        <div class="strava-activity-links">
                            <a href="https://www.strava.com/activities/${activity.id}" target="_blank" rel="noopener noreferrer" class="view-on-strava-link">
                                <span data-i18n="strava.viewOnStrava">View on Strava</span>
                            </a>
                        </div>
                    </div>
                    <div class="strava-activity-actions">
                        <button class="strava-activity-import-btn" onclick="window.stravaController.importActivity(${activity.id})">
                            Import
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        activitiesList.innerHTML = activitiesHtml;

        // Add click handlers for activity selection
        this.setupActivityClickHandlers();
    }

    /**
     * Import a specific activity
     */
    async importActivity(activityId) {
        const activity = this.activities.find(a => a.id === activityId);
        if (!activity) {
            this.showError('Activity not found.');
            return;
        }

        const importBtn = document.querySelector(`[data-activity-id="${activityId}"] .strava-activity-import-btn`);
        if (importBtn) {
            importBtn.disabled = true;
            importBtn.textContent = 'Importing...';
        }

        try {
            // Get detailed activity data with streams
            const detailedActivity = await this.getActivityDetail(activityId);
            
            // Convert to GPX format
            const gpxData = this.convertToGPX(detailedActivity);
            
            // Create a virtual file and load it through the existing file system
            const gpxFile = new File([gpxData], `${activity.name}.gpx`, { type: 'application/gpx+xml' });
            
            // Use existing file handling system
            await this.app.file.handleFiles([gpxFile]);

            // Set activity type and icon on the loaded track
            if (this.app.currentTrackData) {
                this.app.currentTrackData.activityType = activity.type; // e.g., "Run", "Ride"
                this.app.currentTrackData.activityIcon = this.getActivityIcon(activity.type);
                // Immediately update the map marker icon
                if (this.app.mapRenderer && this.app.currentTrackData.activityIcon) {
                    this.app.mapRenderer.setCurrentIcon(this.app.currentTrackData.activityIcon);
                    if (this.app.mapRenderer.forceIconUpdate) {
                        this.app.mapRenderer.forceIconUpdate();
                    }
                }
            }
            
            // Ensure elevation profile is generated for Strava tracks
            if (this.app.generateElevationProfile) {
                console.log('🏔️ Generating elevation profile for Strava track...');
                this.app.generateElevationProfile();
            }

            // Trigger map container resize for video export
            if (this.app.videoExporter && this.app.videoExporter.ensureInitialAspectRatio) {
                console.log('🔄 Forcing aspect ratio/resize after Strava import');
                this.app.videoExporter.ensureInitialAspectRatio();
            }
            
            this.app.showMessage(`Successfully imported "${activity.name}" from Strava!`, 'success');
            AnalyticsTracker.trackStravaEvent('activity_imported', { activityId, activityType: activity.type });

        } catch (error) {
            console.error('Error importing Strava activity:', error);
            this.showError(`Failed to import activity: ${error.message}`);
        } finally {
            if (importBtn) {
                importBtn.disabled = false;
                importBtn.textContent = 'Import';
            }
        }
    }

    /**
     * Get detailed activity data including GPS streams
     */
    async getActivityDetail(activityId) {
        const [activityResponse, streamsResponse] = await Promise.all([
            fetch(`${this.stravaConfig.apiBaseUrl}/activities/${activityId}`, {
                headers: { 'Authorization': `Bearer ${this.accessToken}` }
            }),
            fetch(`${this.stravaConfig.apiBaseUrl}/activities/${activityId}/streams?keys=latlng,altitude,time,distance&key_by_type=true`, {
                headers: { 'Authorization': `Bearer ${this.accessToken}` }
            })
        ]);

        if (!activityResponse.ok || !streamsResponse.ok) {
            throw new Error('Failed to fetch activity details');
        }

        const activity = await activityResponse.json();
        const streams = await streamsResponse.json();

        return { ...activity, streams };
    }

    /**
     * Convert Strava activity to GPX format
     */
    convertToGPX(activity) {
        const { streams } = activity;
        const latlngData = streams.latlng?.data || [];
        // Prefer 'altitude', fallback to 'elevation' for legacy
        const elevationData = streams.altitude?.data || streams.elevation?.data || [];
        const timeData = streams.time?.data || [];
        
        if (latlngData.length === 0) {
            throw new Error('No GPS data available for this activity');
        }

        // Debug elevation data
        console.log('🏔️ Strava elevation data:', {
            hasElevation: elevationData.length > 0,
            elevationCount: elevationData.length,
            gpsPointCount: latlngData.length,
            sampleElevations: elevationData.slice(0, 5)
        });

        const startTime = new Date(activity.start_date);
        
        let gpxContent = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="TrailReplay" xmlns="http://www.topografix.com/GPX/1/1">
    <metadata>
        <name>${activity.name}</name>
        <desc>Imported from Strava</desc>
        <time>${startTime.toISOString()}</time>
    </metadata>
    <trk>
        <name>${activity.name}</name>
        <type>${activity.type}</type>
        <trkseg>`;

        latlngData.forEach((latlng, index) => {
            const [lat, lng] = latlng;
            const elevation = elevationData[index] !== undefined ? elevationData[index] : 0;
            const timeOffset = timeData[index] || index;
            const pointTime = new Date(startTime.getTime() + timeOffset * 1000);

            gpxContent += `
            <trkpt lat="${lat}" lon="${lng}">
                <ele>${elevation}</ele>
                <time>${pointTime.toISOString()}</time>
            </trkpt>`;
        });

        gpxContent += `
        </trkseg>
    </trk>
</gpx>`;

        return gpxContent;
    }

    /**
     * Map Strava activity type to icon (used in list and for loaded track)
     */
    getActivityIcon(type) {
        const icons = {
            Run: '🏃‍♂️',
            Ride: '🚴‍♂️',
            Hike: '🥾',
            Walk: '🚶‍♂️',
            Swim: '🏊‍♂️',
            AlpineSki: '⛷️',
            BackcountrySki: '🎿',
            Canoe: '🛶',
            Crossfit: '🏋️',
            EBikeRide: '🚴‍♂️⚡',
            Elliptical: '🚴‍♂️',
            IceSkate: '⛸️',
            InlineSkate: '🛼',
            Kayak: '🛶',
            NordicSki: '🎿',
            RockClimbing: '🧗',
            RollerSki: '🎿',
            Rowing: '🚣',
            Snowboard: '🏂',
            Snowshoe: '🥾',
            StairStepper: '🦵',
            StandUpPaddling: '🏄',
            Surfing: '🏄‍♂️',
            VirtualRide: '🚴‍♂️💻',
            WeightTraining: '🏋️',
            Wheelchair: '♿',
            Windsurf: '🏄‍♂️',
            Yoga: '🧘',
            // Add more as needed
        };
        return icons[type] || '❓';
    }

    /**
     * Format duration in seconds to human readable format
     */
    formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    }

    /**
     * Show error message
     */
    showError(message) {
        const activitiesList = document.getElementById('stravaActivitiesList');
        if (activitiesList) {
            activitiesList.innerHTML = `<div class="strava-error">${message}</div>`;
        }
        this.app.showMessage(message, 'error');
    }

    /**
     * Logout from Strava
     */
    logout() {
        this.accessToken = null;
        this.user = null;
        this.isAuthenticated = false;
        this.activities = [];
        this.currentPage = 1;
        this.hasMoreActivities = true;
        this.processedCode = null; // Clear processed code on logout
        
        localStorage.removeItem('strava_auth');
        
        // Reset UI - handle all instances
        const authSections = document.querySelectorAll('#stravaAuthSection');
        const authenticatedSections = document.querySelectorAll('#stravaAuthenticatedSection');
        
        authSections.forEach(section => {
            if (section) section.style.display = 'block';
        });
        
        authenticatedSections.forEach(section => {
            if (section) section.style.display = 'none';
        });
        
        try {
            // Best-effort deauthorization call
            if (this.accessToken) {
                fetch('/api/strava/deauthorize', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ access_token: this.accessToken })
                }).catch(() => {});
            }
        } catch (_) {}
        console.log('✅ Strava: Logged out');
        AnalyticsTracker.trackStravaEvent('logout');
    }

    /**
     * Setup click handlers for activity selection
     */
    setupActivityClickHandlers() {
        const activityItems = document.querySelectorAll('.strava-activity-item');
        activityItems.forEach(item => {
            item.addEventListener('click', (e) => {
                // Don't select if clicking on the import button
                if (e.target.classList.contains('strava-activity-import-btn')) return;
                
                // Remove previous selection
                document.querySelectorAll('.strava-activity-item.selected').forEach(selected => {
                    selected.classList.remove('selected');
                });
                
                // Add selection to clicked item
                item.classList.add('selected');
            });
        });
    }

    /**
     * Get the appropriate redirect URI based on environment
     */
    getRedirectUri() {
        const hostname = window.location.hostname;
        // Always use the static HTML callback for both prod and dev
        return `${window.location.origin}/strava-callback.html`;
    }
}

// Make controller globally accessible for inline event handlers
window.stravaController = null; 