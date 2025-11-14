const supabase = require('../config/supabase');

const authenticateToken = async (req, res, next) => {
    console.log('🔐 [AUTH] Checking authentication...');
    console.log('🔐 [AUTH] Headers:', req.headers);
    
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    console.log('🔐 [AUTH] Token found:', token ? 'Yes' : 'No');
    
    if (!token) {
        console.log('❌ [AUTH] No token provided');
        return res.status(401).json({ 
            success: false,
            error: 'Access token required' 
        });
    }

    try {
        console.log('🔐 [AUTH] Verifying token...');
        const { data: { user }, error } = await supabase.auth.getUser(token);
        
        if (error || !user) {
            console.error('❌ [AUTH] Token invalid:', error?.message);
            return res.status(403).json({ 
                success: false,
                error: 'Invalid token',
                details: error?.message
            });
        }

        console.log('✅ [AUTH] Token valid for user:', user.id, user.email);
        req.user = user;
        next();
    } catch (error) {
        console.error('💥 [AUTH] Exception:', error);
        res.status(500).json({ 
            success: false,
            error: 'Server error during authentication'
        });
    }
};

module.exports = authenticateToken;
