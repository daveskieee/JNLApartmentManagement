const db = require('../config/database');

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID });
    });
  });
};

let feedbackEntries = [];

const tokenize = (text) => {
  return (text || '')
    .toLowerCase()
    .replace(/['"`.,!?;:()\-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
};

const jaccard = (a, b) => {
  const A = Array.from(a);
  const B = Array.from(b);
  const inter = A.filter((x) => B.includes(x)).length;
  const union = new Set([...A, ...B]).size || 1;
  return inter / union;
};

async function loadFeedbackModel() {
  const rows = await dbAll('SELECT message, response FROM chatbot_feedback WHERE helpful = 1');
  const map = new Map();

  rows.forEach((row) => {
    const key = (row.message || '').trim().toLowerCase();
    if (!key) return;
    const tokenSet = new Set(tokenize(key));
    const resp = (row.response || '').trim();
    const hash = resp + '||' + key;

    if (!map.has(hash)) {
      map.set(hash, { tokens: tokenSet, response: resp, count: 0 });
    }
    map.get(hash).count += 1;
  });

  feedbackEntries = Array.from(map.values());
  return feedbackEntries.length;
}

function findBestFeedbackResponse(message) {
  if (!message) return null;
  const tokens = new Set(tokenize(message));
  let best = null;
  let bestScore = 0;

  feedbackEntries.forEach((entry) => {
    const score = jaccard(tokens, entry.tokens);
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  });

  return bestScore >= 0.35 ? best.response : null;
}

async function saveFeedback(userId, message, response, helpful) {
  await dbRun(
    'INSERT INTO chatbot_feedback (user_id, message, response, helpful) VALUES (?, ?, ?, ?)',
    [userId, message, response, helpful ? 1 : 0]
  );
  await loadFeedbackModel();
}

function getFeedbackEntryCount() {
  return feedbackEntries.length;
}

module.exports = {
  loadFeedbackModel,
  findBestFeedbackResponse,
  saveFeedback,
  getFeedbackEntryCount
};