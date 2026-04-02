const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');

console.log('Auth routes loaded');

// Promisify db methods for easier async/await
const dbRun = (sql, params) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        console.error('DB Error:', err, 'SQL:', sql, 'Params:', params);
        reject(err);
      }
      else {
        console.log('DB Run Success, ID:', this.lastID);
        resolve({ id: this.lastID });
      }
    });
  });
};

const dbGet = (sql, params) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        console.error('DB Get Error:', err);
        reject(err);
      }
      else {
        console.log('DB Get Result:', row);
        resolve(row);
      }
    });
  });
};

// Register
router.post('/register', [
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  body('fullName').notEmpty(),
  body('role').equals('tenant'),
  body('unitNumber').notEmpty()
], async (req, res) => {
  console.log('Register endpoint hit with body:', req.body);
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('Validation errors:', errors.array());
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const { email, password, fullName, role, phone, unitNumber } = req.body;
    console.log('Processing registration for:', email);

    // Only tenant registration allowed
    if (role !== 'tenant') {
      return res.status(403).json({ success: false, message: 'Only tenant registration is available. Contact admin for other roles.' });
    }

    // Check if user exists
    const userCheck = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
    if (userCheck) {
      console.log('User already exists:', email);
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log('Password hashed');

    // Create user
    const result = await dbRun(
      'INSERT INTO users (email, password, full_name, role, phone) VALUES (?, ?, ?, ?, ?)',
      [email, hashedPassword, fullName, role, phone]
    );
    console.log('User created with ID:', result.id);

    // Create apartment record with unit number
    await dbRun(
      'INSERT INTO apartments (unit_number, tenant_id) VALUES (?, ?)',
      [unitNumber, result.id]
    );
    console.log('Apartment created for unit:', unitNumber);

    const user = { id: result.id, email, fullName, role };
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE || '7d'
    });

    console.log('Token generated, sending response');
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user,
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: 'Registration failed', error: error.message });
  }
});

// Login
router.post('/login', [
  body('email').isEmail(),
  body('password').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const { email, password } = req.body;

    // Find user
    const user = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE || '7d'
    });

    res.json({
      success: true,
      message: 'Login successful',
      user: { id: user.id, email: user.email, fullName: user.full_name, role: user.role },
      token
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Login failed', error: error.message });
  }
});

module.exports = router;
