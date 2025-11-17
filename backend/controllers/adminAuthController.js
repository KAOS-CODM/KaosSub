const supabase = require('../config/supabase');
const otpService = require('../services/otpService');
const { successResponse, errorResponse } = require('../utils/response');
const ensureProfileExists = require('../utils/profile');
const { createClient } = require('@supabase/supabase-js');

// ✅ STANDALONE FUNCTION (outside the class)
function getAdminClient() {
    try {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        
        if (!supabaseUrl || !supabaseServiceKey) {
            console.error('❌ SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set in environment variables');
            throw new Error('Service role key not configured');
        }

        console.log('🔐 Using service role client to bypass RLS');
        return createClient(supabaseUrl, supabaseServiceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });
    } catch (error) {
        console.error('❌ Failed to create admin client:', error);
        throw error;
    }
}

class AdminAuthController {
    // ✅ REMOVED: getAdminClient method from class (now using standalone function)

    // Request OTP for admin login
    async requestAdminOTP(req, res) {
        try {
            const userId = req.user.id;

            console.log(`🔐 Admin OTP request from user: ${userId}`);

            // Check if user is admin using role from middleware
            if (req.user.role !== 'admin') {
                return errorResponse(res, 'Access denied. Admin privileges required.', 403);
            }

            // Get user profile for email
            const profile = await ensureProfileExists(userId, req.user.email, req.user.user_metadata);
            if (!profile) {
                return errorResponse(res, 'User profile not found', 500);
            }

            // Clean up expired OTPs first
            await otpService.cleanupExpiredOTPs();

            // Create and send OTP
            const otpResult = await otpService.createAdminOTP(
                userId,
                profile.email,
                profile.full_name || 'Admin'
            );

            if (otpResult.success) {
                const message = otpResult.demo_mode
                    ? `Demo: OTP sent to your console: ${otpResult.otp_id}`
                    : 'OTP sent to your email successfully';

                return successResponse(res, message, {
                    otp_id: otpResult.otp_id,
                    expires_at: otpResult.expires_at,
                    demo_mode: otpResult.demo_mode
                });
            } else {
                return errorResponse(res, 'Failed to send OTP');
            }

        } catch (error) {
            console.error('❌ Admin OTP request failed:', error);
            return errorResponse(res, error.message, 500);
        }
    }

    // Verify OTP and create admin session
    async verifyAdminOTP(req, res) {
        try {
            const { otp_code } = req.body;
            const userId = req.user.id;

            console.log(`🔐 Admin OTP verification for user: ${userId}`);

            if (!otp_code) {
                return errorResponse(res, 'OTP code is required');
            }

            // Check if user is admin using role from middleware
            if (req.user.role !== 'admin') {
                return errorResponse(res, 'Access denied. Admin privileges required.', 403);
            }

            // Verify OTP
            const otpResult = await otpService.verifyOTP(userId, otp_code);

            if (otpResult.success) {
                // Create admin session
                const adminSession = {
                    user_id: userId,
                    is_admin: true,
                    authenticated_at: new Date().toISOString(),
                    session_expires: new Date(Date.now() + 8 * 60 * 60 * 1000) // 8 hours
                };

                return successResponse(res, 'Admin login successful', {
                    session: adminSession,
                    user: {
                        id: req.user.id,
                        email: req.user.email,
                        full_name: req.user.user_metadata?.full_name
                    }
                });
            } else {
                return errorResponse(res, otpResult.error);
            }

        } catch (error) {
            console.error('❌ Admin OTP verification failed:', error);
            return errorResponse(res, error.message, 500);
        }
    }

    // Check admin status
    async checkAdminStatus(req, res) {
        try {
            const userId = req.user.id;

            // Use role from middleware instead of database check
            const isAdmin = req.user.role === 'admin';
            const profile = await ensureProfileExists(userId, req.user.email, req.user.user_metadata);

            return successResponse(res, 'Admin status checked', {
                is_admin: isAdmin,
                user: {
                    id: req.user.id,
                    email: req.user.email,
                    full_name: profile?.full_name,
                    role: req.user.role // Use role from middleware
                }
            });

        } catch (error) {
            console.error('❌ Admin status check failed:', error);
            return errorResponse(res, error.message, 500);
        }
    }

    // Get admin dashboard stats
    async getAdminStats(req, res) {
        try {
            console.log('🧪 DEBUG: ===== STARTING ADMIN STATS DEBUG =====');
            console.log('🧪 DEBUG: Current user:', { id: req.user.id, email: req.user.email, role: req.user.role });

            // Check if user is admin using role from middleware
            if (req.user.role !== 'admin') {
                return errorResponse(res, 'Access denied. Admin privileges required.', 403);
            }

            // TEST 1: Direct count queries
            console.log('🧪 DEBUG: --- Testing Direct Count Queries ---');

            console.log('🧪 DEBUG: Testing profiles count...');
            const totalUsers = await this.getTotalUsers();
            console.log('🧪 DEBUG: Total users:', totalUsers);

            console.log('🧪 DEBUG: Testing orders count...');
            const totalOrders = await this.getTotalOrders();
            console.log('🧪 DEBUG: Total orders:', totalOrders);

            // TEST 2: Get actual data to see what's returned
            console.log('🧪 DEBUG: --- Testing Data Retrieval ---');

            console.log('🧪 DEBUG: Testing profiles data (first 5)...');
            const adminSupabase = getAdminClient(); // ✅ UPDATED
            const { data: profilesData, error: profilesError } = await adminSupabase
                .from('profiles')
                .select('id, email, role')
                .limit(5);
            console.log('🧪 DEBUG: Profiles data count:', profilesData?.length);
            if (profilesData) {
                profilesData.forEach(profile => {
                    console.log('🧪 DEBUG:   -', profile.email, `(${profile.role})`);
                });
            }

            console.log('🧪 DEBUG: Testing orders data (first 5)...');
            const { data: ordersData, error: ordersError } = await adminSupabase
                .from('orders')
                .select('id, user_id, amount_paid, status, profiles(email)')
                .limit(5);
            console.log('🧪 DEBUG: Orders data count:', ordersData?.length);
            if (ordersData) {
                ordersData.forEach(order => {
                    console.log('🧪 DEBUG:   - Order:', order.id, 'User:', order.profiles?.email, 'Amount:', order.amount_paid);
                });
            }

            // TEST 3: Call helper functions
            console.log('🧪 DEBUG: --- Testing Helper Functions ---');

            console.log('🧪 DEBUG: getTotalUsers result:', totalUsers);
            console.log('🧪 DEBUG: getTotalOrders result:', totalOrders);

            const recentOrders = await this.getRecentOrders();
            console.log('🧪 DEBUG: getRecentOrders count:', recentOrders?.length);

            const stats = {
                total_users: totalUsers,
                total_orders: totalOrders,
                total_revenue: await this.getTotalRevenue(),
                recent_orders: recentOrders,
                updated_at: new Date().toISOString()
            };

            console.log('🧪 DEBUG: ===== FINAL STATS =====');
            console.log('🧪 DEBUG:', stats);
            console.log('🧪 DEBUG: ===== END DEBUG =====');

            return successResponse(res, 'Admin stats retrieved', stats);

        } catch (error) {
            console.error('❌ Admin stats retrieval failed:', error);
            return errorResponse(res, error.message, 500);
        }
    }

    // Get user statistics
    async getUserStats(req, res) {
        try {
            // Check if user is admin using role from middleware
            if (req.user.role !== 'admin') {
                return errorResponse(res, 'Access denied. Admin privileges required.', 403);
            }

            const totalUsers = await this.getTotalUsers();
            const activeUsers = await this.getActiveUsers();
            const newUsersToday = await this.getNewUsersToday();
            const newUsersThisWeek = await this.getNewUsersThisWeek();

            const stats = {
                total_users: totalUsers,
                active_users: activeUsers,
                new_users_today: newUsersToday,
                new_users_this_week: newUsersThisWeek,
                updated_at: new Date().toISOString()
            };

            console.log('✅ User stats retrieved:', stats);
            return successResponse(res, 'User stats retrieved', stats);

        } catch (error) {
            console.error('❌ User stats retrieval failed:', error);
            return errorResponse(res, error.message, 500);
        }
    }

    // Get all users - UPDATED WITH SERVICE ROLE
    async getAllUsers(req, res) {
        try {
            console.log('🔐 Checking if user is admin...');
            console.log('🔍 Current user ID:', req.user.id, 'Role:', req.user.role);

            // Check if user is admin using role from middleware
            if (req.user.role !== 'admin') {
                console.log('❌ User is not admin, access denied');
                return errorResponse(res, 'Access denied. Admin privileges required.', 403);
            }

            console.log('🔍 Fetching all users from database using SERVICE ROLE CLIENT...');
            
            // Use service role client to bypass RLS
            const adminSupabase = getAdminClient(); // ✅ UPDATED
            const { data: users, error } = await adminSupabase
                .from('profiles')
                .select(`
                    id,
                    email,
                    full_name,
                    phone_number,
                    balance,
                    role,
                    created_at,
                    updated_at,
                    preferences
                `)
                .order('created_at', { ascending: false });

            console.log('📊 Database query result:', {
                usersCount: users?.length,
                error: error?.message
            });

            if (error) {
                console.error('❌ Supabase error:', error);
                throw new Error(error.message);
            }

            console.log(`✅ Retrieved ${users?.length || 0} users from database`);

            if (users && users.length > 0) {
                console.log('👥 First few users found:');
                users.slice(0, 3).forEach(user => {
                    console.log(`   - ${user.email} (${user.role})`);
                });
                if (users.length > 3) {
                    console.log(`   ... and ${users.length - 3} more users`);
                }
            } else {
                console.log('❌ No users found in database');
            }

            return successResponse(res, 'Users retrieved successfully', { users });

        } catch (error) {
            console.error('❌ Get all users failed:', error);
            return errorResponse(res, error.message, 500);
        }
    }

    // Get all orders - UPDATED WITH SERVICE ROLE
    async getAllOrders(req, res) {
        try {
            // Check if user is admin using role from middleware
            if (req.user.role !== 'admin') {
                return errorResponse(res, 'Access denied. Admin privileges required.', 403);
            }

            console.log('🔍 Fetching ALL orders from database using SERVICE ROLE CLIENT...');

            const adminSupabase = getAdminClient(); // ✅ UPDATED
            const { data: orders, error } = await adminSupabase
                .from('orders')
                .select(`
                    *,
                    profiles(email, full_name),
                    networks(name),
                    data_plans(name)
                `)
                .order('created_at', { ascending: false });

            if (error) {
                throw new Error(error.message);
            }

            console.log(`✅ Retrieved ${orders?.length || 0} orders from ALL users`);
            
            if (orders && orders.length > 0) {
                console.log('📦 Orders breakdown by user:');
                const userOrders = {};
                orders.forEach(order => {
                    const email = order.profiles?.email || 'Unknown';
                    userOrders[email] = (userOrders[email] || 0) + 1;
                });
                
                Object.entries(userOrders).forEach(([email, count]) => {
                    console.log(`   - ${email}: ${count} orders`);
                });
            }

            return successResponse(res, 'Orders retrieved successfully', { orders });

        } catch (error) {
            console.error('❌ Get all orders failed:', error);
            return errorResponse(res, error.message, 500);
        }
    }

    // Enhanced getSystemSettings method
    async getSystemSettings(req, res) {
        try {
            // Check if user is admin using role from middleware
            if (req.user.role !== 'admin') {
                return errorResponse(res, 'Access denied. Admin privileges required.', 403);
            }

            console.log('⚙️ Fetching system settings...');
        
            const adminSupabase = getAdminClient(); // ✅ UPDATED
            const { data: settings, error } = await adminSupabase
                .from('admin_settings')
                .select('*')
                .order('category')
                .order('setting_key');

            if (error) {
                console.error('❌ Error fetching settings:', error);
                return errorResponse(res, 'Failed to fetch system settings', 500);
            }

            // Transform settings into a more usable format
            const settingsObj = {};
            const settingsByCategory = {};

            settings.forEach(setting => {
                // Convert value based on type
                let value = setting.setting_value;
                switch (setting.setting_type) {
                    case 'boolean':
                        value = value === 'true';
                        break;
                    case 'number':
                        value = parseFloat(value);
                        break;
                    case 'json':
                        try {
                            value = JSON.parse(value);
                        } catch (e) {
                            value = {};
                        }
                        break;
                    // string remains as is
                }

                settingsObj[setting.setting_key] = value;
                
                // Group by category
                if (!settingsByCategory[setting.category]) {
                    settingsByCategory[setting.category] = [];
                }
                settingsByCategory[setting.category].push({
                    ...setting,
                    parsed_value: value
                });
            });

            const result = {
                settings: settingsObj,
                settings_by_category: settingsByCategory,
                raw_settings: settings,
                updated_at: new Date().toISOString()
            };

            console.log('✅ System settings retrieved successfully');
            return successResponse(res, 'System settings retrieved', result);

        } catch (error) {
            console.error('❌ Get system settings failed:', error);
            return errorResponse(res, error.message, 500);
        }
    }

    // Update user role
    async updateUserRole(req, res) {
        try {
            const { id } = req.params;
            const { role } = req.body;

            // Check if user is admin using role from middleware
            if (req.user.role !== 'admin') {
                return errorResponse(res, 'Access denied. Admin privileges required.', 403);
            }

            if (!role) {
                return errorResponse(res, 'Role is required');
            }

            // Update user role using service role client
            const adminSupabase = getAdminClient(); // ✅ UPDATED
            const { data, error } = await adminSupabase
                .from('profiles')
                .update({ role })
                .eq('id', id)
                .select();

            if (error) {
                throw new Error(error.message);
            }

            if (!data || data.length === 0) {
                return errorResponse(res, 'User not found', 404);
            }

            console.log(`✅ Updated user ${id} role to: ${role}`);
            return successResponse(res, 'User role updated successfully', { user: data[0] });

        } catch (error) {
            console.error('❌ Update user role failed:', error);
            return errorResponse(res, error.message, 500);
        }
    }

    // Update order status
    async updateOrderStatus(req, res) {
        try {
            const { id } = req.params;
            const { status } = req.body;

            // Check if user is admin using role from middleware
            if (req.user.role !== 'admin') {
                return errorResponse(res, 'Access denied. Admin privileges required.', 403);
            }

            if (!status) {
                return errorResponse(res, 'Status is required');
            }

            // Valid statuses
            const validStatuses = ['pending', 'processing', 'success', 'failed', 'cancelled'];
            if (!validStatuses.includes(status)) {
                return errorResponse(res, `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
            }

            // Update order status using service role client
            const adminSupabase = getAdminClient(); // ✅ UPDATED
            const { data, error } = await adminSupabase
                .from('orders')
                .update({
                    status,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .select(`
                    *,
                    profiles(email, full_name),
                    networks(name),
                    data_plans(name)
                `);

            if (error) {
                throw new Error(error.message);
            }

            if (!data || data.length === 0) {
                return errorResponse(res, 'Order not found', 404);
            }

            console.log(`✅ Updated order ${id} status to: ${status}`);
            return successResponse(res, 'Order status updated successfully', { order: data[0] });

        } catch (error) {
            console.error('❌ Update order status failed:', error);
            return errorResponse(res, error.message, 500);
        }
    }

    // Enhanced updateSystemSettings method
    async updateSystemSettings(req, res) {
        try {
            const { settings } = req.body;

            // Check if user is admin using role from middleware
            if (req.user.role !== 'admin') {
                return errorResponse(res, 'Access denied. Admin privileges required.', 403);
            }

            if (!settings || typeof settings !== 'object') {
                return errorResponse(res, 'Settings object is required');
            }

            console.log('⚙️ Updating system settings:', Object.keys(settings));

            const adminSupabase = getAdminClient(); // ✅ UPDATED
            const updates = [];
            const updatedSettings = {};

            // Prepare updates for each setting
            for (const [key, value] of Object.entries(settings)) {
                let stringValue;
                
                // Convert value to string based on type
                if (typeof value === 'boolean') {
                    stringValue = value.toString();
                } else if (typeof value === 'object') {
                    stringValue = JSON.stringify(value);
                } else {
                    stringValue = value.toString();
                }

                updates.push(
                    adminSupabase
                        .from('admin_settings')
                        .update({
                            setting_value: stringValue,
                            updated_at: new Date().toISOString()
                        })
                        .eq('setting_key', key)
                );

                updatedSettings[key] = value;
            }

            // Execute all updates
            const results = await Promise.all(updates);
            const errorCount = results.filter(result => result.error).length;

            if (errorCount > 0) {
                console.error(`❌ Failed to update ${errorCount} settings`);
                return errorResponse(res, `Failed to update ${errorCount} settings`, 500);
            }

            console.log(`✅ Updated ${updates.length - errorCount} settings successfully`);

            return successResponse(res, 'System settings updated successfully', {
                updated_settings: updatedSettings,
                total_updated: updates.length - errorCount,
                failed_updates: errorCount,
                updated_at: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ Update system settings failed:', error);
            return errorResponse(res, error.message, 500);
        }
    }

    // Reset settings to defaults
    async resetSystemSettings(req, res) {
        try {
            // Check if user is admin using role from middleware
            if (req.user.role !== 'admin') {
                return errorResponse(res, 'Access denied. Admin privileges required.', 403);
            }

            console.log('🔄 Resetting system settings to defaults...');

            const adminSupabase = getAdminClient(); // ✅ UPDATED
        
            // Define default settings
            const defaultSettings = {
                'site_name': 'KaosSub',
                'support_email': 'support@kaossub.com',
                'currency': 'NGN',
                'maintenance_mode': 'false',
                'registration_enabled': 'true',
                'max_orders_per_user': '10',
                'default_user_balance': '0',
                'profit_margin': '10',
                'auto_approve_orders': 'true',
                'enable_email_notifications': 'true',
                'enable_sms_notifications': 'false',
                'low_balance_threshold': '1000',
                'session_timeout': '24'
            };

            // Reset all settings to defaults
            const updates = [];
            for (const [key, value] of Object.entries(defaultSettings)) {
                updates.push(
                    adminSupabase
                        .from('admin_settings')
                        .update({
                            setting_value: value,
                            updated_at: new Date().toISOString()
                        })
                        .eq('setting_key', key)
                );
            }

            const results = await Promise.all(updates);
            const errorCount = results.filter(result => result.error).length;

            if (errorCount > 0) {
                console.error(`❌ Failed to reset ${errorCount} settings`);
                return errorResponse(res, `Failed to reset ${errorCount} settings`, 500);
            }

            console.log('✅ System settings reset to defaults');
            return successResponse(res, 'System settings reset to defaults successfully', {
                reset_at: new Date().toISOString(),
                total_reset: updates.length - errorCount,
                failed_resets: errorCount
            });

        } catch (error) {
            console.error('❌ Reset system settings failed:', error);
            return errorResponse(res, error.message, 500);
        }
    }

    // Helper methods for user stats - UPDATED WITH SERVICE ROLE
    async getActiveUsers() {
        // Define what "active" means - maybe users who logged in last 30 days?
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const adminSupabase = getAdminClient(); // ✅ UPDATED
        const { count, error } = await adminSupabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .gte('last_login', thirtyDaysAgo.toISOString());

        return error ? 0 : count;
    }

    async getNewUsersToday() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const adminSupabase = getAdminClient(); // ✅ UPDATED
        const { count, error } = await adminSupabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', today.toISOString());

        return error ? 0 : count;
    }

    async getNewUsersThisWeek() {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const adminSupabase = getAdminClient(); // ✅ UPDATED
        const { count, error } = await adminSupabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', oneWeekAgo.toISOString());

        return error ? 0 : count;
    }

    // Helper methods for stats - UPDATED WITH SERVICE ROLE
    async getTotalUsers() {
        const adminSupabase = getAdminClient(); // ✅ UPDATED
        const { count, error } = await adminSupabase
            .from('profiles')
            .select('*', { count: 'exact', head: true });

        console.log(`👥 Total users count: ${count} (error: ${error?.message})`);
        return error ? 0 : count;
    }

    async getTotalOrders() {
        const adminSupabase = getAdminClient(); // ✅ UPDATED
        const { count, error } = await adminSupabase
            .from('orders')
            .select('*', { count: 'exact', head: true });

        console.log(`📦 Total orders count: ${count} (error: ${error?.message})`);
        return error ? 0 : count;
    }

    async getTotalRevenue() {
        const adminSupabase = getAdminClient(); // ✅ UPDATED
        const { data, error } = await adminSupabase
            .from('orders')
            .select('amount_paid, status, profiles(email)')
            .eq('status', 'success');

        if (error) {
            console.error('❌ Error fetching revenue:', error);
            return 0;
        }

        const total = data.reduce((sum, order) => sum + parseFloat(order.amount_paid), 0);
        console.log(`💰 Total revenue: ${total} from ${data.length} successful orders`);
        return total;
    }

    async getRecentOrders() {
        const adminSupabase = getAdminClient(); // ✅ UPDATED
        const { data, error } = await adminSupabase
            .from('orders')
            .select(`
                *,
                profiles(email, full_name),
                networks(name),
                data_plans(name)
            `)
            .order('created_at', { ascending: false })
            .limit(10);

        return error ? [] : data;
    }

    // Data plans statistics
    async getDataPlansStats(req, res) {
        try {
            // Check if user is admin using role from middleware
            if (req.user.role !== 'admin') {
                return errorResponse(res, 'Access denied. Admin privileges required.', 403);
            }

            const adminSupabase = getAdminClient(); // ✅ UPDATED
            const { data: plans, error } = await adminSupabase
                .from('data_plans')
                .select(`
                    id, name, price, is_active, vtu_variation_id,
                    networks!inner (id, name)
                `)
                .eq('is_active', true);

            if (error) throw error;

            // Calculate statistics
            const totalPlans = plans.length;
            const mappedPlans = plans.filter(p => p.vtu_variation_id).length;
            const unmappedPlans = totalPlans - mappedPlans;
            const activePlans = plans.filter(p => p.is_active).length;

            // Network breakdown
            const networkBreakdown = {};
            plans.forEach(plan => {
                const networkName = plan.networks.name;
                if (!networkBreakdown[networkName]) {
                    networkBreakdown[networkName] = {
                        network_name: networkName,
                        total_plans: 0,
                        mapped_plans: 0,
                        unmapped_plans: 0
                    };
                }

                networkBreakdown[networkName].total_plans++;
                if (plan.vtu_variation_id) {
                    networkBreakdown[networkName].mapped_plans++;
                } else {
                    networkBreakdown[networkName].unmapped_plans++;
                }
            });

            // Calculate percentages
            Object.values(networkBreakdown).forEach(network => {
                network.mapping_percentage = Math.round(
                    (network.mapped_plans / network.total_plans) * 100
                );
            });

            // Price range
            const prices = plans.map(p => parseFloat(p.price)).filter(p => !isNaN(p));
            const priceRange = {
                lowest: prices.length > 0 ? Math.min(...prices) : 0,
                highest: prices.length > 0 ? Math.max(...prices) : 0,
                average: prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0
            };

            const stats = {
                total_plans: totalPlans,
                mapped_plans: mappedPlans,
                unmapped_plans: unmappedPlans,
                active_plans: activePlans,
                network_breakdown: Object.values(networkBreakdown),
                price_range: priceRange,
                updated_at: new Date().toISOString()
            };

            return successResponse(res, 'Data plans statistics retrieved', stats);

        } catch (error) {
            console.error('❌ Data plans stats failed:', error);
            return errorResponse(res, error.message, 500);
        }
    }

    // Apply profit margin to data plans
    async applyProfitMargin(req, res) {
        try {
            // Check if user is admin using role from middleware
            if (req.user.role !== 'admin') {
                return errorResponse(res, 'Access denied. Admin privileges required.', 403);
            }

            const { margin_percentage, network_id } = req.body;

            if (!margin_percentage || margin_percentage < 0) {
                return errorResponse(res, 'Valid margin percentage is required');
            }

            // Build query
            const adminSupabase = getAdminClient(); // ✅ UPDATED
            let query = adminSupabase
                .from('data_plans')
                .select('id, price')
                .eq('is_active', true);

            if (network_id) {
                query = query.eq('network_id', network_id);
            }

            const { data: plans, error } = await query;
            if (error) throw error;

            if (plans.length === 0) {
                return errorResponse(res, 'No plans found to update');
            }

            // Update prices with margin
            const updates = plans.map(plan => {
                const currentPrice = parseFloat(plan.price);
                const newPrice = currentPrice * (1 + margin_percentage / 100);
                return adminSupabase
                    .from('data_plans')
                    .update({
                        price: Math.round(newPrice * 100) / 100, // Round to 2 decimal places
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', plan.id);
            });

            // Execute all updates
            const results = await Promise.all(updates);
            const errorCount = results.filter(result => result.error).length;
            if (errorCount > 0) {
                console.error(`Failed to update ${errorCount} plans`);
            }

            return successResponse(res, 'Profit margin applied successfully', {
                updated_plans: plans.length - errorCount,
                total_plans: plans.length,
                failed_updates: errorCount,
                margin_percentage: margin_percentage
            });

        } catch (error) {
            console.error('❌ Apply profit margin failed:', error);
            return errorResponse(res, error.message, 500);
        }
    }

     // ✅ CORRECTED: Delete user and all associated data based on your actual schema
async deleteUser(req, res) {
    try {
        const { id } = req.params;

        // Check if user is admin using role from middleware
        if (req.user.role !== 'admin') {
            return errorResponse(res, 'Access denied. Admin privileges required.', 403);
        }

        // Prevent admin from deleting themselves
        if (id === req.user.id) {
            return errorResponse(res, 'You cannot delete your own account.', 400);
        }

        console.log(`🗑️ Deleting user ${id} and all associated data...`);

        const adminSupabase = getAdminClient();

        // ✅ UPDATED: Based on your actual foreign key relationships
        const tablesToDeleteFrom = [
            'admin_otp_attempts',
            'admin_otps', 
            'wallet_transactions',
            'transactions',
            'orders',
            'profiles' // This should be last since it's the parent table
        ];

        let deletedRecords = 0;
        const deletionResults = {};

        // Delete from each table in order (respecting foreign key constraints)
        for (const table of tablesToDeleteFrom) {
            try {
                console.log(`🗑️ Deleting from ${table} for user ${id}...`);
                
                let query;
                if (table === 'profiles') {
                    // ✅ Profiles table uses 'id' column, not 'user_id'
                    query = adminSupabase
                        .from(table)
                        .delete()
                        .eq('id', id)
                        .select();
                } else {
                    // All other tables use 'user_id' column
                    query = adminSupabase
                        .from(table)
                        .delete()
                        .eq('user_id', id)
                        .select();
                }

                const { data, error } = await query;

                if (error) {
                    console.error(`❌ Error deleting from ${table}:`, error);
                    deletionResults[table] = { success: false, error: error.message };
                } else {
                    const deletedCount = data ? data.length : 0;
                    deletedRecords += deletedCount;
                    deletionResults[table] = { 
                        success: true, 
                        deleted_count: deletedCount 
                    };
                    console.log(`✅ Deleted ${deletedCount} records from ${table}`);
                }
            } catch (tableError) {
                console.error(`❌ Failed to delete from ${table}:`, tableError);
                deletionResults[table] = { success: false, error: tableError.message };
            }
        }

        console.log(`✅ User deletion completed. Total records deleted: ${deletedRecords}`);
        
        return successResponse(res, 'User and all associated data deleted successfully', {
            user_id: id,
            total_records_deleted: deletedRecords,
            deletion_results: deletionResults,
            deleted_at: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Delete user failed:', error);
        return errorResponse(res, error.message, 500);
    }
}
    // Add single data plan
    async addSinglePlan(req, res) {
        try {
            // Check if user is admin using role from middleware
            if (req.user.role !== 'admin') {
                return errorResponse(res, 'Access denied. Admin privileges required.', 403);
            }

            const { network_id, data_type, name, price, data_volume, validity } = req.body;

            // Validate required fields
            if (!network_id || !name || !price) {
                return errorResponse(res, 'Network, name, and price are required');
            }

            const adminSupabase = getAdminClient(); // ✅ UPDATED

            // Get data type ID
            const { data: dataType, error: typeError } = await adminSupabase
                .from('data_types')
                .select('id')
                .eq('name', data_type)
                .single();

            if (typeError) {
                // Create data type if it doesn't exist
                const { data: newType, error: createError } = await adminSupabase
                    .from('data_types')
                    .insert([{ name: data_type }])
                    .select()
                    .single();

                if (createError) throw createError;
                var data_type_id = newType.id;
            } else {
                var data_type_id = dataType.id;
            }

            // Insert the new plan
            const { data: newPlan, error } = await adminSupabase
                .from('data_plans')
                .insert([{
                    network_id: network_id,
                    data_type_id: data_type_id,
                    name: name,
                    price: parseFloat(price),
                    data_volume: data_volume,
                    validity: validity || '30 days',
                    is_active: true
                }])
                .select()
                .single();

            if (error) throw error;

            return successResponse(res, 'Plan added successfully', { plan: newPlan });

        } catch (error) {
            console.error('❌ Add single plan failed:', error);
            return errorResponse(res, error.message, 500);
        }
    }

    // Add bulk data plans
    async addBulkPlans(req, res) {
        try {
            // Check if user is admin using role from middleware
            if (req.user.role !== 'admin') {
                return errorResponse(res, 'Access denied. Admin privileges required.', 403);
            }

            const { network_id, data_type, plans } = req.body;

            if (!network_id || !plans || !Array.isArray(plans)) {
                return errorResponse(res, 'Network and plans array are required');
            }

            const adminSupabase = getAdminClient(); // ✅ UPDATED

            // Get data type ID
            const { data: dataType, error: typeError } = await adminSupabase
                .from('data_types')
                .select('id')
                .eq('name', data_type)
                .single();

            if (typeError) {
                // Create data type if it doesn't exist
                const { data: newType, error: createError } = await adminSupabase
                    .from('data_types')
                    .insert([{ name: data_type }])
                    .select()
                    .single();

                if (createError) throw createError;
                var data_type_id = newType.id;
            } else {
                var data_type_id = dataType.id;
            }

            // Prepare plans for insertion
            const plansToInsert = plans.map(plan => ({
                network_id: network_id,
                data_type_id: data_type_id,
                name: plan.name,
                price: parseFloat(plan.price),
                data_volume: plan.data_volume,
                validity: plan.validity || '30 days',
                is_active: true
            }));

            // Insert all plans
            const { data: newPlans, error } = await adminSupabase
                .from('data_plans')
                .insert(plansToInsert)
                .select();

            if (error) throw error;

            return successResponse(res, 'Bulk plans added successfully', {
                added_plans: newPlans.length,
                plans: newPlans
            });

        } catch (error) {
            console.error('❌ Add bulk plans failed:', error);
            return errorResponse(res, error.message, 500);
        }
    }
}

module.exports = new AdminAuthController();
