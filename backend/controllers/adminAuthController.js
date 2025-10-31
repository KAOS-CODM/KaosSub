const supabase = require('../config/supabase');
const otpService = require('../services/otpService');
const { successResponse, errorResponse } = require('../utils/response');
const ensureProfileExists = require('../utils/profile');

class AdminAuthController {
    // Request OTP for admin login
    async requestAdminOTP(req, res) {
        try {
            const userId = req.user.id;

            console.log(`🔐 Admin OTP request from user: ${userId}`);

            // Check if user is admin
            const isAdmin = await otpService.isUserAdmin(userId);
            if (!isAdmin) {
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

            // Check if user is admin
            const isAdmin = await otpService.isUserAdmin(userId);
            if (!isAdmin) {
                return errorResponse(res, 'Access denied. Admin privileges required.', 403);
            }

            // Verify OTP
            const otpResult = await otpService.verifyOTP(userId, otp_code);

            if (otpResult.success) {
                // Create admin session (you can implement JWT tokens or session management here)
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

            const isAdmin = await otpService.isUserAdmin(userId);
            const profile = await ensureProfileExists(userId, req.user.email, req.user.user_metadata);

            return successResponse(res, 'Admin status checked', {
                is_admin: isAdmin,
                user: {
                    id: req.user.id,
                    email: req.user.email,
                    full_name: profile?.full_name,
                    role: profile?.role
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
            // Check if user is admin
            const isAdmin = await otpService.isUserAdmin(req.user.id);
            if (!isAdmin) {
                return errorResponse(res, 'Access denied. Admin privileges required.', 403);
            }

            // Get various stats
            const totalUsers = await this.getTotalUsers();
            const totalOrders = await this.getTotalOrders();
            const totalRevenue = await this.getTotalRevenue();
            const recentOrders = await this.getRecentOrders();

            const stats = {
                total_users: totalUsers,
                total_orders: totalOrders,
                total_revenue: totalRevenue,
                recent_orders: recentOrders,
                updated_at: new Date().toISOString()
            };

            console.log('✅ Admin stats retrieved:', stats);
            return successResponse(res, 'Admin stats retrieved', stats);

        } catch (error) {
            console.error('❌ Admin stats retrieval failed:', error);
            return errorResponse(res, error.message, 500);
        }
    }
    
   // Get user statistics
    async getUserStats(req, res) {
        try {
            // Check if user is admin
            const isAdmin = await otpService.isUserAdmin(req.user.id);
            if (!isAdmin) {
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

    // Get all users
    async getAllUsers(req, res) {
        try {
            // Check if user is admin
            const isAdmin = await otpService.isUserAdmin(req.user.id);
            if (!isAdmin) {
                return errorResponse(res, 'Access denied. Admin privileges required.', 403);
            }

            const { data: users, error } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                throw new Error(error.message);
            }

            console.log(`✅ Retrieved ${users?.length || 0} users`);
            return successResponse(res, 'Users retrieved successfully', { users });

        } catch (error) {
            console.error('❌ Get all users failed:', error);
            return errorResponse(res, error.message, 500);
        }
    }

    // Get all orders
    async getAllOrders(req, res) {
        try {
            // Check if user is admin
            const isAdmin = await otpService.isUserAdmin(req.user.id);
            if (!isAdmin) {
                return errorResponse(res, 'Access denied. Admin privileges required.', 403);
            }

            const { data: orders, error } = await supabase
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

            console.log(`✅ Retrieved ${orders?.length || 0} orders`);
            return successResponse(res, 'Orders retrieved successfully', { orders });

        } catch (error) {
            console.error('❌ Get all orders failed:', error);
            return errorResponse(res, error.message, 500);
        }
    }

    // Get system settings
    async getSystemSettings(req, res) {
        try {
            // Check if user is admin
            const isAdmin = await otpService.isUserAdmin(req.user.id);
            if (!isAdmin) {
                return errorResponse(res, 'Access denied. Admin privileges required.', 403);
            }

            // You might want to create a system_settings table for this
            // For now, return some default settings
            const settings = {
                site_name: "KaosSub",
                maintenance_mode: false,
                registration_enabled: true,
                max_orders_per_user: 10,
                currency: "NGN",
                updated_at: new Date().toISOString()
            };

            console.log('✅ System settings retrieved');
            return successResponse(res, 'System settings retrieved', { settings });

        } catch (error) {
            console.error('❌ Get system settings failed:', error);
            return errorResponse(res, error.message, 500);
        }
    }

    // Helper methods for user stats
    async getActiveUsers() {
        // Define what "active" means - maybe users who logged in last 30 days?
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const { count, error } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .gte('last_login', thirtyDaysAgo.toISOString());

        return error ? 0 : count;
    }

    async getNewUsersToday() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const { count, error } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', today.toISOString());

        return error ? 0 : count;
    }

    async getNewUsersThisWeek() {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        
        const { count, error } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', oneWeekAgo.toISOString());

        return error ? 0 : count;
    }

    // Helper methods for stats
    async getTotalUsers() {
        const { count, error } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true });

        return error ? 0 : count;
    }

    async getTotalOrders() {
        const { count, error } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true });

        return error ? 0 : count;
    }

    async getTotalRevenue() {
        const { data, error } = await supabase
            .from('orders')
            .select('amount_paid')
            .eq('status', 'success');

        if (error) return 0;

        return data.reduce((sum, order) => sum + parseFloat(order.amount_paid), 0);
    }

    async getRecentOrders() {
        const { data, error } = await supabase
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

    // Add these methods to your existing AdminAuthController class

// Update user role
async updateUserRole(req, res) {
    try {
        const { id } = req.params;
        const { role } = req.body;

        // Check if user is admin
        const isAdmin = await otpService.isUserAdmin(req.user.id);
        if (!isAdmin) {
            return errorResponse(res, 'Access denied. Admin privileges required.', 403);
        }

        if (!role) {
            return errorResponse(res, 'Role is required');
        }

        // Update user role
        const { data, error } = await supabase
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

        // Check if user is admin
        const isAdmin = await otpService.isUserAdmin(req.user.id);
        if (!isAdmin) {
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

        // Update order status
        const { data, error } = await supabase
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

// Update system settings
async updateSystemSettings(req, res) {
    try {
        const { settings } = req.body;

        // Check if user is admin
        const isAdmin = await otpService.isUserAdmin(req.user.id);
        if (!isAdmin) {
            return errorResponse(res, 'Access denied. Admin privileges required.', 403);
        }

        if (!settings) {
            return errorResponse(res, 'Settings are required');
        }

        // For now, just return success since we don't have a settings table
        // You can implement actual settings storage later
        console.log('✅ System settings updated:', settings);
        return successResponse(res, 'System settings updated successfully', { 
            settings: {
                ...settings,
                updated_at: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('❌ Update system settings failed:', error);
        return errorResponse(res, error.message, 500);
    }
}

// Get data plans statistics
async getDataPlansStats(req, res) {
    try {
        const { data: plans, error } = await supabase
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
        const { margin_percentage, network_id } = req.body;

        if (!margin_percentage || margin_percentage < 0) {
            return errorResponse(res, 'Valid margin percentage is required');
        }

        // Build query
        let query = supabase
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
            
            return supabase
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

// Add single data plan
async addSinglePlan(req, res) {
    try {
        const { network_id, data_type, name, price, data_volume, validity } = req.body;

        // Validate required fields
        if (!network_id || !name || !price) {
            return errorResponse(res, 'Network, name, and price are required');
        }

        // Get data type ID
        const { data: dataType, error: typeError } = await supabase
            .from('data_types')
            .select('id')
            .eq('name', data_type)
            .single();

        if (typeError) {
            // Create data type if it doesn't exist
            const { data: newType, error: createError } = await supabase
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
        const { data: newPlan, error } = await supabase
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
        const { network_id, data_type, plans } = req.body;

        if (!network_id || !plans || !Array.isArray(plans)) {
            return errorResponse(res, 'Network and plans array are required');
        }

        // Get data type ID
        const { data: dataType, error: typeError } = await supabase
            .from('data_types')
            .select('id')
            .eq('name', data_type)
            .single();

        if (typeError) {
            // Create data type if it doesn't exist
            const { data: newType, error: createError } = await supabase
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
        const { data: newPlans, error } = await supabase
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
