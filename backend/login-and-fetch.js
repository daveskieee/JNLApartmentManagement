const axios = require('axios');

(async () => {
  try {
    const login = await axios.post('http://localhost:5000/api/auth/login', { email: 'tenant@test.com', password: 'tenant123' });
    const output = { login: login.data };
    const token = login.data.token;

    try {
      const res = await axios.get('http://localhost:5000/api/rent/status/2', { headers: { Authorization: 'Bearer ' + token } });
      output.status = res.status;
      output.response = res.data;
    } catch (e) {
      output.statusError = e.response ? { status: e.response.status, data: e.response.data } : { message: e.message };
    }

    const fs = require('fs');
    fs.writeFileSync('login-fetch-result.json', JSON.stringify(output, null, 2));
    console.log('WROTE login-fetch-result.json');
  } catch (err) {
    if (err.response) {
      const fs = require('fs');
      fs.writeFileSync('login-fetch-result.json', JSON.stringify({ loginError: err.response.data, status: err.response.status }, null, 2));
      console.log('WROTE login-fetch-result.json (login error)');
    } else {
      const fs = require('fs');
      fs.writeFileSync('login-fetch-result.json', JSON.stringify({ error: err.message }, null, 2));
      console.log('WROTE login-fetch-result.json (error)');
    }
  }
})();
