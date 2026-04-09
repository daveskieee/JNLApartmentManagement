const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { translateText, detectLanguage } = require('../services/translation');
const { getTenantData, getApartmentInfo } = require('../services/tenant-data');
const { findBestFeedbackResponse, loadFeedbackModel, saveFeedback, getFeedbackEntryCount } = require('../services/feedback-chatbot');
const { generateSmartResponse, generateFallbackResponse } = require('../services/smart-response');
const { generateSuggestions } = require('../services/predictive-suggestions');
const { getChatHistory } = require('../services/chat-history');
const { getMeralcoRates } = require('../services/meralco-rates');
const { generateOllamaResponse } = require('../services/ollama-chatbot');

function shouldPreferOllama(message) {
  const msg = String(message || '').toLowerCase();

  const directRulePatterns = [
    'hi',
    'hello',
    'hey',
    'hola',
    'ola'
  ];
  if (directRulePatterns.includes(msg)) {
    return false;
  }

  if (
    (msg.includes('how') && (msg.includes('pay') || msg.includes('payment') || msg.includes('billing'))) ||
    msg.includes('next billing') ||
    msg.includes('billing date') ||
    msg.includes('billing schedule') ||
    msg.includes('due date')
  ) {
    return false;
  }

  const asksForDetails = [
    'my', 'show', 'list', 'latest', 'recent', 'history', 'details', 'detail', 'status',
    'summary', 'summarize', 'what', 'when', 'which', 'why', 'compare', 'breakdown', 'overview'
  ].some((keyword) => msg.includes(keyword));

  if (!asksForDetails) {
    return false;
  }

  if (['payment', 'payments', 'rent'].some((keyword) => msg.includes(keyword))) {
    return true;
  }

  if (['complaint', 'complaints', 'issue', 'issues'].some((keyword) => msg.includes(keyword))) {
    return true;
  }

  if (['utility', 'utilities', 'water', 'electric', 'electricity', 'gas', 'usage', 'reading', 'bill', 'billing'].some((keyword) => msg.includes(keyword))) {
    return true;
  }

  const tenantDataKeywords = [
    'rent', 'payment', 'payments', 'bill', 'billing',
    'utility', 'utilities', 'water', 'electric', 'electricity', 'gas', 'usage', 'reading',
    'complaint', 'complaints', 'issue', 'issues'
  ];

  return tenantDataKeywords.some((keyword) => msg.includes(keyword));
}

const dbRun = (sql, params) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID });
    });
  });
};

// Load feedback model at startup
loadFeedbackModel();

// Chat endpoint with advanced features
router.post('/query', authenticateToken, async (req, res) => {
  try {
    const { message } = req.body;
    const userId = req.user.id;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Message cannot be empty' });
    }

    console.log('Chatbot query from user', userId, ':', message);

    const tenantData = await getTenantData(userId);
    const apartmentInfo = await getApartmentInfo(userId);

    let meralcoRates = null;
    try {
      meralcoRates = await getMeralcoRates();
    } catch (err) {
      console.warn('Failed to fetch Meralco rates for chatbot response:', err.message);
    }

    let response = null;
    let responseSource = 'fallback';
    let responseModel = 'rule-fallback';
    const preferOllama = shouldPreferOllama(message);
    const fbMatch = findBestFeedbackResponse(message);
    if (fbMatch) {
      response = fbMatch;
      responseSource = 'feedback';
      responseModel = 'feedback-memory';
      console.log('[CHATBOT] Using feedback-learned response');
    } else {
      if (preferOllama) {
        response = await generateOllamaResponse(message, tenantData, apartmentInfo, meralcoRates);
        if (response) {
          responseSource = 'ollama';
          responseModel = process.env.OLLAMA_MODEL || 'mistral:7b';
          console.log('[CHATBOT] Using local Ollama response (preferred path)');
        }
      }

      if (!response) {
        response = await generateSmartResponse(message, tenantData, apartmentInfo, meralcoRates);
        if (response) {
          responseSource = 'smart-response';
          responseModel = 'rules+tenant-data';
        }
      }

      if (!response) {
        response = await generateOllamaResponse(message, tenantData, apartmentInfo, meralcoRates);
        if (response) {
          responseSource = 'ollama';
          responseModel = process.env.OLLAMA_MODEL || 'mistral:7b';
          console.log('[CHATBOT] Using local Ollama response');
        }
      }

      if (!response) {
        response = generateFallbackResponse(tenantData, apartmentInfo, meralcoRates);
        responseSource = 'fallback';
        responseModel = 'rule-fallback';
      }
    }

    if (!response) {
      response = generateFallbackResponse(tenantData, apartmentInfo, meralcoRates);
      responseSource = 'fallback';
      responseModel = 'rule-fallback';
    }

    console.log('Bot response:', response);

    let translatedResponse = response;
    try {
      const detectedLang = await detectLanguage(message);
      console.log('Detected language:', detectedLang);

      if (detectedLang && detectedLang !== 'en') {
        console.log('Translating response to:', detectedLang);
        translatedResponse = await translateText(response, 'en', detectedLang);
        console.log('Translated response:', translatedResponse);
      }
    } catch (translationError) {
      console.error('Translation error:', translationError.message);
      translatedResponse = response;
    }

    try {
      await dbRun(
        'INSERT INTO chatbot_conversations (user_id, user_message, bot_response) VALUES (?, ?, ?)',
        [userId, message, translatedResponse]
      );
      console.log('Conversation saved');
    } catch (err) {
      console.error('Failed to save conversation:', err.message);
    }

    res.json({
      success: true,
      message: translatedResponse,
      timestamp: new Date(),
      hasRealData: tenantData.rentPayments.length > 0 || tenantData.utilities.length > 0,
      meta: {
        source: responseSource,
        model: responseModel,
        translated: translatedResponse !== response
      }
    });
  } catch (error) {
    console.error('Chatbot error:', error);
    res.status(500).json({ success: false, message: 'Chatbot error', error: error.message });
  }
});

router.post('/feedback', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { message, response: botResponse, helpful } = req.body;
    if (!message || !botResponse || typeof helpful === 'undefined') {
      return res.status(400).json({ success: false, message: 'message, response and helpful are required' });
    }

    await saveFeedback(userId, message, botResponse, helpful);
    res.json({ success: true, message: 'Feedback recorded' });
  } catch (err) {
    console.error('Feedback error:', err);
    res.status(500).json({ success: false, message: 'Failed to record feedback' });
  }
});

router.get('/model/status', async (req, res) => {
  try {
    res.json({ success: true, entries: getFeedbackEntryCount() });
  } catch (err) {
    console.error('Model status error:', err);
    res.status(500).json({ success: false, message: 'Failed to get model status' });
  }
});

router.get('/suggestions', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const tenantData = await getTenantData(userId);
    const suggestions = await generateSuggestions(tenantData);
    res.json({ success: true, data: suggestions });
  } catch (error) {
    console.error('Suggestions error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate suggestions' });
  }
});

router.get('/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await getChatHistory(userId);
    res.json({ success: true, data: result.history, analytics: result.analytics });
  } catch (error) {
    console.error('Chat history error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch chat history' });
  }
});

// Unified tenant data endpoint (dashboard + chatbot sync)
router.get('/tenant-overview', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const tenantData = await getTenantData(userId);
    const apartmentInfo = await getApartmentInfo(userId);
    
    // Get current MERALCO rates
    let meralcoRates = null;
    try {
      meralcoRates = await getMeralcoRates();
    } catch (err) {
      console.warn('Failed to fetch Meralco rates:', err.message);
    }
    
    res.json({ 
      success: true, 
      data: {
        bills: tenantData.rentPayments || [],
        utilities: tenantData.utilities || [],
        complaints: tenantData.complaints || [],
        apartment: apartmentInfo || {},
        meralco_rates: meralcoRates || null
      }
    });
  } catch (error) {
    console.error('Tenant overview error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch tenant overview', error: error.message });
  }
});

module.exports = router;

