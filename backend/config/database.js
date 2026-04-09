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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
      currency TEXT DEFAULT 'PHP',
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
      currency TEXT DEFAULT 'PHP',
      water_rate REAL DEFAULT NULL,
      estimated_cost REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, () => resolve());
  }));

  // Public appointment requests table
  tableCreationPromises.push(new Promise((resolve) => {
    db.run(`CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      preferred_date TEXT NOT NULL,
      building TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, () => resolve());
  }));

  // Maintenance archived tasks table (persistent per maintenance staff)
  tableCreationPromises.push(new Promise((resolve) => {
    db.run(`CREATE TABLE IF NOT EXISTS maintenance_task_archive (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      maintenance_staff_id INTEGER NOT NULL,
      complaint_id INTEGER NOT NULL,
      archived_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(maintenance_staff_id, complaint_id)
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
      currency TEXT DEFAULT 'PHP',
      payment_method TEXT,
      transaction_id TEXT,
      status TEXT DEFAULT 'submitted',
      original_amount REAL,
      original_currency TEXT,
      converted_amount REAL,
      converted_currency TEXT,
      conversion_rate REAL,
      conversion_timestamp TEXT,
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

  // Password reset tokens table
  tableCreationPromises.push(new Promise((resolve) => {
    db.run(`CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`, () => resolve());
  }));

  // Persistent Meralco rates cache (survives backend restarts)
  tableCreationPromises.push(new Promise((resolve) => {
    db.run(`CREATE TABLE IF NOT EXISTS meralco_rates_cache (
      id INTEGER PRIMARY KEY,
      rate_kwh REAL NOT NULL,
      rate_change REAL,
      rate_change_percent REAL,
      trend TEXT,
      unit TEXT DEFAULT 'PHP/kWh',
      source_url TEXT,
      fetched_at TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
    { name: 'water_rate', sql: "ALTER TABLE utility_readings ADD COLUMN water_rate REAL" },
    { name: 'estimated_cost', sql: "ALTER TABLE utility_readings ADD COLUMN estimated_cost REAL DEFAULT 0" },
    { name: 'first_login', sql: "ALTER TABLE users ADD COLUMN first_login INTEGER DEFAULT 1" },
    { name: 'updated_at (users)', sql: "ALTER TABLE users ADD COLUMN updated_at DATETIME" },
    { name: 'sentiment (complaints)', sql: "ALTER TABLE complaints ADD COLUMN sentiment TEXT" },
    { name: 'attachment_filename', sql: "ALTER TABLE complaints ADD COLUMN attachment_filename TEXT" },
    { name: 'attachment_path', sql: "ALTER TABLE complaints ADD COLUMN attachment_path TEXT" },
    { name: 'attachment_size', sql: "ALTER TABLE complaints ADD COLUMN attachment_size INTEGER" },
    { name: 'attachment_type', sql: "ALTER TABLE complaints ADD COLUMN attachment_type TEXT" }
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

      // If all migrations are done (completed + failed = total), run data integrity check
      if (completed + failed === migrations.length) {
        console.log(`Migrations summary: ${completed} successful, ${failed} failed`);
        runDataIntegrityCheck();
      }
    });
  });
};

// Ensure all bills have currency set
const runDataIntegrityCheck = () => {
  console.log('Running data integrity checks...');
  
  // Ensure all rent_payments have currency set to PHP if null
  db.run(
    "UPDATE rent_payments SET currency = 'PHP' WHERE currency IS NULL",
    function(err) {
      if (err) {
        console.error('Data integrity check failed:', err);
      } else {
        console.log(`✓ Data integrity check: updated ${this.changes} bills with missing currency`);
      }
      console.log('Resolving dbReadyPromise...');
      dbReadyResolve();
      console.log('dbReadyPromise resolved!');
    }
  );
};

module.exports = db;
module.exports.dbReady = dbReadyPromise;
