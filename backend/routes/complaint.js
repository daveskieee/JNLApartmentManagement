const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const db = require('../config/database');

const dbRun = (sql, params) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID });
    });
  });
};

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

// Submit complaint (Tenant)
router.post('/submit', authenticateToken, async (req, res) => {
  try {
    const { title, description, category, priority } = req.body;
    const tenantId = req.user.id;

    console.log('Submitting complaint for tenant:', tenantId);
    console.log('Data:', { title, description, category, priority });

    if (!title || !description) {
      return res.status(400).json({ success: false, message: 'Title and description are required' });
    }

    const result = await dbRun(
      'INSERT INTO complaints (tenant_id, title, description, category, priority, status, created_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
      [tenantId, title, description, category || 'maintenance', priority || 'normal', 'submitted']
    );

    console.log('Complaint created with ID:', result.id);

    res.status(201).json({ 
      success: true, 
      data: { id: result.id, tenant_id: tenantId, title, description, category, priority, status: 'submitted' }
    });
  } catch (error) {
    console.error('Error submitting complaint:', error);
    res.status(500).json({ success: false, message: 'Failed to submit complaint', error: error.message });
  }
});

// Get complaints for tenant
router.get('/my-complaints', authenticateToken, async (req, res) => {
  try {
    const tenantId = req.user.id;
    const complaints = await dbAll(
      'SELECT * FROM complaints WHERE tenant_id = ? ORDER BY created_at DESC',
      [tenantId]
    );
    res.json({ success: true, data: complaints });
  } catch (error) {
    console.error('Error fetching complaints:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch complaints', error: error.message });
  }
});

// Get assigned tasks for maintenance staff
router.get('/assigned-tasks/me', authenticateToken, async (req, res) => {
  try {
    const maintenanceStaffId = req.user.id;
    const tasks = await dbAll(
      'SELECT c.*, u.full_name, u.email FROM complaints c LEFT JOIN users u ON c.tenant_id = u.id WHERE c.assigned_to = ? ORDER BY c.priority DESC, c.created_at DESC',
      [maintenanceStaffId]
    );
    res.json({ success: true, data: tasks });
  } catch (error) {
    console.error('Error fetching assigned tasks:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch assigned tasks', error: error.message });
  }
});

// Get all complaints (Admin)
router.get('/all', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const complaints = await dbAll(
      'SELECT c.*, u.full_name, u.email FROM complaints c LEFT JOIN users u ON c.tenant_id = u.id ORDER BY c.priority DESC, c.created_at DESC'
    );
    res.json({ success: true, data: complaints });
  } catch (error) {
    console.error('Error fetching all complaints:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch complaints', error: error.message });
  }
});

// Update complaint status (Admin or assigned Maintenance Staff)
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!['submitted', 'in_progress', 'resolved', 'closed'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    // Get the complaint to check who it's assigned to
    const complaint = await dbGet('SELECT * FROM complaints WHERE id = ?', [id]);
    console.log(`[UPDATE] User ${userId} (${userRole}) updating complaint ${id}. Complaint assigned_to: ${complaint?.assigned_to}`);
    
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    // Authorization: Admin can update any, maintenance staff can only update their own assigned tasks
    if (userRole === 'admin') {
      // Admin can update any complaint
      console.log(`[UPDATE] Admin ${userId} authorized to update complaint ${id}`);
    } else if (userRole === 'maintenance_staff') {
      // Maintenance staff can only update tasks assigned to them
      if (complaint.assigned_to !== userId) {
        console.log(`[UPDATE] Maintenance staff ${userId} NOT authorized - task assigned to ${complaint.assigned_to}`);
        return res.status(403).json({ success: false, message: 'Not authorized to update this complaint' });
      }
      console.log(`[UPDATE] Maintenance staff ${userId} authorized to update complaint ${id}`);
    } else {
      // Other roles cannot update
      return res.status(403).json({ success: false, message: 'Not authorized to update complaints' });
    }

    await dbRun(
      'UPDATE complaints SET status = ? WHERE id = ?',
      [status, id]
    );

    console.log(`[UPDATE] Successfully updated complaint ${id} to status ${status}`);
    res.json({ success: true, message: 'Complaint status updated' });
  } catch (error) {
    console.error('Error updating complaint:', error);
    res.status(500).json({ success: false, message: 'Failed to update complaint', error: error.message });
  }
});

// Assign complaint to maintenance staff (Admin)
router.patch('/:id/assign', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedTo } = req.body;

    if (!assignedTo) {
      return res.status(400).json({ success: false, message: 'Please select maintenance staff' });
    }

    console.log(`[ASSIGN] Admin assigning complaint ${id} to staff ${assignedTo}`);
    
    await dbRun(
      'UPDATE complaints SET assigned_to = ? WHERE id = ?',
      [assignedTo, id]
    );

    console.log(`[ASSIGN] Successfully assigned complaint ${id} to staff ${assignedTo}`);
    res.json({ success: true, message: 'Complaint assigned to maintenance staff' });
  } catch (error) {
    console.error('Error assigning complaint:', error);
    res.status(500).json({ success: false, message: 'Failed to assign complaint', error: error.message });
  }
});

module.exports = router;
