// iSub Variation Codes Management
// This file helps map our internal plan names to iSub variation codes

const variationCodes = {
    'MTN': {
        '100MB': '50',    // MTN 500MB (SME) - N123 30days
        '350MB': '51',    // MTN 1GB (SME) - N240 30days  
        '1GB': '12',      // MTN 1GB (SME) - N240 30days
        '2GB': '13',      // MTN 2GB (SME) - N480 30days
        '5GB': '14',      // MTN 5GB (SME) - N1200 30days
        '10GB': '15'      // MTN 10GB (SME) - N2400 30days
    },
    'Airtel': {
        '100MB': '101',   // Airtel 100MB - N100 7days
        '350MB': '102',   // Airtel 350MB - N200 7days
        '1GB': '103',     // Airtel 1GB - N350 30days
        '2GB': '104',     // Airtel 2GB - N700 30days
        '5GB': '105'      // Airtel 5GB - N1400 30days
    },
    'Glo': {
        '200MB': '201',   // Glo 200MB - N100 3days
        '1GB': '202',     // Glo 1GB - N500 30days
        '2.5GB': '203',   // Glo 2.5GB - N1000 30days
        '5.8GB': '204'    // Glo 5.8GB - N2000 30days
    },
    '9mobile': {
        '150MB': '301',   // 9mobile 150MB - N100 7days
        '600MB': '302',   // 9mobile 600MB - N200 30days
        '1.5GB': '303',   // 9mobile 1.5GB - N500 30days
        '3GB': '304'      // 9mobile 3GB - N1000 30days
    }
};

function getVariationCode(network, planName) {
    const networkPlans = variationCodes[network];
    if (!networkPlans) return null;

    // Try exact match first
    if (networkPlans[planName]) {
        return networkPlans[planName];
    }

    // Try to find the closest match
    const planKeys = Object.keys(networkPlans);
    for (const key of planKeys) {
        if (planName.includes(key) || key.includes(planName)) {
            return networkPlans[key];
        }
    }

    return null;
}

function getAllVariationCodes() {
    return variationCodes;
}

module.exports = {
    getVariationCode,
    getAllVariationCodes,
    variationCodes
};
