const axios = require('axios');

/**
 * Enhanced Chatbot Service using DialoGPT
 * Provides more intelligent conversational responses
 */
class EnhancedChatbotService {
  constructor() {
    this.apiKey = process.env.HUGGINGFACE_API_KEY;
    this.model = 'microsoft/DialoGPT-medium';
    this.baseURL = 'https://api-inference.huggingface.co/models';
  }

  /**
   * Generate enhanced chatbot response using DialoGPT
   * @param {string} message - User's message
   * @param {string} context - Optional conversation context
   * @returns {string} Enhanced response
   */
  async generateResponse(message, context = '') {
    if (!this.apiKey) {
      console.log('HuggingFace API key not configured for enhanced chatbot, using local fallback');
      return this.generateLocalResponse(message, context);
    }

    try {
      console.log('Calling DialoGPT API for enhanced response:', message);

      // Prepare input with context if available
      let inputText = message;
      if (context && context.trim()) {
        inputText = `${context} ${message}`;
      }

      const response = await axios.post(
        `${this.baseURL}/${this.model}`,
        {
          inputs: inputText,
          parameters: {
            max_length: 100,
            min_length: 10,
            do_sample: true,
            temperature: 0.7,
            top_p: 0.9,
            num_return_sequences: 1,
            repetition_penalty: 1.2,
            pad_token_id: 50256
          },
          options: {
            wait_for_model: true,
            use_cache: true
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      console.log('DialoGPT response:', response.data);

      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        const generatedText = response.data[0].generated_text;

        // Clean up the response - remove the input text if it's included
        let cleanResponse = generatedText;
        if (generatedText.toLowerCase().includes(message.toLowerCase())) {
          // Remove the original message from the response
          const messageIndex = generatedText.toLowerCase().indexOf(message.toLowerCase());
          if (messageIndex !== -1) {
            cleanResponse = generatedText.substring(messageIndex + message.length).trim();
          }
        }

        // If response is too short or empty, return null to fall back
        if (!cleanResponse || cleanResponse.length < 5) {
          return null;
        }

        return cleanResponse;
      }

      return this.generateLocalResponse(message, context);
    } catch (error) {
      console.error('DialoGPT API error:', error.response?.status, error.message);

      // If model is loading, return null to fall back
      if (error.response?.status === 503) {
        console.log('DialoGPT model is loading, falling back to basic response');
        return this.generateLocalResponse(message, context);
      }

      return this.generateLocalResponse(message, context);
    }
  }

  generateLocalResponse(message, context = '') {
    const msg = String(message || '').toLowerCase();
    const hasContext = Boolean(context && context.trim());

    const intents = [
      { name: 'rent', keywords: ['rent', 'payment', 'due', 'bill', 'late fee'] },
      { name: 'utility', keywords: ['water', 'electric', 'electricity', 'utility', 'meter', 'usage', 'kwh', 'm3'] },
      { name: 'complaint', keywords: ['complaint', 'maintenance', 'repair', 'issue', 'problem', 'fix', 'leak'] },
      { name: 'greeting', keywords: ['hello', 'hi', 'hey', 'good morning', 'good evening'] },
    ];

    const scoreIntent = (intent) => intent.keywords.reduce((score, keyword) => {
      if (msg.includes(keyword)) return score + 1;
      return score;
    }, 0);

    const best = intents
      .map((intent) => ({ name: intent.name, score: scoreIntent(intent) }))
      .sort((a, b) => b.score - a.score)[0];

    if (!best || best.score === 0) {
      return hasContext
        ? 'Based on our recent conversation, I can continue helping with rent, utility trends, complaints, and payment reminders. Tell me what you want to check now.'
        : 'I can help with rent payments, utility usage, and complaint tracking. Tell me what you want to check and I will guide you step by step.';
    }

    if (best.name === 'rent') {
      return 'I can help you with rent and payment concerns. Check your dashboard bills section for due amounts and status, and settle pending items before due dates to avoid penalties.';
    }

    if (best.name === 'utility') {
      return 'For utility concerns, review your latest water and electricity readings on the tenant dashboard. I can also provide usage suggestions if you ask for recommendations.';
    }

    if (best.name === 'complaint') {
      return 'To report a problem, open Complaints and submit the issue with clear details and a photo if available. Maintenance updates will appear in your complaint status.';
    }

    if (best.name === 'greeting') {
      return hasContext
        ? 'Welcome back. I can continue helping with your rent, utility trends, complaints, and account questions.'
        : 'Hi. I am your apartment assistant. Ask me about rent, utilities, complaints, or payment reminders.';
    }

    return hasContext
      ? 'I can continue from our recent chat and help you check bills, utility trends, or complaint status.'
      : 'I can help with rent payments, utility usage, and complaint tracking. Tell me what you want to check and I will guide you step by step.';
  }

  /**
   * Get conversation context from recent messages
   * @param {number} userId - User ID
   * @param {number} limit - Number of recent messages to include
   * @returns {string} Conversation context
   */
  async getConversationContext(userId, limit = 3) {
    try {
      const db = require('../config/database');

      const rows = await new Promise((resolve, reject) => {
        db.all(
          'SELECT user_message AS message, bot_response AS response FROM chatbot_conversations WHERE user_id = ? ORDER BY id DESC LIMIT ?',
          [userId, limit],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      });

      // Build context from recent conversation
      const contextParts = [];
      rows.reverse().forEach(row => {
        if (row.message) contextParts.push(`User: ${row.message}`);
        if (row.response) contextParts.push(`Bot: ${row.response}`);
      });

      return contextParts.join(' ').substring(0, 500); // Limit context length
    } catch (error) {
      console.error('Error getting conversation context:', error.message);
      return '';
    }
  }
}

module.exports = new EnhancedChatbotService();