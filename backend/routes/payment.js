const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const db = require('../config/database');
const axios = require('axios');
const exchange = require('../services/exchange');

// PayPal API base URL
const PAYPAL_API_BASE = process.env.PAYPAL_MODE === 'live' 
  ? 'https://api.paypal.com' 
  : 'https://api.sandbox.paypal.com';

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

// Helper: Get PayPal Access Token
const getPayPalAccessToken = async () => {
  try {
    const auth = Buffer.from(
      `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
    ).toString('base64');

    const response = await axios.post(
      `${PAYPAL_API_BASE}/v1/oauth2/token`,
      'grant_type=client_credentials',
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    return response.data.access_token;
  } catch (error) {
    console.error('Error getting PayPal access token:', error.response?.data || error.message);
    throw error;
  }
};

// Create PayPal payment (server-side flow)
router.post('/paypal/create', authenticateToken, async (req, res) => {
  try {
    const { billId, amount } = req.body;
    const tenantId = req.user.id;

    console.log('Creating PayPal payment (server):', { billId, amount, tenantId });

    if (!billId || !amount) {
      return res.status(400).json({
        success: false,
        message: 'billId and amount are required'
      });
    }

    // Verify bill belongs to tenant
    const bill = await dbGet(
      'SELECT * FROM rent_payments WHERE id = ? AND tenant_id = ?',
      [billId, tenantId]
    );

    if (!bill) {
      return res.status(403).json({ success: false, message: 'Unauthorized - Bill not found' });
    }

    if (parseFloat(amount) > parseFloat(bill.amount)) {
      return res.status(400).json({ success: false, message: 'Payment amount exceeds bill amount' });
    }

    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3000';
    const serverUrl = process.env.SERVER_URL || 'http://localhost:5000';

    // Keep original info
    const originalAmount = parseFloat(amount);
    const originalCurrency = bill.currency || 'PHP';

    // Default converted values (no conversion)
    let convertedAmount = originalAmount;
    let convertedCurrency = originalCurrency;
    let conversionRate = 1;
    let conversionTimestamp = null;

    // If original currency isn't USD, convert to USD for PayPal
    if (originalCurrency !== 'USD') {
      conversionRate = await exchange.getRate(originalCurrency, 'USD');
      convertedAmount = parseFloat((originalAmount * conversionRate).toFixed(2));
      convertedCurrency = 'USD';
      conversionTimestamp = new Date().toISOString();
    }

    const amountStr = convertedAmount.toFixed(2);
    const currencyCode = convertedCurrency;

    const paymentPayload = {
      intent: 'sale',
      payer: {
        payment_method: 'paypal'
      },
      redirect_urls: {
        return_url: `${serverUrl}/api/payment/paypal/callback?billId=${billId}`,
        cancel_url: `${apiUrl}/payment`
      },
      transactions: [{
        amount: {
          total: amountStr,
          currency: currencyCode,
          details: {
            subtotal: amountStr,
            tax: '0.00',
            shipping: '0.00'
          }
        },
        description: `Apartment Rent Payment - Bill #${billId}`,
        item_list: {
          items: [{
            name: `Apartment Rent Payment - Bill #${billId}`,
            sku: `BILL-${billId}`,
            price: amountStr,
            currency: currencyCode,
            quantity: 1
          }]
        }
      }]
    };

    const accessToken = await getPayPalAccessToken();

    const response = await axios.post(
      `${PAYPAL_API_BASE}/v1/payments/payment`,
      paymentPayload,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const payment = response.data;
    console.log('PayPal payment created:', payment.id);

    // Find approval URL
    const approvalUrl = payment.links?.find(link => link.rel === 'approval_url')?.href;

    if (!approvalUrl) {
      return res.status(400).json({
        success: false,
        message: 'Failed to get approval URL from PayPal'
      });
    }

    // Store payment intent in database for tracking
    if (payment.id) {
      await dbRun(
        'INSERT INTO payment_history (tenant_id, rent_id, amount, currency, payment_method, transaction_id, status, original_amount, original_currency, converted_amount, converted_currency, conversion_rate, conversion_timestamp, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime(\'now\'))',
        [tenantId, billId, originalAmount, originalCurrency, 'paypal', payment.id, 'pending', originalAmount, originalCurrency, convertedAmount, convertedCurrency, conversionRate, conversionTimestamp]
      );
    }

    res.json({
      success: true,
      data: {
        paymentId: payment.id,
        approvalUrl: approvalUrl,
        convertedAmount,
        convertedCurrency,
        conversionRate
      }
    });
  } catch (error) {
    console.error('Error creating PayPal payment:', error.response?.data || error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create payment',
      error: error.response?.data || error.message 
    });
  }
});

// Conversion endpoint - returns rate and converted amount
router.get('/convert', authenticateToken, async (req, res) => {
  try {
    const { amount, from, to } = req.query;
    console.log('[PAYMENT] Convert endpoint called:', { amount, from, to, tenantId: req.user?.id });
    
    if (!amount || !from || !to) {
      console.warn('[PAYMENT] Convert endpoint - missing parameters');
      return res.status(400).json({ success: false, message: 'amount, from and to are required' });
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      console.warn('[PAYMENT] Convert endpoint - invalid amount:', amount);
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    const rate = await exchange.getRate(from, to);
    const converted = parseFloat((amountNum * rate).toFixed(2));
    console.log('[PAYMENT] Convert result:', { amount: amountNum, from, to, rate, converted });
    
    res.json({ 
      success: true, 
      data: { 
        rate: parseFloat(rate.toFixed(6)), 
        converted,
        from,
        to
      } 
    });
  } catch (err) {
    console.error('[PAYMENT] Convert preview failed:', err.message || err);
    res.status(500).json({ 
      success: false, 
      message: 'Conversion failed', 
      error: err.message 
    });
  }
});

// Diagnostic endpoint - test conversion without requiring auth
router.get('/test-convert', async (req, res) => {
  try {
    const { amount = '1000', from = 'PHP', to = 'USD' } = req.query;
    console.log('[PAYMENT] Test convert called:', { amount, from, to });
    
    const rate = await exchange.getRate(from, to);
    const converted = parseFloat((parseFloat(amount) * rate).toFixed(2));
    
    res.json({ 
      success: true, 
      data: { 
        rate: parseFloat(rate.toFixed(6)), 
        converted,
        from,
        to,
        message: 'Conversion test successful'
      } 
    });
  } catch (err) {
    console.error('[PAYMENT] Test convert failed:', err.message || err);
    res.status(500).json({ 
      success: false, 
      message: 'Test conversion failed', 
      error: err.message 
    });
  }
});

// Get pending payment for a bill
router.get('/pending/:billId', authenticateToken, async (req, res) => {
  try {
    const { billId } = req.params;
    const tenantId = req.user.id;

    // Get the latest pending payment for this bill
    const payment = await dbGet(
      'SELECT * FROM payment_history WHERE rent_id = ? AND status = ? ORDER BY created_at DESC LIMIT 1',
      [billId, 'pending']
    );

    if (!payment) {
      return res.status(404).json({ 
        success: false, 
        message: 'No pending payment found for this bill' 
      });
    }

    res.json({ 
      success: true, 
      data: payment 
    });
  } catch (error) {
    console.error('Error fetching pending payment:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch payment information' 
    });
  }
});

// Execute PayPal payment
router.post('/paypal/execute', authenticateToken, async (req, res) => {
  try {
    const { paymentId, payerId, billId } = req.body;
    const tenantId = req.user.id;

    console.log('Executing PayPal payment:', { paymentId, payerId, billId });

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        message: 'paymentId and payerId are required'
      });
    }

    // Verify bill belongs to tenant
    const bill = await dbGet(
      'SELECT * FROM rent_payments WHERE id = ? AND tenant_id = ?',
      [billId, tenantId]
    );

    if (!bill) {
      return res.status(403).json({ success: false, message: 'Unauthorized - Bill not found' });
    }

    const accessToken = await getPayPalAccessToken();

    // Build the execute request - payerId might be empty
    const executePayload = {};
    if (payerId) {
      executePayload.payer_id = payerId;
    }

    const response = await axios.post(
      `${PAYPAL_API_BASE}/v1/payments/payment/${paymentId}/execute`,
      executePayload,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const payment = response.data;

    if (payment.state === 'approved') {
      // Mark bill as paid
      const paymentDate = new Date().toISOString().split('T')[0];
      
      await dbRun(
        'UPDATE rent_payments SET status = ?, payment_method = ?, paid_date = ?, updated_at = datetime("now") WHERE id = ?',
        ['paid', 'paypal', paymentDate, billId]
      );

      // Update payment history status
      await dbRun(
        'UPDATE payment_history SET status = ? WHERE transaction_id = ?',
        ['completed', paymentId]
      );

      console.log('PayPal payment executed successfully:', paymentId);

      res.json({
        success: true,
        message: 'Payment completed successfully!',
        data: {
          billId,
          paymentId,
          status: 'paid',
          transactionId: payment.id
        }
      });
    } else {
      // Payment not approved
      await dbRun(
        'UPDATE payment_history SET status = ? WHERE transaction_id = ?',
        ['failed', paymentId]
      );

      res.status(400).json({
        success: false,
        message: 'Payment was not approved'
      });
    }
  } catch (error) {
    console.error('Error executing PayPal payment:', error.response?.data || error.message);
    
    // Update payment history status to failed
    const { paymentId } = req.body;
    if (paymentId) {
      await dbRun(
        'UPDATE payment_history SET status = ? WHERE transaction_id = ?',
        ['failed', paymentId]
      ).catch(err => console.error('Failed to update payment status:', err));
    }

    res.status(500).json({ 
      success: false, 
      message: 'Failed to execute payment',
      error: error.response?.data || error.message 
    });
  }
});

// Submit payment (Tenant payment submission)
router.post('/submit', authenticateToken, async (req, res) => {
  try {
    const { billId, amount, paymentMethod, referenceNumber, notes } = req.body;
    const tenantId = req.user.id;

    console.log('Payment submission:', { billId, amount, paymentMethod, tenantId });

    if (!billId || !amount || !paymentMethod) {
      return res.status(400).json({ 
        success: false, 
        message: 'billId, amount, and paymentMethod are required' 
      });
    }

    // Verify bill belongs to tenant
    const bill = await dbGet(
      'SELECT * FROM rent_payments WHERE id = ? AND tenant_id = ?',
      [billId, tenantId]
    );

    if (!bill) {
      return res.status(403).json({ success: false, message: 'Unauthorized - Bill not found' });
    }

    if (parseFloat(amount) > parseFloat(bill.amount)) {
      return res.status(400).json({ success: false, message: 'Payment amount exceeds bill amount' });
    }

    // Record the payment
    const paymentDate = new Date().toISOString().split('T')[0];
    
    // For full payment, mark as paid; for partial, keep as pending with payment date
    const newStatus = parseFloat(amount) === parseFloat(bill.amount) ? 'paid' : 'pending';
    
    await dbRun(
      'UPDATE rent_payments SET status = ?, payment_method = ?, paid_date = ?, updated_at = datetime("now") WHERE id = ?',
      [newStatus, paymentMethod, paymentDate, billId]
    );

    // Create payment record in payment history
    const billCurrency = bill.currency || 'PHP';

    // Prepare conversion info for PayPal submissions
    let originalAmount = parseFloat(amount);
    let originalCurrency = billCurrency;
    let convertedAmount = null;
    let convertedCurrency = null;
    let conversionRate = null;
    let conversionTimestamp = null;

    if (paymentMethod === 'paypal' && originalCurrency !== 'USD') {
      conversionRate = await exchange.getRate(originalCurrency, 'USD');
      convertedAmount = parseFloat((originalAmount * conversionRate).toFixed(2));
      convertedCurrency = 'USD';
      conversionTimestamp = new Date().toISOString();
    }

    if (paymentMethod === 'paypal') {
      await dbRun(
        'INSERT INTO payment_history (tenant_id, rent_id, amount, currency, payment_method, transaction_id, status, original_amount, original_currency, converted_amount, converted_currency, conversion_rate, conversion_timestamp, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime(\'now\'))',
        [tenantId, billId, originalAmount, originalCurrency, paymentMethod, referenceNumber || 'MANUAL', 'submitted', originalAmount, originalCurrency, convertedAmount, convertedCurrency, conversionRate, conversionTimestamp]
      );
    } else {
      await dbRun(
        'INSERT INTO payment_history (tenant_id, rent_id, amount, currency, payment_method, transaction_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime(\'now\'))',
        [tenantId, billId, amount, billCurrency, paymentMethod, referenceNumber || 'MANUAL', 'submitted']
      );
    }

    console.log('Payment recorded successfully');

    res.status(201).json({ 
      success: true, 
      message: newStatus === 'paid' ? 'Payment recorded successfully!' : 'Partial payment recorded. Thank you!',
      data: {
        billId,
        amount,
        status: newStatus,
        paymentMethod,
        paymentDate
      }
    });
  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(500).json({ success: false, message: 'Failed to process payment', error: error.message });
  }
});

// Get payment history for tenant
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const tenantId = req.user.id;
    const history = await dbAll(
      'SELECT * FROM payment_history WHERE tenant_id = ? ORDER BY created_at DESC',
      [tenantId]
    );
    res.json({ success: true, data: history });
  } catch (error) {
    console.error('Error fetching payment history:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch payment history', error: error.message });
  }
});

// Process payment (Legacy endpoint for payment gateway integration)
router.post('/process', authenticateToken, async (req, res) => {
  try {
    const { rentId, amount, paymentMethod } = req.body;
    const userId = req.user.id;

    // Verify rent belongs to user
    const bill = await dbGet(
      'SELECT * FROM rent_payments WHERE id = ? AND tenant_id = ?',
      [rentId, userId]
    );
    
    if (!bill) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    // TODO: Integrate with payment gateway (Stripe/PayPal/GCash)
    
    // Record payment
    await dbRun(
      'UPDATE rent_payments SET status = ?, payment_method = ?, paid_date = datetime("now") WHERE id = ?',
      ['paid', paymentMethod, rentId]
    );

    const updatedBill = await dbGet('SELECT * FROM rent_payments WHERE id = ?', [rentId]);

    res.json({ success: true, data: updatedBill });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Payment processing failed' });
  }
});

// Handle PayPal callback - execute payment and redirect to success
router.get('/paypal/callback', async (req, res) => {
  try {
    const { billId, paymentId, PayerID } = req.query;
    const frontendUrl = process.env.REACT_APP_API_URL || 'http://localhost:3000';

    console.log('PayPal Callback received:', { billId, paymentId, PayerID });

    if (!billId || !paymentId) {
      console.error('Missing billId or paymentId in callback');
      return res.redirect(`${frontendUrl}/payment?error=missing_params`);
    }

    // Get the pending payment from database
    const payment = await dbGet(
      'SELECT * FROM payment_history WHERE transaction_id = ? AND status = ?',
      [paymentId, 'pending']
    );

    if (!payment) {
      console.error('Payment not found in database:', paymentId);
      return res.redirect(`${frontendUrl}/payment?error=payment_not_found`);
    }

    const tenantId = payment.tenant_id;
    const rentId = payment.rent_id;

    // Execute the payment with PayPal
    const accessToken = await getPayPalAccessToken();

    const executePayload = {};
    if (PayerID) {
      executePayload.payer_id = PayerID;
    }

    console.log('Executing PayPal payment:', { paymentId, PayerID });

    const response = await axios.post(
      `${PAYPAL_API_BASE}/v1/payments/payment/${paymentId}/execute`,
      executePayload,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const executedPayment = response.data;

    if (executedPayment.state === 'approved') {
      console.log('Payment approved by PayPal:', paymentId);

      // Update database - mark as completed
      await dbRun(
        'UPDATE payment_history SET status = ? WHERE transaction_id = ?',
        ['completed', paymentId]
      );

      // Update rent_payments as paid with current date
      await dbRun(
        'UPDATE rent_payments SET status = ?, paid_date = datetime("now"), payment_method = ? WHERE id = ?',
        ['paid', 'paypal', rentId]
      );

      console.log('Payment marked as completed in database');

      // Redirect to success page
      return res.redirect(`${frontendUrl}/payment/success?billId=${billId}&paymentId=${paymentId}&status=success`);
    } else {
      console.error('Payment not approved by PayPal:', executedPayment.state);
      
      // Update database - mark as failed
      await dbRun(
        'UPDATE payment_history SET status = ? WHERE transaction_id = ?',
        ['failed', paymentId]
      );

      return res.redirect(`${frontendUrl}/payment?error=payment_rejected`);
    }
  } catch (error) {
    console.error('PayPal callback error:', error.response?.data || error.message);
    const frontendUrl = process.env.REACT_APP_API_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/payment?error=callback_failed`);
  }
});

// Handle PayPal redirect from /payment/success (legacy - for backwards compatibility)
router.get('/success', async (req, res) => {
  try {
    const { billId, paymentId } = req.query;
    const frontendUrl = process.env.REACT_APP_API_URL || 'http://localhost:3000';
    
    let redirectUrl = `${frontendUrl}/payment/success?billId=${billId}`;
    if (paymentId) {
      redirectUrl += `&paymentId=${paymentId}`;
    }
    
    console.log('Legacy success redirect:', redirectUrl);
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('Payment success redirect error:', error);
    const frontendUrl = process.env.REACT_APP_API_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/payment?error=redirect_failed`);
  }
});

// ========================
// ADMIN ENDPOINTS
// ========================

// Get all payment records (admin only)
router.get('/admin/all', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const combinedBase = `
      FROM (
        SELECT 
          CAST(ph.id AS TEXT) AS id,
          ph.tenant_id,
          ph.rent_id,
          ph.amount,
          ph.currency,
          ph.original_amount,
          ph.original_currency,
          ph.converted_amount,
          ph.converted_currency,
          ph.conversion_rate,
          ph.payment_method,
          ph.transaction_id,
          ph.status,
          ph.created_at,
          u.full_name as tenant_name,
          u.email as tenant_email,
          a.unit_number,
          rp.due_date,
          rp.status as bill_status
        FROM payment_history ph
        JOIN users u ON ph.tenant_id = u.id
        LEFT JOIN apartments a ON u.id = a.tenant_id
        JOIN rent_payments rp ON ph.rent_id = rp.id

        UNION ALL

        SELECT
          'bill-' || CAST(rp.id AS TEXT) AS id,
          rp.tenant_id,
          rp.id as rent_id,
          rp.amount,
          rp.currency,
          NULL as original_amount,
          NULL as original_currency,
          NULL as converted_amount,
          NULL as converted_currency,
          NULL as conversion_rate,
          'unsubmitted' as payment_method,
          '-' as transaction_id,
          'pending' as status,
          rp.created_at,
          u.full_name as tenant_name,
          u.email as tenant_email,
          a.unit_number,
          rp.due_date,
          rp.status as bill_status
        FROM rent_payments rp
        JOIN users u ON rp.tenant_id = u.id
        LEFT JOIN apartments a ON u.id = a.tenant_id
        WHERE rp.status = 'pending'
          AND NOT EXISTS (
            SELECT 1
            FROM payment_history ph2
            WHERE ph2.rent_id = rp.id
          )
      ) combined
    `;

    const params = [];
    let whereClause = '';
    if (status) {
      whereClause = ' WHERE combined.status = ?';
      params.push(status);
    }

    const query = `
      SELECT *
      ${combinedBase}
      ${whereClause}
      ORDER BY datetime(created_at) DESC
      LIMIT ? OFFSET ?
    `;
    params.push(parseInt(limit), offset);

    const payments = await dbAll(query, params);

    // Get total count (must match combined result)
    const countQuery = `
      SELECT COUNT(*) as count
      ${combinedBase}
      ${whereClause}
    `;

    const countResult = await dbGet(countQuery, status ? [status] : []);
    const totalCount = countResult.count;

    res.json({
      success: true,
      data: payments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching payment records:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch payment records', error: error.message });
  }
});

// Get payment statistics (admin only)
router.get('/admin/stats', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    // Total payments - counts all payment_history records
    const totalStats = await dbGet(`
      SELECT 
        COUNT(*) as total_payments,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count
      FROM payment_history
    `);

    console.log('[STATS] Total stats from DB:', totalStats);

    // Totals per currency (useful when mixed currencies present)
    const totalsByCurrency = await dbAll(`
      SELECT currency, COALESCE(SUM(amount), 0) as total_amount, COUNT(*) as count
      FROM payment_history
      GROUP BY currency
    `);

    // Determine most common currency used (for display)
    const currencyRow = await dbGet(`SELECT currency, COUNT(*) as cnt FROM payment_history GROUP BY currency ORDER BY cnt DESC LIMIT 1`);
    const dominantCurrency = currencyRow?.currency || 'PHP';
    totalStats.currency = dominantCurrency;

    // Also attach totalsByCurrency
    totalStats.totalsByCurrency = totalsByCurrency;

    // Payments by method
    const byMethod = await dbAll(`
      SELECT payment_method, COUNT(*) as count, COALESCE(SUM(amount), 0) as total
      FROM payment_history
      WHERE status = 'completed'
      GROUP BY payment_method
      ORDER BY count DESC
    `);

    console.log('[STATS] By method:', byMethod);

    // Payments by status
    const byStatus = await dbAll(`
      SELECT status, COUNT(*) as count, COALESCE(SUM(amount), 0) as total
      FROM payment_history
      GROUP BY status
    `);

    console.log('[STATS] By status:', byStatus);

    res.json({
      success: true,
      data: {
        totalStats,
        byMethod,
        byStatus
      }
    });
  } catch (error) {
    console.error('Error fetching payment stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch payment statistics', error: error.message });
  }
});

// Get payments for a specific tenant (admin only)
router.get('/admin/tenant/:tenantId', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const { tenantId } = req.params;

    const payments = await dbAll(`
      SELECT 
        ph.id,
        ph.tenant_id,
        ph.rent_id,
        ph.amount,
        ph.payment_method,
        ph.transaction_id,
        ph.status,
        ph.created_at,
        rp.due_date,
        rp.status as bill_status
      FROM payment_history ph
      JOIN rent_payments rp ON ph.rent_id = rp.id
      WHERE ph.tenant_id = ?
      ORDER BY ph.created_at DESC
    `, [tenantId]);

    res.json({ success: true, data: payments });
  } catch (error) {
    console.error('Error fetching tenant payments:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch tenant payments', error: error.message });
  }
});

// Reset all payment data (admin only) - for testing purposes
router.post('/admin/reset', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    // Clear payment_history table
    await dbRun('DELETE FROM payment_history', []);
    console.log('[RESET] Cleared payment_history table');

    // Reset all rent_payments to pending status
    await dbRun(
      'UPDATE rent_payments SET status = ?, payment_method = ?, paid_date = ? WHERE 1=1',
      ['pending', null, null]
    );
    console.log('[RESET] Reset all bills to pending status');

    res.json({
      success: true,
      message: 'Payment data reset successfully. All bills are now pending.'
    });
  } catch (error) {
    console.error('Error resetting payment data:', error);
    res.status(500).json({ success: false, message: 'Failed to reset payment data', error: error.message });
  }
});

module.exports = router;
