const axios = require('axios');
const supabase = require('../config/supabase');
const PAYSTACK_CONFIG = require('../config/paystack');
const ensureProfileExists = require('../utils/profile');
const { successResponse, errorResponse } = require('../utils/response');
const { validateAmount, validateEmail } = require('../utils/validation');

class WalletController {
  // Initialize payment
  async initializePayment(req, res) {
    try {
      const { amount, email, callback_url } = req.body;
      console.log('💰 Payment initialization request:', { amount, email, userId: req.user.id, callback_url });

      // Validate Paystack configuration
      if (!PAYSTACK_CONFIG.isValid()) {
        return errorResponse(res, 'Payment gateway not configured properly', 500);
      }

      // Validate input
      if (!validateAmount(amount)) {
        return errorResponse(res, 'Amount must be at least ₦100');
      }

      if (!validateEmail(email)) {
        return errorResponse(res, 'Valid email is required');
      }

      // Use callback_url from frontend OR construct from referer header
      let finalCallbackUrl;
      if (callback_url) {
        finalCallbackUrl = callback_url;
      } else {
        // Fallback: construct from request referer
        const referer = req.get('Referer') || req.get('Origin');
        if (referer) {
          finalCallbackUrl = `${referer}/payment-verify.html`;
        } else {
          // Last resort fallback
          finalCallbackUrl = `${req.protocol}://${req.get('host')}/payment-verify.html`;
        }
      }

      console.log('🔄 Using callback URL:', finalCallbackUrl);

      // Prepare Paystack payload
      const payload = {
        email: email,
        amount: amount * 100, // Convert to kobo
        currency: 'NGN',
        callback_url: finalCallbackUrl,
        metadata: {
          custom_fields: [
            {
              display_name: "User ID",
              variable_name: "user_id",
              value: req.user.id
            },
            {
              display_name: "Purpose",
              variable_name: "purpose",
              value: "wallet_funding"
            }
          ]
        }
      };

      console.log('📤 Sending to Paystack:', { ...payload, amount: payload.amount + ' kobo' });

      // Make API call to Paystack
      const response = await axios.post(
        `${PAYSTACK_CONFIG.baseUrl}/transaction/initialize`,
        payload,
        {
          headers: PAYSTACK_CONFIG.getHeaders(),
          timeout: 15000
        }
      );

      const paystackData = response.data;
      console.log('✅ Paystack response status:', paystackData.status);

      if (paystackData.status) {
        // Create pending transaction record
        await supabase
          .from('transactions')
          .insert({
            user_id: req.user.id,
            type: 'deposit',
            amount: amount,
            status: 'pending',
            payment_reference: paystackData.data.reference,
            payment_method: 'paystack',
            metadata: paystackData.data
          });

        return successResponse(res, 'Payment initialized successfully', {
          authorization_url: paystackData.data.authorization_url,
          access_code: paystackData.data.access_code,
          reference: paystackData.data.reference
        });
      } else {
        throw new Error(paystackData.message || 'Paystack returned failure status');
      }

    } catch (error) {
      console.error('❌ Payment initialization error:', error);

      let errorMessage = 'Payment initialization failed';

      if (error.response) {
        const paystackError = error.response.data;
        errorMessage = paystackError.message || `Paystack API Error: ${error.response.status}`;
      } else if (error.request) {
        errorMessage = 'Network error: Unable to connect to payment gateway';
      } else {
        errorMessage = error.message;
      }

      return errorResponse(res, errorMessage, 500);
    }
  }

  // Verify Paystack payment - WITH DUPLICATE PROTECTION
  async verifyPayment(req, res) {
    const { reference } = req.params;

    try {
      console.log('🔍 Payment verification request:', { reference, userId: req.user.id });

      if (!PAYSTACK_CONFIG.isValid()) {
        return errorResponse(res, 'Payment gateway not configured properly', 500);
      }

      // ✅ CRITICAL: Check if this transaction was already processed successfully
      const { data: existingTransaction, error: transactionError } = await supabase
        .from('transactions')
        .select('*')
        .eq('payment_reference', reference)
        .eq('user_id', req.user.id)
        .single();

      if (transactionError && transactionError.code !== 'PGRST116') {
        console.error('Error checking existing transaction:', transactionError);
      }

      // If transaction exists and is already successful, return cached result
      if (existingTransaction && existingTransaction.status === 'success') {
        console.log('🔄 Payment already processed successfully, returning cached data');

        // Get current balance to return accurate information
        const { data: profile } = await supabase
          .from('profiles')
          .select('balance')
          .eq('id', req.user.id)
          .single();

        return successResponse(res, 'Payment already verified successfully!', {
          amount: existingTransaction.amount,
          new_balance: profile?.balance || existingTransaction.amount,
          reference: reference,
          already_processed: true
        });
      }

      // Verify payment with Paystack
      const response = await axios.get(
        `${PAYSTACK_CONFIG.baseUrl}/transaction/verify/${reference}`,
        {
          headers: PAYSTACK_CONFIG.getHeaders(),
          timeout: 15000
        }
      );

      const verificationData = response.data;
      console.log('✅ Paystack verification status:', verificationData.status);

      if (verificationData.status && verificationData.data.status === 'success') {
        const amount = verificationData.data.amount / 100; // Convert from kobo to naira

        // Get user profile
        const profile = await ensureProfileExists(req.user.id, req.user.email, req.user.user_metadata);
        if (!profile) {
          return errorResponse(res, 'User profile not found', 500);
        }

        // ✅ Check again for race conditions before processing
        const { data: finalCheck } = await supabase
          .from('transactions')
          .select('status')
          .eq('payment_reference', reference)
          .eq('user_id', req.user.id)
          .single();

        if (finalCheck && finalCheck.status === 'success') {
          console.log('🔄 Race condition detected - payment already processed');
          return successResponse(res, 'Payment verified successfully!', {
            amount: amount,
            new_balance: parseFloat(profile.balance) + amount,
            reference: reference,
            already_processed: true
          });
        }

        // Update transaction status to success
        await supabase
          .from('transactions')
          .update({
            status: 'success',
            metadata: verificationData.data
          })
          .eq('payment_reference', reference)
          .eq('user_id', req.user.id);

        // Update user balance
        const newBalance = parseFloat(profile.balance) + amount;
        await supabase
          .from('profiles')
          .update({ balance: newBalance })
          .eq('id', req.user.id);

        // Create wallet transaction record
        await supabase
          .from('wallet_transactions')
          .insert({
            user_id: req.user.id,
            type: 'credit',
            amount: amount,
            balance_before: parseFloat(profile.balance),
            balance_after: newBalance,
            description: 'Wallet funding via Paystack',
            reference: reference
          });

        return successResponse(res, 'Payment verified successfully! Your wallet has been funded.', {
          amount: amount,
          new_balance: newBalance,
          reference: reference
        });
      } else {
        // Update transaction as failed
        await supabase
          .from('transactions')
          .update({
            status: 'failed',
            metadata: verificationData.data
          })
          .eq('payment_reference', reference)
          .eq('user_id', req.user.id);

        return errorResponse(res, 'Payment verification failed. The transaction was not successful.');
      }

    } catch (error) {
      console.error('❌ Payment verification error:', error);

      let errorMessage = 'Payment verification failed';
      if (error.response) {
        errorMessage = error.response.data?.message || `Paystack Error: ${error.response.status}`;
      } else if (error.request) {
        errorMessage = 'Network error: Unable to connect to payment gateway';
      } else {
        errorMessage = error.message;
      }

      // Update transaction as failed
      await supabase
        .from('transactions')
        .update({ status: 'failed' })
        .eq('payment_reference', reference)
        .eq('user_id', req.user.id);

      return errorResponse(res, errorMessage, 500);
    }
  }

  // Get wallet transactions
  async getWalletTransactions(req, res) {
    try {
      console.log('🔍 Fetching wallet transactions for user:', req.user.id);

      const { data: transactions, error } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', req.user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      console.log('💰 Wallet transactions found:', transactions?.length || 0);
      console.log('📊 Sample transaction:', transactions?.[0]);

      return successResponse(res, 'Wallet transactions retrieved successfully', transactions);

    } catch (error) {
      console.error('Wallet transactions error:', error);
      return errorResponse(res, error.message, 500);
    }
  }

  // Get payment transactions
  async getPaymentTransactions(req, res) {
    try {
      console.log('🔍 Fetching payment transactions for user:', req.user.id);

      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', req.user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      console.log('💳 Payment transactions found:', transactions?.length || 0);
      console.log('📊 Sample transaction:', transactions?.[0]);

      return successResponse(res, 'Payment transactions retrieved successfully', transactions);

    } catch (error) {
      console.error('Payment transactions error:', error);
      return errorResponse(res, error.message, 500);
    }
  }

  // Test Paystack connection
  async testPaystack(req, res) {
    try {
      if (!PAYSTACK_CONFIG.isValid()) {
        return errorResponse(res, 'Paystack not configured properly', 500);
      }

      // Test Paystack connection by listing banks
      const response = await axios.get(
        `${PAYSTACK_CONFIG.baseUrl}/bank`,
        {
          headers: PAYSTACK_CONFIG.getHeaders(),
          timeout: 10000
        }
      );

      return successResponse(res, 'Paystack connection successful', {
        bank_count: response.data.data?.length || 0
      });

    } catch (error) {
      console.error('Paystack test error:', error);
      let errorMessage = 'Paystack test failed';
      if (error.response) {
        errorMessage = error.response.data?.message || `Paystack Error: ${error.response.status}`;
      } else if (error.request) {
        errorMessage = 'Network error: Cannot connect to Paystack';
      }

      return errorResponse(res, errorMessage, 500);
    }
  }
}

module.exports = new WalletController();
