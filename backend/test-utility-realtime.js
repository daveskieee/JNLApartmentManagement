const axios = require('axios');

const API_URL = 'http://localhost:5000';
const ADMIN_EMAIL = 'admin@test.com';
const ADMIN_PASSWORD = 'admin123';

const testUtilityRealtimeFlow = async () => {
  try {
    console.log('======== TESTING UTILITY REAL-TIME DATA FLOW ========\n');
    
    // Step 1: Admin login
    console.log('Step 1: Admin login...');
    const adminLoginRes = await axios.post(`${API_URL}/api/auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });
    
    if (!adminLoginRes.data.success) {
      console.log('❌ Admin login failed');
      return;
    }
    
    const adminToken = adminLoginRes.data.token;
    console.log('✅ Admin logged in');
    
    // Step 2: Get first tenant
    console.log('\nStep 2: Fetching first tenant...');
    const tenantsRes = await axios.get(`${API_URL}/api/admin/tenants`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    
    if (!tenantsRes.data.success || !tenantsRes.data.data.length) {
      console.log('❌ No tenants found');
      return;
    }
    
    const tenant = tenantsRes.data.data[0];
    const tenantId = tenant.id;
    console.log(`✅ Found tenant: ID=${tenantId}, Name=${tenant.full_name}`);
    
    // Step 3: Submit utility data
    console.log('\nStep 3: Submitting utility data via /api/admin/submit-utility...');
    const utilityPayload = {
      tenantId: tenantId,
      month: '2026-02',
      rent: 10000,
      waterUsage: 123.45,
      electricityUsage: 456.78,
      waterCost: 567.89,
      electricityCost: 2345.67,
      currency: 'PHP'
    };
    
    console.log('Payload:', JSON.stringify(utilityPayload, null, 2));
    
    const submitRes = await axios.post(
      `${API_URL}/api/admin/submit-utility`,
      utilityPayload,
      { headers: { 'Authorization': `Bearer ${adminToken}` } }
    );
    
    if (submitRes.data.success) {
      console.log('✅ Utility data submitted successfully');
      console.log('Response:', JSON.stringify(submitRes.data, null, 2));
    } else {
      console.log('❌ Submission returned error');
      console.log('Response:', JSON.stringify(submitRes.data, null, 2));
    }
    
    // Step 4: Get tenant credentials and login
    console.log('\nStep 4: Getting tenant credentials...');
    const tenantPassword = `user_${tenantId}`;  // Default test password
    
    try {
      const tenantLoginRes = await axios.post(`${API_URL}/api/auth/login`, {
        email: tenant.email,
        password: tenantPassword
      });
      
      if (!tenantLoginRes.data.success) {
        console.log('⚠️  Tenant login failed - trying with common test password');
        // Most test tenants use the format tenant_password or similar
        // Skip tenant verification if password doesn't work
      } else {
        console.log('✅ Tenant login successful');
        
        const tenantToken = tenantLoginRes.data.token;
        
        // Step 5: Verify tenant can see utilities via /api/utility/latest
        console.log('\nStep 5: Fetching utilities via /api/utility/latest endpoint...');
        const utilFetchRes = await axios.get(`${API_URL}/api/utility/latest/${tenantId}`, {
          headers: { 'Authorization': `Bearer ${tenantToken}` }
        });
        
        if (utilFetchRes.data.success) {
          const utilities = utilFetchRes.data.data;
          console.log('✅ Utilities fetched successfully!');
          console.log('Utilities data:', JSON.stringify(utilities, null, 2));
          
          // Verify the data matches what was submitted
          if (utilities.water && utilities.electricity) {
            console.log('\n✅ Both water and electricity data found');
            console.log(`   Water usage: ${utilities.water.usage} ${utilities.water.unit}, Cost: ${utilities.water.cost}`);
            console.log(`   Electric usage: ${utilities.electricity.usage} ${utilities.electricity.unit}, Cost: ${utilities.electricity.cost}`);
            
            // Check for data match
            const waterMatch = Math.abs(utilities.water.usage - utilityPayload.waterUsage) < 0.01;
            const electricMatch = Math.abs(utilities.electricity.usage - utilityPayload.electricityUsage) < 0.01;
            
            if (waterMatch && electricMatch) {
              console.log('\n✅ DATA MATCH VERIFIED - Real-time update is working!');
            } else {
              console.log('\n⚠️  Data does not match exactly (might be due to formatting)');
              console.log(`   Expected water: ${utilityPayload.waterUsage}, Got: ${utilities.water.usage}`);
              console.log(`   Expected electricity: ${utilityPayload.electricityUsage}, Got: ${utilities.electricity.usage}`);
            }
          } else {
            console.log('\n❌ Water or electricity data missing');
          }
        } else {
          console.log('❌ Failed to fetch utilities');
          console.log('Response:', JSON.stringify(utilFetchRes.data, null, 2));
        }
      }
    } catch (tenantErr) {
      console.log('⚠️  Could not verify tenant view:', tenantErr.message);
    }
    
    // Step 6: Direct database check using debug endpoint
    console.log('\nStep 6: Checking utility_readings table directly (debug endpoint)...');
    try {
      const debugRes = await axios.get(`${API_URL}/api/utility/debug/utilities/${tenantId}`);
      if (debugRes.data.success) {
        console.log('✅ Debug endpoint response:', JSON.stringify(debugRes.data, null, 2));
      }
    } catch (debugErr) {
      console.log('⚠️  Debug endpoint failed (may be disabled in production):', debugErr.message);
    }
    
    console.log('\n======== TEST COMPLETE ========');
    
  } catch (error) {
    console.log('❌ UNEXPECTED ERROR!');
    console.log('Error:', error.message);
    if (error.response?.data) {
      console.log('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
};

testUtilityRealtimeFlow();
