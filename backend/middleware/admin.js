const supabase = require('../config/supabase');

// Basic admin check (role-based)
const adminAuth = async (req, res, next) => {
    try {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', req.user.id)
            .single();

        if (error || !profile || profile.role !== 'admin') {
            return res.status(403).json({ 
                success: false,
                error: 'Admin access required' 
            });
        }

        // In a real implementation, you would check for a valid admin session/token here
        // For now, we'll just check the role
        
        next();
    } catch (error) {
        res.status(403).json({ 
            success: false,
            error: 'Admin access required' 
        });
    }
};

// Enhanced admin check with session validation (for future implementation)
const adminSessionAuth = async (req, res, next) => {
    try {
        // Check basic admin role first
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', req.user.id)
            .single();

        if (error || !profile || profile.role !== 'admin') {
            return res.status(403).json({ 
                success: false,
                error: 'Admin access required' 
            });
        }

        // TODO: Implement session validation here
        // Check for valid admin session token or recent OTP verification
        
        next();
    } catch (error) {
        res.status(403).json({ 
            success: false,
            error: 'Admin session invalid' 
        });
    }
};

module.exports = adminAuth;
