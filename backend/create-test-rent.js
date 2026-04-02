const db = require('sqlite3').verbose();
const sqlite = new db.Database('./apartment.db');

console.log('=== CREATING TEST RENT DATA ===\n');

const testRent = [
  {
    tenant_id: 1,
    apartment_id: 1,
    amount: 5000,
    due_date: '2026-02-15',
    paid_date: null,
    status: 'pending',
    payment_method: null
  },
  {
    tenant_id: 2,
    apartment_id: 2,
    amount: 5000,
    due_date: '2026-02-15',
    paid_date: null,
    status: 'pending',
    payment_method: null
  },
  {
    tenant_id: 2,
    apartment_id: 2,
    amount: 5000,
    due_date: '2026-01-15',
    paid_date: '2026-01-20',
    status: 'paid',
    payment_method: 'bank_transfer'
  }
];

let created = 0;

testRent.forEach(rent => {
  sqlite.run(
    'INSERT OR IGNORE INTO rent_payments (tenant_id, apartment_id, amount, currency, due_date, paid_date, status, payment_method, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
    [rent.tenant_id, rent.apartment_id, rent.amount, 'PHP', rent.due_date, rent.paid_date, rent.status, rent.payment_method],
    (err) => {
      if (err) {
        console.log(`❌ Error creating rent:`, err.message);
      } else {
        created++;
        console.log(`✅ Created rent payment:`);
        console.log(`   Tenant ID: ${rent.tenant_id}`);
        console.log(`   Amount: ₱${rent.amount}`);
        console.log(`   Due Date: ${rent.due_date}`);
        console.log(`   Status: ${rent.status}`);
        console.log();
      }
      
      if (created === testRent.length) {
        console.log('=== TEST RENT DATA CREATED ===');
        sqlite.close();
      }
    }
  );
});

setTimeout(() => {
  sqlite.close();
}, 2000);
