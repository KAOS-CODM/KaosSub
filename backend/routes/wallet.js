const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const auth = require('../middleware/auth');

// Protected routes
router.post('/initialize-payment', auth, walletController.initializePayment);
router.get('/verify-payment/:reference', auth, walletController.verifyPayment);
router.get('/transactions', auth, walletController.getWalletTransactions);
router.get('/payment-transactions', auth, walletController.getPaymentTransactions);
router.get('/test-paystack', auth, walletController.testPaystack);

module.exports = router;
