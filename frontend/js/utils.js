// Unified Utils implementation - Works for both login AND profile updates
(function() {
    // Define Utils immediately
    window.Utils = {
        // Authentication functions
        isAuthenticated: function() {
            const token = this.getAuthToken();
            if (!token) {
                return false;
            }
            try {
                const isValid = token.length > 10;
                return isValid;
            } catch (e) {
                console.error('Token validation error:', e);
                return false;
            }
        },
        
        isLoggedIn: function() {
            return this.isAuthenticated();
        },

        requireAuth: function() {
            if (!this.isAuthenticated()) {
                this.redirectToLogin();
                return false;
            }
            return true;
        },

        getAuthToken: function() {
            const locations = [
                "authToken",
                "supabase.auth.token",
                "token",
                "sb-aezuyterjdnkrktepvvp-auth-token",
                "supabase.auth.refresh-token",
                "access_token"
            ];

            let token = null;
            for (const location of locations) {
                token = localStorage.getItem(location) || sessionStorage.getItem(location);
                if (token) {
                    break;
                }
            }
            
            // Also check supabase_session
            if (!token) {
                const supabaseSession = localStorage.getItem("supabase_session");
                if (supabaseSession) {
                    try {
                        const session = JSON.parse(supabaseSession);
                        token = session.access_token || session.accessToken;
                    } catch (e) {}
                }
            }

            return token;
        },

        getToken: function() {
            return this.getAuthToken();
        },

        setAuthToken: function(token, key = 'authToken') {
            localStorage.setItem(key, token);
        },

        setUserProfile: function(profileData) {
            localStorage.setItem('userProfile', JSON.stringify({
                email: profileData.email,
                full_name: profileData.full_name || profileData.email,
                balance: profileData.balance || 0,
                id: profileData.id
            }));
        },

        getUserProfile: function() {
            try {
                const profile = JSON.parse(localStorage.getItem('userProfile') || '{}');
                return profile;
            } catch (e) {
                console.error('Error parsing user profile:', e);
                return {};
            }
        },

        clearAuth: function() {
            const keys = [
                'authToken',
                'supabase.auth.token',
                'token',
                'userProfile',
                'userBalance',
                'sb-aezuyterjdnkrktepvvp-auth-token',
                'supabase.auth.refresh-token',
                'supabase_session'
            ];

            keys.forEach(key => {
                localStorage.removeItem(key);
                sessionStorage.removeItem(key);
            });
        },

        logout: function() {
            this.clearAuth();
            window.location.href = '/login';
        },

        redirectToLogin: function() {
            window.location.href = '/login';
        },

        // Validation functions
        validateEmail: function(email) {
            if (!email || typeof email !== 'string') return false;
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailRegex.test(email.trim());
        },

        validatePhone: function(phone) {
            if (!phone || typeof phone !== 'string') return false;
            const phoneRegex = /^(\+?234|0)[789][01]\d{8}$/;
            return phoneRegex.test(phone.trim());
        },
        
        // UNIFIED API Request function - Works for both login and profile updates
        apiRequest: async function(url, methodOrOptions = 'GET', data = null) {
            console.log(`🔄 API Request: ${url}`, { methodOrOptions, data });
            
            // Handle both signatures:
            // - Old: apiRequest(url, options = {})
            // - New: apiRequest(url, method = 'GET', data = null)
            
            let method = 'GET';
            let options = {};
            
            if (typeof methodOrOptions === 'string') {
                // New signature: (url, method, data)
                method = methodOrOptions;
                options = {
                    method: method,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                };
                
                if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
                    options.body = JSON.stringify(data);
                }
            } else {
                // Old signature: (url, options)
                options = methodOrOptions;
                method = options.method || 'GET';
            }

            try {
                const token = this.getAuthToken();
                
                // Ensure headers exist
                if (!options.headers) {
                    options.headers = {};
                }
                
                // Set content type if not provided
                if (!options.headers['Content-Type']) {
                    options.headers['Content-Type'] = 'application/json';
                }
                
                // Add authorization if token exists
                if (token) {
                    options.headers['Authorization'] = `Bearer ${token}`;
                }

                const response = await fetch(url, options);
                console.log(`📡 API Response Status: ${response.status} ${response.statusText}`);
                
                // Check if response is JSON
                const contentType = response.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    // For login compatibility, throw error
                    if (url.includes('/auth/')) {
                        throw new Error('Server returned non-JSON response');
                    }
                    // For profile updates, return error object
                    return {
                        success: false,
                        error: 'Server returned non-JSON response'
                    };
                }
                
                const result = await response.json();
                console.log(`📊 API Response Data:`, result);
                
                // Handle different response patterns:
                // - Login expects thrown errors for non-200 responses
                // - Profile updates expect returned error objects
                
                if (url.includes('/auth/')) {
                    // For auth endpoints (login/signup), maintain old behavior
                    if (!response.ok) {
                        throw new Error(result.error || `HTTP error! status: ${response.status}`);
                    }
                    return result;
                } else {
                    // For all other endpoints, use new behavior
                    return result;
                }
                
            } catch (error) {
                console.error('💥 API Request Failed:', error);
                
                if (url.includes('/auth/')) {
                    // For auth endpoints, throw error (login expects this)
                    throw error;
                } else {
                    // For other endpoints, return error object
                    return {
                        success: false,
                        error: error.message || 'Network request failed'
                    };
                }
            }
        },

        // UI functions
        showLoading: function(button) {
            const originalText = button.innerHTML;
            button.innerHTML = 'Loading...';
            button.disabled = true;
            return originalText;
        },

        hideLoading: function(button, originalText) {
            button.innerHTML = originalText;
            button.disabled = false;
        },

        showAlert: function(message, type = 'info') {
            if (typeof message === 'object') {
                message = JSON.stringify(message);
            }
            alert(message);
        },

        formatCurrency: function(amount) {
            return '₦' + parseFloat(amount || 0).toFixed(2);
        },

        formatDate: function(dateString) {
            try {
                return new Date(dateString).toLocaleString();
            } catch (e) {
                return dateString;
            }
        },

        handleApiError: function(error, defaultMessage = 'An error occurred') {
            console.error('API Error:', error);
            const message = error.message || error.error || defaultMessage;
            this.showAlert(message, 'error');
            return message;
        },

        // URL utilities
        getUrlParam: function(name) {
            const urlParams = new URLSearchParams(window.location.search);
            return urlParams.get(name);
        },

        // Enhanced notification system
        showNotification: function(message, type = 'success') {
            // Create notification element
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 15px 20px;
                border-radius: 5px;
                color: white;
                font-weight: 500;
                z-index: 10000;
                max-width: 400px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                transition: all 0.3s ease;
            `;
            
            if (type === 'success') {
                notification.style.background = '#28a745';
            } else {
                notification.style.background = '#dc3545';
            }
            
            notification.textContent = message;
            document.body.appendChild(notification);
            
            // Remove after 5 seconds
            setTimeout(() => {
                notification.style.opacity = '0';
                notification.style.transform = 'translateX(100px)';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }, 5000);
        }
    };
})();
