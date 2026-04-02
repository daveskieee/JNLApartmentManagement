const axios = require('axios');

const API_URL = 'http://localhost:5000';
const ADMIN_EMAIL = 'admin@test.com';
const ADMIN_PASSWORD = 'admin123';

const testUtilityRetrieval = async () => {
  try {
    console.log('======== TESTING UTILITY RETRIEVAL ========\n');
    
    // Login as admin
    console.log('Step 1: Admin login...');
    const adminLoginRes = await axios.post(`${API_URL}/api/auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });
    
    const adminToken = adminLoginRes.data.token;
    console.log('✅ Admin logged in');
    
    // Get first tenant
    console.log('\nStep 2: Fetching tenants...');
    const tenantsRes = await axios.get(`${API_URL}/api/admin/tenants`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    
    const tenantId = tenantsRes.data.data[0].id;
    console.log(`✅ Found tenant ID=${tenantId}`);
    
    // Test /api/utility/latest endpoint
    console.log('\nStep 3: Fetching utilities via /api/utility/latest...');
    const utilRes = await axios.get(`${API_URL}/api/utility/latest/${tenantId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    
    console.log('✅ Response received:');
    console.log(JSON.stringify(utilRes.data, null, 2));
    
    // Verify data structure
    if (utilRes.data.success && utilRes.data.data) {
      const data = utilRes.data.data;
      if (data.water || data.electricity) {
        console.log('\n✅ Data structure looks good!');
        if (data.water) {
          console.log(`   Water: usage=${data.water.usage}, cost=${data.water.cost}, unit="${data.water.unit}"`);
        }
        if (data.electricity) {
          console.log(`   Electricity: usage=${data.electricity.usage}, cost=${data.electricity.cost}, unit="${data.electricity.unit}"`);
        }
      }
    }
    
    console.log('\n======== TEST COMPLETE ========');
    
  } catch (error) {
    console.log('❌ ERROR!');
    console.log('Error:', error.message);
    if (error.response?.data) {
      console.log('Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
};

testUtilityRetrieval();
