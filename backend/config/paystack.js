const PAYSTACK_CONFIG = {
  secretKey: process.env.PAYSTACK_SECRET_KEY,
  publicKey: process.env.PAYSTACK_PUBLIC_KEY,
  baseUrl: 'https://api.paystack.co',
  
  isValid: function() {
    return this.secretKey && 
           this.secretKey.startsWith('sk_') && 
           !this.secretKey.includes('your_paystack_secret_key');
  },
  
  getHeaders: function() {
    return {
      'Authorization': `Bearer ${this.secretKey}`,
      'Content-Type': 'application/json'
    };
  }
};

console.log('💰 Paystack Configuration:');
console.log('   - Valid:', PAYSTACK_CONFIG.isValid() ? '✅ YES' : '❌ NO');

module.exports = PAYSTACK_CONFIG;
