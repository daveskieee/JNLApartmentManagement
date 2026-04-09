const axios = require('axios');

const POSITIVE_WORDS = [
  'good', 'great', 'excellent', 'happy', 'satisfied', 'thanks', 'thank', 'fast', 'resolved', 'fix', 'fixed', 'working', 'clean', 'nice'
];

const NEGATIVE_WORDS = [
  'bad', 'worse', 'worst', 'angry', 'upset', 'frustrated', 'broken', 'leak', 'noisy', 'late', 'slow', 'dirty', 'problem', 'issue', 'not working', 'failed', 'fail', 'urgent'
];

function analyzeSentimentLocally(text) {
  const raw = String(text || '').toLowerCase();
  if (!raw.trim()) {
    return { label: 'NEUTRAL', score: 0.5, source: 'local' };
  }

  const tokens = raw.split(/\s+/).filter(Boolean);
  let pos = 0;
  let neg = 0;

  POSITIVE_WORDS.forEach((word) => {
    if (raw.includes(word)) pos += 1;
  });

  NEGATIVE_WORDS.forEach((word) => {
    if (raw.includes(word)) neg += 1;
  });

  // Mild boost for exclamation/urgent style complaints.
  if (raw.includes('!') || raw.includes('asap') || raw.includes('immediately')) {
    neg += 1;
  }

  const total = Math.max(tokens.length, 1);
  const polarity = (pos - neg) / Math.max(total / 3, 1);

  if (polarity > 0.2) {
    return { label: 'POSITIVE', score: Math.min(0.95, 0.55 + pos * 0.08), source: 'local' };
  }

  if (polarity < -0.2) {
    return { label: 'NEGATIVE', score: Math.min(0.95, 0.55 + neg * 0.08), source: 'local' };
  }

  return { label: 'NEUTRAL', score: 0.5, source: 'local' };
}

async function analyzeSentiment(text) {
  const apiKey = process.env.HUGGINGFACE_API_KEY;

  if (!apiKey || apiKey === 'hf_default') {
    console.log('HuggingFace API key not configured for sentiment analysis, using local fallback');
    return analyzeSentimentLocally(text);
  }

  try {
    console.log('Analyzing sentiment for text:', text.substring(0, 50) + '...');

    const response = await axios.post(
      'https://api-inference.huggingface.co/models/distilbert-base-uncased-finetuned-sst-2-english',
      { inputs: text },
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 10000
      }
    );

    console.log('Sentiment analysis result:', response.data);

    // Returns: [{ label: 'POSITIVE' or 'NEGATIVE', score: 0.99 }]
    if (response.data && Array.isArray(response.data) && response.data[0]) {
      return {
        label: response.data[0].label,
        score: response.data[0].score
      };
    }

    return analyzeSentimentLocally(text);
  } catch (error) {
    console.error('Sentiment analysis error:', error.response?.status, error.message);
    return analyzeSentimentLocally(text);
  }
}

module.exports = { analyzeSentiment };