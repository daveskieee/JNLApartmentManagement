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
        'SELECT * FROM utility_readings WHERE tenant_id = ? ORDER BY reading_date DESC, id DESC LIMIT 12',
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

// Update tenant profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { fullName, phone } = req.body;

    // Validate tenant
    const tenant = await dbGet(
      'SELECT * FROM users WHERE id = ? AND role = ?',
      [userId, 'tenant']
    );

    if (!tenant) {
      return res.status(403).json({ success: false, message: 'Only tenants can access this' });
    }

    // Update profile
    const dbRun = (sql, params) => {
      return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID });
        });
      });
    };

    await dbRun(
      'UPDATE users SET full_name = ?, phone = ?, updated_at = datetime("now") WHERE id = ?',
      [fullName || tenant.full_name, phone || tenant.phone, userId]
    );

    res.json({ 
      success: true, 
      message: 'Profile updated successfully',
      user: {
        id: userId,
        email: tenant.email,
        fullName: fullName || tenant.full_name,
        phone: phone || tenant.phone,
        role: tenant.role
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to update profile', error: error.message });
  }
});

module.exports = router;
