const express = require('express');
const router = express.Router();
const adminAuthController = require('../controllers/adminAuthController');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/admin');

// Admin authentication routes - properly bound
router.get('/check-status', auth, (req, res) => adminAuthController.checkAdminStatus(req, res));
router.post('/request-otp', auth, (req, res) => adminAuthController.requestAdminOTP(req, res));
router.post('/verify-otp', auth, (req, res) => adminAuthController.verifyAdminOTP(req, res));

// Admin dashboard routes (protected with OTP verification) - properly bound
router.get('/stats', auth, adminAuth, (req, res) => adminAuthController.getAdminStats(req, res));

// User Management routes
router.get('/users', auth, adminAuth, (req, res) => adminAuthController.getAllUsers(req, res));
router.put('/users/:id/role', auth, adminAuth, (req, res) => adminAuthController.updateUserRole(req, res));
router.get('/users/stats', auth, adminAuth, (req, res) => adminAuthController.getUserStats(req, res));

// Order Management routes
router.get('/orders', auth, adminAuth, (req, res) => adminAuthController.getAllOrders(req, res));
router.put('/orders/:id/status', auth, adminAuth, (req, res) => adminAuthController.updateOrderStatus(req, res));

// System Settings routes
router.get('/settings', auth, adminAuth, (req, res) => adminAuthController.getSystemSettings(req, res));
router.put('/settings', auth, adminAuth, (req, res) => adminAuthController.updateSystemSettings(req, res));

// Data Plans Management routes
router.get('/data-plans/stats', auth, adminAuth, (req, res) => adminAuthController.getDataPlansStats(req, res));
router.post('/data-plans/profit-margin', auth, adminAuth, (req, res) => adminAuthController.applyProfitMargin(req, res));
router.post('/data-plans/single', auth, adminAuth, (req, res) => adminAuthController.addSinglePlan(req, res));
router.post('/data-plans/bulk', auth, adminAuth, (req, res) => adminAuthController.addBulkPlans(req, res));

module.exports = router;
