const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./apartment.db');

console.log('=== Checking utility_readings schema ===');
db.all("PRAGMA table_info(utility_readings)", [], (err, cols) => {
  if (err) {
    console.error('Schema error:', err);
  } else {
    console.log('Columns in utility_readings:');
    cols.forEach(col => console.log(`  - ${col.name} (${col.type})`));
  }
  
  console.log('\n=== Sample utility data for each tenant ===');
  db.all('SELECT tenant_id, meter_type, reading, reading_date FROM utility_readings ORDER BY tenant_id, reading_date DESC LIMIT 15', [], (err, rows) => {
    if (err) {
      console.error('Query error:', err);
    } else {
      rows.forEach(row => {
        console.log(`Tenant ${row.tenant_id}: ${row.meter_type} = ${row.reading} on ${row.reading_date}`);
      });
    }
    db.close();
  });
});
