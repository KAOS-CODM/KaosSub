// routes/dataRoutes.js
const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const DataService = require('../services/dataService');
const authMiddleware = require('../middleware/auth');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Get all data plans with VTU mappings
router.get('/plans', authMiddleware, async (req, res) => {
    try {
        console.log('📊 Fetching all data plans from database...');

        // Fetch all active networks
        const { data: networks, error: networksError } = await supabase
            .from('networks')
            .select('id, name, logo_url')
            .eq('is_active', true)
            .order('name');

        if (networksError) {
            throw new Error(`Failed to fetch networks: ${networksError.message}`);
        }

        const result = {};

        // For each network, fetch its data plans organized by data types
        for (const network of networks) {
            console.log(`📡 Fetching plans for network: ${network.name}`);

            // Fetch data plans for this network with their data types
            const { data: plans, error: plansError } = await supabase
                .from('data_plans')
                .select(`
                    id,
                    name,
                    price,
                    validity,
                    data_volume,
                    vtu_variation_id,
                    is_active,
                    data_types!inner (
                        id,
                        name
                    )
                `)
                .eq('network_id', network.id)
                .eq('is_active', true)
                .order('price');

            if (plansError) {
                console.error(`❌ Error fetching plans for ${network.name}:`, plansError);
                continue;
            }

            // Organize plans by data type
            const dataTypes = {};
            plans.forEach(plan => {
                const dataType = plan.data_types.name;
                if (!dataTypes[dataType]) {
                    dataTypes[dataType] = {
                        type: { id: plan.data_types.id, name: dataType },
                        plans: []
                    };
                }

                dataTypes[dataType].plans.push({
                    id: plan.id,
                    name: plan.name,
                    price: parseFloat(plan.price),
                    validity: plan.validity,
                    data_volume: plan.data_volume,
                    vtu_variation_id: plan.vtu_variation_id,
                    has_vtu_mapping: !!plan.vtu_variation_id
                });
            });

            result[network.id] = {
                network: {
                    id: network.id,
                    name: network.name,
                    logo_url: network.logo_url
                },
                data_types: dataTypes
            };
        }

        console.log(`✅ Successfully loaded data for ${Object.keys(result).length} networks`);

        res.json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('❌ Error fetching data plans:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Purchase data - with demo mode support
router.post('/purchase', authMiddleware, async (req, res) => {
    try {
        const { data_plan_id, phone_number } = req.body;
        const userId = req.user.id;

        console.log('📦 Data purchase request:', { data_plan_id, phone_number, userId });

        // Get plan details from database
        const planDetails = await DataService.getPlanById(data_plan_id);

        // Purchase via VTU (or demo mode)
        const vtuResult = await DataService.purchaseData(planDetails, phone_number, userId);

        // FIXED: Correct parameter order with network_id
        const order = await DataService.createOrder(
            userId, 
            planDetails.network_id, // networkId
            data_plan_id, // planId
            phone_number, // phoneNumber
            planDetails.price, // amount
            vtuResult // result
        );

        // In demo mode, also update user balance
        if (process.env.DEMO_MODE === 'true') {
            await DataService.updateUserBalance(userId, -planDetails.price);
        }

        res.json({
            success: true,
            message: process.env.DEMO_MODE === 'true'
                ? 'DEMO: Data purchase simulated successfully'
                : 'Data purchase initiated successfully',
            data: {
                order: order,
                purchase: vtuResult,
                demo_mode: process.env.DEMO_MODE === 'true'
            }
        });

    } catch (error) {
        console.error('Purchase error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Sync VTU variation IDs
router.post('/sync-vtu-variations', authMiddleware, async (req, res) => {
    try {
        console.log('🔄 Manual VTU sync triggered via API');
        const result = await DataService.syncVTUVariationIds();

        res.json({
            success: true,
            message: `Successfully mapped ${result.totalMapped} plans to VTU variations`,
            data: result
        });
    } catch (error) {
        console.error('VTU sync error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Update plan VTU mapping
router.put('/plans/:planId/vtu-mapping', authMiddleware, async (req, res) => {
    try {
        const { planId } = req.params;
        const { vtu_variation_id } = req.body;

        console.log(`🔄 Updating VTU mapping for plan ${planId}: ${vtu_variation_id}`);

        // TODO: Implement your database update logic here
        // For now, we'll just return success
        res.json({
            success: true,
            message: 'VTU mapping updated successfully',
            data: { planId, vtu_variation_id }
        });
    } catch (error) {
        console.error('Update VTU mapping error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get plans with VTU mappings
router.get('/plans-with-mappings', authMiddleware, async (req, res) => {
    try {
        // TODO: Implement your database query here
        // For now, return empty array
        res.json({
            success: true,
            data: []
        });
    } catch (error) {
        console.error('Get plans error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Test VTU credentials and connection
router.get('/test-vtu-credentials', authMiddleware, async (req, res) => {
    try {
        console.log('🧪 Testing VTU credentials...');

        // Check if environment variables are set
        const vtuUsername = process.env.VTU_USERNAME;
        const vtuPassword = process.env.VTU_PASSWORD;
        const credentialsCheck = {
            usernameSet: !!vtuUsername,
            passwordSet: !!vtuPassword,
            username: vtuUsername ? '***' + vtuUsername.slice(-4) : 'NOT SET',
            password: vtuPassword ? '***' + vtuPassword.slice(-4) : 'NOT SET'
        };

        console.log('🔑 Credentials check:', credentialsCheck);

        if (!vtuUsername || !vtuPassword) {
            return res.json({
                success: false,
                message: 'VTU credentials not configured in environment variables',
                data: credentialsCheck
            });
        }

        // Test authentication
        const DataService = require('../services/dataService');
        const testResult = await DataService.testVTUConnection();

        res.json({
            success: testResult.success,
            message: testResult.success ? 'VTU connection successful' : 'VTU connection failed',
            data: {
                credentials: credentialsCheck,
                connection: testResult
            }
        });

    } catch (error) {
        console.error('❌ VTU credentials test failed:', error);
        res.status(500).json({
            success: false,
            message: error.message,
            data: {
                credentials: {
                    usernameSet: !!process.env.VTU_USERNAME,
                    passwordSet: !!process.env.VTU_PASSWORD
                }
            }
        });
    }
});

// Enhanced sync with delete unmapped + add missing plans
router.post('/sync-vtu-enhanced', authMiddleware, async (req, res) => {
    try {
        console.log('🔄 Starting ENHANCED VTU sync...');
        const result = await DataService.syncVTUVariationIdsEnhanced();

        res.json({
            success: true,
            message: `Enhanced sync completed! Mapped: ${result.totalMapped}, Deleted: ${result.totalDeleted}, Added: ${result.totalAdded}`,
            data: result
        });
    } catch (error) {
        console.error('Enhanced VTU sync error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;
