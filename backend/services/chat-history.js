const db = require('../config/database');

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

function extractTopicAnalytics(history) {
  const topics = {};
  const knownTopics = ['rent', 'water', 'complaint', 'maintenance', 'building', 'utility'];

  history.forEach((chat) => {
    const message = (chat.message || chat.user_message || '').toLowerCase();
    knownTopics.forEach((topic) => {
      if (message.includes(topic)) {
        topics[topic] = (topics[topic] || 0) + 1;
      }
    });
  });

  return topics;
}

async function getChatHistory(userId) {
  const history = await dbAll(
    'SELECT * FROM chatbot_conversations WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
    [userId]
  );

  return {
    history,
    analytics: {
      totalChats: history.length,
      topTopics: extractTopicAnalytics(history)
    }
  };
}

module.exports = { getChatHistory };