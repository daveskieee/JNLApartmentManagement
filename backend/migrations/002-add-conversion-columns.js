const db = require('../config/database');

const addColumn = (colSql) => {
  return new Promise((resolve, reject) => {
    db.run(colSql, (err) => {
      if (err) {
        // Ignore "duplicate column" errors
        if (err.message && err.message.includes('duplicate column')) {
          console.log('Column already exists, skipping');
          resolve();
        } else {
          reject(err);
        }
      } else {
        resolve();
      }
    });
  });
};

(async () => {
  try {
    console.log('Adding conversion columns to payment_history...');

    await addColumn("ALTER TABLE payment_history ADD COLUMN original_amount REAL;");
    await addColumn("ALTER TABLE payment_history ADD COLUMN original_currency TEXT;");
    await addColumn("ALTER TABLE payment_history ADD COLUMN converted_amount REAL;");
    await addColumn("ALTER TABLE payment_history ADD COLUMN converted_currency TEXT;");
    await addColumn("ALTER TABLE payment_history ADD COLUMN conversion_rate REAL;");
    await addColumn("ALTER TABLE payment_history ADD COLUMN conversion_timestamp TEXT;");

    console.log('Migration completed.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
})();