const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../middleware/auth');
const otpService = require('../services/otpService');

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);
// In your auth routes file, add:
router.post('/change-password', auth, authController.changePassword);

// Registration OTP routes
router.post('/request-registration-otp', async (req, res) => {
    try {
        const { email, full_name } = req.body;
        
        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'Email is required'
            });
        }

        // Check if email already exists
        const emailExists = await otpService.checkEmailExists(email);
        if (emailExists) {
            return res.status(400).json({
                success: false,
                error: 'Email already registered. Please use a different email or login.'
            });
        }

        const result = await otpService.createRegistrationOTP(email, full_name);
        res.json(result);
        
    } catch (error) {
        console.error('Registration OTP request failed:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.post('/verify-registration-otp', async (req, res) => {
    try {
        const { email, otp_code } = req.body;
        
        if (!email || !otp_code) {
            return res.status(400).json({
                success: false,
                error: 'Email and OTP code are required'
            });
        }

        const result = await otpService.verifyRegistrationOTP(email, otp_code);
        res.json(result);
        
    } catch (error) {
        console.error('Registration OTP verification failed:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Protected routes
router.get('/profile', auth, authController.getProfile);

module.exports = router;
