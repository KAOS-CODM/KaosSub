const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { logServerUrls } = require('./config/urls');
require('dotenv').config();

console.log('🚀 Starting KaosSub Server...');
console.log('📱 Environment:', process.env.NODE_ENV);
console.log('🔧 Loading configurations...');

// Import configurations
require('./config/supabase');
require('./config/paystack');

// Import all routes from routes/index.js
const apiRoutes = require('./routes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Redirect .html URLs to clean URLs (preserve query parameters)
app.get('*', (req, res, next) => {
    // Skip API routes and health check
    if (req.url.startsWith('/api/') || req.url === '/health') {
        return next();
    }

    // If URL ends with .html, redirect to clean URL
    if (req.url.endsWith('.html') || req.url.includes('.html?')) {
        const urlParts = req.url.split('?');
        const pathWithoutHtml = urlParts[0].replace(/\.html$/, '');
        const queryString = urlParts[1] ? `?${urlParts[1]}` : '';
        const cleanUrl = pathWithoutHtml + queryString;
        return res.redirect(301, cleanUrl);
    }
    next();
});

// Use all API routes
app.use('/api', apiRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'KaosSub API is running',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

// In your main server file or routes
app.get('/api/debug-routes', (req, res) => {
    res.json({
        message: 'Available routes',
        emailRoutes: [
            '/api/email/send-order-confirmation',
            '/api/email/send-welcome', 
            '/api/email/send-password-reset'
        ]
    });
});

// Serve HTML files without .html extension - IMPROVED VERSION
app.get('*', (req, res, next) => {
    // Skip API routes
    if (req.url.startsWith('/api/')) {
        return next();
    }

    const frontendDir = path.join(__dirname, '../frontend');
    
    // Extract just the path without query parameters
    const pathWithoutQuery = req.url.split('?')[0];
    
    let filePath;

    // If root path, serve index.html
    if (pathWithoutQuery === '/' || pathWithoutQuery === '') {
        filePath = path.join(frontendDir, 'index.html');
    } else {
        // Remove leading slash and add .html
        const cleanPath = pathWithoutQuery.replace(/^\//, '');
        filePath = path.join(frontendDir, cleanPath + '.html');

        // If file doesn't exist, try serving as is (for assets)
        if (!fs.existsSync(filePath)) {
            // Check if it's a directory and serve index.html
            const dirPath = path.join(frontendDir, cleanPath);
            if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
                filePath = path.join(dirPath, 'index.html');
            }
        }
    }

    // Check if file exists and serve it
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        console.log(`📄 Serving: ${filePath} for URL: ${req.url}`);
        return res.sendFile(filePath);
    }

    // If no HTML file found, continue to next middleware (static files or 404)
    next();
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 404 handler - this should come AFTER all other routes
app.use('*', (req, res) => {
    if (req.url.startsWith('/api/')) {
        return res.status(404).json({
            success: false,
            error: 'Endpoint not found'
        });
    }

    // For non-API routes, serve the 404 page
    const notFoundPath = path.join(__dirname, '../frontend/404.html');
    if (fs.existsSync(notFoundPath)) {
        res.status(404).sendFile(notFoundPath);
    } else {
        res.status(404).send(`
            <html>
                <head><title>404 - Page Not Found</title></head>
                <body style="text-align: center; padding: 50px; font-family: Arial, sans-serif;">
                    <h1>404 - Page Not Found</h1>
                    <p>The page you are looking for doesn't exist.</p>
                    <a href="/">Go Home</a>
                </body>
            </html>
        `);
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  logServerUrls(PORT);
});
