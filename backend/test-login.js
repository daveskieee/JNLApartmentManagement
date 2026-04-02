const axios = require('axios');

const testLogin = async () => {
  try {
    console.log('Testing login endpoint...\n');
    
    const response = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'tenant@test.com',
      password: 'tenant123'
    });
    
    console.log('✅ LOGIN SUCCESSFUL!\n');
    console.log('Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('❌ LOGIN FAILED!\n');
    console.log('Error Status:', error.response?.status);
    console.log('Error Message:', error.response?.data?.message);
    console.log('Error Details:', error.response?.data?.error);
    console.log('\nFull Error:', error.message);
  }
};

testLogin();
