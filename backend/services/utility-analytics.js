function getCurrencySymbol(currency) {
  if (!currency) return '₱';
  const normalized = currency.toUpperCase();
  if (normalized === 'USD') return '$';
  if (normalized === 'EUR') return '€';
  if (normalized === 'GBP') return '£';
  return '₱';
}

function getUtilityType(type) {
  const normalized = (type || 'other').toLowerCase();
  if (normalized.includes('electric')) return 'electricity';
  if (normalized.includes('water')) return 'water';
  if (normalized.includes('gas')) return 'gas';
  return normalized;
}

function normalizeUtilities(utilities) {
  return (utilities || []).map((u) => ({
    ...u,
    utility_type: getUtilityType(u.utility_type || u.meter_type || 'other'),
    reading: u.reading || u.reading_value || 0,
    estimated_cost: u.estimated_cost || u.cost || 0,
    currency: u.currency || 'PHP',
    unit: u.unit || (u.utility_type?.toLowerCase().includes('water') ? 'm³' : u.utility_type?.toLowerCase().includes('electric') ? 'kWh' : '')
  }));
}

function summarizeUtilities(utilities) {
  const normalized = normalizeUtilities(utilities);
  const group = normalized.reduce((acc, item) => {
    acc[item.utility_type] = acc[item.utility_type] || [];
    acc[item.utility_type].push(item);
    return acc;
  }, {});

  return Object.entries(group).map(([type, items]) => {
    const avgReading = items.reduce((sum, item) => sum + (item.reading || 0), 0) / items.length;
    const avgCost = items.reduce((sum, item) => sum + (item.estimated_cost || 0), 0) / items.length;
    const symbol = getCurrencySymbol(items[0].currency);
    const unit = items[0].unit || (type === 'water' ? 'm³' : type === 'electricity' ? 'kWh' : '');

    return {
      type,
      avgReading: Number(avgReading.toFixed(2)),
      avgCost: Number(avgCost.toFixed(2)),
      currency: items[0].currency,
      symbol,
      unit,
      summary: `${type[0].toUpperCase() + type.slice(1)} — avg usage: ${avgReading.toFixed(2)} ${unit}${avgCost ? `, avg cost: ${symbol}${avgCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : ''}`
    };
  });
}

function detectUtilityAnomalies(utilities) {
  const summaries = summarizeUtilities(utilities);
  return summaries.map((item) => {
    const trends = item.avgReading;
    return {
      ...item,
      alert: item.avgReading > 100 ? `Usage is high for ${item.type}` : null
    };
  });
}

module.exports = {
  summarizeUtilities,
  detectUtilityAnomalies,
  normalizeUtilities
};