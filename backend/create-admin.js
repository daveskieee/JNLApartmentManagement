const bcrypt = require('bcryptjs');
const db = require('./config/database');

const email = 'admin@apartment.com';
const password = 'Admin123';
const fullName = 'Administrator';
const phone = '1234567890';

bcrypt.hash(password, 10, (err, hash) => {
  if (err) {
    console.error('Error hashing password:', err);
    process.exit(1);
  }

  db.run(
    'INSERT INTO users (email, password, full_name, role, phone, created_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
    [email, hash, fullName, 'admin', phone],
    function(err) {
      if (err) {
        console.error('Error creating admin:', err.message);
        process.exit(1);
      }
      console.log('✓ Admin account created successfully!');
      console.log('Email:', email);
      console.log('Password:', password);
      console.log('');
      console.log('⚠️  Please change this password after first login!');
      process.exit(0);
    }
  );
});
