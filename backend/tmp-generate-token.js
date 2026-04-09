const jwt = require('jsonwebtoken');
const token = jwt.sign({ id: 2, email: 'tenant@test.com', role: 'tenant' }, 'super_secret_jwt_key_change_this_in_production', { expiresIn: '7d' });
console.log(token);
