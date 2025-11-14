const express = require('express');
const router = express.Router();
const dataController = require('../controllers/dataController');
const auth = require('../middleware/auth');
const testController = require('../controllers/testController');

// Public routes
router.get('/plans', dataController.getDataPlans);

// Protected routes
router.post('/purchase', auth, dataController.purchaseData);
router.get('/provider-status', auth, dataController.getProviderStatus);
router.get('/purchase-history', auth, dataController.getPurchaseHistory);

module.exports = router;

// Test routes (remove in production)
router.get('/test-connection', testController.testISubConnection);
router.post('/test-purchase', testController.testDataPurchase);
