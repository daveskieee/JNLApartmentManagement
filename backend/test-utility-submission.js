const axios = require('axios');

const testSubmitUtility = async () => {
  try {
    console.log('======== TESTING UTILITY SUBMISSION ========\n');
    
    // Step 1: Login as admin
    console.log('Step 1: Attempting admin login...');
    const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'admin@test.com',
      password: 'admin123'
    });
    
    if (!loginResponse.data.success) {
      console.log('❌ Login failed:', loginResponse.data);
      return;
    }
    
    const token = loginResponse.data.token;
    console.log('✅ Admin login successful!');
    
    // Step 2: Get available tenants
    console.log('\nStep 2: Fetching available tenants...');
    const tenantsResponse = await axios.get('http://localhost:5000/api/admin/tenants', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!tenantsResponse.data.success || !tenantsResponse.data.data.length) {
      console.log('❌ No tenants found');
      return;
    }
    
    const tenantId = tenantsResponse.data.data[0].id;
    console.log(`✅ Found tenant: ID=${tenantId}, Name=${tenantsResponse.data.data[0].full_name}`);
    
    // Step 3: Submit utility data
    console.log('\nStep 3: Submitting utility data...');
    const utilityPayload = {
      tenantId: tenantId,
      month: '2026-02',
      rent: 10000,
      waterUsage: 50,
      electricityUsage: 200,
      waterCost: 500,
      electricityCost: 1500,
      currency: 'PHP'
    };
    
    console.log('Payload:', JSON.stringify(utilityPayload, null, 2));
    
    try {
      const submitResponse = await axios.post(
        'http://localhost:5000/api/admin/submit-utility',
        utilityPayload,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      console.log('✅ Utility submission successful!');
      console.log('Response:', JSON.stringify(submitResponse.data, null, 2));
    } catch (error) {
      console.log('❌ Utility submission FAILED!');
      console.log('Status:', error.response?.status);
      console.log('Error Response:', JSON.stringify(error.response?.data, null, 2));
      console.log('Full Error:', error.message);
    }
    
  } catch (error) {
    console.log('❌ Unexpected ERROR!\n');
    console.log('Error:', error.message);
  }
};

testSubmitUtility();
