const supabase = require('../config/supabase');

const authenticateToken = async (req, res, next) => {
    console.log('🔐 [AUTH] Checking authentication...');
    
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

        // NEW: Get user's role from profiles table
        console.log('🔐 [AUTH] Fetching user role from profiles...');
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (profileError) {
            console.error('❌ [AUTH] Failed to fetch user profile:', profileError);
            req.user = user;
            req.user.role = 'user'; // Default role
        } else {
            console.log('✅ [AUTH] User role:', profile.role);
            req.user = {
                ...user,
                role: profile.role
            };
        }

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
