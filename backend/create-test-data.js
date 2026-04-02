const db = require('./config/database');
const bcrypt = require('bcryptjs');

// Insert test tenant
const hashedPassword = bcrypt.hashSync('password123', 10);

db.serialize(() => {
  // Insert test tenant user
  db.run(
    `INSERT OR IGNORE INTO users (id, email, password, full_name, role, phone) 
     VALUES (1, 'tenant@test.com', ?, 'Test Tenant', 'tenant', '09123456789')`,
    [hashedPassword],
    (err) => {
      if (err) console.error('Error inserting tenant:', err);
      else console.log('Test tenant created: tenant@test.com / password123');
    }
  );

  // Insert test apartment
  db.run(
    `INSERT OR IGNORE INTO apartments (id, apartment_number, tenant_id, monthly_rent) 
     VALUES (1, '101', 1, 5000)`,
    (err) => {
      if (err) console.error('Error inserting apartment:', err);
      else console.log('Test apartment created: Unit 101');
    }
  );

  // Insert test rent payment (bill)
  db.run(
    `INSERT OR IGNORE INTO rent_payments (id, tenant_id, apartment_id, amount, currency, due_date, status, created_at) 
     VALUES (1, 1, 1, 5000, 'PHP', '2026-02-28', 'pending', CURRENT_TIMESTAMP)`,
    (err) => {
      if (err) console.error('Error inserting rent payment:', err);
      else console.log('Test bill created: ₱5000 due 2026-02-28');
    }
  );

  // Insert second bill
  db.run(
    `INSERT OR IGNORE INTO rent_payments (id, tenant_id, apartment_id, amount, currency, due_date, status, created_at) 
     VALUES (2, 1, 1, 5000, 'PHP', '2026-03-31', 'pending', CURRENT_TIMESTAMP)`,
    (err) => {
      if (err) console.error('Error inserting second bill:', err);
      else console.log('Test bill 2 created: ₱5000 due 2026-03-31');
    }
  );

  // Query to show what was created
  setTimeout(() => {
    console.log('\n=== Test Data Summary ===');
    db.all('SELECT * FROM users WHERE role = "tenant" LIMIT 1', (err, users) => {
      if (!err && users.length > 0) console.log('Tenant:', users[0]);
    });
    db.all('SELECT * FROM rent_payments WHERE tenant_id = 1', (err, payments) => {
      if (!err && payments.length > 0) {
        console.log('Bills for tenant:');
        payments.forEach(p => console.log(`  - Bill #${p.id}: ₱${p.amount} due ${p.due_date} (${p.status})`));
      }
      console.log('\n=== Ready to test ===');
      console.log('Login with: tenant@test.com / password123');
      console.log('You should see 2 pending bills on the dashboard');
      process.exit(0);
    });
  }, 1000);
});
