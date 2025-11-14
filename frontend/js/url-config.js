// Frontend URL Configuration
// This file provides dynamic URL handling for both development and production

class UrlConfig {
    // Get the base API URL
    static getApiBaseUrl() {
        // In production, use relative URLs (same domain)
        // In development, use localhost:3001
        if (window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1' ||
            window.location.hostname === '0.0.0.0') {
            return 'http://localhost:3001';
        }
        return ''; // Empty string for same domain in production
    }

    // Get full API URL for an endpoint
    static getApiUrl(endpoint) {
        const baseUrl = this.getApiBaseUrl();
        // Remove leading slash from endpoint if present
        const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
        return `${baseUrl}/api/${cleanEndpoint}`;
    }

    // Get frontend URL for a path
    static getFrontendUrl(path = '') {
        const cleanPath = path.startsWith('/') ? path : `/${path}`;
        return window.location.origin + cleanPath;
    }

    // Get payment verification URL (SPECIFICALLY FOR PAYSTACK CALLBACK)
    static getPaymentVerifyUrl() {
        return this.getFrontendUrl('/payment-verify.html');
    }

    // Check if we're in development
    static isDevelopment() {
        return window.location.hostname === 'localhost' ||
               window.location.hostname === '127.0.0.1';
    }

    // Check if we're in production
    static isProduction() {
        return !this.isDevelopment();
    }
}

// Global helper functions for backward compatibility
window.getApiUrl = UrlConfig.getApiUrl.bind(UrlConfig);
window.getFrontendUrl = UrlConfig.getFrontendUrl.bind(UrlConfig);
window.getPaymentVerifyUrl = UrlConfig.getPaymentVerifyUrl.bind(UrlConfig);

console.log('URL Config loaded. Environment:', UrlConfig.isProduction() ? 'Production' : 'Development');
