const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'apartment.db');
const sqlite = new sqlite3.Database(dbPath);

console.log('=== ADDING USD SAMPLE DATA (using DB at', dbPath, ') ===\n');

const tenantId = 1;
const today = new Date();
const dueDate = new Date(today.getFullYear(), today.getMonth() + 1, 15).toISOString().split('T')[0];

const checkColumn = (table, col) => {
  return new Promise((resolve, reject) => {
    sqlite.all(`PRAGMA table_info(${table})`, (err, rows) => {
      if (err) return resolve(false);
      const has = rows.some(r => r.name === col);
      resolve(has);
    });
  });
};

(async () => {
  const rentHasCurrency = await checkColumn('rent_payments', 'currency');
  const utilHasCurrency = await checkColumn('utility_readings', 'currency');
  const utilHasMeterType = await checkColumn('utility_readings', 'meter_type');
  const utilHasReading = await checkColumn('utility_readings', 'reading');

  // Insert rent payment
  if (rentHasCurrency) {
    sqlite.run(
      `INSERT INTO rent_payments (tenant_id, apartment_id, amount, currency, due_date, status, created_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [tenantId, 1, 100.00, 'USD', dueDate, 'pending'],
      function(err) {
        if (err) console.error('Error inserting USD bill:', err.message);
        else console.log(`✅ USD bill created: $100 due ${dueDate} (id=${this.lastID})`);
      }
    );
  } else {
    sqlite.run(
      `INSERT INTO rent_payments (tenant_id, apartment_id, amount, due_date, status, created_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [tenantId, 1, 100.00, dueDate, 'pending'],
      function(err) {
        if (err) console.error('Error inserting USD bill (no currency column):', err.message);
        else console.log(`✅ USD bill created WITHOUT currency column: $100 due ${dueDate} (id=${this.lastID})`);
      }
    );
  }

  // Insert utility reading using existing columns
  const readingDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];

  if (utilHasMeterType && utilHasReading) {
    sqlite.run(
      `INSERT INTO utility_readings (tenant_id, apartment_id, meter_type, reading, reading_date, created_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [tenantId, 1, 'water', 12.34, readingDate],
      function(err) {
        if (err) console.error('Error inserting utility reading:', err.message);
        else {
          const id = this.lastID;
          console.log(`✅ Utility reading created: 12.34 cu.m (id=${id})`);
          if (utilHasCurrency) {
            sqlite.run(`UPDATE utility_readings SET currency = ? WHERE id = ?`, ['USD', id], (uErr) => {
              if (uErr) console.error('Error updating utility currency:', uErr.message);
              else console.log('✅ Utility reading currency set to USD');
            });
          }
        }
      }
    );
  } else {
    console.error('Utility table does not have expected columns (meter_type & reading). Skipping utility insert.');
  }

  setTimeout(() => sqlite.close(), 800);
})();
