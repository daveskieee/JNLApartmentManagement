const db = require('sqlite3').verbose();
const sqlite = new db.Database('./apartment.db');

console.log('=== DEBUGGING PAYPAL PAYMENT ===\n');

// Check PayPal env vars
console.log('Environment Variables:');
console.log('PAYPAL_MODE:', process.env.PAYPAL_MODE || 'NOT SET');
console.log('PAYPAL_CLIENT_ID:', process.env.PAYPAL_CLIENT_ID ? 'SET (***' + process.env.PAYPAL_CLIENT_ID.slice(-10) + ')' : 'NOT SET');
console.log('PAYPAL_CLIENT_SECRET:', process.env.PAYPAL_CLIENT_SECRET ? 'SET (***' + process.env.PAYPAL_CLIENT_SECRET.slice(-10) + ')' : 'NOT SET');
console.log('SERVER_URL:', process.env.SERVER_URL || 'NOT SET');
console.log('REACT_APP_API_URL:', process.env.REACT_APP_API_URL || 'NOT SET');
console.log();

// Check for test data
console.log('=== CHECKING DATABASE ===\n');

// Check users
sqlite.all('SELECT id, email, role FROM users LIMIT 5', (err, rows) => {
  if (err) {
    console.error('Error querying users:', err.message);
  } else {
    console.log('Users found:', rows?.length || 0);
    rows?.forEach(row => console.log(`  - ${row.email} (id: ${row.id}, role: ${row.role})`));
  }

  // Check rent_payments (bills)
  sqlite.all('SELECT id, tenant_id, amount, due_date, status FROM rent_payments LIMIT 5', (err, rows) => {
    if (err) {
      console.error('Error querying rent_payments:', err.message);
    } else {
      console.log('\nRent payments (bills) found:', rows?.length || 0);
      rows?.forEach(row => console.log(`  - Bill ID ${row.id}: tenant ${row.tenant_id}, ₱${row.amount}, due ${row.due_date}, status: ${row.status}`));
    }

    if (!rows || rows.length === 0) {
      console.log('\n⚠️  No bills found! You need to create test data first.');
      console.log('Run: node create-test-data.js');
    }

    sqlite.close();
  });
});
