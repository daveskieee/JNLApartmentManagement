const axios = require('axios');

const testPaymentEndpoints = async () => {
  try {
    console.log('======== TESTING PAYMENT ADMIN ENDPOINTS ========\n');
    
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
    
    // Step 2: Test /api/payment/admin/all
    console.log('\nStep 2: Testing /api/payment/admin/all endpoint...');
    try {
      const allResponse = await axios.get('http://localhost:5000/api/payment/admin/all?page=1&limit=20', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('✅ Admin/all request successful!');
      console.log('Response:', JSON.stringify(allResponse.data, null, 2));
    } catch (error) {
      console.log('❌ Admin/all request FAILED!');
      console.log('Status:', error.response?.status);
      console.log('Error Response:', JSON.stringify(error.response?.data, null, 2));
      console.log('Full Error:', error.message);
    }
    
    // Step 3: Test /api/payment/admin/stats
    console.log('\nStep 3: Testing /api/payment/admin/stats endpoint...');
    try {
      const statsResponse = await axios.get('http://localhost:5000/api/payment/admin/stats', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('✅ Admin/stats request successful!');
      console.log('Response:', JSON.stringify(statsResponse.data, null, 2));
    } catch (error) {
      console.log('❌ Admin/stats request FAILED!');
      console.log('Status:', error.response?.status);
      console.log('Error Response:', JSON.stringify(error.response?.data, null, 2));
      console.log('Full Error:', error.message);
    }
    
  } catch (error) {
    console.log('❌ Unexpected ERROR!\n');
    console.log('Error:', error.message);
  }
};

testPaymentEndpoints();
