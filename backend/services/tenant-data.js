const db = require('../config/database');

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
      else resolve(row || {});
    });
  });
};

async function getTenantData(userId) {
  const rentPayments = await dbAll(
    'SELECT * FROM rent_payments WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 10',
    [userId]
  );

  const utilitiesRaw = await dbAll(
    'SELECT * FROM utility_readings WHERE tenant_id = ? ORDER BY datetime(created_at) DESC, id DESC LIMIT 12',
    [userId]
  );

  const utilities = utilitiesRaw.map((u) => ({
    ...u,
    reading: u.reading_value || u.reading || 0,
    utility_type: u.utility_type || u.meter_type || 'other',
    estimated_cost: u.estimated_cost || u.cost || 0,
    water_rate: u.water_rate != null ? u.water_rate : null,
    unit: u.unit || ''
  }));

  const complaints = await dbAll(
    'SELECT * FROM complaints WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 5',
    [userId]
  );

  return { rentPayments, utilities, complaints };
}

async function getApartmentInfo(userId) {
  const apartment = await dbGet(
    'SELECT unit_number, floor FROM apartments WHERE tenant_id = ? LIMIT 1',
    [userId]
  ) || {};
  return {
    unit_number: apartment.unit_number || null,
    floor: apartment.floor || null,
    building: apartment.building || 'Main'
  };
}

module.exports = { getTenantData, getApartmentInfo };