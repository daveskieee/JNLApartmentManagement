const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const axios = require('axios');

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

// Simple tokenizer and feedback model (in-memory). This is lightweight incremental "ML" that learns from feedbacked Q/A pairs.
const tokenize = (text) => {
  return (text || '')
    .toLowerCase()
    .replace(/["'`.,!?;:()-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
};

let feedbackModel = { entries: [] };

const loadFeedbackModel = async () => {
  try {
    const rows = await dbAll('SELECT message, response FROM chatbot_feedback WHERE helpful = 1');
    const map = new Map();
    rows.forEach(r => {
      const key = (r.message || '').trim().toLowerCase();
      if (!key) return;
      const tokenSet = new Set(tokenize(key));
      const resp = (r.response || '').trim();
      const hash = resp + '||' + key; // unique
      if (!map.has(hash)) map.set(hash, { tokens: tokenSet, response: resp, count: 0 });
      map.get(hash).count += 1;
    });
    feedbackModel.entries = Array.from(map.values());
    console.log('[CHATBOT] Feedback model loaded, entries:', feedbackModel.entries.length);
  } catch (err) {
    console.error('Failed to load feedback model:', err);
    feedbackModel.entries = [];
  }
};

// Jaccard similarity on token sets
const jaccard = (a, b) => {
  const A = Array.from(a);
  const B = Array.from(b);
  const inter = A.filter(x => B.includes(x)).length;
  const union = new Set([...A, ...B]).size || 1;
  return inter / union;
};

const findBestFeedbackResponse = (message) => {
  if (!message) return null;
  const tokens = new Set(tokenize(message));
  let best = null;
  let bestScore = 0;
  feedbackModel.entries.forEach(e => {
    const score = jaccard(tokens, e.tokens);
    if (score > bestScore) {
      bestScore = score;
      best = e;
    }
  });
  // threshold — only return if reasonably similar
  if (bestScore >= 0.35) return best.response;
  return null;
};

// Load feedback model at startup
loadFeedbackModel();

// Get tenant's real data
const getTenantData = async (userId) => {
  try {
    const rentPayments = await dbAll(
      'SELECT * FROM rent_payments WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 10',
      [userId]
    );
    const utilitiesRaw = await dbAll(
      'SELECT * FROM utility_readings WHERE tenant_id = ? ORDER BY reading_date DESC LIMIT 12',
      [userId]
    );
    const utilities = utilitiesRaw.map(u => ({
      ...u,
      reading: u.reading_value || u.reading || 0,
      utility_type: u.utility_type || u.meter_type,
      estimated_cost: u.estimated_cost || u.cost || 0,
      unit: u.unit || ''
    }));
    const complaints = await dbAll(
      'SELECT * FROM complaints WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 5',
      [userId]
    );
    
    return { rentPayments, utilities, complaints };
  } catch (error) {
    console.error('Error fetching tenant data:', error);
    return { rentPayments: [], utilities: [], complaints: [] };
  }
};

// Generate smart response based on real data
const generateSmartResponse = async (message, userId, tenantData, apartmentInfo) => {
  const msg = message.toLowerCase();
  
  // Rent-related questions
  if (msg.includes('rent') || msg.includes('payment')) {
    const pendingRents = tenantData.rentPayments?.filter(r => r.status === 'pending') || [];
    if (pendingRents.length > 0) {
      const total = pendingRents.reduce((sum, r) => sum + (r.amount || 0), 0);
      const currency = pendingRents[0]?.currency || 'PHP';
      const symbol = currency === 'USD' ? '$' : '₱';
      const totalStr = symbol + Number(total).toLocaleString(undefined, {maximumFractionDigits:2});
      return `You have ${pendingRents.length} pending rent payment(s) totaling ${totalStr}. Your rent is due on the 1st of each month. You can pay online via our payment portal.`;
    }
    return 'Your rent account is up to date! Make sure to pay by the 1st of each month.';
  }

  // Utility-related questions (water, electricity, gas, bills)
  if (msg.includes('water') || msg.includes('electric') || msg.includes('electricity') || msg.includes('gas') || msg.includes('utility') || msg.includes('consumption') || msg.includes('bill')) {
    const utilities = tenantData.utilities || [];
    if (utilities.length === 0) {
      return 'No utility data available yet. Readings will appear once they are recorded.';
    }

    // detect if user asked about a specific utility
    const askedElectric = msg.includes('electric') || msg.includes('electricity') || msg.includes('power');
    const askedWater = msg.includes('water');
    const askedGas = msg.includes('gas');

    const groupByType = utilities.reduce((acc, u) => {
      const type = (u.utility_type || 'other').toLowerCase();
      acc[type] = acc[type] || [];
      acc[type].push(u);
      return acc;
    }, {});

    const formatSingle = (type, items) => {
      const avg = items.reduce((s, it) => s + (it.reading || 0), 0) / items.length;
      const avgCost = items.reduce((s, it) => s + (it.estimated_cost || 0), 0) / items.length;
      const currency = items[0]?.currency || 'PHP';
      const symbol = currency === 'USD' ? '$' : '₱';
      const unit = (items[0]?.unit) || (type.includes('water') ? 'm³' : type.includes('electric') ? 'kWh' : '');
      return `${type[0].toUpperCase() + type.slice(1)} — avg usage: ${avg.toFixed(2)} ${unit}${avgCost ? `, avg cost: ${symbol + Number(avgCost).toLocaleString(undefined, {maximumFractionDigits:2})}` : ''}`;
    };

    if (askedWater || askedElectric || askedGas) {
      const askedType = askedWater ? 'water' : askedElectric ? 'electricity' : 'gas';
      const items = Object.entries(groupByType).find(([k]) => k.includes(askedType))?.[1] || [];
      if (items.length === 0) {
        return `No ${askedType} readings available yet.`;
      }
      return formatSingle(askedType, items);
    }

    // generic summary for all utilities
    const summaries = Object.entries(groupByType).map(([type, items]) => formatSingle(type, items));
    return `Utility summary:\n${summaries.join('\n')}`;
  }

  // Complaint-related
  if (msg.includes('complaint') || msg.includes('issue') || msg.includes('problem') || msg.includes('file')) {
    const openComplaints = tenantData.complaints?.filter(c => c.status === 'submitted' || c.status === 'in_progress') || [];
    if (openComplaints.length > 0) {
      return `You have ${openComplaints.length} pending complaint(s). You can submit a new complaint through the Complaints section. Our maintenance team will assist you within 24-48 hours.`;
    }
    return 'You don\'t have any pending complaints. If you need assistance, please submit a new complaint with details.';
  }

  // Maintenance
  if (msg.includes('maintenance') || msg.includes('repair') || msg.includes('fix') || msg.includes('maintenance')) {
    return 'For maintenance issues, please submit a complaint with details about the problem. Our team will contact you within 24 hours to schedule a visit.';
  }

  // Unit/Apartment info
  if (msg.includes('unit') || msg.includes('apartment') || msg.includes('room') || msg.includes('address')) {
    if (apartmentInfo && apartmentInfo.unit_number) {
      return `Your unit number is ${apartmentInfo.unit_number}. Building: ${apartmentInfo.building || 'Main'}, Floor: ${apartmentInfo.floor || 'Not specified'}. Contact admin for any updates to your apartment info.`;
    }
    return 'Your apartment information is stored in the system. Contact the admin office for details about your unit.';
  }

  // Contact/Owner related
  if (msg.includes('contact') || msg.includes('owner') || msg.includes('landlord') || msg.includes('admin') || msg.includes('manager')) {
    return 'You can contact the property management office:\n📞 Phone: (02) 1234-5678\n📧 Email: admin@apartmentmgmt.com\n🏢 Office Hours: Mon-Fri 9AM-6PM\nYou can also reach out through your tenant dashboard.';
  }

  // Building info
  if (msg.includes('building') || msg.includes('rules') || msg.includes('policy') || msg.includes('regulation')) {
    return 'Building rules: Quiet hours 10 PM - 7 AM. Pets allowed with approval. Guests must be registered. Parking available on Level B2. Visit the admin office for complete building policies and regulations.';
  }

  // Suggestions
  if (msg.includes('suggest') || msg.includes('advice') || msg.includes('help') || msg.includes('recommend')) {
    let suggestions = [];
    if (tenantData.rentPayments?.some(r => r.status === 'pending')) {
      suggestions.push('💰 Pay your pending rent to avoid late fees');
    }
    if (tenantData.utilities && tenantData.utilities.length > 5) {
      const recent = tenantData.utilities.slice(0, 3);
      const older = tenantData.utilities.slice(3, 6);
      const recentAvg = recent.reduce((s, u) => s + (u.reading || 0), 0) / recent.length;
      const olderAvg = older.reduce((s, u) => s + (u.reading || 0), 0) / older.length;
      if (recentAvg > olderAvg * 1.2) {
        suggestions.push('💧 Your water usage increased 20%. Check for leaks!');
      }
    }
    if (!tenantData.complaints?.some(c => c.status !== 'resolved' && c.status !== 'closed')) {
      suggestions.push('📋 All complaints resolved! Great job staying on top of issues');
    }
    return suggestions.length > 0 
      ? `Here are my suggestions:\n${suggestions.join('\n')}`
      : 'Keep up with rent payments and monitor your utilities!';
  }

  return null;
};

// Fallback to Hugging Face API for general questions
const callHuggingFaceAPI = async (message) => {
  try {
    const apiKey = process.env.HUGGINGFACE_API_KEY;
    
    if (!apiKey || apiKey === 'hf_default') {
      console.log('HuggingFace API key not configured');
      return null;
    }

    console.log('Calling HuggingFace API for:', message);
    
    // Using Hugging Face Inference API
    const response = await axios.post(
      'https://api-inference.huggingface.co/models/facebook/blenderbot-400M-distill',
      { inputs: message },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    console.log('HuggingFace response:', response.data);

    if (response.data && Array.isArray(response.data) && response.data[0]?.generated_text) {
      return response.data[0].generated_text.trim();
    }
    
    if (response.data && response.data.generated_text) {
      return response.data.generated_text.trim();
    }
    
    console.log('Unexpected HuggingFace response format:', response.data);
  } catch (error) {
    console.error('HuggingFace API error:', error.response?.status, error.message);
  }
  return null;
};

// Chat endpoint with advanced features
router.post('/query', authenticateToken, async (req, res) => {
  try {
    const { message } = req.body;
    const userId = req.user.id;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Message cannot be empty' });
    }

    console.log('Chatbot query from user', userId, ':', message);

    // Get tenant's real data
    const tenantData = await getTenantData(userId);

    // Get apartment info
    let apartmentInfo = {};
    try {
      apartmentInfo = await dbGet(
        'SELECT unit_number, building, floor FROM apartments WHERE tenant_id = ? LIMIT 1',
        [userId]
      ) || {};
    } catch (err) {
      console.log('Could not fetch apartment info:', err.message);
    }

    // Prefer feedback-learned responses first
    let response = null;
    const fbMatch = findBestFeedbackResponse(message);
    if (fbMatch) {
      response = fbMatch;
      console.log('[CHATBOT] Using feedback-learned response');
    } else {
      // Try to generate smart response based on real data
      response = await generateSmartResponse(message, userId, tenantData, apartmentInfo);

      // If no smart response, try HuggingFace API
      if (!response) {
        console.log('No smart response matched, trying HuggingFace API...');
        response = await callHuggingFaceAPI(message);
      }
    }

    // Final fallback - provide helpful generic response
    if (!response) {
      response = `I'm here to help with rent payments, utility bills, complaints, maintenance, building rules, and contact information. Please be more specific about what you need help with. You can ask about:\n✓ Your rent payments\n✓ Water/utility consumption\n✓ Filing complaints\n✓ Maintenance issues\n✓ Unit information\n✓ Contact the admin`;
    }

    console.log('Bot response:', response);

    // Store conversation
    try {
      // Columns in schema are `message` and `response`
      await dbRun(
        'INSERT INTO chatbot_conversations (user_id, message, response) VALUES (?, ?, ?)',
        [userId, message, response]
      );
      console.log('Conversation saved');
    } catch (err) {
      console.error('Failed to save conversation:', err.message);
    }

    res.json({
      success: true,
      message: response,
      timestamp: new Date(),
      hasRealData: tenantData.rentPayments.length > 0 || tenantData.utilities.length > 0
    });
  } catch (error) {
    console.error('Chatbot error:', error);
    res.status(500).json({ success: false, message: 'Chatbot error', error: error.message });
  }
});

// Feedback endpoint: store user feedback (helpful or not)
router.post('/feedback', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { message, response: botResponse, helpful } = req.body;
    if (!message || !botResponse || typeof helpful === 'undefined') {
      return res.status(400).json({ success: false, message: 'message, response and helpful are required' });
    }
    await dbRun('INSERT INTO chatbot_feedback (user_id, message, response, helpful) VALUES (?, ?, ?, ?)', [userId, message, botResponse, helpful ? 1 : 0]);
    // reload model (simple incremental learning)
    await loadFeedbackModel();
    res.json({ success: true, message: 'Feedback recorded' });
  } catch (err) {
    console.error('Feedback error:', err);
    res.status(500).json({ success: false, message: 'Failed to record feedback' });
  }
});

// Model status (dev only)
router.get('/model/status', async (req, res) => {
  try {
    res.json({ success: true, entries: feedbackModel.entries.length });
  } catch (err) {
    console.error('Model status error:', err);
    res.status(500).json({ success: false, message: 'Failed to get model status' });
  }
});

// Get smart suggestions based on tenant data
router.get('/suggestions', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const tenantData = await getTenantData(userId);

    const suggestions = [];

    // Rent prediction
    if (tenantData.rentPayments?.length > 0) {
      const pending = tenantData.rentPayments.filter(r => r.status === 'pending').length;
      const paid = tenantData.rentPayments.filter(r => r.status === 'paid').length;
      const paymentRate = paid / (paid + pending) * 100;

      if (paymentRate < 80) {
        suggestions.push({
          type: 'warning',
          title: 'Payment History Alert',
          message: `Your payment rate is ${paymentRate.toFixed(0)}%. Maintain above 90% to avoid penalties.`
        });
      }
    }

    // Utility prediction by type (water, electricity, gas)
    if (tenantData.utilities?.length >= 3) {
      const byType = (tenantData.utilities || []).reduce((acc, u) => {
        const type = (u.utility_type || 'other').toLowerCase();
        acc[type] = acc[type] || [];
        acc[type].push(u);
        return acc;
      }, {});

      Object.entries(byType).forEach(([type, items]) => {
        if (items.length < 3) return;
        const recent = items.slice(0, 3);
        const older = items.slice(3, 6);
        if (older.length === 0) return;
        const recentAvg = recent.reduce((s, u) => s + (u.reading || 0), 0) / recent.length;
        const olderAvg = older.reduce((s, u) => s + (u.reading || 0), 0) / older.length;
        const increase = ((recentAvg - olderAvg) / olderAvg * 100) || 0;

        const niceType = type[0].toUpperCase() + type.slice(1);
        if (increase > 20) {
          suggestions.push({
            type: 'alert',
            title: `High ${niceType} Usage Detected`,
            message: `Your ${niceType.toLowerCase()} usage increased by ${increase.toFixed(0)}%. Check for leaks or appliance issues.`
          });
        }

        suggestions.push({
          type: 'info',
          title: `${niceType} Usage Trend`,
          message: `Average usage (recent): ${recentAvg.toFixed(2)} ${items[0]?.unit || (type.includes('water') ? 'm³' : type.includes('electric') ? 'kWh' : '')}. Status: ${increase > 10 ? 'Increasing ⬆️' : increase < -10 ? 'Decreasing ⬇️' : 'Stable ➡️'}`
        });
      });
    }

    // Complaint tracking
    if (tenantData.complaints?.length > 0) {
      const unresolved = tenantData.complaints.filter(c => c.status !== 'resolved').length;
      if (unresolved > 0) {
        suggestions.push({
          type: 'info',
          title: 'Pending Complaints',
          message: `You have ${unresolved} unresolved complaint(s). Expected resolution: 2-3 days.`
        });
      }
    }

    if (suggestions.length === 0) {
      suggestions.push({
        type: 'success',
        title: 'All Good!',
        message: 'Your account is in good standing. Keep maintaining your payments and utilities!'
      });
    }

    res.json({ success: true, data: suggestions });
  } catch (error) {
    console.error('Suggestions error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate suggestions' });
  }
});

// Get chat history with analytics
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const history = await dbAll(
      'SELECT * FROM chatbot_conversations WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      [userId]
    );
    
    // Calculate chat analytics
    const totalChats = history.length;
    const topTopics = {};
    history.forEach(chat => {
      const topics = ['rent', 'water', 'complaint', 'maintenance', 'building'];
      topics.forEach(topic => {
        if (chat.user_message.toLowerCase().includes(topic)) {
          topTopics[topic] = (topTopics[topic] || 0) + 1;
        }
      });
    });

    // History is already ordered DESC by created_at in the query; return as-is (latest first)
    res.json({ 
      success: true, 
      data: history,
      analytics: {
        totalChats,
        topTopics
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to fetch chat history' });
  }
});

module.exports = router;
