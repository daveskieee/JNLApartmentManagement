const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { subscribe, sendEventToTenant } = require('../services/sse');

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

module.exports = router;
