const db = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const sqlite = new db.Database('./apartment.db');

console.log('=== CREATING TEST ACCOUNTS ===\n');

const testAccounts = [
  {
    email: 'admin@test.com',
    password: 'admin123',
    full_name: 'Admin User',
    role: 'admin',
    phone: '09100000001'
  },
  {
    email: 'tenant@test.com',
    password: 'tenant123',
    full_name: 'Test Tenant',
    role: 'tenant',
    phone: '09100000002'
  },
  {
    email: 'maintenance@test.com',
    password: 'maint123',
    full_name: 'Maintenance Staff',
    role: 'maintenance_staff',
    phone: '09100000003'
  }
];

let created = 0;

testAccounts.forEach(account => {
  const hashedPassword = bcrypt.hashSync(account.password, 10);
  
  sqlite.run(
    'INSERT OR IGNORE INTO users (email, password, full_name, role, phone) VALUES (?, ?, ?, ?, ?)',
    [account.email, hashedPassword, account.full_name, account.role, account.phone],
    (err) => {
      if (err) {
        console.log(`❌ Error creating ${account.role}:`, err.message);
      } else {
        created++;
        console.log(`✅ Created ${account.role}:`);
        console.log(`   Email: ${account.email}`);
        console.log(`   Password: ${account.password}`);
        console.log();
      }
      
      if (created === testAccounts.length) {
        console.log('=== CREATION COMPLETE ===\n');
        console.log('You can now login with these accounts:');
        testAccounts.forEach(a => {
          console.log(`\n${a.role.toUpperCase()}:`);
          console.log(`  Email: ${a.email}`);
          console.log(`  Password: ${a.password}`);
        });
        sqlite.close();
      }
    }
  );
});
