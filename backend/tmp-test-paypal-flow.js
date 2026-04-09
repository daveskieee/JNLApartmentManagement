const axios = require('axios');
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwiZW1haWwiOiJ0ZW5hbnRAdGVzdC5jb20iLCJyb2xlIjoidGVuYW50IiwiaWF0IjoxNzc1NTgxODAzLCJleHAiOjE3NzYxODY2MDN9.QPmK0PDZZ2usIg3ib1lnJ2ovOY230X8qYPJJ_Q46IFY';

(async () => {
  try {
    console.log('=== Testing PayPal Payment Flow ===\n');

    // Test 1: Create PayPal payment
    console.log('1️⃣  Creating PayPal payment for bill 7 (2500 PHP)...');
    const createResponse = await axios.post('http://localhost:5000/api/payment/paypal/create', {
      billId: 7,
      amount: 2500
    }, {
      headers: { 
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 20000
    });
    
    const { paymentId, approvalUrl, convertedAmount, convertedCurrency, conversionRate } = createResponse.data.data;
    console.log('✅ Payment created successfully!');
    console.log('   Payment ID:', paymentId);
    console.log('   Approval URL:', approvalUrl ? '✓ Present' : '✗ Missing');
    console.log('   Conversion: 2500 PHP → ' + convertedAmount + ' ' + convertedCurrency);
    console.log('   Conversion Rate:', conversionRate);
    
    // Test 2: Check payment pending status
    console.log('\n2️⃣  Checking pending payment status...');
    const pendingResponse = await axios.get('http://localhost:5000/api/payment/pending/7', {
      headers: { 
        Authorization: `Bearer ${token}`
      },
      timeout: 10000
    });
    
    console.log('✅ Pending payment found:');
    console.log('   Status:', pendingResponse.data.data.status);
    console.log('   Transaction ID:', pendingResponse.data.data.transaction_id);
    
    console.log('\n✅ PayPal payment processing is WORKING!');
    console.log('Approval URL would be:', approvalUrl);
  } catch (error) {
    if (error.response) {
      console.error('❌ API ERROR');
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('❌ ERROR:', error.message);
    }
  }
})();
