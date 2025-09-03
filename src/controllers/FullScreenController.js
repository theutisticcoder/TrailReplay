/**
 * FullScreenController - Manages full-screen mode for the trail animation
 * Provides immersive viewing experience with collapsible control menus
 */
export class FullScreenController {
    constructor(app) {
        this.app = app;
        this.isFullScreen = false;
        this.menusVisible = true;
        this.menuPanels = {};
        this.fullScreenButton = null;
        this.activePopup = null;

        // Bind methods
        this.toggleFullScreen = this.toggleFullScreen.bind(this);
        this.toggleMenus = this.toggleMenus.bind(this);
        this.handleKeyPress = this.handleKeyPress.bind(this);
    }

    /**
     * Initialize the full-screen controller
     */
    async init() {
        console.log('Initializing FullScreenController');

        // Don't create button yet - wait for visualization section to be shown
        this.setupEventListeners();
        this.createMenuPanels();
        console.log('FullScreenController initialized - waiting for visualization section');

        // Listen for when the visualization section becomes visible
        this.waitForVisualizationSection();

        // Also try to find the button immediately in case it's already there
        setTimeout(() => {
            console.log('Checking for fullscreen button after timeout');
            this.createFullScreenButton();
        }, 1000);

        // Debug: Check initial map state
        setTimeout(() => {
            console.log('=== INITIAL MAP STATE CHECK ===');
            const mapContainer = document.querySelector('.map-container');
            const map = document.querySelector('#map');
            if (mapContainer) {
                console.log('Map container found:', mapContainer);
                console.log('Map container display:', window.getComputedStyle(mapContainer).display);
                console.log('Map container position:', window.getComputedStyle(mapContainer).position);
                console.log('Map container dimensions:', mapContainer.offsetWidth, 'x', mapContainer.offsetHeight);
                console.log('Map container classes:', mapContainer.className);
            } else {
                console.log('Map container NOT found!');
            }
            if (map) {
                console.log('Map element found:', map);
                console.log('Map display:', window.getComputedStyle(map).display);
                console.log('Map dimensions:', map.offsetWidth, 'x', map.offsetHeight);
            } else {
                console.log('Map element NOT found!');
            }
            console.log('Body classes:', document.body.className);
            
            // Force remove any stuck fullscreen classes
            if (document.body.classList.contains('fullscreen-mode') || document.body.classList.contains('pseudo-fullscreen')) {
                console.log('Found stuck fullscreen classes, removing them...');
                document.body.classList.remove('fullscreen-mode', 'pseudo-fullscreen');
                console.log('Body classes after cleanup:', document.body.className);
            }
            
            console.log('=== END INITIAL MAP STATE CHECK ===');
        }, 2000);
    }

    /**
     * Wait for the visualization section to become visible, then create the button
     */
    waitForVisualizationSection() {
        // Method 1: Polling approach
        const checkVisualizationSection = () => {
            const visualizationSection = document.getElementById('visualizationSection');
            const controlsPanel = document.querySelector('.controls-panel');

            if (visualizationSection && controlsPanel &&
                visualizationSection.style.display !== 'none' &&
                window.getComputedStyle(visualizationSection).display !== 'none') {

                console.log('Visualization section is now visible, creating fullscreen button');
                this.createFullScreenButton();
                return;
            }

            // Check again in 100ms
            setTimeout(checkVisualizationSection, 100);
        };

        // Method 2: MutationObserver to catch style changes
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    const target = mutation.target;
                    if (target.id === 'visualizationSection' &&
                        target.style.display !== 'none' &&
                        window.getComputedStyle(target).display !== 'none') {
                        console.log('Visualization section became visible via MutationObserver');
                        this.createFullScreenButton();
                        observer.disconnect();
                    }
                }
            });
        });

        const visualizationSection = document.getElementById('visualizationSection');
        if (visualizationSection) {
            observer.observe(visualizationSection, {
                attributes: true,
                attributeFilter: ['style']
            });
        }

        // Start polling as backup
        checkVisualizationSection();
    }

    /**
     * Initialize the fullscreen button (it's now in HTML, just need to wire it up)
     */
    createFullScreenButton() {
        // The button is now in the HTML, just find it and wire it up
        this.fullScreenButton = document.getElementById('fullscreenToggleBtn');

        if (this.fullScreenButton) {
            console.log('Fullscreen button found in HTML, wiring up event listeners');

            // Remove any existing listeners first
            this.fullScreenButton.removeEventListener('click', this.toggleFullScreen);

            // Add the event listener with debugging
            this.fullScreenButton.addEventListener('click', (event) => {
                console.log('Fullscreen button clicked!');
                console.log('Button element:', this.fullScreenButton);
                console.log('Event:', event);

                // Visual feedback
                this.fullScreenButton.style.background = '#a85a2a';
                this.fullScreenButton.textContent = 'Processing...';
                this.fullScreenButton.disabled = true;

                event.preventDefault();
                this.toggleFullScreen().then(() => {
                    // Reset button after fullscreen operation
                    setTimeout(() => {
                        this.fullScreenButton.style.background = '';
                        this.fullScreenButton.innerHTML = `
                            <span class="fullscreen-icon">⛶</span>
                            <span class="fullscreen-text">${this.isFullScreen ? 'Exit Full Screen' : 'Enter Full Screen'}</span>
                        `;
                        this.fullScreenButton.disabled = false;
                    }, 500);
                });
            });

            console.log('Event listener attached to fullscreen button');
        } else {
            console.warn('Fullscreen button not found in HTML');
        }
    }

    /**
     * Create floating menu buttons for full-screen mode
     */
    createMenuPanels() {
        const menuTypes = [
            {
                id: 'controlsMenu',
                icon: '⚙️',
                title: 'Controls',
                position: 'top-left',
                content: '.controls-panel'
            },
            {
                id: 'playbackMenu',
                icon: '▶️',
                title: 'Playback',
                position: 'top-right',
                content: '.progress-controls-container'
            },
            {
                id: 'statsMenu',
                icon: '📊',
                title: 'Stats',
                position: 'bottom-left',
                content: '.elevation-profile-container'
            }
        ];

        menuTypes.forEach(menuType => {
            const button = this.createFloatingMenuButton(menuType);
            document.body.appendChild(button);
            this.menuPanels[menuType.id] = button;
        });
    }

    /**
     * Create a floating menu button
     */
    createFloatingMenuButton(menuType) {
        const button = document.createElement('button');
        button.className = `fullscreen-floating-btn ${menuType.position}`;
        button.setAttribute('data-menu', menuType.id);
        button.innerHTML = `
            <span class="floating-btn-icon">${menuType.icon}</span>
            <span class="floating-btn-tooltip">${menuType.title}</span>
        `;

        // Add click handler
        button.addEventListener('click', () => this.toggleFloatingMenu(menuType));

        return button;
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Keyboard shortcuts
        document.addEventListener('keydown', this.handleKeyPress);

        // Full-screen change events
        document.addEventListener('fullscreenchange', this.handleFullScreenChange.bind(this));
        document.addEventListener('webkitfullscreenchange', this.handleFullScreenChange.bind(this));
        document.addEventListener('mozfullscreenchange', this.handleFullScreenChange.bind(this));
        document.addEventListener('MSFullscreenChange', this.handleFullScreenChange.bind(this));
    }

    /**
     * Handle keyboard shortcuts
     */
    handleKeyPress(event) {
        // F key for full-screen toggle
        if (event.key === 'f' || event.key === 'F') {
            // Only if not typing in an input field
            if (event.target.tagName !== 'INPUT' && event.target.tagName !== 'TEXTAREA') {
                event.preventDefault();
                this.toggleFullScreen();
            }
        }

        // Escape key handled separately for better UX
        if (event.key === 'Escape' && this.isFullScreen) {
            this.exitFullScreen();
        }

        // M key to toggle menus
        if (event.key === 'm' || event.key === 'M') {
            if (this.isFullScreen && event.target.tagName !== 'INPUT' && event.target.tagName !== 'TEXTAREA') {
                event.preventDefault();
                this.toggleMenus();
            }
        }

        // B key to manually show buttons (debug)
        if (event.key === 'b' || event.key === 'B') {
            if (this.isFullScreen && event.target.tagName !== 'INPUT' && event.target.tagName !== 'TEXTAREA') {
                event.preventDefault();
                console.log('Debug: Manually showing buttons with B key');
                this.debugShowButtons();
                this.debugCheckButtons();
            }
        }

        // P key to force pseudo-fullscreen (debug)
        if (event.key === 'p' || event.key === 'P') {
            if (!this.isFullScreen && event.target.tagName !== 'INPUT' && event.target.tagName !== 'TEXTAREA') {
                event.preventDefault();
                console.log('Debug: Forcing pseudo-fullscreen mode with P key');
                this.enterFullScreenFallback();
            }
        }

        // T key to create test popup (debug)
        if (event.key === 't' || event.key === 'T') {
            if (this.isFullScreen && event.target.tagName !== 'INPUT' && event.target.tagName !== 'TEXTAREA') {
                event.preventDefault();
                console.log('Debug: Creating test popup with T key');
                this.debugCreateTestPopup();
            }
        }

        // R key to force reset layout (debug)
        if (event.key === 'r' || event.key === 'R') {
            if (event.target.tagName !== 'INPUT' && event.target.tagName !== 'TEXTAREA') {
                event.preventDefault();
                console.log('Debug: Force resetting layout with R key');
                document.body.classList.remove('fullscreen-mode', 'pseudo-fullscreen');
                this.isFullScreen = false;
                this.applyNormalLayout();
                console.log('Layout reset complete');
            }
        }
    }

    /**
     * Toggle full-screen mode
     */
    toggleFullScreen() {
        console.log('toggleFullScreen called, current state:', this.isFullScreen);

        if (this.isFullScreen) {
            console.log('Exiting fullscreen mode');
            this.exitFullScreen();
        } else {
            console.log('Entering fullscreen mode');
            this.enterFullScreen();
        }
    }

    /**
     * Enter full-screen mode
     */
    enterFullScreen() {
        console.log('Attempting to enter fullscreen mode');

        try {
            // Request full-screen on the document element
            const element = document.documentElement;
            console.log('Requesting fullscreen on element:', element);

            if (element.requestFullscreen) {
                console.log('Using requestFullscreen');
                const promise = element.requestFullscreen();
                promise.then(() => {
                    console.log('Fullscreen request successful');
                    this.isFullScreen = true;
                    this.applyFullScreenLayout();
                    this.showWelcomeMessage();
                }).catch((error) => {
                    console.error('Failed to enter full-screen mode:', error);
                    console.error('Error details:', error.name, error.message);

                    // If permissions fail, try fallback mode
                    if (error.name === 'NotAllowedError' || error.message.includes('permission')) {
                        console.log('Permissions denied, trying fallback mode');
                        this.enterFullScreenFallback();
                    } else {
                        this.app.showMessage('Failed to enter full-screen mode: ' + error.message, 'error');
                    }
                });
            } else if (element.webkitRequestFullscreen) {
                console.log('Using webkitRequestFullscreen');
                element.webkitRequestFullscreen();
                this.isFullScreen = true;
                this.applyFullScreenLayout();
                this.showWelcomeMessage();
            } else if (element.mozRequestFullScreen) {
                console.log('Using mozRequestFullScreen');
                element.mozRequestFullScreen();
                this.isFullScreen = true;
                this.applyFullScreenLayout();
                this.showWelcomeMessage();
            } else if (element.msRequestFullscreen) {
                console.log('Using msRequestFullscreen');
                element.msRequestFullscreen();
                this.isFullScreen = true;
                this.applyFullScreenLayout();
                this.showWelcomeMessage();
            } else {
                // Fallback for browsers without full-screen API
                console.log('No fullscreen API found, using fallback');
                this.enterFullScreenFallback();
            }

        } catch (error) {
            console.error('Failed to enter full-screen mode:', error);
            console.error('Error details:', error.name, error.message);
            this.app.showMessage('Failed to enter full-screen mode: ' + error.message, 'error');
        }
    }

    /**
     * Exit full-screen mode
     */
    exitFullScreen() {
        try {
            // Check if we're in real fullscreen mode
            const isInFullscreen = !!(
                document.fullscreenElement ||
                document.webkitFullscreenElement ||
                document.mozFullScreenElement ||
                document.msFullscreenElement
            );

            if (isInFullscreen) {
                // Exit real fullscreen
                if (document.exitFullscreen) {
                    const promise = document.exitFullscreen();
                    promise.then(() => {
                        console.log('Exited real fullscreen');
                        this.isFullScreen = false;
                        this.applyNormalLayout();
                    }).catch((error) => {
                        console.error('Failed to exit real fullscreen:', error);
                        this.exitFullScreenFallback();
                    });
                } else if (document.webkitExitFullscreen) {
                    document.webkitExitFullscreen();
                    this.isFullScreen = false;
                    this.applyNormalLayout();
                } else if (document.mozCancelFullScreen) {
                    document.mozCancelFullScreen();
                    this.isFullScreen = false;
                    this.applyNormalLayout();
                } else if (document.msExitFullscreen) {
                    document.msExitFullscreen();
                    this.isFullScreen = false;
                    this.applyNormalLayout();
                } else {
                    this.exitFullScreenFallback();
                }
            } else {
                // Exit pseudo-fullscreen
                this.exitFullScreenFallback();
            }

        } catch (error) {
            console.error('Failed to exit full-screen mode:', error);
            this.app.showMessage('Failed to exit full-screen mode', 'error');
            // Try fallback anyway
            this.exitFullScreenFallback();
        }
    }

    /**
     * Fallback for browsers without full-screen API
     */
    enterFullScreenFallback() {
        console.log('Using fullscreen fallback mode');
        this.isFullScreen = true;
        this.applyFullScreenLayout();
        this.showWelcomeMessage();

        // Try to hide browser UI elements for pseudo-fullscreen
        try {
            // Hide scrollbars
            document.documentElement.style.overflow = 'hidden';
            document.body.style.overflow = 'hidden';

            // Add CSS class for pseudo-fullscreen
            document.body.classList.add('pseudo-fullscreen');

            this.app.showMessage('Full-screen mode activated (simulated)', 'info');
        } catch (error) {
            console.error('Fallback fullscreen setup failed:', error);
            this.app.showMessage('Full-screen mode may not work properly in this browser', 'warning');
        }
    }

    /**
     * Fallback for exiting full-screen
     */
    exitFullScreenFallback() {
        console.log('Exiting fullscreen fallback mode');
        this.isFullScreen = false;

        // Clean up pseudo-fullscreen styles
        try {
            document.documentElement.style.overflow = '';
            document.body.style.overflow = '';
            document.body.classList.remove('pseudo-fullscreen');
        } catch (error) {
            console.error('Failed to clean up fallback fullscreen:', error);
        }

        this.applyNormalLayout();
        this.app.showMessage('Exited full-screen mode', 'info');
    }

    /**
     * Apply full-screen layout
     */
    applyFullScreenLayout() {
        console.log('Applying fullscreen layout');
        console.log('Current body classes before:', document.body.className);
        document.body.classList.add('fullscreen-mode');
        console.log('Current body classes after:', document.body.className);

        // Update button text
        if (this.fullScreenButton) {
            const icon = this.fullScreenButton.querySelector('.fullscreen-icon');
            const text = this.fullScreenButton.querySelector('.fullscreen-text');
            if (icon) icon.textContent = '⛶';
            if (text) text.textContent = 'Exit Full Screen';
        }

        // Store content references for floating menus
        this.storeContentForMenus();

        // Show menu panels (floating buttons)
        console.log('Showing menu panels (floating buttons)');
        this.showMenuPanels();

        // Force a reflow to ensure styles are applied
        document.body.offsetHeight;

        // Debug: Check if buttons are visible after a delay
        setTimeout(() => {
            console.log('Checking button visibility after fullscreen application');
            Object.values(this.menuPanels).forEach((button, index) => {
                console.log('Button', index, 'visibility:', button.style.display, 'classes:', button.className);
            });

            // Debug: Check map visibility
            const mapContainer = document.querySelector('.map-container');
            const map = document.querySelector('#map');
            if (mapContainer) {
                console.log('Map container found:', mapContainer);
                console.log('Map container display:', window.getComputedStyle(mapContainer).display);
                console.log('Map container position:', window.getComputedStyle(mapContainer).position);
                console.log('Map container dimensions:', mapContainer.offsetWidth, 'x', mapContainer.offsetHeight);
            } else {
                console.log('Map container NOT found!');
            }
            if (map) {
                console.log('Map element found:', map);
                console.log('Map display:', window.getComputedStyle(map).display);
                console.log('Map dimensions:', map.offsetWidth, 'x', map.offsetHeight);
            } else {
                console.log('Map element NOT found!');
            }
        }, 1000);
    }

    /**
     * Apply normal layout
     */
    applyNormalLayout() {
        console.log('Applying normal layout');
        console.log('Current body classes before:', document.body.className);
        document.body.classList.remove('fullscreen-mode');
        console.log('Current body classes after:', document.body.className);

        // Update button text
        if (this.fullScreenButton) {
            const icon = this.fullScreenButton.querySelector('.fullscreen-icon');
            const text = this.fullScreenButton.querySelector('.fullscreen-text');
            if (icon) icon.textContent = '⛶';
            if (text) text.textContent = 'Enter Full Screen';
        }

        // Restore content from menu panels
        this.restoreContentFromMenus();

        // Hide menu panels
        this.hideMenuPanels();
    }

    /**
     * Store content references for floating menus
     */
    storeContentForMenus() {
        // Store references to the original content
        this.menuContent = {
            controls: document.querySelector('.controls-panel'),
            playback: document.querySelector('.progress-controls-container'),
            stats: document.querySelector('.elevation-profile-container')
        };
    }

    /**
     * Restore content from menu panels
     */
    restoreContentFromMenus() {
        // The original elements should still be in place, just update their visibility
        // This is handled by CSS classes
    }

    /**
     * Show floating menu buttons
     */
    showMenuPanels() {
        console.log('Showing floating menu buttons, count:', Object.keys(this.menuPanels).length);
        Object.values(this.menuPanels).forEach((button, index) => {
            console.log('Showing button', index, button);
            button.classList.add('visible');
            button.style.display = 'flex'; // Ensure it's visible
        });
    }

    /**
     * Hide floating menu buttons
     */
    hideMenuPanels() {
        Object.values(this.menuPanels).forEach(button => {
            button.classList.remove('visible');
            button.classList.remove('active');
        });

        // Close any open popups
        this.closeAllPopups();
    }

    /**
     * Toggle menu visibility
     */
    toggleMenus() {
        if (!this.isFullScreen) return;

        this.menusVisible = !this.menusVisible;

        if (this.menusVisible) {
            this.showMenuPanels();
        } else {
            this.hideMenuPanels();
        }
    }

    /**
     * Toggle floating menu popup
     */
    toggleFloatingMenu(menuType) {
        const button = this.menuPanels[menuType.id];

        // Close all other popups first
        this.closeAllPopups();

        // Toggle this popup
        const isActive = button.classList.contains('active');
        if (isActive) {
            this.closePopup(menuType.id);
        } else {
            this.openPopup(menuType);
        }
    }

    /**
     * Open popup for a menu
     */
    openPopup(menuType) {
        const button = this.menuPanels[menuType.id];
        button.classList.add('active');

        // Create popup
        const popup = document.createElement('div');
        popup.className = `fullscreen-popup ${menuType.position}`;
        popup.setAttribute('data-menu', menuType.id);
        popup.innerHTML = `
            <div class="popup-header">
                <span class="popup-icon">${menuType.icon}</span>
                <span class="popup-title">${menuType.title}</span>
                <button class="popup-close-btn">✕</button>
            </div>
            <div class="popup-content">
                <!-- Content will be cloned here -->
            </div>
        `;

        // Clone content
        const contentElement = document.querySelector(menuType.content);
        if (contentElement) {
            console.log('Cloning content for menu:', menuType.id, 'from element:', contentElement);
            console.log('Original element display:', window.getComputedStyle(contentElement).display);
            console.log('Original element visibility:', window.getComputedStyle(contentElement).visibility);

            const contentClone = contentElement.cloneNode(true);
            console.log('Content cloned, children count:', contentClone.children.length);

            // Remove fullscreen button from controls if present
            const fullscreenBtn = contentClone.querySelector('.fullscreen-control-group');
            if (fullscreenBtn) {
                fullscreenBtn.remove();
                console.log('Removed fullscreen button from cloned content');
            }

            const popupContent = popup.querySelector('.popup-content');
            console.log('Popup content element:', popupContent);

            popupContent.innerHTML = ''; // Clear any existing content
            popupContent.appendChild(contentClone);
            console.log('Content appended to popup');

            // Force styles on cloned content
            contentClone.style.display = 'block';
            contentClone.style.width = '100%';
            contentClone.style.height = 'auto';
            contentClone.style.visibility = 'visible';
            contentClone.style.opacity = '1';

            // Force styles on all child elements too
            const allElements = contentClone.querySelectorAll('*');
            allElements.forEach(el => {
                el.style.display = el.style.display || 'block';
                el.style.visibility = 'visible';
                el.style.opacity = '1';
            });

            // Debug: Check if content is actually in the popup
            setTimeout(() => {
                console.log('Popup content after append:', popupContent.innerHTML.substring(0, 200) + '...');
                console.log('Popup content children:', popupContent.children.length);
            }, 100);
        } else {
            console.warn('Content element not found for menu:', menuType.id, 'selector:', menuType.content);
            // Add some fallback content
            popup.querySelector('.popup-content').innerHTML = `
                <div style="padding: 20px; text-align: center; color: #666;">
                    <p>Content not available</p>
                    <p>Menu: ${menuType.title}</p>
                </div>
            `;
        }

        // Add close handler
        popup.querySelector('.popup-close-btn').addEventListener('click', () => {
            this.closePopup(menuType.id);
        });

        // Close on outside click
        popup.addEventListener('click', (e) => {
            if (e.target === popup) {
                this.closePopup(menuType.id);
            }
        });

        document.body.appendChild(popup);
        this.activePopup = popup;

        // Debug: Check popup positioning and visibility
        setTimeout(() => {
            console.log('Popup created and appended:', popup);
            console.log('Popup position:', popup.style.position);
            console.log('Popup display:', popup.style.display);
            console.log('Popup z-index:', popup.style.zIndex);
            const rect = popup.getBoundingClientRect();
            console.log('Popup rect:', rect);
            console.log('Popup visible on screen?', rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.left >= 0);

            // Force popup to be visible if it's not
            if (rect.width === 0 || rect.height === 0) {
                console.log('Popup not visible, forcing visibility');
                popup.style.display = 'block';
                popup.style.visibility = 'visible';
                popup.style.opacity = '1';
            }
        }, 50);
    }

    /**
     * Close popup for a menu
     */
    closePopup(menuId) {
        const button = this.menuPanels[menuId];
        if (button) {
            button.classList.remove('active');
        }

        if (this.activePopup) {
            this.activePopup.remove();
            this.activePopup = null;
        }
    }

    /**
     * Close all popups
     */
    closeAllPopups() {
        Object.keys(this.menuPanels).forEach(menuId => {
            this.closePopup(menuId);
        });
    }

    /**
     * Handle full-screen change events
     */
    handleFullScreenChange() {
        const isCurrentlyFullScreen = !!(
            document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullScreenElement ||
            document.msFullscreenElement
        );

        if (isCurrentlyFullScreen !== this.isFullScreen) {
            if (isCurrentlyFullScreen) {
                this.isFullScreen = true;
                this.applyFullScreenLayout();
            } else {
                this.isFullScreen = false;
                this.applyNormalLayout();
            }
        }
    }

    /**
     * Show welcome message for full-screen mode
     */
    showWelcomeMessage() {
        const message = `
            <div style="text-align: center;">
                <strong>Full-Screen Mode Active!</strong><br>
                <small>
                    • Press <kbd>F</kbd> to toggle full-screen<br>
                    • Press <kbd>M</kbd> to hide/show menus<br>
                    • Press <kbd>ESC</kbd> to exit full-screen<br>
                    • Click menu icons to access controls
                </small>
            </div>
        `;

        this.app.showMessage(message, 'info');
    }

    /**
     * Get current full-screen state
     */
    getState() {
        return {
            isFullScreen: this.isFullScreen,
            menusVisible: this.menusVisible
        };
    }

    /**
     * Debug method to manually show buttons (for testing)
     */
    debugShowButtons() {
        console.log('Manually showing fullscreen buttons for debugging');
        this.showMenuPanels();
    }

    /**
     * Debug method to check button status
     */
    debugCheckButtons() {
        console.log('Debug: Checking fullscreen button status');
        console.log('Menu panels count:', Object.keys(this.menuPanels).length);
        Object.values(this.menuPanels).forEach((button, index) => {
            console.log('Button', index, ':', {
                element: button,
                classes: button.className,
                display: button.style.display,
                visible: button.classList.contains('visible'),
                position: button.style.position || window.getComputedStyle(button).position
            });
        });
    }

    /**
     * Debug method to create a test popup
     */
    debugCreateTestPopup() {
        console.log('Creating test popup for debugging');

        const popup = document.createElement('div');
        popup.className = 'fullscreen-popup top-left';
        popup.innerHTML = `
            <div class="popup-header">
                <span class="popup-icon">🧪</span>
                <span class="popup-title">Test Popup</span>
                <button class="popup-close-btn">✕</button>
            </div>
            <div class="popup-content">
                <div style="padding: 20px; text-align: center;">
                    <h3>Test Content</h3>
                    <p>If you can see this, popups are working!</p>
                    <button id="testBtn">Test Button</button>
                </div>
            </div>
        `;

        // Add close handler
        popup.querySelector('.popup-close-btn').addEventListener('click', () => {
            popup.remove();
        });

        // Add test button handler
        popup.querySelector('#testBtn').addEventListener('click', () => {
            alert('Test button clicked!');
        });

        document.body.appendChild(popup);
        console.log('Test popup created and appended');
    }

    /**
     * Clean up event listeners
     */
    destroy() {
        document.removeEventListener('keydown', this.handleKeyPress);
        if (this.fullScreenButton) {
            this.fullScreenButton.removeEventListener('click', this.toggleFullScreen);
        }

        // Remove menu panels
        Object.values(this.menuPanels).forEach(panel => {
            if (panel.parentNode) {
                panel.parentNode.removeChild(panel);
            }
        });

        // Remove overlay
        const overlay = document.getElementById('fullscreenOverlay');
        if (overlay && overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
    }
}
