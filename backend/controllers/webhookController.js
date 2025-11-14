const crypto = require('crypto');

const WebhookController = {
    // Verify and process VTU.ng webhook
    async handleVTUWebhook(req, res) {
        try {
            const payload = JSON.stringify(req.body);
            const signature = req.headers['x-signature'];
            const userPin = process.env.VTU_USER_PIN;

            console.log('📨 Received VTU.ng webhook:', req.body);

            // Verify signature
            const isValid = this.verifyWebhookSignature(payload, signature, userPin);
            
            if (!isValid) {
                console.error('❌ Invalid webhook signature');
                return res.status(403).json({ error: 'Invalid signature' });
            }

            const webhookData = req.body;
            
            // Process the webhook based on status
            await this.processWebhook(webhookData);

            // Always return 200 to acknowledge receipt
            res.status(200).json({ status: 'success', message: 'Webhook processed' });

        } catch (error) {
            console.error('❌ Webhook processing error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Verify HMAC-SHA256 signature
    verifyWebhookSignature(payload, signature, userPin) {
        try {
            const computedSignature = crypto
                .createHmac('sha256', userPin)
                .update(payload)
                .digest('hex');

            return crypto.timingSafeEqual(
                Buffer.from(signature, 'hex'),
                Buffer.from(computedSignature, 'hex')
            );
        } catch (error) {
            console.error('Signature verification error:', error);
            return false;
        }
    },

    // Process webhook data
    async processWebhook(webhookData) {
        const { order_id, status, request_id, product_name, phone, amount_charged } = webhookData;

        console.log(`🔄 Processing webhook: Order ${order_id}, Status: ${status}`);

        try {
            // Update order status in your database
            if (status === 'completed-api') {
                console.log(`✅ Order ${order_id} completed successfully`);
                // Update your order status to 'success'
                await this.updateOrderStatus(request_id, 'success', {
                    vtuOrderId: order_id,
                    finalAmount: amount_charged
                });
                
            } else if (status === 'refunded') {
                console.log(`💸 Order ${order_id} refunded`);
                // Update your order status to 'refunded'
                await this.updateOrderStatus(request_id, 'refunded', {
                    vtuOrderId: order_id,
                    refundAmount: amount_charged
                });
            }

        } catch (error) {
            console.error('❌ Error processing webhook:', error);
            throw error;
        }
    },

    // Update order status in your database
    async updateOrderStatus(requestId, status, metadata = {}) {
        // Extract user ID from request ID (kaos_userId_timestamp)
        const userId = requestId.split('_')[1];
        
        // Update your order in the database
        // This depends on your database structure
        console.log(`📊 Updating order ${requestId} to status: ${status}`);
        
        // Example: Update order in Supabase
        const { data, error } = await supabase
            .from('orders')
            .update({ 
                status: status,
                updated_at: new Date().toISOString(),
                metadata: metadata
            })
            .eq('request_id', requestId); // You'll need to store request_id in your orders table

        if (error) {
            throw new Error(`Database update failed: ${error.message}`);
        }

        console.log(`✅ Order ${requestId} updated to ${status}`);
    }
};

module.exports = WebhookController;
