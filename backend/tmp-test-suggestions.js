const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./apartment.db');

// Check utilities for each tenant
console.log('Checking utility data by tenant:\n');

db.all('SELECT tenant_id, COUNT(*) as count, GROUP_CONCAT(DISTINCT utility_type) as types FROM utility_readings GROUP BY tenant_id', [], (err, rows) => {
  if (err) console.error('Error:', err);
  else {
    console.log('Utilities per tenant:');
    console.log(JSON.stringify(rows, null, 2));
  }
  
  // Check rent payments by tenant
  db.all('SELECT tenant_id, COUNT(*) as count, GROUP_CONCAT(status) as statuses FROM rent_payments GROUP BY tenant_id', [], (err, rows2) => {
    if (err) console.error('Error:', err);
    else {
      console.log('\nRent payments per tenant:');
      console.log(JSON.stringify(rows2, null, 2));
    }
    
    // Now test the suggestions API for tenant 2 and another tenant
    console.log('\n--- Testing Suggestions API ---');
    const axios = require('axios');
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwiZW1haWwiOiJ0ZW5hbnRAdGVzdC5jb20iLCJyb2xlIjoidGVuYW50IiwiaWF0IjoxNzc1NTgxODAzLCJleHAiOjE3NzYxODY2MDN9.QPmK0PDZZ2usIg3ib1lnJ2ovOY230X8qYPJJ_Q46IFY';
    
    axios.get('http://localhost:5000/api/chatbot/suggestions', {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10000
    }).then(resp => {
      console.log('\nTenant 2 suggestions:');
      console.log(JSON.stringify(resp.data, null, 2));
      db.close();
    }).catch(err => {
      console.error('API error:', err.response?.data || err.message);
      db.close();
    });
  });
});
