const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./apartment.db', (err) => {
  if (err) {
    console.error('Failed to open database:', err.message);
    process.exit(1);
  }
});

// Insert a new pending bill for tenant 2
db.run(
  `INSERT INTO rent_payments (tenant_id, apartment_id, amount, currency, due_date, status, payment_method, created_at, updated_at) 
   VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
  [2, 1, 2500, 'PHP', '2026-04-30', 'pending', null],
  function(err) {
    if (err) {
      console.error('Failed to insert pending bill:', err.message);
      process.exit(1);
    }
    console.log('✅ Pending bill created with ID:', this.lastID);
    
    // Now query to confirm
    db.all('SELECT id, tenant_id, amount, currency, status FROM rent_payments WHERE tenant_id = 2 ORDER BY id DESC LIMIT 5', [], (err2, rows) => {
      if (err2) {
        console.error('Query error:', err2.message);
      } else {
        console.log('Updated rent payments for tenant 2:');
        console.log(JSON.stringify(rows, null, 2));
      }
      db.close();
    });
  }
);
