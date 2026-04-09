const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const {
  sendPasswordResetEmail,
  sendTenantWelcomeEmail,
  sendTenantActivationEmail,
  sendNewTenantAlertToAdmin
} = require('../services/emailService');

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

const getFrontendBaseUrl = () => {
  return (process.env.FRONTEND_URL || 'http://localhost:3000')
    .split(',')
    .map((value) => value.trim())
    .find(Boolean) || 'http://localhost:3000';
};

const createPasswordSetupToken = async (userId, expiresMinutes) => {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + expiresMinutes * 60 * 1000);

  await dbRun(
    'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
    [userId, hashedToken, expiresAt]
  );

  return rawToken;
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

    // Email notifications are best effort and should not block registration success.
    Promise.allSettled([
      sendTenantWelcomeEmail({ toEmail: email, fullName, unitNumber }),
      sendNewTenantAlertToAdmin({
        tenantName: fullName,
        tenantEmail: email,
        unitNumber,
        createdBy: 'Self Registration'
      })
    ]).then((results) => {
      results
        .filter((r) => r.status === 'rejected')
        .forEach((r) => console.warn('Registration email notification failed:', r.reason?.message || r.reason));
    });

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
      user: { 
        id: user.id, 
        email: user.email, 
        fullName: user.full_name, 
        role: user.role,
        firstLogin: user.first_login || false
      },
      token
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Login failed', error: error.message });
  }
});

// Admin: Create Tenant Account
// Protected route - only admins can create tenant accounts
router.post('/admin/create-tenant', authenticateToken, authorizeRole('admin'), [
  body('email').isEmail().withMessage('Valid email required'),
  body('fullName').notEmpty().withMessage('Full name required'),
  body('unitNumber').notEmpty().withMessage('Unit number required')
], async (req, res) => {
  console.log('Admin create tenant endpoint hit. Admin ID:', req.user.id);
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('Validation errors:', errors.array());
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const { email, fullName, unitNumber, phone } = req.body;
    console.log('Admin creating tenant account for:', email);

    // Check if user already exists
    const userCheck = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
    if (userCheck) {
      console.log('Email already registered:', email);
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    // Generate a server-only random password so the tenant must activate the account.
    const generatedPassword = crypto.randomBytes(32).toString('hex');
    const hashedPassword = await bcrypt.hash(generatedPassword, 10);

    // Create user with tenant role and first_login flag
    const result = await dbRun(
      'INSERT INTO users (email, password, full_name, role, phone, first_login) VALUES (?, ?, ?, ?, ?, ?)',
      [email, hashedPassword, fullName, 'tenant', phone || null, true]
    );
    console.log('Tenant user created with ID:', result.id);

    const activationExpiryMinutes = Number(process.env.ACTIVATION_LINK_EXPIRE_MINUTES || 2880);
    const activationToken = await createPasswordSetupToken(result.id, activationExpiryMinutes);
    const activationUrl = `${getFrontendBaseUrl().replace(/\/$/, '')}/activate-account/${activationToken}`;

    // Create apartment record with unit number
    await dbRun(
      'INSERT INTO apartments (unit_number, tenant_id) VALUES (?, ?)',
      [unitNumber, result.id]
    );
    console.log('Apartment created for unit:', unitNumber);

    // Email notifications are best effort and should not block account creation success.
    Promise.allSettled([
      sendTenantActivationEmail({
        toEmail: email,
        fullName,
        unitNumber,
        activationUrl,
        expiresMinutes: activationExpiryMinutes
      }),
      sendNewTenantAlertToAdmin({
        tenantName: fullName,
        tenantEmail: email,
        unitNumber,
        createdBy: `Admin ID ${req.user.id}`
      })
    ]).then((results) => {
      results
        .filter((r) => r.status === 'rejected')
        .forEach((r) => console.warn('Admin create tenant email notification failed:', r.reason?.message || r.reason));
    });

    res.status(201).json({
      success: true,
      message: 'Tenant account created. A welcome email with an activation link has been sent.',
      user: { id: result.id, email, fullName, role: 'tenant' },
      activationUrl: process.env.NODE_ENV === 'development' ? activationUrl : undefined
    });
  } catch (error) {
    console.error('Admin create tenant error:', error);
    res.status(500).json({ success: false, message: 'Failed to create tenant account', error: error.message });
  }
});

// Forgot Password - Send reset token
router.post('/forgot-password', [
  body('email').isEmail().withMessage('Valid email required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const { email } = req.body;

    // Check if user exists
    const user = await dbGet('SELECT id, email, full_name FROM users WHERE email = ?', [email]);
    if (!user) {
      // Don't reveal if email exists (security best practice)
      return res.json({ 
        success: true, 
        message: 'If the email exists, a password reset link has been sent.' 
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes expiry

    // Store token in database
    await dbRun(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, hashedToken, expiresAt]
    );

    const frontendBaseUrl = getFrontendBaseUrl();
    const resetUrl = `${frontendBaseUrl.replace(/\/$/, '')}/reset-password/${resetToken}`;

    try {
      await sendPasswordResetEmail({
        toEmail: user.email,
        fullName: user.full_name,
        resetUrl,
        expiresMinutes: 30
      });
    } catch (mailError) {
      console.warn('Password reset email failed:', mailError.message);
    }

    console.log('Reset URL generated:', resetUrl);

    res.json({ 
      success: true, 
      message: 'Password reset link has been sent to your email.',
      // Remove in production: resetUrl for testing
      resetToken: process.env.NODE_ENV === 'development' ? resetToken : undefined
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, message: 'Failed to send reset link', error: error.message });
  }
});

// Verify Reset Token
router.get('/verify-reset-token/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const resetRecord = await dbGet(
      'SELECT id, user_id, expires_at FROM password_reset_tokens WHERE token = ?',
      [hashedToken]
    );

    if (!resetRecord) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
    }

    if (new Date(resetRecord.expires_at) < new Date()) {
      return res.status(400).json({ success: false, message: 'Reset token has expired' });
    }

    res.json({ success: true, message: 'Token is valid' });
  } catch (error) {
    console.error('Verify token error:', error);
    res.status(500).json({ success: false, message: 'Failed to verify token', error: error.message });
  }
});

// Reset Password - Using reset token
router.post('/reset-password', [
  body('token').notEmpty().withMessage('Reset token required'),
  body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const { token, newPassword } = req.body;
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const resetRecord = await dbGet(
      'SELECT id, user_id, expires_at FROM password_reset_tokens WHERE token = ?',
      [hashedToken]
    );

    if (!resetRecord) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
    }

    if (new Date(resetRecord.expires_at) < new Date()) {
      return res.status(400).json({ success: false, message: 'Reset token has expired' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user password and mark onboarding complete.
    await dbRun(
      'UPDATE users SET password = ?, first_login = 0, updated_at = datetime("now") WHERE id = ?',
      [hashedPassword, resetRecord.user_id]
    );

    // Delete used reset token
    await dbRun('DELETE FROM password_reset_tokens WHERE id = ?', [resetRecord.id]);

    res.json({ success: true, message: 'Password has been reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Failed to reset password', error: error.message });
  }
});

// Change Password - Authenticated user
router.post('/change-password', authenticateToken, [
  body('currentPassword').notEmpty().withMessage('Current password required'),
  body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    // Get user
    const user = await dbGet('SELECT password FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and clear first_login flag
    await dbRun(
      'UPDATE users SET password = ?, first_login = 0, updated_at = datetime("now") WHERE id = ?',
      [hashedPassword, userId]
    );

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, message: 'Failed to change password', error: error.message });
  }
});

module.exports = router;
