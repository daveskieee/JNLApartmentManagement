const axios = require('axios');

// Simple in-memory cache for exchange rates
const cache = new Map();
const TTL_MS = 10 * 60 * 1000; // 10 minutes
const API_BASE = process.env.EXCHANGE_API_URL || 'https://api.frankfurter.app';

async function fetchRate(from, to) {
  const key = `${from}_${to}`;
  const now = Date.now();

  if (cache.has(key)) {
    const entry = cache.get(key);
    if (now - entry.ts < TTL_MS) {
      return entry.rate;
    }
  }

  try {
    // Use Frankfurter free API by default
    const url = `${API_BASE}/latest?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    const resp = await axios.get(url, { timeout: 5000 });
    const rate = resp.data?.rates?.[to.toUpperCase()];
    if (typeof rate !== 'number') {
      throw new Error('Failed to parse rate');
    }

    cache.set(key, { rate, ts: now });
    return rate;
  } catch (err) {
    console.error('Exchange fetch failed:', err.message || err);
    // Fallback: if we have stale cache, return it
    const entry = cache.get(key);
    if (entry && entry.rate) return entry.rate;
    throw err;
  }
}

module.exports = {
  getRate: async (from, to) => {
    if (!from || !to) throw new Error('Missing currency');
    if (from === to) return 1;
    return await fetchRate(from.toUpperCase(), to.toUpperCase());
  }
};