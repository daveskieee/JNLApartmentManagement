const db = require('sqlite3').verbose();
const sqlite = new db.Database('./apartment.db');

console.log('=== CHECKING DATABASE ===\n');

// Check users
sqlite.all('SELECT id, email, role FROM users', (err, users) => {
  if (err) {
    console.error('Error fetching users:', err);
  } else {
    console.log('=== USERS ===');
    users.forEach(user => {
      console.log(`ID: ${user.id}, Email: ${user.email}, Role: ${user.role}`);
    });
    console.log();
  }
});

// Check rent payments
sqlite.all('SELECT * FROM rent_payments', (err, rents) => {
  if (err) {
    console.error('Error fetching rent:', err);
  } else {
    console.log('=== RENT PAYMENTS ===');
    rents.forEach(rent => {
      console.log(`ID: ${rent.id}, Tenant: ${rent.tenant_id}, Amount: ₱${rent.amount}, Status: ${rent.status}, Due: ${rent.due_date}`);
    });
    console.log();
  }
  
  sqlite.close();
});
