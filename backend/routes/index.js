const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./auth');
const dataRoutes = require('./dataRoutes');
const orderRoutes = require('./orders');
const walletRoutes = require('./wallet');
const adminRoutes = require('./admin');
const contactRoutes = require('./contact');
const newsletterRoutes = require('./newsletter');
const profileRoutes = require('./profile');
// Add this line with your other route imports
const emailRoutes = require('./email');

// const webhookRoutes = require('./webhook'); // Uncomment if you have webhooks

// Use route modules
router.use('/auth', authRoutes);
router.use('/data', dataRoutes);
router.use('/orders', orderRoutes);
router.use('/wallet', walletRoutes);
router.use('/admin', adminRoutes);
router.use('/contact', contactRoutes);
router.use('/newsletter', newsletterRoutes);
router.use('/profile', profileRoutes);
router.use('/email', emailRoutes);
// router.use('/webhook', webhookRoutes); // Uncomment if you have webhooks

module.exports = router;
