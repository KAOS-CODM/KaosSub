const getFrontendUrl = () => {
  return process.env.FRONTEND_URL || `http://localhost:${process.env.PORT || 3001}`;
};

const getBackendUrl = () => {
  return process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3001}`;
};

const getApiBaseUrl = () => {
  return process.env.API_BASE_URL || getBackendUrl();
};

// For console logging - shows actual URLs being used
const logServerUrls = (port) => {
  const frontendUrl = getFrontendUrl();
  const backendUrl = getBackendUrl();
  
  console.log(`\n🎉 KaosSub server running on port ${port}`);
  console.log(`🌐 Frontend URL: ${frontendUrl}`);
  console.log(`🔗 Backend URL: ${backendUrl}`);
  console.log(`🔗 API Health: ${backendUrl}/api/health`);
  console.log(`💰 Paystack Test: ${backendUrl}/api/wallet/test-paystack`);
  console.log(`👤 Profile API: ${backendUrl}/api/profile/`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`✨ Pretty URLs enabled - .html extensions removed`);
  console.log(`📝 Test URLs with query parameters:`);
  console.log(`   - ${frontendUrl}/history?tab=transactions`);
  console.log(`   - ${frontendUrl}/history?tab=wallet`);
  console.log(`   - ${frontendUrl}/history?tab=orders`);
};

module.exports = {
  getFrontendUrl,
  getBackendUrl,
  getApiBaseUrl,
  logServerUrls
};
