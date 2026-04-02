const db = require('sqlite3').verbose();
const sqlite = new db.Database('./apartment.db');

console.log('=== DELETING TEST USERS ===\n');

const emails = [
  'tenant@test.com',
  'admin@test.com',
  'maintenance@test.com',
  'admin@apartment.com'
];

sqlite.serialize(() => {
  emails.forEach(email => {
    sqlite.run('DELETE FROM users WHERE email = ?', [email], function(err) {
      if (err) {
        console.log(`❌ Error deleting ${email}:`, err.message);
      } else if (this.changes > 0) {
        console.log(`✅ Deleted user: ${email}`);
      } else {
        console.log(`ℹ️  No user found for: ${email}`);
      }
    });
  });
});

setTimeout(() => {
  console.log('\n=== DELETION COMPLETE ===');
  sqlite.close();
  process.exit(0);
}, 1000);
