const db = require('../config/database');

const run = async () => {
  try {
    console.log('Starting migration: add currency columns');

    // Add currency to rent_payments
    await new Promise((resolve, reject) => {
      db.run("ALTER TABLE rent_payments ADD COLUMN currency TEXT DEFAULT 'PHP'", (err) => {
        if (err) {
          if (err.message && err.message.includes('duplicate column name')) {
            console.log('Column `currency` already exists on rent_payments');
            resolve();
          } else {
            console.error('Error adding currency to rent_payments:', err.message);
            resolve(); // resolve to continue other migrations
          }
        } else {
          console.log('Added currency to rent_payments');
          resolve();
        }
      });
    });

    // Add currency to utility_readings
    await new Promise((resolve, reject) => {
      db.run("ALTER TABLE utility_readings ADD COLUMN currency TEXT DEFAULT 'PHP'", (err) => {
        if (err) {
          if (err.message && err.message.includes('duplicate column name')) {
            console.log('Column `currency` already exists on utility_readings');
            resolve();
          } else {
            console.error('Error adding currency to utility_readings:', err.message);
            resolve();
          }
        } else {
          console.log('Added currency to utility_readings');
          resolve();
        }
      });
    });

    // Add currency to payment_history
    await new Promise((resolve, reject) => {
      db.run("ALTER TABLE payment_history ADD COLUMN currency TEXT DEFAULT 'PHP'", (err) => {
        if (err) {
          if (err.message && err.message.includes('duplicate column name')) {
            console.log('Column `currency` already exists on payment_history');
            resolve();
          } else {
            console.error('Error adding currency to payment_history:', err.message);
            resolve();
          }
        } else {
          console.log('Added currency to payment_history');
          resolve();
        }
      });
    });

    console.log('Migration completed.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
};

run();
