const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('apartment.db');
const sql = `
  INSERT OR REPLACE INTO meralco_rates_cache
  (id, rate_kwh, rate_change, rate_change_percent, trend, unit, source_url, fetched_at, updated_at)
  VALUES (1, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
`;
const params = [
  13.8161,
  0.6427,
  4.88,
  'up',
  'PHP/kWh',
  'https://company.meralco.com.ph/news-and-advisories/higher-residential-rates-march-2026',
  '2026-04-08T23:29:44.629767'
];

db.run(sql, params, function onRun(err) {
  if (err) {
    console.error('Failed to seed Meralco cache:', err.message);
    process.exit(1);
  }

  console.log('Seeded Meralco cache rows:', this.changes);
  db.close();
});
