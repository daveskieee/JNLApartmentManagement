const db = require('sqlite3').verbose();
const sqlite = new db.Database('./apartment.db');

console.log('=== ADDING PENDING BILLS ===\n');

const pendingBills = [
  {
    tenant_id: 2,
    amount: 5000,
    due_date: '2026-02-15',
    status: 'pending'
  },
  {
    tenant_id: 2,
    amount: 5000,
    due_date: '2026-03-15',
    status: 'pending'
  }
];

let created = 0;

pendingBills.forEach(bill => {
  sqlite.run(
    'INSERT INTO rent_payments (tenant_id, amount, currency, due_date, status, created_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
    [bill.tenant_id, bill.amount, 'PHP', bill.due_date, bill.status],
    (err) => {
      if (err) {
        console.log(`❌ Error: ${err.message}`);
      } else {
        created++;
        console.log(`✅ Added pending bill: ₱${bill.amount} due ${bill.due_date}`);
      }
      
      if (created === pendingBills.length) {
        console.log('\n=== PENDING BILLS ADDED ===');
        sqlite.close();
      }
    }
  );
});

setTimeout(() => {
  sqlite.close();
}, 1000);
