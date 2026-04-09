const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const db = require('../config/database');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { sendAdminPasswordResetNotice } = require('../services/emailService');
const { getMeralcoRates } = require('../services/meralco-rates');
const {
  calculateCabuyaoWaterBill,
  normalizeWaterRateCategory
} = require('../services/cabuyao-water-rates');

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
        resolve({ id: this.lastID, changes: this.changes });
      }
    });
  });
};

// SSE support
const { sendEventToTenant } = require('../services/sse');

const parseNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const deriveUsage = ({ directUsage, previousReading, presentReading }) => {
  const usageFromField = parseNumber(directUsage);
  const prev = parseNumber(previousReading);
  const present = parseNumber(presentReading);

  if (present != null && prev != null) {
    return Number(Math.max(0, present - prev).toFixed(4));
  }

  if (usageFromField != null) {
    return Number(Math.max(0, usageFromField).toFixed(4));
  }

  return 0;
};

const hasValue = (value) => value !== null && value !== undefined && value !== '';

// Get admin dashboard (overview)
router.get('/dashboard', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    // Get statistics
    const totalTenantsRow = await dbGet('SELECT COUNT(*) as count FROM users WHERE role = ?', ['tenant']);
    const pendingRentsRow = await dbGet('SELECT COUNT(*) as count FROM rent_payments WHERE status = ?', ['pending']);
    const totalComplaintsRow = await dbGet('SELECT COUNT(*) as count FROM complaints');
    const resolvedComplaintsRow = await dbGet('SELECT COUNT(*) as count FROM complaints WHERE status = ?', ['resolved']);
    const totalAppointmentsRow = await dbGet('SELECT COUNT(*) as count FROM appointments');
    const pendingAppointmentsRow = await dbGet('SELECT COUNT(*) as count FROM appointments WHERE status = ?', ['pending']);

    res.json({
      success: true,
      data: {
        totalTenants: totalTenantsRow?.count || 0,
        pendingRents: pendingRentsRow?.count || 0,
        totalComplaints: totalComplaintsRow?.count || 0,
        resolvedComplaints: resolvedComplaintsRow?.count || 0,
        totalAppointments: totalAppointmentsRow?.count || 0,
        pendingAppointments: pendingAppointmentsRow?.count || 0
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

// Get all appointment requests
router.get('/appointments', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const appointments = await dbAll(`
      SELECT id, full_name, email, preferred_date, building, status, created_at
      FROM appointments
      ORDER BY created_at DESC
    `);

    res.json({ success: true, data: appointments });
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch appointments', error: error.message });
  }
});

// Update appointment status
router.patch('/appointments/:id/status', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const allowedStatuses = ['pending', 'confirmed', 'cancelled'];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const appointment = await dbGet('SELECT id FROM appointments WHERE id = ?', [id]);
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    await dbRun('UPDATE appointments SET status = ? WHERE id = ?', [status, id]);

    const admins = await dbAll('SELECT id FROM users WHERE role = ?', ['admin']);
    const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
    for (const admin of admins) {
      await dbRun(
        'INSERT INTO notifications (user_id, message, is_read, created_at) VALUES (?, ?, 0, datetime(\'now\'))',
        [
          admin.id,
          `Appointment #${id} status updated to ${statusLabel}.`
        ]
      );
    }

    res.json({ success: true, message: 'Appointment status updated successfully' });
  } catch (error) {
    console.error('Error updating appointment status:', error);
    res.status(500).json({ success: false, message: 'Failed to update appointment status', error: error.message });
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
    const {
      tenantId,
      month,
      rent,
      waterUsage,
      electricityUsage,
      waterCost,
      electricityCost,
      waterRate,
      waterRateCategory,
      electricityRate,
      waterPreviousReading,
      waterPresentReading,
      electricityPreviousReading,
      electricityPresentReading,
      currency
    } = req.body;

    console.log('Received utility data:', {
      tenantId,
      month,
      rent,
      waterUsage,
      electricityUsage,
      waterCost,
      electricityCost,
      waterRate,
      waterRateCategory,
      electricityRate,
      waterPreviousReading,
      waterPresentReading,
      electricityPreviousReading,
      electricityPresentReading,
      currency
    });

    if (!tenantId || !month) {
      return res.status(400).json({ success: false, message: 'Tenant and month are required' });
    }

    const dateStr = `${month}-01`;
    const billCurrency = currency || 'PHP';
    const hasWaterInput = [waterUsage, waterPreviousReading, waterPresentReading, waterCost, waterRate].some(hasValue);
    const hasElectricityInput = [electricityUsage, electricityPreviousReading, electricityPresentReading, electricityCost, electricityRate].some(hasValue);
    const rentValue = parseNumber(rent) || 0;

    if (!hasWaterInput && !hasElectricityInput && rentValue <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Provide rent, water data, or electricity data before submitting'
      });
    }

    if (hasValue(waterPreviousReading) !== hasValue(waterPresentReading)) {
      return res.status(400).json({
        success: false,
        message: 'Both water previous and present readings are required when using meter readings'
      });
    }

    if (hasValue(electricityPreviousReading) !== hasValue(electricityPresentReading)) {
      return res.status(400).json({
        success: false,
        message: 'Both electricity previous and present readings are required when using meter readings'
      });
    }

    const waterUsageValue = deriveUsage({
      directUsage: waterUsage,
      previousReading: waterPreviousReading,
      presentReading: waterPresentReading
    });
    const waterRateValue = parseNumber(waterRate);
    const waterRateCategoryValue = normalizeWaterRateCategory(waterRateCategory);

    let currentMeralcoRate = null;
    try {
      const rateData = await getMeralcoRates();
      currentMeralcoRate = parseNumber(rateData?.rate_kwh);
    } catch (e) {
      console.warn('Failed to fetch Meralco rates during utility submit:', e.message);
    }

    const electricityRateValue = parseNumber(electricityRate) != null
      ? parseNumber(electricityRate)
      : currentMeralcoRate;

    const electricityUsageValue = deriveUsage({
      directUsage: electricityUsage,
      previousReading: electricityPreviousReading,
      presentReading: electricityPresentReading
    });

    const waterTierComputation = calculateCabuyaoWaterBill(waterUsageValue, waterRateCategoryValue);
    const waterCostValue = parseNumber(waterCost) != null
      ? parseNumber(waterCost)
      : waterRateValue != null
        ? Number((waterUsageValue * waterRateValue).toFixed(2))
        : waterTierComputation.estimated_cost;

    const autoWaterCostBasis = waterRateCategoryValue === 'hvha_hongkong_village'
      ? 'hvha_flat_rate_sample'
      : 'cabuyao_tiered_schedule';

    const storedWaterRateValue = waterRateValue != null
      ? waterRateValue
      : waterTierComputation.effective_rate;

    const electricityCostValue = parseNumber(electricityCost) != null
      ? parseNumber(electricityCost)
      : electricityRateValue != null
        ? Number((electricityUsageValue * electricityRateValue).toFixed(2))
        : 0;

    let waterReading = null;
    if (hasWaterInput) {
      waterReading = await dbRun(
        `INSERT INTO utility_readings (tenant_id, meter_type, reading, reading_date, estimated_cost, currency, water_rate) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [tenantId, 'water', waterUsageValue, dateStr, waterCostValue || 0, billCurrency, storedWaterRateValue]
      );

      console.log('Water reading inserted:', waterReading);
    }

    let electricityReading = null;
    if (hasElectricityInput) {
      electricityReading = await dbRun(
        `INSERT INTO utility_readings (tenant_id, meter_type, reading, reading_date, estimated_cost, currency) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [tenantId, 'electricity', electricityUsageValue, dateStr, electricityCostValue, billCurrency]
      );

      console.log('Electricity reading inserted:', electricityReading);
    }

    // Notify tenant of new utility readings (best effort)
    try {
      if (waterReading || electricityReading) {
        sendEventToTenant(tenantId, 'utility_update', {
          month,
          water: waterReading ? {
            id: waterReading.id,
            usage: waterUsageValue,
            cost: waterCostValue || 0,
            currency: billCurrency,
            rate: storedWaterRateValue,
            rate_category: waterRateCategoryValue,
            cost_basis: parseNumber(waterCost) != null
              ? 'manual_cost'
              : waterRateValue != null
                ? 'manual_flat_rate'
                : autoWaterCostBasis
          } : null,
          electricity: electricityReading ? {
            id: electricityReading.id,
            usage: electricityUsageValue,
            cost: electricityCostValue,
            currency: billCurrency,
            rate: electricityRateValue
          } : null,
          message: 'New utility readings have been recorded for your account.'
        });
      }
    } catch (e) {
      console.warn('Failed to send SSE utility_update:', e);
    }

    // Store rent/bill data if provided
    if (rentValue > 0) {
      const rentResult = await dbRun(
        `INSERT INTO rent_payments (tenant_id, amount, currency, due_date, status, created_at) 
         VALUES (?, ?, ?, ?, ?, datetime('now'))`,
        [tenantId, rentValue, billCurrency, dateStr, 'pending']
      );
      console.log('Rent payment inserted');

      // Notify tenant via SSE about the new bill (best-effort)
      try {
        sendEventToTenant(tenantId, 'new_bill', {
          id: rentResult.id,
          amount: rentValue,
          due_date: dateStr,
          currency: billCurrency,
          message: 'A new bill has been created by admin.'
        });
      } catch (e) {
        console.warn('Failed to send SSE new_bill:', e);
      }
    }

    res.json({
      success: true,
      message: 'Utility data submitted successfully',
      data: {
        month,
        water: {
          usage: hasWaterInput ? waterUsageValue : null,
          rate: hasWaterInput ? storedWaterRateValue : null,
          rate_category: hasWaterInput ? waterRateCategoryValue : null,
          estimated_cost: hasWaterInput ? waterCostValue : null,
          cost_basis: hasWaterInput
            ? (parseNumber(waterCost) != null
              ? 'manual_cost'
              : waterRateValue != null
                ? 'manual_flat_rate'
                : autoWaterCostBasis)
            : null
        },
        electricity: {
          usage: hasElectricityInput ? electricityUsageValue : null,
          rate: hasElectricityInput ? electricityRateValue : null,
          estimated_cost: hasElectricityInput ? electricityCostValue : null
        }
      }
    });
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
      `INSERT INTO rent_payments (tenant_id, amount, currency, due_date, status, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))`,
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

// Update tenant information
router.put('/tenants/:id', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, email, phone, unitNumber } = req.body;

    // Validate tenant exists
    const tenant = await dbGet('SELECT * FROM users WHERE id = ? AND role = ?', [id, 'tenant']);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    // Check if email is being changed and if it already exists
    if (email !== tenant.email) {
      const emailExists = await dbGet('SELECT id FROM users WHERE email = ? AND id != ?', [email, id]);
      if (emailExists) {
        return res.status(400).json({ success: false, message: 'Email already in use' });
      }
    }

    // Update user information
    await dbRun(
      'UPDATE users SET email = ?, full_name = ?, phone = ?, updated_at = datetime("now") WHERE id = ?',
      [email, fullName, phone || null, id]
    );

    // Update apartment unit if needed
    const apartment = await dbGet('SELECT * FROM apartments WHERE tenant_id = ?', [id]);
    if (apartment && unitNumber !== apartment.unit_number) {
      // Check if new unit number already exists
      const unitExists = await dbGet('SELECT id FROM apartments WHERE unit_number = ? AND id != ?', [unitNumber, apartment.id]);
      if (unitExists) {
        return res.status(400).json({ success: false, message: 'Unit number already assigned' });
      }
      
      await dbRun(
        'UPDATE apartments SET unit_number = ? WHERE id = ?',
        [unitNumber, apartment.id]
      );
    }

    res.json({
      success: true,
      message: 'Tenant updated successfully',
      data: {
        id,
        email,
        fullName,
        phone,
        unitNumber
      }
    });
  } catch (error) {
    console.error('Error updating tenant:', error);
    res.status(500).json({ success: false, message: 'Failed to update tenant', error: error.message });
  }
});

// Reset tenant password
router.patch('/tenants/:id/reset-password', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || String(newPassword).length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const tenant = await dbGet('SELECT id, email, full_name FROM users WHERE id = ? AND role = ?', [id, 'tenant']);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await dbRun(
      'UPDATE users SET password = ?, first_login = 1, updated_at = datetime("now") WHERE id = ?',
      [hashedPassword, id]
    );

    try {
      await sendAdminPasswordResetNotice({
        toEmail: tenant.email,
        fullName: tenant.full_name,
        newPassword,
        roleLabel: 'tenant account'
      });
    } catch (mailError) {
      console.warn('Tenant reset password email failed:', mailError.message);
    }

    res.json({ success: true, message: 'Tenant password reset successfully' });
  } catch (error) {
    console.error('Error resetting tenant password:', error);
    res.status(500).json({ success: false, message: 'Failed to reset tenant password', error: error.message });
  }
});

// Delete tenant account and related records
router.delete('/tenants/:id', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const tenant = await dbGet('SELECT id FROM users WHERE id = ? AND role = ?', [id, 'tenant']);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    await dbRun('DELETE FROM complaints WHERE tenant_id = ?', [id]);
    await dbRun('DELETE FROM utility_readings WHERE tenant_id = ?', [id]);
    await dbRun('DELETE FROM rent_payments WHERE tenant_id = ?', [id]);
    await dbRun('DELETE FROM payment_history WHERE tenant_id = ?', [id]);
    await dbRun('DELETE FROM apartments WHERE tenant_id = ?', [id]);
    await dbRun('DELETE FROM notifications WHERE user_id = ?', [id]);
    await dbRun('DELETE FROM chatbot_conversations WHERE user_id = ?', [id]);
    await dbRun('DELETE FROM chatbot_feedback WHERE user_id = ?', [id]);
    await dbRun('DELETE FROM password_reset_tokens WHERE user_id = ?', [id]);
    await dbRun('DELETE FROM users WHERE id = ? AND role = ?', [id, 'tenant']);

    res.json({ success: true, message: 'Tenant account deleted successfully' });
  } catch (error) {
    console.error('Error deleting tenant:', error);
    res.status(500).json({ success: false, message: 'Failed to delete tenant', error: error.message });
  }
});

// Update maintenance staff information
router.put('/maintenance-staff/:id', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, email, phone } = req.body;

    const staff = await dbGet('SELECT * FROM users WHERE id = ? AND role = ?', [id, 'maintenance_staff']);
    if (!staff) {
      return res.status(404).json({ success: false, message: 'Maintenance staff not found' });
    }

    if (!fullName || !email) {
      return res.status(400).json({ success: false, message: 'Full name and email are required' });
    }

    if (email !== staff.email) {
      const emailExists = await dbGet('SELECT id FROM users WHERE email = ? AND id != ?', [email, id]);
      if (emailExists) {
        return res.status(400).json({ success: false, message: 'Email already in use' });
      }
    }

    await dbRun(
      'UPDATE users SET full_name = ?, email = ?, phone = ?, updated_at = datetime("now") WHERE id = ? AND role = ?',
      [fullName, email, phone || null, id, 'maintenance_staff']
    );

    res.json({ success: true, message: 'Maintenance staff updated successfully' });
  } catch (error) {
    console.error('Error updating maintenance staff:', error);
    res.status(500).json({ success: false, message: 'Failed to update maintenance staff', error: error.message });
  }
});

// Reset maintenance staff password
router.patch('/maintenance-staff/:id/reset-password', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || String(newPassword).length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const staff = await dbGet('SELECT id, email, full_name FROM users WHERE id = ? AND role = ?', [id, 'maintenance_staff']);
    if (!staff) {
      return res.status(404).json({ success: false, message: 'Maintenance staff not found' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await dbRun(
      'UPDATE users SET password = ?, first_login = 1, updated_at = datetime("now") WHERE id = ? AND role = ?',
      [hashedPassword, id, 'maintenance_staff']
    );

    try {
      await sendAdminPasswordResetNotice({
        toEmail: staff.email,
        fullName: staff.full_name,
        newPassword,
        roleLabel: 'maintenance staff account'
      });
    } catch (mailError) {
      console.warn('Maintenance reset password email failed:', mailError.message);
    }

    res.json({ success: true, message: 'Maintenance staff password reset successfully' });
  } catch (error) {
    console.error('Error resetting maintenance password:', error);
    res.status(500).json({ success: false, message: 'Failed to reset maintenance password', error: error.message });
  }
});

// Delete maintenance staff account
router.delete('/maintenance-staff/:id', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const staff = await dbGet('SELECT id FROM users WHERE id = ? AND role = ?', [id, 'maintenance_staff']);
    if (!staff) {
      return res.status(404).json({ success: false, message: 'Maintenance staff not found' });
    }

    await dbRun('UPDATE complaints SET assigned_to = NULL WHERE assigned_to = ?', [id]);
    await dbRun('DELETE FROM notifications WHERE user_id = ?', [id]);
    await dbRun('DELETE FROM chatbot_conversations WHERE user_id = ?', [id]);
    await dbRun('DELETE FROM chatbot_feedback WHERE user_id = ?', [id]);
    await dbRun('DELETE FROM password_reset_tokens WHERE user_id = ?', [id]);
    await dbRun('DELETE FROM users WHERE id = ? AND role = ?', [id, 'maintenance_staff']);

    res.json({ success: true, message: 'Maintenance staff deleted successfully' });
  } catch (error) {
    console.error('Error deleting maintenance staff:', error);
    res.status(500).json({ success: false, message: 'Failed to delete maintenance staff', error: error.message });
  }
});

module.exports = router;
