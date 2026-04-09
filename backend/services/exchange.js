const axios = require('axios');

// Simple in-memory cache for exchange rates
const cache = new Map();
const TTL_MS = 1000; // 1 second - always fetch fresh rates
const API_BASE = process.env.EXCHANGE_API_URL || 'https://api.frankfurter.app';

// Fallback rates for common currencies (approximate, maintained manually)
const fallbackRates = {
  'PHP_USD': 0.018,
  'USD_PHP': 55.5,
  'EUR_USD': 1.09,
  'USD_EUR': 0.92,
  'GBP_USD': 1.27,
  'USD_GBP': 0.79,
  'JPY_USD': 0.0067,
  'USD_JPY': 149.5,
  'AUD_USD': 0.67,
  'USD_AUD': 1.49,
  'CAD_USD': 0.73,
  'USD_CAD': 1.37,
  'SGD_USD': 0.74,
  'USD_SGD': 1.35,
  'HKD_USD': 0.128,
  'USD_HKD': 7.81,
  'INR_USD': 0.012,
  'USD_INR': 83.33
};

async function fetchRate(from, to) {
  const key = `${from}_${to}`;
  const now = Date.now();

  if (cache.has(key)) {
    const entry = cache.get(key);
    if (now - entry.ts < TTL_MS) {
      console.log(`[EXCHANGE] Cache HIT for ${key}: ${entry.rate}`);
      return entry.rate;
    }
  }

  try {
    // Use Frankfurter free API by default
    const url = `${API_BASE}/latest?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    console.log(`[EXCHANGE] Fetching rate from ${url}`);
    const resp = await axios.get(url, { timeout: 8000 });
    const rate = resp.data?.rates?.[to.toUpperCase()];
    
    if (typeof rate !== 'number') {
      throw new Error(`Invalid rate response: ${JSON.stringify(resp.data)}`);
    }

    console.log(`[EXCHANGE] Successfully fetched ${key}: ${rate}`);
    cache.set(key, { rate, ts: now });
    return rate;
  } catch (err) {
    console.error(`[EXCHANGE] Fetch failed for ${key}:`, err.message || err);
    
    // Fallback 1: if we have stale cache, return it
    const entry = cache.get(key);
    if (entry && entry.rate) {
      console.log(`[EXCHANGE] Using stale cache for ${key}: ${entry.rate}`);
      return entry.rate;
    }
    
    // Fallback 2: use hardcoded fallback rates
    if (fallbackRates[key]) {
      console.log(`[EXCHANGE] Using fallback rate for ${key}: ${fallbackRates[key]}`);
      cache.set(key, { rate: fallbackRates[key], ts: now - (TTL_MS - 1000) }); // Cache for shorter time
      return fallbackRates[key];
    }
    
    // Fallback 3: try reverse rate if available
    const reverseKey = `${to}_${from}`;
    if (fallbackRates[reverseKey]) {
      const reversedRate = 1 / fallbackRates[reverseKey];
      console.log(`[EXCHANGE] Using reversed fallback rate for ${key}: ${reversedRate}`);
      cache.set(key, { rate: reversedRate, ts: now - (TTL_MS - 1000) });
      return reversedRate;
    }
    
    console.error(`[EXCHANGE] No fallback available for ${key}. Throwing error.`);
    throw err;
  }
}

module.exports = {
  getRate: async (from, to) => {
    if (!from || !to) throw new Error('Missing currency');
    const normalizedFrom = String(from).toUpperCase();
    const normalizedTo = String(to).toUpperCase();
    console.log(`[EXCHANGE] getRate called: ${normalizedFrom} -> ${normalizedTo}`);
    
    if (normalizedFrom === normalizedTo) return 1;
    return await fetchRate(normalizedFrom, normalizedTo);
  }
};