const axios = require('axios');
const db = require('../config/database');

// Meralco API configuration
const MERALCO_API_URL = (process.env.MERALCO_API_URL || '').trim();
const MERALCO_API_URLS = (process.env.MERALCO_API_URLS || '')
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean);
const MERALCO_REMOTE_DISABLED = String(process.env.MERALCO_DISABLE_REMOTE || 'false').toLowerCase() === 'true';
const MERALCO_RETRY_COOLDOWN_MS = Number(process.env.MERALCO_RETRY_COOLDOWN_MS || 6 * 60 * 60 * 1000);
const MERALCO_CACHE_TTL_MS = Number(process.env.MERALCO_CACHE_TTL_MS || 30 * 24 * 60 * 60 * 1000);
const MERALCO_API_TIMEOUT_MS = Number(process.env.MERALCO_API_TIMEOUT_MS || 45 * 1000);
const MERALCO_COOLDOWN_LOG_INTERVAL_MS = Number(process.env.MERALCO_COOLDOWN_LOG_INTERVAL_MS || 60 * 1000);
const MERALCO_SOURCE_URLS = [
  MERALCO_API_URL,
  ...MERALCO_API_URLS
].filter((url, index, arr) => arr.indexOf(url) === index);

// In-memory cache for Meralco rates
const cache = {
  rates: null,
  timestamp: null,
  TTL_MS: MERALCO_CACHE_TTL_MS, // Default monthly cache TTL (30 days)
  remoteDisabledUntil: null,
  lastCooldownLogAt: null,
  persistentHydrated: false
};

// Fallback rates for when API is unavailable (approximate 2025 rates)
const fallbackRateValues = {
  rate_kwh: 13.11, // PHP per kWh (approximate, as of Dec 2025)
  rate_change: -0.36,
  rate_change_percent: -2.64,
  trend: 'down',
  unit: 'PHP/kWh'
};

const buildFallbackRates = (source = 'fallback') => ({
  ...fallbackRateValues,
  timestamp: new Date().toISOString(),
  source
});

const toNumber = (value, defaultValue = null) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : defaultValue;
};

const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
};

const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

const hydrateCacheFromDb = async () => {
  if (cache.persistentHydrated || cache.rates) {
    return;
  }

  try {
    const row = await dbGet(`
      SELECT rate_kwh, rate_change, rate_change_percent, trend, unit, source_url, fetched_at
      FROM meralco_rates_cache
      ORDER BY updated_at DESC
      LIMIT 1
    `);

    cache.persistentHydrated = true;
    if (!row || row.rate_kwh == null) {
      return;
    }

    cache.rates = {
      rate_kwh: toNumber(row.rate_kwh, fallbackRateValues.rate_kwh),
      rate_change: toNumber(row.rate_change, fallbackRateValues.rate_change),
      rate_change_percent: toNumber(row.rate_change_percent, fallbackRateValues.rate_change_percent),
      trend: row.trend || 'stable',
      unit: row.unit || fallbackRateValues.unit,
      timestamp: row.fetched_at || new Date().toISOString(),
      source: 'meralco_stale',
      url: row.source_url || null
    };
    cache.timestamp = Date.now();
    console.log('[MERALCO] Hydrated cache from persistent storage');
  } catch (error) {
    cache.persistentHydrated = true;
    console.warn('[MERALCO] Failed to hydrate persistent cache:', error.message);
  }
};

const persistRatesToDb = async (rates) => {
  if (!rates || rates.rate_kwh == null) {
    return;
  }

  try {
    await dbRun(
      `INSERT OR REPLACE INTO meralco_rates_cache
       (id, rate_kwh, rate_change, rate_change_percent, trend, unit, source_url, fetched_at, updated_at)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        rates.rate_kwh,
        rates.rate_change,
        rates.rate_change_percent,
        rates.trend,
        rates.unit,
        rates.url || null,
        rates.timestamp || new Date().toISOString()
      ]
    );
  } catch (error) {
    console.warn('[MERALCO] Failed to persist cache:', error.message);
  }
};

const normalizeRatePayload = (payload, url) => {
  const root = payload || {};
  const data = root.data && typeof root.data === 'object' ? root.data : root;

  const rateKwh = toNumber(
    data.rate_kwh ?? data.current_rate ?? data.rate ?? data.ratePerKwh,
    null
  );

  if (rateKwh == null) {
    return null;
  }

  const rawChange = toNumber(data.rate_change ?? data.change, fallbackRateValues.rate_change);
  const rawChangePercent = toNumber(
    data.rate_change_percent ?? data.change_percent,
    fallbackRateValues.rate_change_percent
  );

  let trend = data.trend;
  if (!trend) {
    trend = rawChange > 0 ? 'up' : rawChange < 0 ? 'down' : 'stable';
  }

  return {
    rate_kwh: rateKwh,
    rate_change: rawChange,
    rate_change_percent: rawChangePercent,
    trend,
    unit: data.rate_unit || data.unit || fallbackRateValues.unit,
    timestamp: root.timestamp || data.timestamp || new Date().toISOString(),
    source: 'meralco',
    url
  };
};

/**
 * Fetch current MERALCO electricity rates
 * @returns {Promise<Object>} Rates object with rate_kwh, trend, etc.
 */
async function getMeralcoRates() {
  await hydrateCacheFromDb();

  const now = Date.now();

  // Return cached rates if still valid
  if (cache.rates && cache.timestamp && (now - cache.timestamp) < cache.TTL_MS) {
    console.log('[MERALCO] Cache HIT - returning cached rates');
    return cache.rates;
  }

  if (MERALCO_REMOTE_DISABLED) {
    console.log('[MERALCO] Remote fetching disabled by MERALCO_DISABLE_REMOTE. Using fallback/cache only.');
    if (cache.rates) {
      return {
        ...cache.rates,
        source: 'meralco_stale',
        timestamp: cache.rates.timestamp || new Date().toISOString()
      };
    }
    return buildFallbackRates('fallback');
  }

  if (cache.remoteDisabledUntil && now < cache.remoteDisabledUntil) {
    const shouldLogCooldown = !cache.lastCooldownLogAt || (now - cache.lastCooldownLogAt) >= MERALCO_COOLDOWN_LOG_INTERVAL_MS;
    if (shouldLogCooldown) {
      const nextRetry = new Date(cache.remoteDisabledUntil).toISOString();
      console.log(`[MERALCO] Remote source cooldown active. Next retry after ${nextRetry}`);
      cache.lastCooldownLogAt = now;
    }
    if (cache.rates) {
      return {
        ...cache.rates,
        source: 'meralco_stale',
        timestamp: cache.rates.timestamp || new Date().toISOString()
      };
    }
    return buildFallbackRates('fallback');
  }

  if (MERALCO_SOURCE_URLS.length === 0) {
    console.warn('[MERALCO] No remote source URL configured. Set MERALCO_API_URL (or MERALCO_API_URLS) to enable live fetch. Using fallback.');
    return buildFallbackRates('fallback');
  }

  let lastErrorMessage = null;
  let allSources404 = true;
  let anySourceFailed = false;

  for (const url of MERALCO_SOURCE_URLS) {
    try {
      console.log(`[MERALCO] Fetching rates from ${url}`);
      const response = await axios.get(url, {
        timeout: MERALCO_API_TIMEOUT_MS,
        headers: {
          'Accept': 'application/json'
        }
      });

      const normalized = normalizeRatePayload(response.data, url);
      if (!normalized) {
        lastErrorMessage = 'Unsupported payload shape';
        console.warn(`[MERALCO] Skipping source ${url}: ${lastErrorMessage}`);
        continue;
      }

      // Cache the rates
      cache.rates = normalized;
      cache.timestamp = now;
      await persistRatesToDb(normalized);

      console.log(`[MERALCO] Successfully fetched rates: ${normalized.rate_kwh} ${normalized.unit}`);
      return normalized;
    } catch (error) {
      anySourceFailed = true;
      lastErrorMessage = error.message;
      const statusCode = error?.response?.status;
      if (statusCode !== 404) {
        allSources404 = false;
      }
      console.warn(`[MERALCO] Source failed (${url}): ${error.message}`);
    }
  }

  console.warn(`[MERALCO] All API sources failed${lastErrorMessage ? `: ${lastErrorMessage}` : ''}`);

  if (allSources404) {
    cache.remoteDisabledUntil = now + MERALCO_RETRY_COOLDOWN_MS;
    const retryAt = new Date(cache.remoteDisabledUntil).toISOString();
    console.warn(`[MERALCO] All sources returned 404. Pausing remote retries until ${retryAt}.`);
  } else if (anySourceFailed) {
    cache.remoteDisabledUntil = now + MERALCO_RETRY_COOLDOWN_MS;
    const retryAt = new Date(cache.remoteDisabledUntil).toISOString();
    console.warn(`[MERALCO] Remote sources failed (e.g. timeout/network). Pausing remote retries until ${retryAt}.`);
  }

  // Return cached rates if available (even if stale)
  if (cache.rates) {
    console.log('[MERALCO] Returning stale cached rates');
    return {
      ...cache.rates,
      source: 'meralco_stale',
      timestamp: cache.rates.timestamp || new Date().toISOString()
    };
  }

  // Use fallback rates as last resort
  console.log('[MERALCO] Using fallback rates');
  return buildFallbackRates('fallback');
}

/**
 * Calculate monthly electricity bill based on usage and current Meralco rates
 * @param {number} usage - Electricity usage in kWh
 * @returns {Promise<Object>} Forecast with cost breakdown
 */
async function forecastElectricityBill(usage) {
  try {
    const rates = await getMeralcoRates();
    const baseCost = usage * rates.rate_kwh;
    const trend = rates.trend || 'stable';
    const trendIndicator = trend === 'up' ? '📈' : trend === 'down' ? '📉' : '➡️';

    return {
      usage_kwh: usage,
      rate_per_kwh: rates.rate_kwh,
      rate_unit: rates.unit,
      estimated_cost: parseFloat(baseCost.toFixed(2)),
      trend,
      trend_indicator: trendIndicator,
      rate_change_percent: rates.rate_change_percent,
      forecast_note: `Based on ${rates.source === 'meralco' ? 'latest MERALCO' : 'estimated'} rates`,
      source: rates.source,
      updated_at: rates.timestamp || new Date().toISOString()
    };
  } catch (error) {
    console.error('[MERALCO] Forecast calculation error:', error);
    throw error;
  }
}

/**
 * Clear cache (useful for testing or manual updates)
 */
function clearCache() {
  cache.rates = null;
  cache.timestamp = null;
  cache.remoteDisabledUntil = null;
  cache.lastCooldownLogAt = null;
  cache.persistentHydrated = false;
  console.log('[MERALCO] Cache cleared');
}

/**
 * Get rate comparison (previous vs current)
 * @returns {Promise<Object>} Comparison data
 */
async function getRateComparison() {
  const rates = await getMeralcoRates();
  return {
    current_rate: rates.rate_kwh,
    previous_rate: rates.rate_kwh - (rates.rate_change || 0),
    change: rates.rate_change || 0,
    change_percent: rates.rate_change_percent || 0,
    trend: rates.trend,
    unit: rates.unit,
    message: `Electricity rates are ${rates.trend === 'up' ? 'increasing' : 'decreasing'} by ${Math.abs(rates.rate_change_percent || 0).toFixed(2)}% this month`
  };
}

module.exports = {
  getMeralcoRates,
  forecastElectricityBill,
  getRateComparison,
  clearCache
};
