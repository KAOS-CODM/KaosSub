const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase'); // Fixed import
const emailService = require('../services/emailService');

// Submit contact form
router.post('/submit', async (req, res) => {
    try {
        console.log('📝 Contact form submission:', req.body);
        
        const { name, email, message } = req.body;

        // Validate input
        if (!name || !email || !message) {
            console.log('❌ Missing fields:', { name, email, message });
            return res.status(400).json({
                success: false,
                error: 'All fields are required'
            });
        }

        if (!email.includes('@')) {
            console.log('❌ Invalid email:', email);
            return res.status(400).json({
                success: false,
                error: 'Please provide a valid email address'
            });
        }

        console.log('📝 Saving contact message to database');

        // Save contact message to database
        const { data, error } = await supabase
            .from('contact_messages')
            .insert([
                {
                    name: name,
                    email: email,
                    message: message,
                    submitted_at: new Date().toISOString(),
                    status: 'new'
                }
            ])
            .select();

        if (error) {
            console.error('❌ Database insert error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to submit message'
            });
        }

        console.log('✅ Contact message saved:', data[0].id);

        // Send email notification (optional)
        try {
            console.log('📧 Sending contact notification email');
            await emailService.sendContactNotification({
                name,
                email,
                message,
                submitted_at: new Date().toISOString()
            });
            console.log('✅ Contact notification email sent');
        } catch (emailError) {
            console.error('❌ Failed to send notification email:', emailError);
            // Don't fail the request if email fails
        }

        res.json({
            success: true,
            message: 'Thank you for your message! We will get back to you soon.',
            data: data[0]
        });

    } catch (error) {
        console.error('❌ Contact form error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Get contact messages (admin only)
router.get('/messages', async (req, res) => {
    try {
        console.log('📝 Fetching contact messages');
        
        const { data, error } = await supabase
            .from('contact_messages')
            .select('*')
            .order('submitted_at', { ascending: false });

        if (error) {
            console.error('❌ Database fetch error:', error);
            throw error;
        }

        console.log('✅ Found contact messages:', data.length);

        res.json({
            success: true,
            data: data
        });

    } catch (error) {
        console.error('❌ Get messages error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch messages'
        });
    }
});

module.exports = router;
