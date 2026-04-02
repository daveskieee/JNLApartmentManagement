const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'apartment.db');
const sqlite = new sqlite3.Database(dbPath);

const tenantId = 1;

sqlite.serialize(() => {
  console.log('\n=== Recent rent_payments for tenant 1 ===');
  sqlite.all('SELECT id, tenant_id, amount, currency, due_date, status, created_at FROM rent_payments WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 10', [tenantId], (err, rows) => {
    if (err) return console.error('Error fetching rent_payments:', err.message);
    rows.forEach(r => console.log(r));
  });

  setTimeout(() => {
    console.log('\n=== Recent utility_readings for tenant 1 ===');
    sqlite.all('SELECT id, meter_type as utility_type, reading as reading_value, currency, reading_date FROM utility_readings WHERE tenant_id = ? ORDER BY reading_date DESC LIMIT 10', [tenantId], (err, rows) => {
      if (err) return console.error('Error fetching utility_readings:', err.message);
      rows.forEach(r => console.log(r));
    });
  }, 200);

  setTimeout(() => sqlite.close(), 1000);
});
