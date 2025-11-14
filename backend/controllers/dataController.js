const supabase = require('../config/supabase');
const dataService = require('../services/dataService');
const { successResponse, errorResponse } = require('../utils/response');
const { validatePhone } = require('../utils/validation');
const ensureProfileExists = require('../utils/profile');

class DataController {
  // Get available data plans
  async getDataPlans(req, res) {
    try {
      const { data: plans, error } = await supabase
        .from('data_plans')
        .select(`
          *,
          networks (id, name, logo_url),
          data_types (id, name)
        `)
        .eq('is_active', true)
        .order('price', { ascending: true });

      if (error) throw error;

      // Group by network and data type
      const groupedPlans = {};
      plans.forEach(plan => {
        const networkId = plan.network_id;
        const dataTypeId = plan.data_type_id;

        if (!groupedPlans[networkId]) {
          groupedPlans[networkId] = {
            network: plan.networks,
            data_types: {}
          };
        }

        if (!groupedPlans[networkId].data_types[dataTypeId]) {
          groupedPlans[networkId].data_types[dataTypeId] = {
            type: plan.data_types,
            plans: []
          };
        }

        groupedPlans[networkId].data_types[dataTypeId].plans.push(plan);
      });

      return successResponse(res, 'Data plans retrieved successfully', groupedPlans);

    } catch (error) {
      console.error('Data plans error:', error);
      return errorResponse(res, error.message, 500);
    }
  }

  // Purchase data bundle
  async purchaseData(req, res) {
    const { network_id, data_plan_id, phone_number } = req.body;

    try {
      console.log('🛒 Data purchase request:', { network_id, data_plan_id, phone_number, userId: req.user.id });

      // Validate input
      if (!network_id || !data_plan_id || !phone_number) {
        return errorResponse(res, 'Missing required fields');
      }

      if (!validatePhone(phone_number)) {
        return errorResponse(res, 'Phone number must be 11 digits');
      }

      // Get user profile
      const profile = await ensureProfileExists(req.user.id, req.user.email, req.user.user_metadata);
      if (!profile) {
        return errorResponse(res, 'User profile not found', 500);
      }

      // Get data plan details
      const { data: dataPlan, error: planError } = await supabase
        .from('data_plans')
        .select('*, networks(name), data_types(id)')
        .eq('id', data_plan_id)
        .single();

      if (planError) throw planError;

      // Check if user has sufficient balance
      if (profile.balance < dataPlan.price) {
        return errorResponse(res, 'Insufficient balance');
      }

      // Format phone number (just clean it, don't use validatePhoneNumber which returns boolean)
      const formattedPhone = phone_number.replace(/\D/g, '');

      // Create order record
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: req.user.id,
          network_id: network_id,
          data_plan_id: data_plan_id,
          phone_number: formattedPhone,
          amount_paid: dataPlan.price,
          status: 'processing'
        })
        .select()
        .single();

      if (orderError) {
        console.error('Order creation error:', orderError);
        return errorResponse(res, 'Failed to create order', 500);
      }

      console.log(`📝 Order created: ${order.id}`);

      try {
        // Create planDetails object for dataService
        const planDetails = {
          id: dataPlan.id,
          name: dataPlan.name,
          price: dataPlan.price,
          network: dataPlan.networks.name,
          network_id: network_id
        };

        // Attempt to purchase data from provider
        const purchaseResult = await dataService.purchaseData(
          planDetails,
          formattedPhone,  // Use the formatted phone number string
          req.user.id
        );

        console.log('✅ Data purchase successful:', purchaseResult);

        // Update order with successful result - NEW FORMAT
        await supabase
          .from('orders')
          .update({
            iSub_response: purchaseResult.details,
            iSub_reference: purchaseResult.reference,
            status: purchaseResult.success ? 'success' : 'failed',
            updated_at: new Date().toISOString()
          })
          .eq('id', order.id);

        // If successful, deduct from user's balance and create transactions
        if (purchaseResult.success === true || purchaseResult.success === "true") {
          // Update user balance
          const newBalance = profile.balance - dataPlan.price;
          await supabase
            .from('profiles')
            .update({ balance: newBalance })
            .eq('id', req.user.id);

          // Create wallet transaction
          await supabase
            .from('wallet_transactions')
            .insert({
              user_id: req.user.id,
              type: 'debit',
              amount: dataPlan.price,
              balance_before: profile.balance,
              balance_after: newBalance,
              description: `Data purchase: ${dataPlan.name} for ${formattedPhone}`,
              reference: purchaseResult.reference
            });

          // Create transaction record
          await supabase
            .from('transactions')
            .insert({
              user_id: req.user.id,
              type: 'purchase',
              amount: dataPlan.price,
              status: 'success',
              payment_reference: purchaseResult.reference,
              metadata: purchaseResult
            });

          console.log('💰 Balance updated and transactions recorded');

          return successResponse(res, purchaseResult.message || 'Data purchase completed successfully', {
            order_id: order.id,
            ...purchaseResult
          });
        } else {
          throw new Error(purchaseResult.message || 'Data purchase failed');
        }

      } catch (purchaseError) {
        console.error('❌ Data purchase failed:', purchaseError);

        // Update order as failed
        await supabase
          .from('orders')
          .update({
            status: 'failed',
            iSub_response: { error: purchaseError.message },
            updated_at: new Date().toISOString()
          })
          .eq('id', order.id);

        return errorResponse(res, purchaseError.message);
      }

    } catch (error) {
      console.error('Purchase error:', error);
      return errorResponse(res, error.message, 500);
    }
  }

  // Get provider status and balance
  async getProviderStatus(req, res) {
    try {
      // Use the actual provider status from dataService
      const providerStatus = await dataService.getProviderStatus();
      
      return successResponse(res, 'Provider status retrieved', providerStatus);

    } catch (error) {
      console.error('Provider status error:', error);
      return errorResponse(res, error.message, 500);
    }
  }

  // Get user's purchase history
  async getPurchaseHistory(req, res) {
    try {
      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          *,
          networks (name),
          data_plans (name, price, validity)
        `)
        .eq('user_id', req.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return successResponse(res, 'Purchase history retrieved successfully', orders);

    } catch (error) {
      console.error('Purchase history error:', error);
      return errorResponse(res, error.message, 500);
    }
  }
}

module.exports = new DataController();
