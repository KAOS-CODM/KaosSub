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
// Add these routes to your admin routes
router.get('/settings', adminAuthController.getSystemSettings);
router.put('/settings', adminAuthController.updateSystemSettings);
router.post('/settings/reset', adminAuthController.resetSystemSettings);

// Data Plans Management routes
router.get('/data-plans/stats', auth, adminAuth, (req, res) => adminAuthController.getDataPlansStats(req, res));
router.post('/data-plans/profit-margin', auth, adminAuth, (req, res) => adminAuthController.applyProfitMargin(req, res));
router.post('/data-plans/single', auth, adminAuth, (req, res) => adminAuthController.addSinglePlan(req, res));
router.post('/data-plans/bulk', auth, adminAuth, (req, res) => adminAuthController.addBulkPlans(req, res));

// Add this to your admin routes temporarily
router.get('/debug-all-users', auth, adminAuth, async (req, res) => {
    try {
        console.log('🧪 Debug: Testing users query directly...');
        
        // Test direct database query
        const { data: users, error } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });

        console.log('🧪 Direct query result:', { 
            usersCount: users?.length, 
            error: error?.message,
            users: users?.map(u => ({ id: u.id, email: u.email, role: u.role }))
        });
        
        return res.json({
            success: true,
            message: `Found ${users?.length || 0} users`,
            data: { users },
            debug: { 
                query: 'SELECT * FROM profiles ORDER BY created_at DESC',
                currentUser: { id: req.user.id, email: req.user.email }
            }
        });
    } catch (error) {
        console.error('🧪 Debug error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
