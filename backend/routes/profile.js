const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const authenticateToken = require('../middleware/auth');

// Get user profile
router.get('/', authenticateToken, async (req, res) => {
    try {
        console.log('🔍 [PROFILE] Fetching profile for user:', req.user?.id);
        
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', req.user.id)
            .single();

        if (error) {
            console.error('❌ [PROFILE] Database error:', error);
            return res.status(400).json({
                success: false,
                error: 'Failed to fetch profile',
                details: error.message
            });
        }

        console.log('✅ [PROFILE] Fetch successful');
        res.json({
            success: true,
            data: profile
        });
    } catch (error) {
        console.error('💥 [PROFILE] Exception:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});

// Update user profile
router.post('/update', authenticateToken, async (req, res) => {
    try {
        console.log('🔄 [PROFILE UPDATE] Starting update for user:', req.user?.id);
        console.log('📦 [PROFILE UPDATE] Request body:', req.body);
        
        const { full_name, phone } = req.body;

        // Validate input
        if (!full_name && !phone) {
            console.log('❌ [PROFILE UPDATE] No fields to update');
            return res.status(400).json({
                success: false,
                error: 'No fields to update'
            });
        }

        const updateData = {
            updated_at: new Date().toISOString()
        };

        if (full_name) updateData.full_name = full_name;
        if (phone) updateData.phone_number = phone;

        console.log('📤 [PROFILE UPDATE] Sending to database:', updateData);

        const { data, error } = await supabase
            .from('profiles')
            .update(updateData)
            .eq('id', req.user.id)
            .select()
            .single();

        if (error) {
            console.error('❌ [PROFILE UPDATE] Database error:', error);
            return res.status(400).json({
                success: false,
                error: 'Failed to update profile',
                details: error.message,
                code: error.code
            });
        }

        console.log('✅ [PROFILE UPDATE] Success:', data);
        res.json({
            success: true,
            data,
            message: 'Profile updated successfully'
        });
    } catch (error) {
        console.error('💥 [PROFILE UPDATE] Exception:', error);
        res.status(500).json({
            success: false,
            error: 'Server error',
            details: error.message
        });
    }
});

// Change password
router.post('/change-password', authenticateToken, async (req, res) => {
    try {
        console.log('🔐 [PASSWORD] Changing password for user:', req.user?.id);
        
        const { current_password, new_password } = req.body;

        if (!current_password || !new_password) {
            return res.status(400).json({
                success: false,
                error: 'Current password and new password are required'
            });
        }

        console.log('🔑 [PASSWORD] Verifying current password...');

        const { data: user, error: signInError } = await supabase.auth.signInWithPassword({
            email: req.user.email,
            password: current_password
        });

        if (signInError) {
            console.error('❌ [PASSWORD] Current password incorrect:', signInError);
            return res.status(400).json({
                success: false,
                error: 'Current password is incorrect'
            });
        }

        console.log('✅ [PASSWORD] Current password verified');

        const { error: updateError } = await supabase.auth.updateUser({
            password: new_password
        });

        if (updateError) {
            console.error('❌ [PASSWORD] Update failed:', updateError);
            return res.status(400).json({
                success: false,
                error: 'Failed to update password'
            });
        }

        console.log('✅ [PASSWORD] Password updated successfully');
        res.json({
            success: true,
            message: 'Password updated successfully'
        });
    } catch (error) {
        console.error('💥 [PASSWORD] Exception:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});

// Add missing preferences endpoint
router.post('/preferences', authenticateToken, async (req, res) => {
    try {
        console.log('⚙️ [PREFERENCES] Updating preferences for user:', req.user?.id);
        console.log('🎛️ [PREFERENCES] Request body:', req.body);
        
        const { preferences } = req.body;

        if (!preferences) {
            return res.status(400).json({
                success: false,
                error: 'Preferences data is required'
            });
        }

        const updateData = {
            preferences: preferences,
            updated_at: new Date().toISOString()
        };

        console.log('📤 [PREFERENCES] Sending to database:', updateData);

        const { data, error } = await supabase
            .from('profiles')
            .update(updateData)
            .eq('id', req.user.id)
            .select()
            .single();

        if (error) {
            console.error('❌ [PREFERENCES] Database error:', error);
            
            // Check if preferences column exists
            if (error.message.includes('preferences') && error.message.includes('does not exist')) {
                return res.status(400).json({
                    success: false,
                    error: 'Preferences feature not available. The preferences column does not exist in the database.'
                });
            }
            
            return res.status(400).json({
                success: false,
                error: 'Failed to update preferences',
                details: error.message,
                code: error.code
            });
        }

        console.log('✅ [PREFERENCES] Success:', data);
        res.json({
            success: true,
            data,
            message: 'Preferences updated successfully'
        });
    } catch (error) {
        console.error('💥 [PREFERENCES] Exception:', error);
        res.status(500).json({
            success: false,
            error: 'Server error',
            details: error.message
        });
    }
});

module.exports = router;
