const axios = require('axios');
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwiZW1haWwiOiJ0ZW5hbnRAdGVzdC5jb20iLCJyb2xlIjoidGVuYW50IiwiaWF0IjoxNzc1NTgxODAzLCJleHAiOjE3NzYxODY2MDN9.QPmK0PDZZ2usIg3ib1lnJ2ovOY230X8qYPJJ_Q46IFY';

(async () => {
  try {
    const response = await axios.post('http://localhost:5000/api/chatbot/query', {
      message: 'Hello, how is my rent?'
    }, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 20000
    });
    console.log('STATUS', response.status);
    console.log('DATA', response.data);
  } catch (error) {
    if (error.response) {
      console.error('RESPONSE_STATUS', error.response.status);
      console.error('RESPONSE_DATA', error.response.data);
    } else {
      console.error('ERROR', error.message);
    }
  }
})();
