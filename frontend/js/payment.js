// Payment Handler for Paystack integration
class PaymentHandler {
    constructor() {
    }

    async initializePayment(amount, email) {
        try {
            
            // Validate inputs
            if (!amount || amount < 100) {
                throw new Error('Amount must be at least ₦100');
            }
            
            if (!email || !Utils.validateEmail(email)) {
                throw new Error('Valid email is required');
            }

            // Call backend to initialize payment
            const response = await Utils.apiRequest('/api/wallet/initialize-payment', {
                method: 'POST',
                body: JSON.stringify({ 
                    amount: parseFloat(amount),
                    email: email.trim().toLowerCase()
                })
            });


            if (response.success && response.data) {
                
                // Handle different response types
                if (response.data.authorization_url) {
                    // Redirect to Paystack payment page
                    window.location.href = response.data.authorization_url;
                } else if (response.data.reference) {
                    // Show payment reference
                    Utils.showAlert(`Payment initialized! Reference: ${response.data.reference}`, 'success');
                    
                    // Optionally redirect to payment verification
                    setTimeout(() => {
                        window.location.href = `/payment-verify?reference=${response.data.reference}`;
                    }, 2000);
                } else {
                    Utils.showAlert('Payment initialized successfully!', 'success');
                }
                
                return response.data;
            } else {
                throw new Error(response.error || 'Failed to initialize payment');
            }
        } catch (error) {
            console.error('❌ Payment initialization error:', error);
            Utils.showAlert(error.message, 'error');
            throw error;
        }
    }

    // Fallback method if backend endpoint doesn't exist
    async processDirectPayment(amount, email) {
        try {
            
            // Simple client-side payment simulation
            Utils.showAlert(`Direct payment of ₦${amount} would be processed for ${email}. This is a simulation.`, 'info');
            
            // Simulate API call delay
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            return { 
                success: true, 
                reference: 'DIRECT_' + Date.now(),
                message: 'Payment simulation completed' 
            };
        } catch (error) {
            console.error('Direct payment error:', error);
            throw error;
        }
    }
}

// Make it globally available
window.PaymentHandler = PaymentHandler;
