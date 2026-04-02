const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const db = require('../config/database');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');

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

const dbRun = (sql, params) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        console.error('DB Error:', err);
        reject(err);
      }
      else {
        resolve({ id: this.lastID });
      }
    });
  });
};

// SSE support
const { sendEventToTenant } = require('../services/sse');

// Get admin dashboard (overview)
router.get('/dashboard', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    // Get statistics
    const totalTenantsRow = await dbGet('SELECT COUNT(*) as count FROM users WHERE role = ?', ['tenant']);
    const pendingRentsRow = await dbGet('SELECT COUNT(*) as count FROM rent_payments WHERE status = ?', ['pending']);
    const totalComplaintsRow = await dbGet('SELECT COUNT(*) as count FROM complaints');
    const resolvedComplaintsRow = await dbGet('SELECT COUNT(*) as count FROM complaints WHERE status = ?', ['resolved']);

    res.json({
      success: true,
      data: {
        totalTenants: totalTenantsRow?.count || 0,
        pendingRents: pendingRentsRow?.count || 0,
        totalComplaints: totalComplaintsRow?.count || 0,
        resolvedComplaints: resolvedComplaintsRow?.count || 0
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard', error: error.message });
  }
});

// Get all tenants
router.get('/tenants', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const tenants = await dbAll(`
      SELECT 
        u.id, 
        u.full_name, 
        u.email, 
        u.phone, 
        u.created_at,
        a.unit_number,
        a.id as apartment_id
      FROM users u
      LEFT JOIN apartments a ON u.id = a.tenant_id
      WHERE u.role = ? 
      ORDER BY u.created_at DESC
    `, ['tenant']);
    res.json({ success: true, data: tenants });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to fetch tenants', error: error.message });
  }
});

// Get maintenance staff
router.get('/maintenance-staff', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const staff = await dbAll('SELECT id, full_name, email, phone, created_at FROM users WHERE role = ? ORDER BY created_at DESC', ['maintenance_staff']);
    res.json({ success: true, data: staff });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to fetch maintenance staff', error: error.message });
  }
});

// Add maintenance staff (Admin only)
router.post('/add-staff', [
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  body('fullName').notEmpty(),
  body('role').equals('maintenance_staff')
], authenticateToken, authorizeRole('admin'), async (req, res) => {
  console.log('Add maintenance staff endpoint hit');

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const { email, password, fullName, role, phone } = req.body;

    // Check if user already exists
    const userCheck = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
    if (userCheck) {
      return res.status(400).json({ success: false, message: 'Email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const result = await dbRun(
      'INSERT INTO users (email, password, full_name, role, phone) VALUES (?, ?, ?, ?, ?)',
      [email, hashedPassword, fullName, role, phone]
    );

    res.status(201).json({
      success: true,
      message: 'Maintenance staff added successfully',
      user: { id: result.id, email, fullName, role }
    });
  } catch (error) {
    console.error('Error adding staff:', error);
    res.status(500).json({ success: false, message: 'Failed to add staff', error: error.message });
  }
});

// Submit utility and bill data
router.post('/submit-utility', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { tenantId, month, rent, waterUsage, electricityUsage, waterCost, electricityCost, currency } = req.body;

    console.log('Received utility data:', { tenantId, month, rent, waterUsage, electricityUsage, waterCost, electricityCost, currency });

    if (!tenantId || !month) {
      return res.status(400).json({ success: false, message: 'Tenant and month are required' });
    }

    const dateStr = `${month}-01`;
    const billCurrency = currency || 'PHP';

    // Store water reading
    const waterReading = await dbRun(
      `INSERT INTO utility_readings (tenant_id, meter_type, reading, reading_date, estimated_cost, currency) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [tenantId, 'water', waterUsage || 0, dateStr, waterCost || 0, billCurrency]
    );

    console.log('Water reading inserted:', waterReading);

    // Store electricity reading
    const electricityReading = await dbRun(
      `INSERT INTO utility_readings (tenant_id, meter_type, reading, reading_date, estimated_cost, currency) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [tenantId, 'electricity', electricityUsage || 0, dateStr, electricityCost || 0, billCurrency]
    );

    console.log('Electricity reading inserted:', electricityReading);

    // Notify tenant of new utility readings (best effort)
    try {
      sendEventToTenant(tenantId, 'utility_update', {
        month,
        water: { id: waterReading.id, usage: waterUsage || 0, cost: waterCost || 0, currency: billCurrency },
        electricity: { id: electricityReading.id, usage: electricityUsage || 0, cost: electricityCost || 0, currency: billCurrency },
        message: 'New utility readings have been recorded for your account.'
      });
    } catch (e) {
      console.warn('Failed to send SSE utility_update:', e);
    }

    // Store rent/bill data if provided
    if (rent && parseFloat(rent) > 0) {
      const rentResult = await dbRun(
        `INSERT INTO rent_payments (tenant_id, amount, currency, due_date, status, created_at) 
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [tenantId, parseFloat(rent), billCurrency, dateStr, 'pending']
      );
      console.log('Rent payment inserted');

      // Notify tenant via SSE about the new bill (best-effort)
      try {
        sendEventToTenant(tenantId, 'new_bill', {
          id: rentResult.id,
          amount: parseFloat(rent),
          due_date: dateStr,
          currency: billCurrency,
          message: 'A new bill has been created by admin.'
        });
      } catch (e) {
        console.warn('Failed to send SSE new_bill:', e);
      }
    }

    res.json({ success: true, message: 'Utility data submitted successfully' });
  } catch (error) {
    console.error('Error submitting utility data:', error);
    res.status(500).json({ success: false, message: 'Failed to submit utility data', error: error.message });
  }
});

// Create a new bill (Admin)
router.post('/bills', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { tenantId, amount, dueDate, currency } = req.body;

    if (!tenantId || !amount || !dueDate) {
      return res.status(400).json({ success: false, message: 'tenantId, amount and dueDate are required' });
    }

    const billCurrency = currency || 'PHP';

    const result = await dbRun(
      `INSERT INTO rent_payments (tenant_id, amount, currency, due_date, status, created_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [tenantId, parseFloat(amount), billCurrency, dueDate, 'pending']
    );

    res.status(201).json({ success: true, message: 'Bill created', data: { id: result.id } });
  } catch (error) {
    console.error('Error creating bill:', error);
    res.status(500).json({ success: false, message: 'Failed to create bill', error: error.message });
  }
});

// Get all rent payments/bills
router.get('/bills', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const bills = await dbAll(`
      SELECT rp.*, u.full_name, u.email, a.unit_number
      FROM rent_payments rp 
      LEFT JOIN users u ON rp.tenant_id = u.id 
      LEFT JOIN apartments a ON u.id = a.tenant_id
      ORDER BY rp.due_date DESC
    `);
    res.json({ success: true, data: bills });
  } catch (error) {
    console.error('Error fetching bills:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch bills', error: error.message });
  }
});

// Update bill payment status
router.patch('/bills/:id', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, paid_date } = req.body;

    if (!['paid', 'pending', 'overdue'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    await dbRun(
      'UPDATE rent_payments SET status = ?, paid_date = ? WHERE id = ?',
      [status, paid_date || null, id]
    );

    // Notify tenant about bill status change
    try {
      const updated = await dbGet('SELECT * FROM rent_payments WHERE id = ?', [id]);
      if (updated && updated.tenant_id) {
        sendEventToTenant(updated.tenant_id, 'bill_update', {
          id: updated.id,
          status: updated.status,
          paid_date: updated.paid_date,
          message: `Your bill status is now ${updated.status}`
        });
      }
    } catch (e) {
      console.warn('Failed to send SSE bill_update:', e);
    }

    res.json({ success: true, message: 'Bill status updated successfully' });
  } catch (error) {
    console.error('Error updating bill:', error);
    res.status(500).json({ success: false, message: 'Failed to update bill', error: error.message });
  }
});

module.exports = router;
