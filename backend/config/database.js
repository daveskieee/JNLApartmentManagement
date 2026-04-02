const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

let dbReadyResolve;
const dbReadyPromise = new Promise((resolve) => {
  dbReadyResolve = resolve;
});

const db = new sqlite3.Database(path.join(__dirname, '../apartment.db'), (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

// Add error handling for the database
db.on('error', (err) => {
  console.error('Database error event:', err);
});

const initializeDatabase = () => {
  // Don't use serialize() - run all table creations in parallel
  // This speeds up initialization significantly
  
  const tableCreationPromises = [];

  // Users table
  tableCreationPromises.push(new Promise((resolve) => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL,
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) console.error('Error creating users table:', err);
      resolve();
    });
  }));

  // Apartments table
  tableCreationPromises.push(new Promise((resolve) => {
    db.run(`CREATE TABLE IF NOT EXISTS apartments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unit_number TEXT UNIQUE NOT NULL,
      floor INTEGER,
      tenant_id INTEGER,
      monthly_rent REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, () => resolve());
  }));

  // Rent payments table
  tableCreationPromises.push(new Promise((resolve) => {
    db.run(`CREATE TABLE IF NOT EXISTS rent_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      apartment_id INTEGER,
      amount REAL NOT NULL,
      due_date TEXT,
      paid_date TEXT,
      status TEXT DEFAULT 'pending',
      payment_method TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, () => resolve());
  }));

  // Complaints table
  tableCreationPromises.push(new Promise((resolve) => {
    db.run(`CREATE TABLE IF NOT EXISTS complaints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT,
      priority TEXT DEFAULT 'medium',
      status TEXT DEFAULT 'submitted',
      assigned_to INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, () => resolve());
  }));

  // Utility readings table
  tableCreationPromises.push(new Promise((resolve) => {
    db.run(`CREATE TABLE IF NOT EXISTS utility_readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      apartment_id INTEGER,
      meter_type TEXT,
      reading REAL,
      reading_date TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, () => resolve());
  }));

  // Notifications table
  tableCreationPromises.push(new Promise((resolve) => {
    db.run(`CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      message TEXT,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, () => resolve());
  }));

  // Payment history table
  tableCreationPromises.push(new Promise((resolve) => {
    db.run(`CREATE TABLE IF NOT EXISTS payment_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      rent_id INTEGER,
      amount REAL NOT NULL,
      payment_method TEXT,
      transaction_id TEXT,
      status TEXT DEFAULT 'submitted',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES users(id),
      FOREIGN KEY (rent_id) REFERENCES rent_payments(id)
    )`, () => resolve());
  }));

  // Chatbot conversations table
  tableCreationPromises.push(new Promise((resolve) => {
    db.run(`CREATE TABLE IF NOT EXISTS chatbot_conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      user_message TEXT NOT NULL,
      bot_response TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, () => resolve());
  }));

  // Chatbot feedback table (stores user-rated helpful responses for simple learning)
  tableCreationPromises.push(new Promise((resolve) => {
    db.run(`CREATE TABLE IF NOT EXISTS chatbot_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      message TEXT,
      response TEXT,
      helpful INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, () => resolve());
  }));

  // Wait for all tables to be created, then run migrations
  Promise.all(tableCreationPromises).then(() => {
    console.log('Database tables initialized');
    runMigrations();
  }).catch(err => {
    console.error('Error initializing database tables:', err);
    dbReadyResolve(); // Still resolve to allow app to start
  });
};

// Run migrations to add missing columns
const runMigrations = () => {
  console.log('Running database migrations...');
  
  // Add currency columns if not present
  const migrations = [
    { name: 'currency', sql: "ALTER TABLE rent_payments ADD COLUMN currency TEXT DEFAULT 'PHP'" },
    { name: 'currency (utility)', sql: "ALTER TABLE utility_readings ADD COLUMN currency TEXT DEFAULT 'PHP'" },
    { name: 'currency (payment)', sql: "ALTER TABLE payment_history ADD COLUMN currency TEXT DEFAULT 'PHP'" },
    { name: 'original_amount', sql: "ALTER TABLE payment_history ADD COLUMN original_amount REAL" },
    { name: 'original_currency', sql: "ALTER TABLE payment_history ADD COLUMN original_currency TEXT" },
    { name: 'converted_amount', sql: "ALTER TABLE payment_history ADD COLUMN converted_amount REAL" },
    { name: 'converted_currency', sql: "ALTER TABLE payment_history ADD COLUMN converted_currency TEXT" },
    { name: 'conversion_rate', sql: "ALTER TABLE payment_history ADD COLUMN conversion_rate REAL" },
    { name: 'conversion_timestamp', sql: "ALTER TABLE payment_history ADD COLUMN conversion_timestamp TEXT" },
    { name: 'estimated_cost', sql: "ALTER TABLE utility_readings ADD COLUMN estimated_cost REAL DEFAULT 0" }
  ];

  let completed = 0;
  let failed = 0;

  migrations.forEach(migration => {
    db.run(migration.sql, (err) => {
      if (err) {
        if (err.message && err.message.includes('duplicate column')) {
          console.log(`✓ Column '${migration.name}' already exists`);
          completed++;
        } else {
          console.warn(`✗ Migration '${migration.name}' failed: ${err.message}`);
          failed++;
        }
      } else {
        console.log(`✓ Migration '${migration.name}' completed`);
        completed++;
      }

      // If all migrations are done (completed + failed = total), resolve the promise
      if (completed + failed === migrations.length) {
        console.log(`Migrations summary: ${completed} successful, ${failed} failed`);
        console.log('Resolving dbReadyPromise...');
        dbReadyResolve();
        console.log('dbReadyPromise resolved!');
      }
    });
  });
};

module.exports = db;
module.exports.dbReady = dbReadyPromise;
