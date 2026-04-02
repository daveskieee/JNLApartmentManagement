const db = require('sqlite3').verbose();
const sqlite = new db.Database('./apartment.db');

console.log('=== PAYMENT SYSTEM DEBUG ===\n');

sqlite.all('SELECT id, email, full_name FROM users WHERE role = "tenant" LIMIT 5', (err, users) => {
  if (err) {
    console.log('Error getting tenants:', err.message);
  } else {
    console.log('✓ TENANTS IN DATABASE:');
    if (!users || users.length === 0) {
      console.log('  (none found)');
    } else {
      users.forEach(u => console.log(`  - ID: ${u.id}, Email: ${u.email}, Name: ${u.full_name}`));
    }
  }
  
  sqlite.all('SELECT id, tenant_id, amount, due_date, status FROM rent_payments LIMIT 5', (err, bills) => {
    if (err) {
      console.log('\n✗ Error getting bills:', err.message);
    } else {
      console.log('\n✓ BILLS IN DATABASE:');
      if (!bills || bills.length === 0) {
        console.log('  (none found - ADD TEST BILLS FIRST!)');
      } else {
        bills.forEach(b => console.log(`  - ID: ${b.id}, Tenant: ${b.tenant_id}, ₱${b.amount}, Due: ${b.due_date}, Status: ${b.status}`));
      }
    }
    
    sqlite.all('SELECT COUNT(*) as cnt FROM payment_history', (err, hist) => {
      if (!err) console.log(`\n✓ Payments submitted: ${hist[0].cnt}`);
      sqlite.close();
      
      console.log('\n=== NEXT STEPS ===');
      console.log('1. If you see NO TENANTS: You need to login and register first');
      console.log('2. If you see NO BILLS: Your tenant account needs bills (run add-bills.js)');
      console.log('3. If you see BILLS: Try paying a bill now in the app');
    });
  });
});
