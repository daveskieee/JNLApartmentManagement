const jwt = require('jsonwebtoken');
const axios = require('axios');

// Generate tokens for different tenants
const tenants = [
  { id: 2, email: 'tenant@test.com' },
  { id: 4, email: 'davematthewreglos@gmail.com' },
  { id: 8, email: 'ivanalmazan@test.com' }
];

const generateToken = (id, email) => {
  return jwt.sign({ id, email, role: 'tenant' }, 'super_secret_jwt_key_change_this_in_production', { expiresIn: '7d' });
};

(async () => {
  console.log('Testing suggestions for ALL tenants:\n');
  
  for (const tenant of tenants) {
    const token = generateToken(tenant.id, tenant.email);
    try {
      const resp = await axios.get('http://localhost:5000/api/chatbot/suggestions', {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000
      });
      
      console.log(`\n✅ Tenant ${tenant.id} (${tenant.email}):`);
      const suggestions = resp.data.data || [];
      suggestions.forEach(s => {
        console.log(`   - ${s.title}: ${s.message}`);
      });
    } catch (err) {
      console.error(`❌ Tenant ${tenant.id} error:`, err.response?.data || err.message);
    }
  }
})();
