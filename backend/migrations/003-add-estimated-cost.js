const db = require('../config/database');

const runSQLMigration = (sql) => {
  return new Promise((resolve, reject) => {
    db.run(sql, (err) => {
      if (err) {
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
    console.log('Running SQL migration: add estimated_cost to utility_readings...');
    
    await runSQLMigration("ALTER TABLE utility_readings ADD COLUMN estimated_cost REAL DEFAULT 0");
    
    console.log('✅ Migration completed successfully');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
})();
