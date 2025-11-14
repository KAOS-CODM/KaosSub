const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const auth = require('../middleware/auth');

// Protected routes
router.get('/', auth, orderController.getUserOrders);

module.exports = router;
