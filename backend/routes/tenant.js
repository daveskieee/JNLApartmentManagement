const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const db = require('../config/database');

// Promisify db.all for SQLite
const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

// Get tenant dashboard overview
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get tenant info
    const tenant = await dbGet(
      'SELECT * FROM users WHERE id = ? AND role = ?',
      [userId, 'tenant']
    );

    if (!tenant) {
      return res.status(403).json({ success: false, message: 'Only tenants can access this' });
    }

    // Get rent information
    const rentPayments = await dbAll(
      'SELECT * FROM rent_payments WHERE tenant_id = ? ORDER BY due_date DESC LIMIT 5',
      [userId]
    );

    // Get utility data
    const utilities = await dbAll(
      'SELECT * FROM utility_readings WHERE tenant_id = ? ORDER BY reading_date DESC LIMIT 12',
      [userId]
    );

    // Get complaints
    const complaints = await dbAll(
      'SELECT * FROM complaints WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 5',
      [userId]
    );

    res.json({
      success: true,
      data: {
        user: tenant,
        rentPayments,
        utilities,
        complaints
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard', error: error.message });
  }
});

module.exports = router;
