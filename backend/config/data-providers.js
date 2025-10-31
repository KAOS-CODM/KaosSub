// Data Providers Configuration
require('dotenv').config();

const DATA_PROVIDERS = {
    // iSub Configuration
    isub: {
        name: 'iSub',
        baseUrl: 'https://isub.com.ng',
        apiKey: process.env.ISUB_API_KEY,
        enabled: process.env.ISUB_API_KEY && process.env.ISUB_API_KEY !== 'your_isub_api_key_here' && process.env.ISUB_API_KEY.length > 10,
        demoMode: false,
        
        // Endpoints
        endpoints: {
            purchase: '/buydata_api'
        },
        
        // Network mappings (01=MTN, 02=Glo, 03=Airtel, 04=9mobile)
        networks: {
            'MTN': '01',
            'Glo': '02', 
            'Airtel': '03',
            '9mobile': '04'
        },
        
        // Data type (default to SME)
        dataType: 'SME'
    },
    
    // Demo provider (for testing)
    demo: {
        name: 'Demo Provider',
        enabled: true, // Always available as fallback
        demoMode: true
    }
};

// Get active provider
function getActiveProvider() {
    console.log('🔧 Checking data providers:');
    console.log('   - DEMO_MODE:', process.env.DEMO_MODE);
    console.log('   - iSub enabled:', DATA_PROVIDERS.isub.enabled);
    console.log('   - Demo enabled:', DATA_PROVIDERS.demo.enabled);
    
    // If DEMO_MODE is explicitly set to true, use demo provider
    if (process.env.DEMO_MODE === 'true') {
        console.log('🎭 DEMO_MODE=true - Using Demo Provider');
        return DATA_PROVIDERS.demo;
    }
    
    // Otherwise, use iSub if enabled
    if (DATA_PROVIDERS.isub.enabled) {
        console.log('✅ Using iSub Provider');
        return DATA_PROVIDERS.isub;
    }
    
    // Fallback to demo
    console.log('🎭 Using Demo Provider (fallback)');
    return DATA_PROVIDERS.demo;
}

module.exports = {
    DATA_PROVIDERS,
    getActiveProvider
};
