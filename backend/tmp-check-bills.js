const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./apartment.db', (err) => {
  if (err) {
    console.error('Failed to open database:', err.message);
    process.exit(1);
  }
});

// Check rent payments for tenant 2
db.all('SELECT id, tenant_id, amount, currency, status FROM rent_payments WHERE tenant_id = 2 LIMIT 5', [], (err, rows) => {
  if (err) {
    console.error('DB QUERY ERROR', err.message);
    process.exit(1);
  }
  console.log('Rent bills for tenant 2:');
  console.log(JSON.stringify(rows, null, 2));
  db.close();
});
