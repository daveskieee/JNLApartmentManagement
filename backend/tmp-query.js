const db = require('sqlite3').verbose();
const path = require('path');
const sqlite = new db.Database(path.join(__dirname, 'apartment.db'));

sqlite.all('SELECT id, tenant_id, amount, due_date, status, created_at FROM rent_payments WHERE tenant_id = ? ORDER BY due_date DESC', [2], (err, rows) => {
  if (err) {
    console.error('DB ERR', err);
    sqlite.close();
    process.exit(1);
  }
  console.log('ROWS:', JSON.stringify(rows, null, 2));
  sqlite.close();
});
