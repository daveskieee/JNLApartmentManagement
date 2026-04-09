const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./apartment.db', (err) => {
  if (err) {
    console.error('Failed to open database:', err.message);
    process.exit(1);
  }
});

db.all('SELECT id, email, role, first_login FROM users LIMIT 10', [], (err, rows) => {
  if (err) {
    console.error('DB QUERY ERROR', err.message);
    process.exit(1);
  }
  console.log(JSON.stringify(rows, null, 2));
  db.close();
});
