// services/dataService.js
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DataService = {
  async purchaseData(planDetails, phoneNumber, userId) {
    try {
      console.log('🛒 Data purchase request:', {
        data_plan_id: planDetails.id,
        phone_number: phoneNumber,
        userId: userId
      });

      // DEMO MODE: Simulate purchase if API access not available
      if (process.env.DEMO_MODE === 'true') {
        console.log('🎮 DEMO MODE: Simulating VTU purchase');
        
        // Simulate successful purchase
        const requestId = `kaos_${userId}_${Date.now()}`;
        
        const demoResult = {
          success: true,
          reference: `demo_${requestId}`,
          message: 'DEMO: Data purchase simulated successfully',
          network: planDetails.network,
          phoneNumber: phoneNumber,
          plan: planDetails.name,
          amount: parseFloat(planDetails.price),
          status: 'success',
          orderId: Math.floor(Math.random() * 1000000),
          requestId: requestId
        };

        console.log('✅ DEMO: Purchase simulation completed:', demoResult);
        return demoResult;
      }

      // Get VTU token first
      const token = await this.getVTUToken();

      // Purchase via VTU.ng
      console.log('🛒 Purchasing data via VTU.ng:', `${planDetails.name} for ${phoneNumber}`);
      const result = await this.purchaseFromVTU(planDetails, phoneNumber, userId, token);

      return {
        success: true,
        message: 'Data purchase successful',
        reference: result.reference,
        provider: 'VTU.ng',
        details: result
      };

    } catch (error) {
      console.error('❌ Data purchase failed:', error);
      
      // Return error result instead of throwing
      return {
        success: false,
        message: error.message,
        reference: `error_${Date.now()}`,
        error: error.message
      };
    }
  },

  // Get VTU.ng authentication token
  async getVTUToken() {
    try {
      const vtuConfig = {
        baseUrl: 'https://vtu.ng/wp-json',
        username: process.env.VTU_USERNAME,
        password: process.env.VTU_PASSWORD
      };

      console.log('🔐 Authenticating with VTU.ng...');
      console.log('   - Username:', vtuConfig.username ? '***' + vtuConfig.username.slice(-4) : 'NOT SET');
      console.log('   - Password:', vtuConfig.password ? '***' + vtuConfig.password.slice(-4) : 'NOT SET');

      if (!vtuConfig.username || !vtuConfig.password) {
        throw new Error('VTU.ng credentials not configured. Set VTU_USERNAME and VTU_PASSWORD in environment variables.');
      }

      const response = await fetch(`${vtuConfig.baseUrl}/jwt-auth/v1/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: vtuConfig.username,
          password: vtuConfig.password
        })
      });

      console.log('📥 VTU.ng auth response status:', response.status);
      const data = await response.json();
      console.log('📥 VTU.ng auth response data:', data);

      if (!response.ok) {
        // Extract clean error message
        let errorMessage = data.message || `VTU.ng auth failed: ${response.status}`;
        // Remove HTML tags from error message
        errorMessage = errorMessage.replace(/<[^>]*>/g, '').trim();
        throw new Error(errorMessage);
      }

      if (data.token) {
        console.log('✅ VTU.ng token obtained successfully');
        return data.token;
      } else {
        throw new Error(data.message || 'VTU.ng authentication failed - no token received');
      }

    } catch (error) {
      console.error('❌ VTU.ng token error:', error.message);
      throw error;
    }
  },

  async purchaseFromVTU(planDetails, phoneNumber, userId, token) {
    try {
      // DEMO MODE: Simulate purchase if API access not available
      if (process.env.DEMO_MODE === 'true') {
        console.log('🎮 DEMO MODE: Simulating VTU purchase');
        
        // Simulate successful purchase
        const requestId = `kaos_${userId}_${Date.now()}`;

        return {
          success: true,
          reference: `demo_${requestId}`,
          message: 'DEMO: Data purchase simulated successfully',
          network: planDetails.network,
          phoneNumber: phoneNumber,
          plan: planDetails.name,
          amount: parseFloat(planDetails.price),
          status: 'completed',
          orderId: Math.floor(Math.random() * 1000000),
          requestId: requestId
        };
      }

      const vtuConfig = {
        baseUrl: 'https://vtu.ng/wp-json/api/v2'
      };

      console.log('🔧 VTU.ng Data Purchase Details:');
      console.log('   - Phone:', phoneNumber);
      console.log('   - Plan:', planDetails.name);
      console.log('   - Network:', planDetails.network);

      // Map your networks to VTU service_id
      const networkMap = {
        'mtn': 'mtn',
        'glo': 'glo',
        'airtel': 'airtel',
        '9mobile': '9mobile',
        'etisalat': '9mobile'
      };

      const serviceId = networkMap[planDetails.network?.toLowerCase()];

      if (!serviceId) {
        throw new Error(`Unsupported network: ${planDetails.network}. Supported: mtn, glo, airtel, 9mobile`);
      }

      // Get VTU variation ID for the plan
      const variationId = await this.getVTUVariationId(serviceId, planDetails, token);
      if (!variationId) {
        throw new Error(`No VTU variation found for plan: ${planDetails.name} (${planDetails.network}). Please sync variation IDs.`);
      }

      // Generate unique request ID
      const requestId = `kaos_${userId}_${Date.now()}`;

      const requestBody = {
        request_id: requestId,
        phone: phoneNumber,
        service_id: serviceId,
        variation_id: variationId
      };

      console.log('📤 Sending to VTU.ng:', requestBody);

      const response = await fetch(`${vtuConfig.baseUrl}/data`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      const responseData = await response.json();
      console.log('📥 VTU.ng response:', responseData);

      if (!response.ok) {
        throw new Error(responseData.message || `VTU.ng API error: ${response.status}`);
      }

      if (responseData.code === 'order_placed_successfully' || responseData.code === 'success') {
        console.log('✅ VTU.ng purchase successful');
        return {
          success: true,
          reference: responseData.data?.order_id?.toString() || requestId,
          message: responseData.message,
          network: responseData.data?.service_name || planDetails.network,
          phoneNumber: responseData.data?.phone || phoneNumber,
          plan: responseData.data?.data_plan || planDetails.name,
          amount: parseFloat(responseData.data?.amount_charged || planDetails.price),
          status: responseData.data?.status || 'processing',
          orderId: responseData.data?.order_id,
          requestId: requestId
        };
      } else {
        throw new Error(responseData.message || 'VTU.ng purchase failed');
      }

    } catch (error) {
      console.error('❌ VTU.ng purchase error:', error);
      throw error;
    }
  },

  // Helper to get VTU variation ID with better matching
  async getVTUVariationId(serviceId, planDetails, token) {
    try {
      // First, check if we already have a mapped variation ID
      if (planDetails.vtu_variation_id) {
        console.log(`✅ Using pre-mapped VTU variation: ${planDetails.vtu_variation_id}`);
        return planDetails.vtu_variation_id;
      }

      // If not, fetch and find matching variation
      const variations = await this.fetchVTUVariations(serviceId, token);

      // Find the best matching variation
      const variation = this.findBestMatchingVariation(variations, planDetails);

      if (variation) {
        console.log(`✅ Found VTU variation: ${variation.variation_id} for "${planDetails.name}"`);
        
        // Update database with found variation for future use
        await this.updatePlanVTUMapping(planDetails.id, variation.variation_id);

        return variation.variation_id;
      } else {
        console.log('❌ No matching VTU variation found. Available variations:');
        variations.forEach(v => {
          if (v.availability === 'Available') {
            console.log(`   - ${v.data_plan} (${v.variation_id}) - ₦${v.price}`);
          }
        });
        return null;
      }
    } catch (error) {
      console.error('Error finding variation:', error);
      return null;
    }
  },

  // IMPROVED: Better variation matching logic
  findBestMatchingVariation(variations, planDetails) {
    const availableVariations = variations.filter(v => v.availability === 'Available');

    console.log(`🔍 Matching: "${planDetails.name}" (₦${planDetails.price})`);
    console.log(`   Available VTU variations: ${availableVariations.length}`);

    // Strategy 1: Exact name match
    let variation = availableVariations.find(v => {
      const match = v.data_plan.toLowerCase().trim() === planDetails.name.toLowerCase().trim();
      if (match) console.log(`   ✅ Exact match: "${v.data_plan}"`);
      return match;
    });

    if (variation) return variation;

    // Strategy 2: Extract and match data volumes
    variation = availableVariations.find(v => {
      const ourVolume = this.extractDataVolume(planDetails.name);
      const vtuVolume = this.extractDataVolume(v.data_plan);
      const priceMatch = Math.abs(parseFloat(v.price) - parseFloat(planDetails.price)) < 50;

      if (ourVolume && vtuVolume && ourVolume === vtuVolume && priceMatch) {
        console.log(`   ✅ Volume match: "${v.data_plan}" (${vtuVolume}MB) vs "${planDetails.name}" (${ourVolume}MB)`);
        return true;
      }
      return false;
    });

    if (variation) return variation;

    // Strategy 3: Smart name matching with common patterns
    variation = availableVariations.find(v => {
      const ourName = this.normalizePlanName(planDetails.name);
      const vtuName = this.normalizePlanName(v.data_plan);

      // Check if they're similar (same data amount and similar type)
      const similarity = this.calculateNameSimilarity(ourName, vtuName);
      const priceMatch = Math.abs(parseFloat(v.price) - parseFloat(planDetails.price)) < 100;

      if (similarity > 0.7 && priceMatch) {
        console.log(`   ✅ Similarity match: "${v.data_plan}" (similarity: ${similarity})`);
        return true;
      }
      return false;
    });

    if (variation) return variation;

    // Strategy 4: Manual mapping for common patterns
    variation = this.manualPlanMapping(planDetails, availableVariations);
    if (variation) return variation;

    // Strategy 5: Fallback - closest price match with similar volume
    variation = availableVariations.find(v => {
      const ourVolume = this.extractDataVolume(planDetails.name);
      const vtuVolume = this.extractDataVolume(v.data_plan);
      const priceDiff = Math.abs(parseFloat(v.price) - parseFloat(planDetails.price));

      return ourVolume && vtuVolume &&
        Math.abs(ourVolume - vtuVolume) < 500 && // Within 500MB
        priceDiff < 200; // Within ₦200
    });

    if (variation) {
      console.log(`   ⚠️  Fallback match: "${variation.data_plan}"`);
      return variation;
    }

    console.log(`   ❌ No match found for "${planDetails.name}"`);
    return null;
  },

  // Helper to normalize plan names for comparison
  normalizePlanName(planName) {
    return planName.toLowerCase()
      .replace(/\(.*?\)/g, '') // Remove text in parentheses
      .replace(/[^a-z0-9\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();
  },

  // Calculate similarity between two plan names (0 to 1)
  calculateNameSimilarity(name1, name2) {
    const words1 = name1.split(' ');
    const words2 = name2.split(' ');
    const commonWords = words1.filter(word =>
      words2.some(w2 => w2.includes(word) || word.includes(w2))
    );

    return commonWords.length / Math.max(words1.length, words2.length);
  },

  // Manual mapping for common plan patterns
  manualPlanMapping(planDetails, variations) {
    const manualMappings = {
      // MTN mappings
      '50MB (CG_LITE)': ['50MB', '50 MB', '50MB Daily'],
      '150MB (CG_LITE)': ['150MB', '150 MB', '150MB Daily'],
      '250MB (CG_LITE)': ['250MB', '250 MB', '250MB Daily'],
      '500MB (CG_LITE)': ['500MB', '500 MB', '500MB Daily'],
      '500MB (CG)': ['500MB', '500 MB', '500MB Weekly'],
      '1GB (CG)': ['1GB', '1 GB', '1000MB'],
      '1GB (CG_LITE)': ['1GB', '1 GB', '1000MB'],

      // 9mobile mappings
      '100MB (SME)': ['100MB', '100 MB'],
      '300MB (SME)': ['300MB', '300 MB'],
      '500MB (SME)': ['500MB', '500 MB'],
      '1GB (SME)': ['1GB', '1 GB', '1000MB'],
      // Airtel mappings
      '500MB (CG)': ['500MB', '500 MB'],
      '1GB (CG)': ['1GB', '1 GB', '1000MB'],
      '1.5GB (CG)': ['1.5GB', '1.5 GB', '1500MB'],

      // Glo mappings
      '200MB (CG)': ['200MB', '200 MB'],
      '750MB (Awoof)': ['750MB', '750 MB'],
      '500MB (CG)': ['500MB', '500 MB'],
      '1GB (CG)': ['1GB', '1 GB', '1000MB']
    };

    for (const [ourPlan, vtuPatterns] of Object.entries(manualMappings)) {
      if (planDetails.name.toLowerCase().includes(ourPlan.toLowerCase().replace(/\(.*?\)/g, '').trim())) {
        for (const pattern of vtuPatterns) {
          const variation = variations.find(v =>
            v.data_plan.toLowerCase().includes(pattern.toLowerCase())
          );
          if (variation) {
            console.log(`   ✅ Manual mapping: "${planDetails.name}" -> "${variation.data_plan}"`);
            return variation;
          }
        }
      }
    }

    return null;
  },

  // Helper to compare data volumes (1GB, 500MB, etc.)
  compareDataVolumes(vtuName, ourName) {
    const vtuVolume = this.extractDataVolume(vtuName);
    const ourVolume = this.extractDataVolume(ourName);

    if (vtuVolume && ourVolume) {
      return vtuVolume === ourVolume;
    }

    return false;
  },

  // IMPROVED: Better data volume extraction
  extractDataVolume(planName) {
    // Handle different formats: 1GB, 1.5GB, 500MB, 1.75GB, etc.
    const matches = planName.match(/(\d+(?:\.\d+)?)\s*(GB|MB|mb|gb)/i);
    if (matches) {
      const amount = parseFloat(matches[1]);
      const unit = matches[2].toUpperCase();

      // Convert everything to MB for comparison
      if (unit === 'GB') {
        return amount * 1024; // Convert GB to MB
      } else {
        return amount; // Already in MB
      }
    }

    // Try to extract just numbers and assume MB if no unit
    const numberMatch = planName.match(/(\d+)\s*(?=MB|mb|GB|gb|)/i);
    if (numberMatch) {
      return parseInt(numberMatch[1]);
    }

    return null;
  },

  // Helper function to fetch available data variations from VTU.ng
  async fetchVTUVariations(serviceId = null, token = null) {
    try {
      const vtuConfig = {
        baseUrl: 'https://vtu.ng/wp-json/api/v2'
      };

      let url = `${vtuConfig.baseUrl}/variations/data`;
      if (serviceId) {
        url += `?service_id=${serviceId}`;
      }

      console.log('📡 Fetching VTU.ng variations from:', url);

      const headers = {
        'Content-Type': 'application/json'
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(url, {
        headers: headers
      });

      if (!response.ok) {
        throw new Error(`VTU.ng API error: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();
      console.log('📥 VTU variations response received');

      if (data.code === 'success' && data.data) {
        console.log(`✅ Retrieved ${data.data.length} variations from VTU.ng`);
        return data.data;
      } else {
        throw new Error(data.message || 'Failed to fetch variations from VTU.ng');
      }

    } catch (error) {
      console.error('❌ Error fetching VTU variations:', error);
      throw error;
    }
  },

  // Check VTU wallet balance
  async checkVTUBalance(token) {
    try {
      const vtuConfig = {
        baseUrl: 'https://vtu.ng/wp-json/api/v2'
      };

      const response = await fetch(`${vtuConfig.baseUrl}/balance`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      if (data.code === 'success') {
        console.log(`💰 VTU Wallet Balance: ₦${data.data.balance}`);
        return data.data.balance;
      } else {
        throw new Error(data.message || 'Failed to check balance');
      }

    } catch (error) {
      console.error('❌ Error checking VTU balance:', error);
      throw error;
    }
  },

  // SYNC FUNCTION: Update your database with VTU variation IDs
  async syncVTUVariationIds() {
    try {
      console.log('🔄 Syncing VTU.ng variation IDs...');
      const token = await this.getVTUToken();

      const networks = [
        { ourId: 'mtn', vtuId: 'mtn' },
        { ourId: 'glo', vtuId: 'glo' },
        { ourId: 'airtel', vtuId: 'airtel' },
        { ourId: '9mobile', vtuId: '9mobile' }
      ];

      let totalMapped = 0;
      const syncResults = {};

      for (const network of networks) {
        try {
          console.log(`📡 Fetching variations for ${network.ourId}...`);
          const variations = await this.fetchVTUVariations(network.vtuId, token);

          // Get our plans for this network from database
          const ourPlans = await this.getOurPlansByNetwork(network.ourId);
          console.log(`📊 Found ${ourPlans.length} plans for ${network.ourId}`);

          let mappedCount = 0;
          const networkMappings = [];

          for (const ourPlan of ourPlans) {
            const variation = this.findBestMatchingVariation(variations, ourPlan);
            if (variation) {
              await this.updatePlanVTUMapping(ourPlan.id, variation.variation_id);
              mappedCount++;
              networkMappings.push({
                ourPlan: ourPlan.name,
                vtuPlan: variation.data_plan,
                variationId: variation.variation_id,
                price: variation.price
              });
            }
          }

          syncResults[network.ourId] = {
            total: ourPlans.length,
            mapped: mappedCount,
            mappings: networkMappings
          };

          console.log(`✅ ${network.ourId}: Mapped ${mappedCount}/${ourPlans.length} plans`);
          totalMapped += mappedCount;

        } catch (error) {
          console.error(`❌ Failed to sync ${network.ourId}:`, error.message);
          syncResults[network.ourId] = {
            error: error.message,
            total: 0,
            mapped: 0
          };
        }
      }

      console.log(`🎉 VTU variation ID sync completed. Total mapped: ${totalMapped}`);
      return {
        totalMapped,
        details: syncResults
      };

    } catch (error) {
      console.error('❌ VTU sync failed:', error);
      throw error;
    }
  },

  // Enhanced sync that deletes unmapped plans and adds missing VTU plans
  async syncVTUVariationIdsEnhanced() {
    try {
      console.log('🔄 Starting ENHANCED VTU sync: Delete unmapped + Add missing plans...');
      const token = await this.getVTUToken();

      const networks = [
        { ourId: 'mtn', vtuId: 'mtn' },
        { ourId: 'glo', vtuId: 'glo' },
        { ourId: 'airtel', vtuId: 'airtel' },
        { ourId: '9mobile', vtuId: '9mobile' }
      ];

      let totalMapped = 0;
      let totalDeleted = 0;
      let totalAdded = 0;
      const syncResults = {};

      for (const network of networks) {
        try {
          console.log(`\n📡 Processing ${network.ourId.toUpperCase()}...`);

          // Step 1: Fetch VTU variations
          const vtuVariations = await this.fetchVTUVariations(network.vtuId, token);
          const availableVTUPlans = vtuVariations.filter(v => v.availability === 'Available');

          // Step 2: Fetch our current plans
          const ourPlans = await this.getOurPlansByNetwork(network.ourId);

          // Step 3: Get network and data type IDs
          const networkInfo = await this.getNetworkInfo(network.ourId);
          const dataTypes = await this.getDataTypes();

          // Step 4: Match and update existing plans
          let mappedCount = 0;
          const unmappedPlanIds = [];

          for (const ourPlan of ourPlans) {
            const variation = this.findBestMatchingVariation(availableVTUPlans, ourPlan);
            if (variation) {
              await this.updatePlanVTUMapping(ourPlan.id, variation.variation_id);
              mappedCount++;
            } else {
              unmappedPlanIds.push(ourPlan.id);
            }
          }

          // Step 5: Delete unmapped plans
          let deletedCount = 0;
          if (unmappedPlanIds.length > 0) {
            console.log(`🗑️  Deleting ${unmappedPlanIds.length} unmapped plans for ${network.ourId}...`);
            deletedCount = await this.deleteUnmappedPlans(unmappedPlanIds);
          }

          // Step 6: Add missing VTU plans
          let addedCount = 0;
          const missingPlans = await this.findMissingVTUPlans(availableVTUPlans, ourPlans, networkInfo, dataTypes);
          if (missingPlans.length > 0) {
            console.log(`➕ Adding ${missingPlans.length} missing VTU plans for ${network.ourId}...`);
            addedCount = await this.addMissingPlans(missingPlans);
          }

          syncResults[network.ourId] = {
            total: ourPlans.length,
            mapped: mappedCount,
            deleted: deletedCount,
            added: addedCount,
            finalCount: ourPlans.length - deletedCount + addedCount
          };

          console.log(`✅ ${network.ourId}: Mapped ${mappedCount}, Deleted ${deletedCount}, Added ${addedCount}`);
          totalMapped += mappedCount;
          totalDeleted += deletedCount;
          totalAdded += addedCount;

        } catch (error) {
          console.error(`❌ Failed to sync ${network.ourId}:`, error.message);
          syncResults[network.ourId] = {
            error: error.message,
            total: 0,
            mapped: 0,
            deleted: 0,
            added: 0
          };
        }
      }

      console.log(`\n🎉 ENHANCED VTU sync completed!`);
      console.log(`   📊 Total Mapped: ${totalMapped}`);
      console.log(`   🗑️  Total Deleted: ${totalDeleted}`);
      console.log(`   ➕ Total Added: ${totalAdded}`);
      console.log(`   📈 Net Change: ${totalAdded - totalDeleted} plans`);

      return {
        totalMapped,
        totalDeleted,
        totalAdded,
        netChange: totalAdded - totalDeleted,
        details: syncResults
      };

    } catch (error) {
      console.error('❌ Enhanced VTU sync failed:', error);
      throw error;
    }
  },

  // DATABASE FUNCTIONS - Real Supabase integration
  async getOurPlansByNetwork(networkName) {
    try {
      console.log(`📊 Fetching plans for network: ${networkName}`);

      // First, get the network ID
      const { data: networkData, error: networkError } = await supabase
        .from('networks')
        .select('id')
        .eq('name', networkName.toUpperCase())
        .eq('is_active', true)
        .single();

      if (networkError) {
        console.error(`❌ Error fetching network ${networkName}:`, networkError);
        return [];
      }

      if (!networkData) {
        console.log(`❌ Network not found: ${networkName}`);
        return [];
      }

      // Get data plans for this network
      const { data: plansData, error: plansError } = await supabase
        .from('data_plans')
        .select(`
          id,
          name,
          price,
          validity,
          data_volume,
          vtu_variation_id,
          networks!inner (name),
          data_types!inner (name)
        `)
        .eq('network_id', networkData.id)
        .eq('is_active', true);

      if (plansError) {
        console.error(`❌ Error fetching plans for ${networkName}:`, plansError);
        return [];
      }

      console.log(`✅ Found ${plansData?.length || 0} active plans for ${networkName}`);

      // Format the data to match expected structure
      const formattedPlans = (plansData || []).map(plan => ({
        id: plan.id,
        name: plan.name,
        price: parseFloat(plan.price),
        network: plan.networks.name,
        data_volume: plan.data_volume,
        validity: plan.validity,
        vtu_variation_id: plan.vtu_variation_id,
        data_type: plan.data_types.name
      }));

      return formattedPlans;

    } catch (error) {
      console.error('❌ Database error fetching plans:', error);
      return [];
    }
  },

  async updatePlanVTUMapping(planId, vtuVariationId) {
    try {
      console.log(`💾 Updating database: Plan ${planId} -> VTU ${vtuVariationId}`);

      // Update the data_plans table with the VTU variation ID
      const { data, error } = await supabase
        .from('data_plans')
        .update({
          vtu_variation_id: vtuVariationId,
          updated_at: new Date().toISOString()
        })
        .eq('id', planId);

      if (error) {
        console.error(`❌ Database update error for plan ${planId}:`, error);
        return {
          planId,
          vtuVariationId,
          error: error.message,
          success: false
        };
      }

      console.log(`✅ Successfully updated plan ${planId} with VTU variation ${vtuVariationId}`);

      return {
        planId,
        vtuVariationId,
        success: true,
        message: 'Mapping stored in database'
      };

    } catch (error) {
      console.error('❌ Error updating VTU mapping:', error);
      return {
        planId,
        vtuVariationId,
        error: error.message,
        success: false
      };
    }
  },

  // Get plan details by ID for purchase - FIXED VERSION
  async getPlanById(planId) {
    try {
      const { data, error } = await supabase
        .from('data_plans')
        .select(`
          id,
          name,
          price,
          validity,
          data_volume,
          vtu_variation_id,
          network_id,
          networks!inner (name)
        `)
        .eq('id', planId)
        .eq('is_active', true)
        .single();

      if (error) {
        console.error('❌ Error fetching plan:', error);
        throw new Error('Plan not found');
      }

      if (!data) {
        throw new Error('Plan not found or inactive');
      }

      return {
        id: data.id,
        name: data.name,
        price: parseFloat(data.price),
        network: data.networks.name,
        network_id: data.network_id, // ADD THIS LINE
        data_volume: data.data_volume,
        validity: data.validity,
        vtu_variation_id: data.vtu_variation_id
      };

    } catch (error) {
      console.error('❌ Database error fetching plan:', error);
      throw error;
    }
  },

  // Create order in database - FIXED PARAMETER ORDER
  // In dataService.js - update the createOrder method with exact status mapping
async createOrder(userId, networkId, planId, phoneNumber, amount, vtuResult) {
    try {
        console.log('💾 Creating order in database...');
        
        // Handle undefined vtuResult
        if (!vtuResult) {
            console.warn('⚠️ vtuResult is undefined, creating order with default values');
            vtuResult = {
                reference: `unknown_${Date.now()}`,
                message: 'Purchase result not available',
                status: 'pending'
            };
        }

        // Exact valid status values from database constraint
        const validStatuses = ['pending', 'processing', 'success', 'failed'];
        
        // Map vtuResult status to valid database status
        let orderStatus = 'pending'; // default
        
        if (vtuResult.status && validStatuses.includes(vtuResult.status.toLowerCase())) {
            orderStatus = vtuResult.status.toLowerCase();
        } else if (vtuResult.status === 'completed') {
            orderStatus = 'success'; // Map 'completed' to 'success'
        } else if (vtuResult.success === true) {
            orderStatus = 'success';
        } else if (vtuResult.success === false) {
            orderStatus = 'failed';
        } else if (vtuResult.status === 'processing' || vtuResult.status === 'in_progress') {
            orderStatus = 'processing';
        }

        console.log(`🔄 Status mapping: ${vtuResult.status} → ${orderStatus}`);

        const orderData = {
            user_id: userId,
            network_id: networkId,
            data_plan_id: planId,
            phone_number: phoneNumber,
            amount_paid: amount,
            status: orderStatus,
            isub_reference: vtuResult.reference || `ref_${Date.now()}`,
            isub_response: vtuResult
        };

        console.log('📝 Final order data for database:', orderData);

        const { data, error } = await supabase
            .from('orders')
            .insert([orderData])
            .select()
            .single();

        if (error) {
            console.error('❌ Error creating order:', error);
            throw new Error(`Failed to create order: ${error.message}`);
        }

        console.log(`✅ Order created with ID: ${data.id}`);
        return data;

    } catch (error) {
        console.error('❌ Database error creating order:', error);
        throw error;
    }
},

  // TEST FUNCTION: Quick test of VTU connection
  async testVTUConnection() {
    try {
      console.log('🧪 Testing VTU.ng connection...');
      const token = await this.getVTUToken();
      const balance = await this.checkVTUBalance(token);
      const variations = await this.fetchVTUVariations('mtn', token);

      return {
        success: true,
        token: !!token,
        balance: balance,
        variationsCount: variations.length,
        sampleVariation: variations[0]
      };
    } catch (error) {
      console.error('❌ VTU connection test failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  // Debug method to see all available VTU plans
  async debugVTUPlans(serviceId = 'mtn') {
    try {
      const token = await this.getVTUToken();
      const variations = await this.fetchVTUVariations(serviceId, token);

      console.log(`\n📋 AVAILABLE VTU PLANS FOR ${serviceId.toUpperCase()}:`);
      variations.forEach(v => {
        if (v.availability === 'Available') {
          console.log(`   ${v.data_plan} - ₦${v.price} (ID: ${v.variation_id})`);
        }
      });
      console.log('');

      return variations.filter(v => v.availability === 'Available');
    } catch (error) {
      console.error('Debug error:', error);
      return [];
    }
  },

  // Get network info by name
  async getNetworkInfo(networkName) {
    try {
      const { data, error } = await supabase
        .from('networks')
        .select('id, name')
        .eq('name', networkName.toUpperCase())
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error(`Error getting network info for ${networkName}:`, error);
      throw error;
    }
  },

  // Get all data types
  async getDataTypes() {
    try {
      const { data, error } = await supabase
        .from('data_types')
        .select('id, name')
        .eq('is_active', true);

      if (error) throw error;

      // Create a map for easy lookup
      const typeMap = {};
      data.forEach(type => {
        typeMap[type.name.toLowerCase()] = type.id;
      });
      return typeMap;
    } catch (error) {
      console.error('Error getting data types:', error);
      throw error;
    }
  },

  // Delete unmapped plans
  async deleteUnmappedPlans(planIds) {
    try {
      if (planIds.length === 0) return 0;

      const { error } = await supabase
        .from('data_plans')
        .update({ is_active: false })
        .in('id', planIds);

      if (error) throw error;

      console.log(`✅ Soft-deleted ${planIds.length} unmapped plans`);
      return planIds.length;
    } catch (error) {
      console.error('Error deleting unmapped plans:', error);
      return 0;
    }
  },

  // Find VTU plans that are missing from our database
  async findMissingVTUPlans(vtuPlans, ourPlans, networkInfo, dataTypes) {
    const missingPlans = [];

    // Extract our plan names for comparison
    const ourPlanNames = ourPlans.map(p => p.name.toLowerCase());

    for (const vtuPlan of vtuPlans) {
      // Check if this VTU plan already exists in our database
      const exists = ourPlanNames.some(ourName =>
        this.arePlansSimilar(ourName, vtuPlan.data_plan.toLowerCase())
      );

      if (!exists) {
        // Determine data type based on plan name
        let dataTypeId = dataTypes['sme'] || dataTypes['corporate'] || dataTypes[Object.keys(dataTypes)[0]];

        if (vtuPlan.data_plan.toLowerCase().includes('lite')) {
          dataTypeId = dataTypes['lite'] || dataTypeId;
        } else if (vtuPlan.data_plan.toLowerCase().includes('awoof') || vtuPlan.data_plan.toLowerCase().includes('gift')) {
          dataTypeId = dataTypes['special'] || dataTypeId;
        } else if (vtuPlan.data_plan.toLowerCase().includes('corporate') || vtuPlan.data_plan.toLowerCase().includes('cg')) {
          dataTypeId = dataTypes['corporate'] || dataTypeId;
        }

        missingPlans.push({
          name: vtuPlan.data_plan,
          price: parseFloat(vtuPlan.price),
          network_id: networkInfo.id,
          data_type_id: dataTypeId,
          vtu_variation_id: vtuPlan.variation_id,
          data_volume: this.extractDataVolumeDisplay(vtuPlan.data_plan),
          validity: this.extractValidity(vtuPlan.data_plan),
          is_active: true
        });
      }
    }

    return missingPlans;
  },

  // Add missing plans to database - ENHANCED VERSION
  async addMissingPlans(missingPlans) {
    try {
      if (missingPlans.length === 0) return 0;

      // Verify all plans have network_id
      const validPlans = missingPlans.filter(plan => {
        if (!plan.network_id) {
          console.warn(`⚠️ Skipping plan without network_id: ${plan.name}`);
          return false;
        }
        return true;
      });

      if (validPlans.length === 0) {
        console.log('⚠️ No valid plans to add (missing network_id)');
        return 0;
      }

      const { data, error } = await supabase
        .from('data_plans')
        .insert(validPlans)
        .select();

      if (error) throw error;

      console.log(`✅ Added ${validPlans.length} new plans to database`);
      return validPlans.length;
    } catch (error) {
      console.error('Error adding missing plans:', error);
      return 0;
    }
  },

  // Helper to check if plans are similar
  arePlansSimilar(plan1, plan2) {
    const vol1 = this.extractDataVolume(plan1);
    const vol2 = this.extractDataVolume(plan2);
    // If volumes match and names are somewhat similar
    return vol1 && vol2 && vol1 === vol2 &&
      (plan1.includes(plan2.substring(0, 10)) || plan2.includes(plan1.substring(0, 10)));
  },

  // Extract data volume for display
  extractDataVolumeDisplay(planName) {
    const matches = planName.match(/(\d+(?:\.\d+)?)\s*(GB|MB)/i);
    if (matches) {
      return `${matches[1]}${matches[2].toUpperCase()}`;
    }
    return null;
  },

  // Extract validity from plan name
  extractValidity(planName) {
    if (planName.toLowerCase().includes('1 day') || planName.toLowerCase().includes('daily')) return '1 day';
    if (planName.toLowerCase().includes('2 day')) return '2 days';
    if (planName.toLowerCase().includes('3 day')) return '3 days';
    if (planName.toLowerCase().includes('7 day') || planName.toLowerCase().includes('weekly')) return '7 days';
    if (planName.toLowerCase().includes('14 day')) return '14 days';
    if (planName.toLowerCase().includes('30 day') || planName.toLowerCase().includes('monthly')) return '30 days';
    return '30 days'; // Default
  },

  // Update user balance (for demo mode)
  async updateUserBalance(userId, amount) {
    try {
      // Get current balance
      const { data: profile, error: fetchError } = await supabase
        .from('profiles')
        .select('balance')
        .eq('id', userId)
        .single();

      if (fetchError) throw fetchError;

      const newBalance = parseFloat(profile.balance) + parseFloat(amount);

      // Update balance
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ balance: newBalance })
        .eq('id', userId);

      if (updateError) throw updateError;

      console.log(`💰 Updated user ${userId} balance: ${profile.balance} → ${newBalance}`);
      return newBalance;
    } catch (error) {
      console.error('Error updating user balance:', error);
      throw error;
    }
  },

  // Get user balance
  async getUserBalance(userId) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('balance')
        .eq('id', userId)
        .single();

      if (error) throw error;
      return parseFloat(data.balance);
    } catch (error) {
      console.error('Error getting user balance:', error);
      return 0;
    }
  }
};

module.exports = DataService;
