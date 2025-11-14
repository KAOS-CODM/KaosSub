const express = require('express');
const router = express.Router();
const emailService = require('../services/emailService');

// Send order confirmation email
router.post('/send-order-confirmation', async (req, res) => {
    try {
        const { email, orderDetails, userName } = req.body;
        
        if (!email || !orderDetails) {
            return res.json({ 
                success: false, 
                error: 'Email and order details are required' 
            });
        }

        await emailService.sendOrderConfirmation(email, orderDetails, userName);
        res.json({ 
            success: true, 
            message: 'Order confirmation sent successfully' 
        });
    } catch (error) {
        console.error('Order confirmation email failed:', error);
        res.json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Send welcome email
router.post('/send-welcome', async (req, res) => {
    try {
        const { email, userName } = req.body;
        
        if (!email) {
            return res.json({ 
                success: false, 
                error: 'Email is required' 
            });
        }

        await emailService.sendWelcomeEmail(email, userName);
        res.json({ 
            success: true, 
            message: 'Welcome email sent successfully' 
        });
    } catch (error) {
        console.error('Welcome email failed:', error);
        res.json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Send password reset email
router.post('/send-password-reset', async (req, res) => {
    try {
        const { email, resetToken, userName } = req.body;
        
        if (!email || !resetToken) {
            return res.json({ 
                success: false, 
                error: 'Email and reset token are required' 
            });
        }

        await emailService.sendPasswordResetEmail(email, resetToken, userName);
        res.json({ 
            success: true, 
            message: 'Password reset email sent successfully' 
        });
    } catch (error) {
        console.error('Password reset email failed:', error);
        res.json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Send password change notification
router.post('/send-password-change-notification', async (req, res) => {
    try {
        const { email, userName, changeTime } = req.body;

        if (!email) {
            return res.json({
                success: false,
                error: 'Email is required'
            });
        }

        await emailService.sendPasswordChangeNotification(email, userName, changeTime);
        res.json({
            success: true,
            message: 'Password change notification sent successfully'
        });
    } catch (error) {
        console.error('Password change notification failed:', error);
        res.json({
            success: false,
            error: error.message
        });
    }
});

// Send wallet top-up confirmation email
router.post('/send-wallet-topup', async (req, res) => {
    try {
        const { email, topupDetails, userName } = req.body;
        
        if (!email || !topupDetails) {
            return res.json({ 
                success: false, 
                error: 'Email and top-up details are required' 
            });
        }

        await emailService.sendWalletTopupEmail(email, topupDetails, userName);
        res.json({ 
            success: true, 
            message: 'Wallet top-up confirmation sent successfully' 
        });
    } catch (error) {
        console.error('Wallet top-up email failed:', error);
        res.json({ 
            success: false, 
            error: error.message 
        });
    }
});

module.exports = router;
