const axios = require('axios');

(async () => {
  try {
    const res = await axios.post('http://localhost:3000/api/auth/login', { email: 'tenant@test.com', password: 'tenant123' });
    console.log('STATUS:', res.status);
    console.log('DATA:', res.data);
  } catch (err) {
    if (err.response) {
      console.log('STATUS:', err.response.status);
      console.log('DATA:', err.response.data);
    } else {
      console.error('ERROR:', err.message);
    }
  }
})();