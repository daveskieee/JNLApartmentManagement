const axios = require('axios');

const api = axios.create({
  baseURL: 'http://localhost:5000'
});

async function testComplaintFlow() {
  try {
    console.log('1. Testing login...');
    const loginResponse = await api.post('/api/auth/login', {
      email: 'admin@apartment.com',
      password: 'Admin123'
    });
    
    const token = loginResponse.data.token;
    console.log('✓ Login successful, token:', token.substring(0, 20) + '...');

    console.log('\n2. Testing complaint submission...');
    const complaintResponse = await api.post(
      '/api/complaint/submit',
      {
        title: 'Test Complaint',
        description: 'This is a test complaint from the backend',
        category: 'maintenance',
        priority: 'high'
      },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    console.log('✓ Complaint submitted successfully!');
    console.log('Response:', complaintResponse.data);

    console.log('\n3. Testing complaint retrieval...');
    const getResponse = await api.get(
      '/api/complaint/my-complaints',
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    console.log('✓ Complaints retrieved:', getResponse.data.data.length, 'complaints');
    console.log(getResponse.data.data);

  } catch (error) {
    console.error('✗ Error:', error.response?.data || error.message);
    process.exit(1);
  }
}

testComplaintFlow();
