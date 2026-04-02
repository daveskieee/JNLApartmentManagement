const db = require('./config/database');

db.all("PRAGMA table_info(utility_readings)", (err, rows) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Columns in utility_readings table:');
    rows.forEach(row => {
      console.log(`  - ${row.name} (${row.type})`);
    });
  }
  process.exit(0);
});
