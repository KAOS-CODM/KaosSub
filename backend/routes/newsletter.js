const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase'); // Fixed import

// Subscribe to newsletter
router.post('/subscribe', async (req, res) => {
    try {
        console.log('📧 Newsletter subscription request:', req.body);
        
        const { email } = req.body;

        // Validate email
        if (!email || !email.includes('@')) {
            console.log('❌ Invalid email:', email);
            return res.status(400).json({
                success: false,
                error: 'Please provide a valid email address'
            });
        }

        console.log('📧 Checking if email exists:', email);

        // Check if email already exists
        const { data: existingSubscriber, error: checkError } = await supabase
            .from('newsletter_subscribers')
            .select('email')
            .eq('email', email)
            .single();

        if (checkError && checkError.code !== 'PGRST116') {
            console.error('❌ Database check error:', checkError);
            throw checkError;
        }

        if (existingSubscriber) {
            console.log('❌ Email already subscribed:', email);
            return res.status(409).json({
                success: false,
                error: 'This email is already subscribed to our newsletter'
            });
        }

        console.log('📧 Inserting new subscriber:', email);

        // Insert new subscriber
        const { data, error } = await supabase
            .from('newsletter_subscribers')
            .insert([
                {
                    email: email,
                    subscribed_at: new Date().toISOString(),
                    active: true
                }
            ])
            .select();

        if (error) {
            console.error('❌ Database insert error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to subscribe to newsletter'
            });
        }

        console.log('✅ Newsletter subscription successful:', email);

        res.json({
            success: true,
            message: 'Successfully subscribed to newsletter!',
            data: data[0]
        });

    } catch (error) {
        console.error('❌ Newsletter subscription error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Get newsletter subscribers (admin only)
router.get('/subscribers', async (req, res) => {
    try {
        console.log('📧 Fetching newsletter subscribers');
        
        const { data, error } = await supabase
            .from('newsletter_subscribers')
            .select('*')
            .order('subscribed_at', { ascending: false });

        if (error) {
            console.error('❌ Database fetch error:', error);
            throw error;
        }

        console.log('✅ Found subscribers:', data.length);

        res.json({
            success: true,
            data: data
        });

    } catch (error) {
        console.error('❌ Get subscribers error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch subscribers'
        });
    }
});

module.exports = router;
