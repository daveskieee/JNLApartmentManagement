const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'apartment.db');
const sqlite = new sqlite3.Database(dbPath);

const show = (table) => {
  sqlite.all(`PRAGMA table_info(${table})`, (err, rows) => {
    if (err) return console.error(`Error reading ${table}:`, err.message);
    console.log(`\n=== Schema: ${table} ===`);
    rows.forEach(r => console.log(`${r.cid}: ${r.name} (${r.type})`));
  });
};

show('rent_payments');
setTimeout(() => show('utility_readings'), 200);
setTimeout(() => show('payment_history'), 400);
setTimeout(() => sqlite.close(), 800);
