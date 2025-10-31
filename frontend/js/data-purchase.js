// Data purchase functionality for KaosSub
class DataPurchase {
    constructor() {
        this.currentPlan = null;
    }

    // Purchase data bundle - UPDATED FOR HYBRID SYSTEM
    async purchaseData(planId, networkName, planName, price, phoneNumber) {
        try {

            // Get network ID from name
            const networkId = this.getNetworkId(networkName);
            if (!networkId) {
                throw new Error('Invalid network selected');
            }

            const response = await Utils.apiRequest('/api/data/purchase', {
                method: 'POST',
                body: JSON.stringify({
                    network_id: networkId,
                    data_plan_id: planId,
                    phone_number: phoneNumber
                })
            });

            // Handle new response format from hybrid system
            if (response && response.success) {
                return response;
            } else {
                throw new Error(response.message || 'Purchase failed');
            }

        } catch (error) {
            console.error('Data purchase error:', error);
            throw error;
        }
    }

    // Get provider status - UPDATED FOR HYBRID SYSTEM
    async getProviderStatus() {
        try {
            const response = await Utils.apiRequest('/api/data/provider-status');
            
            // Handle new provider status format
            if (response && response.data) {
                return response.data;
            }
            return response;
        } catch (error) {
            console.error('Provider status error:', error);
            throw error;
        }
    }

    // Get purchase history
    async getPurchaseHistory() {
        try {
            const response = await Utils.apiRequest('/api/data/purchase-history');
            return response;
        } catch (error) {
            console.error('Purchase history error:', error);
            throw error;
        }
    }

    // Helper function to get network ID
    getNetworkId(networkName) {
        // This should match your data structure
        const networkMap = {
            'MTN': '1',
            'Airtel': '2',
            'Glo': '3',
            '9mobile': '4'
        };
        return networkMap[networkName];
    }

    // Format purchase result for display - UPDATED FOR HYBRID SYSTEM
    formatPurchaseResult(result) {
        // Handle both old and new response formats
        const details = result.details || result;
        
        return {
            success: result.success,
            message: result.message || details.message,
            reference: result.reference || details.reference_no,
            provider: result.provider || 'iSub', // Default to iSub for backward compatibility
            amount: Utils.formatCurrency(details.amount || result.amount_paid),
            network: details.network || result.network,
            plan: details.dataplan || result.plan_name,
            date: Utils.formatDate(details.transaction_date || result.created_at)
        };
    }

    // New method to handle the hybrid system response
    handlePurchaseResponse(response) {
        if (!response) {
            throw new Error('No response from server');
        }

        if (!response.success) {
            throw new Error(response.message || 'Purchase failed');
        }

        // Return formatted response for UI
        return this.formatPurchaseResult(response);
    }
}

// Make available globally
window.DataPurchase = DataPurchase;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Check if DataPurchase needs to be instantiated
    if (typeof window.dataPurchase === 'undefined') {
        window.dataPurchase = new DataPurchase();
    }
});
