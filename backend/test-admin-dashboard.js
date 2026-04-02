const axios = require('axios');

const testAdminDashboard = async () => {
  try {
    console.log('======== TESTING ADMIN DASHBOARD ========\n');
    
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
    console.log('Token:', token.substring(0, 20) + '...');
    
    // Step 2: Test dashboard endpoint
    console.log('\nStep 2: Testing /api/admin/dashboard endpoint...');
    const dashboardResponse = await axios.get('http://localhost:5000/api/admin/dashboard', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ Dashboard request successful!');
    console.log('Response:', JSON.stringify(dashboardResponse.data, null, 2));
    
    // Step 3: Test other admin endpoints
    console.log('\nStep 3: Testing /api/admin/tenants endpoint...');
    const tenantsResponse = await axios.get('http://localhost:5000/api/admin/tenants', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ Tenants request successful!');
    console.log('Response:', JSON.stringify(tenantsResponse.data, null, 2));
    
    console.log('\nStep 4: Testing /api/admin/bills endpoint...');
    const billsResponse = await axios.get('http://localhost:5000/api/admin/bills', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ Bills request successful!');
    console.log('Response:', JSON.stringify(billsResponse.data, null, 2));
    
  } catch (error) {
    console.log('❌ ERROR!\n');
    console.log('Status:', error.response?.status);
    console.log('Status Text:', error.response?.statusText);
    console.log('Error Response:', JSON.stringify(error.response?.data, null, 2));
    console.log('Error Message:', error.message);
    
    if (error.response?.status === 403) {
      console.log('\n⚠️  Access denied (403) - Likely an authorization issue');
      console.log('Check if the account has admin role');
    } else if (error.response?.status === 500) {
      console.log('\n⚠️  Server error (500) - Database or query issue');
    }
  }
};

testAdminDashboard();
