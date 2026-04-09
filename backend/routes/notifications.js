const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { subscribe, sendEventToTenant } = require('../services/sse');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

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

const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ changes: this.changes, id: this.lastID });
    });
  });
};

// SSE subscribe endpoint
// Accepts token via Authorization header or ?token=... query param
router.get('/subscribe', async (req, res) => {
  try {
    // Allow using query token because EventSource does not support custom headers
    const token = (req.headers['authorization'] && req.headers['authorization'].split(' ')[1]) || req.query.token;
    if (!token) {
      return res.status(401).json({ success: false, message: 'Access token required for SSE' });
    }

    let user;
    try {
      user = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(403).json({ success: false, message: 'Invalid or expired token' });
    }

    // Only tenants need SSE currently
    const tenantId = user.id;

    // Set headers for SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    // Disable timeout for long-lived request
    req.setTimeout(0);

    // Subscribe to events
    subscribe(tenantId, res);

    // Keep the connection open
  } catch (error) {
    console.error('SSE subscribe error:', error);
    res.status(500).json({ success: false, message: 'Failed to subscribe to notifications', error: error.message });
  }
});

// List notifications for authenticated user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);

    const rows = await dbAll(
      `SELECT id, user_id, message, is_read, created_at
       FROM notifications
       WHERE user_id = ?
       ORDER BY datetime(created_at) DESC
       LIMIT ?`,
      [userId, limit]
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Notifications list error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch notifications', error: error.message });
  }
});

// Unread notifications count
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const row = await dbGet(
      `SELECT COUNT(*) AS unread
       FROM notifications
       WHERE user_id = ? AND COALESCE(is_read, 0) = 0`,
      [userId]
    );

    res.json({ success: true, data: { unread: row?.unread || 0 } });
  } catch (error) {
    console.error('Unread count error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch unread count', error: error.message });
  }
});

// Mark one notification as read
router.patch('/:id/read', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await dbRun(
      `UPDATE notifications
       SET is_read = 1
       WHERE id = ? AND user_id = ?`,
      [id, userId]
    );

    if (!result.changes) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ success: false, message: 'Failed to mark as read', error: error.message });
  }
});

// Mark all notifications as read
router.patch('/mark-all-read', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    await dbRun(
      `UPDATE notifications
       SET is_read = 1
       WHERE user_id = ? AND COALESCE(is_read, 0) = 0`,
      [userId]
    );

    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ success: false, message: 'Failed to mark all as read', error: error.message });
  }
});

// Clear all notifications
router.delete('/clear-all', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await dbRun(
      `DELETE FROM notifications
       WHERE user_id = ?`,
      [userId]
    );

    res.json({ success: true, message: 'All notifications cleared', data: { deleted: result.changes || 0 } });
  } catch (error) {
    console.error('Clear all notifications error:', error);
    res.status(500).json({ success: false, message: 'Failed to clear notifications', error: error.message });
  }
});

// Clear one notification
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await dbRun(
      `DELETE FROM notifications
       WHERE id = ? AND user_id = ?`,
      [id, userId]
    );

    if (!result.changes) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.json({ success: true, message: 'Notification cleared' });
  } catch (error) {
    console.error('Clear notification error:', error);
    res.status(500).json({ success: false, message: 'Failed to clear notification', error: error.message });
  }
});

module.exports = router;
