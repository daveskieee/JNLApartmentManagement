const axios = require('axios');
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwiZW1haWwiOiJ0ZW5hbnRAdGVzdC5jb20iLCJyb2xlIjoidGVuYW50IiwiaWF0IjoxNzc1NTgxODAzLCJleHAiOjE3NzYxODY2MDN9.QPmK0PDZZ2usIg3ib1lnJ2ovOY230X8qYPJJ_Q46IFY';

(async () => {
  try {
    console.log('=== Test 1: Test currency conversion ===');
    const convertTest = await axios.get('http://localhost:5000/api/payment/test-convert?amount=5000&from=PHP&to=USD', {
      timeout: 10000
    });
    console.log('Conversion result:', convertTest.data);

    console.log('\n=== Test 2: Get conversion rate (with auth) ===');
    const rateTest = await axios.get('http://localhost:5000/api/payment/convert?amount=5000&from=PHP&to=USD', {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10000
    });
    console.log('Rate result:', rateTest.data);

    console.log('\n=== Test 3: Create PayPal payment ===');
    const createPayment = await axios.post('http://localhost:5000/api/payment/paypal/create', {
      billId: 1,
      amount: 5000
    }, {
      headers: { 
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 20000
    });
    console.log('Create payment response:', createPayment.data);
  } catch (error) {
    if (error.response) {
      console.error('RESPONSE_STATUS', error.response.status);
      console.error('RESPONSE_DATA', error.response.data);
    } else {
      console.error('ERROR', error.message);
    }
  }
})();
