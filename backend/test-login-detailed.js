const axios = require('axios');

const testLogin = async () => {
  try {
    console.log('Testing login endpoint...\n');
    console.log('URL: http://localhost:5000/api/auth/login');
    console.log('Payload: { email: "tenant@test.com", password: "tenant123" }\n');
    
    const response = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'tenant@test.com',
      password: 'tenant123'
    });
    
    console.log('✅ LOGIN SUCCESSFUL!\n');
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('❌ LOGIN FAILED!\n');
    if (error.response) {
      console.log('HTTP Status:', error.response.status);
      console.log('Response Data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.log('No response received. Request made but no response.');
      console.log('Request details:', error.request);
    } else {
      console.log('Error:', error.message);
    }
  }
};

testLogin();
