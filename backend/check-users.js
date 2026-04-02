const db = require('sqlite3').verbose();
const sqlite = new db.Database('./apartment.db');

console.log('=== CHECKING DATABASE FOR USERS ===\n');

sqlite.all('SELECT id, email, role, full_name FROM users', (err, rows) => {
  if (err) {
    console.log('ERROR:', err.message);
    sqlite.close();
    process.exit(1);
  }
  
  console.log('Total users:', rows ? rows.length : 0);
  
  if (!rows || rows.length === 0) {
    console.log('\n❌ NO USERS FOUND!');
    console.log('You need to register an account first or create test data.');
  } else {
    console.log('\n✅ EXISTING USERS:');
    rows.forEach(u => {
      console.log(`   - ${u.email} (${u.role}) - ID: ${u.id}`);
    });
  }
  
  sqlite.close();
  process.exit(0);
});
