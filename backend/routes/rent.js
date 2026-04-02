const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const db = require('../config/database');

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

// Get rent status for tenant
router.get('/status/:tenantId', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    console.log('[RENT] Fetching rent status for tenant:', tenantId);
    
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'tenantId is required' });
    }

    const bills = await dbAll(
      'SELECT * FROM rent_payments WHERE tenant_id = ? ORDER BY due_date DESC',
      [tenantId]
    );
    console.log('[RENT] Bills found:', bills);
    
    res.json({ success: true, data: bills || [] });
  } catch (error) {
    console.error('[RENT] Error fetching rent status:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch rent status', error: error.message });
  }
});

// Get all rent records (Admin only)
router.get('/all', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const result = await dbAll(
      'SELECT rp.*, u.full_name, u.email FROM rent_payments rp LEFT JOIN users u ON rp.tenant_id = u.id ORDER BY rp.due_date DESC'
    );
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching rent records:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch rent records' });
  }
});

module.exports = router;
