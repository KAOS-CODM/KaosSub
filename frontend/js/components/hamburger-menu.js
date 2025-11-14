class HamburgerMenu {
    constructor() {
        this.isOpen = false;
        this.init();
    }

    init() {
        this.createMenu();
        this.setupEventListeners();
    }

    createMenu() {
        const menuHTML = `
            <!-- Hamburger Button -->
            <div id="hamburgerBtn" style="position: fixed; top: 20px; right: 20px; z-index: 1002; cursor: pointer; background: #dc3545; color: white; padding: 10px; border-radius: 5px;">
                <i class="fas fa-bars"></i>
            </div>

            <!-- Side Menu -->
            <div id="sideMenu" style="position: fixed; top: 0; right: -300px; width: 300px; height: 100vh; background: white; box-shadow: -2px 0 10px rgba(0,0,0,0.1); z-index: 1001; transition: right 0.3s ease; padding: 20px; overflow-y: auto;">
                <!-- Close Button -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                    <h3 style="margin: 0; color: #333;">Menu</h3>
                    <button id="closeMenu" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #666;">&times;</button>
                </div>

                <!-- User Info -->
                <div id="menuUserInfo" style="text-align: center; margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 1px solid #eee;">
                    <div style="width: 80px; height: 80px; background: #dc3545; border-radius: 50%; margin: 0 auto 1rem; display: flex; align-items: center; justify-content: center; color: white; font-size: 2rem;">
                        <i class="fas fa-user"></i>
                    </div>
                    <h4 id="menuUserName" style="margin: 0 0 0.5rem 0; color: #333;">Loading...</h4>
                    <p id="menuUserEmail" style="margin: 0; color: #666; font-size: 0.9rem;">Loading...</p>
                </div>

                <!-- Navigation Links -->
                <nav style="margin-bottom: 2rem;">
                    <ul style="list-style: none; padding: 0; margin: 0;">
                        <li style="margin-bottom: 0.5rem;">
                            <a href="/dashboard" style="display: flex; align-items: center; padding: 12px; text-decoration: none; color: #333; border-radius: 5px; transition: background 0.3s;">
                                <i class="fas fa-tachometer-alt" style="margin-right: 10px; width: 20px;"></i>
                                Dashboard
                            </a>
                        </li>
                        <li style="margin-bottom: 0.5rem;">
                            <a href="/data-plans" style="display: flex; align-items: center; padding: 12px; text-decoration: none; color: #333; border-radius: 5px; transition: background 0.3s;">
                                <i class="fas fa-database" style="margin-right: 10px; width: 20px;"></i>
                                Data Plans
                            </a>
                        </li>
                        <li style="margin-bottom: 0.5rem;">
                            <a href="/history" style="display: flex; align-items: center; padding: 12px; text-decoration: none; color: #333; border-radius: 5px; transition: background 0.3s;">
                                <i class="fas fa-history" style="margin-right: 10px; width: 20px;"></i>
                                Order History
                            </a>
                        </li>
                        <li style="margin-bottom: 0.5rem;">
                            <a href="/profile-settings" style="display: flex; align-items: center; padding: 12px; text-decoration: none; color: #333; border-radius: 5px; transition: background 0.3s;">
                                <i class="fas fa-user-cog" style="margin-right: 10px; width: 20px;"></i>
                                Profile Settings
                            </a>
                        </li>
                        <li style="margin-bottom: 0.5rem;">
                            <a href="/contact" style="display: flex; align-items: center; padding: 12px; text-decoration: none; color: #333; border-radius: 5px; transition: background 0.3s;">
                                <i class="fas fa-envelope" style="margin-right: 10px; width: 20px;"></i>
                                Contact Support
                            </a>
                        </li>
                    </ul>
                </nav>

                <!-- Quick Actions -->
                <div style="margin-bottom: 2rem;">
                    <h4 style="margin-bottom: 1rem; color: #333;">Quick Actions</h4>
                    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                        <button onclick="window.location.href='/data-plans'" style="display: flex; align-items: center; padding: 10px; background: #f8f9fa; border: 1px solid #ddd; border-radius: 5px; cursor: pointer; text-align: left;">
                            <i class="fas fa-bolt" style="margin-right: 10px; color: #dc3545;"></i>
                            Buy Data
                        </button>
                        <button onclick="window.location.href='/dashboard'" style="display: flex; align-items: center; padding: 10px; background: #f8f9fa; border: 1px solid #ddd; border-radius: 5px; cursor: pointer; text-align: left;">
                            <i class="fas fa-wallet" style="margin-right: 10px; color: #28a745;"></i>
                            Fund Wallet
                        </button>
                    </div>
                </div>

                <!-- Logout Button -->
                <div style="margin-top: auto;">
                    <button id="menuLogoutBtn" style="width: 100%; padding: 12px; background: #dc3545; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;">
                        <i class="fas fa-sign-out-alt" style="margin-right: 8px;"></i>
                        Logout
                    </button>
                </div>
            </div>

            <!-- Overlay -->
            <div id="menuOverlay" style="position: fixed; top: 0; left: 0; width: 100%; height: 100vh; background: rgba(0,0,0,0.5); z-index: 1000; display: none;"></div>
        `;

        document.body.insertAdjacentHTML('beforeend', menuHTML);
    }

    setupEventListeners() {
        const hamburgerBtn = document.getElementById('hamburgerBtn');
        const closeMenu = document.getElementById('closeMenu');
        const menuOverlay = document.getElementById('menuOverlay');
        const sideMenu = document.getElementById('sideMenu');
        const logoutBtn = document.getElementById('menuLogoutBtn');

        hamburgerBtn.addEventListener('click', () => this.toggleMenu());
        closeMenu.addEventListener('click', () => this.closeMenu());
        menuOverlay.addEventListener('click', () => this.closeMenu());
        
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                Utils.logout();
            });
        }

        // Close menu when clicking on links (optional)
        sideMenu.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => this.closeMenu());
        });
    }

    toggleMenu() {
        const sideMenu = document.getElementById('sideMenu');
        const menuOverlay = document.getElementById('menuOverlay');
        const hamburgerBtn = document.getElementById('hamburgerBtn');

        if (this.isOpen) {
            this.closeMenu();
        } else {
            this.openMenu();
        }
    }

    openMenu() {
        const sideMenu = document.getElementById('sideMenu');
        const menuOverlay = document.getElementById('menuOverlay');
        const hamburgerBtn = document.getElementById('hamburgerBtn');

        sideMenu.style.right = '0';
        menuOverlay.style.display = 'block';
        hamburgerBtn.style.display = 'none';
        this.isOpen = true;

        // Load user info when menu opens
        this.loadUserInfo();
    }

    closeMenu() {
        const sideMenu = document.getElementById('sideMenu');
        const menuOverlay = document.getElementById('menuOverlay');
        const hamburgerBtn = document.getElementById('hamburgerBtn');

        sideMenu.style.right = '-300px';
        menuOverlay.style.display = 'none';
        hamburgerBtn.style.display = 'block';
        this.isOpen = false;
    }

    async loadUserInfo() {
        try {
            const response = await Utils.apiRequest('/api/auth/profile');
            if (response.success) {
                const user = response.data;
                document.getElementById('menuUserName').textContent = user.full_name || user.email || 'User';
                document.getElementById('menuUserEmail').textContent = user.email || 'No email';
            }
        } catch (error) {
            console.error('Failed to load user info:', error);
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Only show hamburger menu for authenticated users on relevant pages
    if (Utils.isAuthenticated() && isRelevantPage()) {
        window.hamburgerMenu = new HamburgerMenu();
    }
});

function isRelevantPage() {
    const relevantPages = ['/dashboard', '/data-plans', '/history', '/profile-settings', '/admin'];
    return relevantPages.some(page => window.location.pathname.includes(page));
}
