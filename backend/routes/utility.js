const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const db = require('../config/database');
const { getMeralcoRates, forecastElectricityBill, getRateComparison } = require('../services/meralco-rates');

const dbRun = (sql, params) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID });
    });
  });
};

const { sendEventToTenant } = require('../services/sse');

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

// Get utility consumption history
router.get('/history/:tenantId', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const result = await dbAll(
      'SELECT * FROM utility_readings WHERE tenant_id = ? ORDER BY datetime(created_at) DESC, id DESC',
      [tenantId]
    );
    res.json({ success: true, data: result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to fetch utility history' });
  }
});

// Get forecasted utility bill (latest reading)
router.get('/forecast/:tenantId', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const result = await dbGet(
      'SELECT * FROM utility_readings WHERE tenant_id = ? ORDER BY datetime(created_at) DESC, id DESC LIMIT 1',
      [tenantId]
    );
    res.json({ success: true, data: result || null });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to fetch forecast' });
  }
});

// Get latest reading per utility type for tenant
router.get('/latest/:tenantId', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const rows = await dbAll(
      'SELECT * FROM utility_readings WHERE tenant_id = ? ORDER BY datetime(created_at) DESC, id DESC',
      [tenantId]
    );
    const latest = {};
    rows.forEach(r => {
      const type = r.utility_type || r.meter_type || 'unknown';
      if (!latest[type]) {
        latest[type] = {
          usage: r.reading_value || r.reading || 0,
          cost: r.estimated_cost || r.cost || 0,
          rate: r.water_rate != null ? r.water_rate : null,
          unit: r.unit || '',
          reading_date: r.reading_date
        };
      }
    });
    res.json({ success: true, data: latest });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to fetch latest utility readings' });
  }
});

// Assign/Record utility reading to tenant
router.post('/assign', authenticateToken, async (req, res) => {
  try {
    const {
      tenantId,
      apartmentId,
      utilityType: _utilityType,
      meterType,
      readingValue: _readingValue,
      reading,
      readingDate,
      unit,
      estimatedCost
    } = req.body;

    const utilityType = _utilityType || meterType;
    const readingValue = (_readingValue !== undefined) ? _readingValue : reading;

    console.log('Assigning utility - tenantId:', tenantId, 'utilityType:', utilityType, 'readingValue:', readingValue);

    if (!tenantId || !utilityType || readingValue === undefined || !readingDate) {
      return res.status(400).json({ 
        success: false, 
        message: 'tenantId, utilityType, readingValue, and readingDate are required' 
      });
    }

    const result = await dbRun(
      'INSERT INTO utility_readings (tenant_id, apartment_id, meter_type, reading, reading_date, estimated_cost, currency) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [tenantId, apartmentId || null, utilityType, readingValue, readingDate, estimatedCost || null, 'PHP']
    );

    console.log('Utility reading assigned with ID:', result.id);

    // Notify tenant of the new reading
    try {
      sendEventToTenant(tenantId, 'utility_update', {
        id: result.id,
        meter_type: utilityType,
        reading: readingValue,
        reading_date: readingDate,
        estimated_cost: estimatedCost,
        message: 'A utility reading was added by admin.'
      });
    } catch (e) {
      console.warn('Failed to send SSE utility_update (assign):', e);
    }

    res.status(201).json({ 
      success: true, 
      message: 'Utility reading assigned successfully',
      data: { id: result.id, tenant_id: tenantId, meter_type: utilityType, reading: readingValue, reading_date: readingDate, estimated_cost: estimatedCost }
    });
  } catch (error) {
    console.error('Error assigning utility:', error);
    res.status(500).json({ success: false, message: 'Failed to assign utility', error: error.message });
  }
});

// Get all utility readings for a tenant
router.get('/tenant/:tenantId', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const result = await dbAll(
      'SELECT * FROM utility_readings WHERE tenant_id = ? ORDER BY datetime(created_at) DESC, id DESC',
      [tenantId]
    );
    res.json({ success: true, data: result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to fetch utility readings' });
  }
});

// DEBUG: Returns counts and sample rows per utility type (development only)
router.get('/debug/utilities/:tenantId', async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ success: false, message: 'Not found' });
    }

    const { tenantId } = req.params;
    const rows = await dbAll(
      'SELECT * FROM utility_readings WHERE tenant_id = ? ORDER BY datetime(created_at) DESC, id DESC',
      [tenantId]
    );

    const byType = rows.reduce((acc, r) => {
      const type = (r.utility_type || r.meter_type || 'unknown').toLowerCase();
      acc[type] = acc[type] || { count: 0, samples: [] };
      acc[type].count++;
      if (acc[type].samples.length < 5) {
        acc[type].samples.push({
          id: r.id,
          reading: r.reading_value || r.reading || 0,
          cost: r.estimated_cost || r.cost || 0,
          unit: r.unit || '',
          date: r.reading_date,
        });
      }
      return acc;
    }, {});

    res.json({ success: true, totalReadings: rows.length, data: byType });
  } catch (error) {
    console.error('Debug utilities error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch debug utilities', error: error.message });
  }
});

// Get current MERALCO electricity rates
router.get('/meralco-rates', async (req, res) => {
  try {
    console.log('[UTILITY] Fetching Meralco rates');
    const rates = await getMeralcoRates();
    res.json({ success: true, data: rates });
  } catch (error) {
    console.error('[UTILITY] Error fetching Meralco rates:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch electricity rates', error: error.message });
  }
});

// Health/status endpoint for MERALCO rate source diagnostics
router.get('/meralco-health', async (req, res) => {
  try {
    const rates = await getMeralcoRates();
    const source = rates?.source || 'unknown';
    const status = source === 'meralco'
      ? 'live'
      : source === 'meralco_stale'
        ? 'stale_cache'
        : 'fallback';

    res.json({
      success: true,
      data: {
        status,
        source,
        current_rate: rates?.rate_kwh ?? null,
        unit: rates?.unit || 'PHP/kWh',
        trend: rates?.trend || null,
        updated_at: rates?.timestamp || null,
        source_url: rates?.url || null,
        message: status === 'live'
          ? 'Using live Meralco source data.'
          : status === 'stale_cache'
            ? 'Using stale cached Meralco data because live source is unavailable.'
            : 'Using fallback rate estimates because live source is unavailable and cache is empty.'
      }
    });
  } catch (error) {
    console.error('[UTILITY] Error fetching meralco health status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch MERALCO health status',
      error: error.message
    });
  }
});

// Get MERALCO rate comparison (this month vs last month)
router.get('/meralco-comparison', async (req, res) => {
  try {
    const comparison = await getRateComparison();
    res.json({ success: true, data: comparison });
  } catch (error) {
    console.error('[UTILITY] Error fetching rate comparison:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch rate comparison', error: error.message });
  }
});

// Get electricity bill forecast for tenant (based on latest reading + current Meralco rates)
router.get('/electricity-forecast/:tenantId', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    
    // Get latest electricity reading for this tenant
    const latestReading = await dbGet(
      `SELECT * FROM utility_readings 
       WHERE tenant_id = ? AND (utility_type = 'electricity' OR meter_type = 'electricity')
       ORDER BY datetime(created_at) DESC, id DESC LIMIT 1`,
      [tenantId]
    );

    const previousReading = await dbGet(
      `SELECT * FROM utility_readings
       WHERE tenant_id = ? AND (utility_type = 'electricity' OR meter_type = 'electricity')
       ORDER BY datetime(created_at) DESC, id DESC LIMIT 1 OFFSET 1`,
      [tenantId]
    );

    if (!latestReading) {
      return res.json({ 
        success: true, 
        data: { message: 'No electricity readings available yet', forecast: null }
      });
    }

    const latestValue = Number(latestReading.reading_value || latestReading.reading || 0);
    const previousValue = previousReading
      ? Number(previousReading.reading_value || previousReading.reading || 0)
      : null;

    // If two readings are available and latest is higher, treat them as cumulative meter readings and use delta.
    const usageFromDelta = previousValue != null && latestValue >= previousValue
      ? latestValue - previousValue
      : null;
    const usage = usageFromDelta != null ? usageFromDelta : latestValue;

    const forecast = await forecastElectricityBill(usage);

    res.json({ 
      success: true, 
      data: {
        ...forecast,
        usage_basis: usageFromDelta != null ? 'present_minus_previous' : 'latest_reading',
        latest_reading: {
          reading_kwh: latestValue,
          reading_date: latestReading.reading_date,
          previous_cost: latestReading.estimated_cost || null
        },
        previous_reading: previousReading ? {
          reading_kwh: previousValue,
          reading_date: previousReading.reading_date
        } : null,
        computed_usage: {
          usage_kwh: Number(usage.toFixed(4)),
          is_delta_based: usageFromDelta != null
        }
      }
    });
  } catch (error) {
    console.error('[UTILITY] Error calculating electricity forecast:', error);
    res.status(500).json({ success: false, message: 'Failed to calculate forecast', error: error.message });
  }
});

module.exports = router;
