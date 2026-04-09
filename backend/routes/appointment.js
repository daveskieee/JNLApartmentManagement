const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { sendAppointmentRequestEmails } = require('../services/emailService');

const router = express.Router();

const dbRun = (sql, params) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ id: this.lastID, changes: this.changes });
      }
    });
  });
};

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows || []);
      }
    });
  });
};

const createNotification = async (userId, message) => {
  try {
    await dbRun(
      'INSERT INTO notifications (user_id, message, is_read, created_at) VALUES (?, ?, 0, datetime(\'now\'))',
      [userId, message]
    );
  } catch (error) {
    console.warn('Failed to create appointment notification:', error.message);
  }
};

router.post('/request', [
  body('fullName').trim().notEmpty().withMessage('Full name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('preferredDate').trim().notEmpty().withMessage('Preferred date is required'),
  body('building').isIn(['A', 'B', 'C', 'D', 'E']).withMessage('Invalid building selection')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const { fullName, email, preferredDate, building } = req.body;

    const insertResult = await dbRun(
      `INSERT INTO appointments (full_name, email, preferred_date, building, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [fullName, email, preferredDate, building]
    );

    const admins = await dbAll('SELECT id FROM users WHERE role = ?', ['admin']);
    for (const admin of admins) {
      await createNotification(
        admin.id,
        `New appointment request from ${fullName} (${email}) for Building ${building} on ${preferredDate}.`
      );
    }

    if (insertResult?.id && admins.length > 0) {
      console.log(`Appointment ${insertResult.id} notifications sent to ${admins.length} admin(s)`);
    }

    // Do not fail request if email send fails.
    sendAppointmentRequestEmails({ fullName, email, preferredDate, building })
      .then((result) => {
        if (!result.adminSent || !result.userSent) {
          console.warn('Appointment email partially sent:', result);
        }
      })
      .catch((emailError) => {
        console.warn('Appointment email notification failed:', emailError.message);
      });

    return res.status(201).json({
      success: true,
      message: 'Appointment request submitted successfully. We will contact you shortly.'
    });
  } catch (error) {
    console.error('Appointment request error:', error);
    return res.status(500).json({ success: false, message: 'Failed to submit appointment request' });
  }
});

module.exports = router;
