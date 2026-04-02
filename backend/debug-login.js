const axios = require('axios');

(async () => {
  try {
    const resp = await axios.post('http://localhost:5000/api/auth/login', { email: 'tenant@test.com', password: 'tenant123' });
    console.log('STATUS', resp.status);
    console.log('DATA', JSON.stringify(resp.data, null, 2));
  } catch (err) {
    if (err.response) console.error('ERR DATA', err.response.status, err.response.data);
    else console.error(err.message);
  }
})();