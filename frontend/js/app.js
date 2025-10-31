// KaosSub Main Application JavaScript

class KaosApp {
  constructor() {
    this.currentUser = null;
    this.userBalance = 0;
    this.init();
  }

  init() {
    
    // Check authentication on page load
    this.checkAuth();
    
    // Initialize common event listeners
    this.initEventListeners();
    
    // Load user data if authenticated
    if (Utils.isAuthenticated()) {
      this.loadUserData();
    }
  }

  checkAuth() {
    // If on protected pages and not authenticated, redirect to login
    const protectedPages = ['dashboard', 'profile', 'data-plans'];
    const currentPage = window.location.pathname.split('/').pop();
    
    if (protectedPages.includes(currentPage) && !Utils.isAuthenticated()) {
      window.location.href = '/login';
      return false;
    }

    // If on auth pages and already authenticated, redirect to dashboard
    const authPages = ['login', 'register'];
    if (authPages.includes(currentPage) && Utils.isAuthenticated()) {
      window.location.href = '/dashboard';
      return false;
    }

    return true;
  }

  initEventListeners() {
    // Global logout handler
    document.addEventListener('click', (e) => {
      if (e.target.id === 'logoutBtn' || e.target.closest('#logoutBtn')) {
        e.preventDefault();
        Utils.logout();
      }
    });

    // Global error handler
    window.addEventListener('error', (e) => {
      console.error('Global error:', e.error);
    });
  }

  async loadUserData() {
    try {
      const response = await Utils.apiRequest('/api/auth/profile');
      
      if (response.success) {
        this.currentUser = response.data;
        this.userBalance = response.data.balance;
        
        // Store in localStorage for other pages
        localStorage.setItem('userProfile', JSON.stringify(response.data));
        localStorage.setItem('userBalance', response.data.balance);
        
        // Update UI if elements exist
        this.updateUserUI();
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  }

  updateUserUI() {
    // Update user name if element exists
    const userNameElement = document.getElementById('userName');
    if (userNameElement && this.currentUser) {
      userNameElement.textContent = this.currentUser.full_name || this.currentUser.email;
    }

    // Update balance if element exists
    const balanceElement = document.getElementById('currentBalance');
    if (balanceElement) {
      balanceElement.textContent = Utils.formatCurrency(this.userBalance);
    }

    // Update navigation based on auth state
    this.updateNavigation();
  }

  updateNavigation() {
    const authNav = document.getElementById('authNav');
    const userNav = document.getElementById('userNav');

    if (Utils.isAuthenticated()) {
      if (authNav) authNav.style.display = 'none';
      if (userNav) {
        userNav.style.display = 'flex';
        userNav.style.gap = '1.5rem';
        userNav.style.flexWrap = 'wrap';
      }
    } else {
      if (authNav) {
        authNav.style.display = 'flex';
        authNav.style.gap = '1.5rem';
        authNav.style.flexWrap = 'wrap';
      }
      if (userNav) userNav.style.display = 'none';
    }
  }

  // Show modal
  showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = 'flex';
    }
  }

  // Hide modal
  hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = 'none';
    }
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.kaosApp = new KaosApp();
});

// Common payment initialization function
async function initializePayment(amountInputId, errorDivId) {
  const amountInput = document.getElementById(amountInputId);
  const errorDiv = document.getElementById(errorDivId);
  const amount = parseInt(amountInput.value);

  try {
    // Clear previous errors
    errorDiv.style.display = 'none';
    errorDiv.textContent = '';

    // Validate amount
    if (!amount || amount < 100) {
      throw new Error('Please enter an amount of at least ₦100');
    }

    // Get user email
    const userProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
    const userEmail = userProfile.email;

    if (!userEmail) {
      throw new Error('User email not found. Please login again.');
    }

    // Initialize payment
    const paymentHandler = new PaymentHandler();
    await paymentHandler.initializePayment(amount, userEmail);

  } catch (error) {
    console.error('Payment error:', error);
    errorDiv.textContent = error.message;
    errorDiv.style.display = 'block';
  }
}
