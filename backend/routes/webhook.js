const express = require('express');
const router = express.Router();
const WebhookController = require('../controllers/webhookController');

// VTU.ng webhook endpoint
router.post('/vtu', express.json(), WebhookController.handleVTUWebhook);

module.exports = router;
