const { summarizeUtilities } = require('./utility-analytics');
const { getMeralcoRates } = require('./meralco-rates');

const normalizeUtilityType = (value) => {
  const v = String(value || '').toLowerCase();
  if (v.includes('electric')) return 'electricity';
  if (v.includes('water')) return 'water';
  if (v.includes('gas')) return 'gas';
  return v || 'other';
};

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

function buildUtilityUsageSuggestion(utilities) {
  if (!Array.isArray(utilities) || utilities.length < 4) {
    return [];
  }

  const byType = utilities.reduce((acc, item) => {
    const type = normalizeUtilityType(item.utility_type || item.meter_type);
    acc[type] = acc[type] || [];
    acc[type].push(item);
    return acc;
  }, {});

  const advice = [];

  Object.entries(byType).forEach(([type, readings]) => {
    const sorted = readings
      .slice()
      .sort((a, b) => new Date(b.reading_date || 0).getTime() - new Date(a.reading_date || 0).getTime());

    if (sorted.length < 4) {
      return;
    }

    const recentWindow = sorted.slice(0, 3);
    const previousWindow = sorted.slice(3, 6);
    if (previousWindow.length === 0) {
      return;
    }

    const recentAvg = recentWindow.reduce((sum, r) => sum + toNumber(r.reading || r.reading_value), 0) / recentWindow.length;
    const previousAvg = previousWindow.reduce((sum, r) => sum + toNumber(r.reading || r.reading_value), 0) / previousWindow.length;
    if (previousAvg <= 0) {
      return;
    }

    const changePct = ((recentAvg - previousAvg) / previousAvg) * 100;
    const unit = recentWindow[0]?.unit || (type === 'water' ? 'm3' : type === 'electricity' ? 'kWh' : 'units');
    const titleType = type.charAt(0).toUpperCase() + type.slice(1);

    if (changePct >= 15) {
      advice.push({
        type: 'warning',
        title: `${titleType} Usage Is High`,
        message: `Your recent average is ${recentAvg.toFixed(2)} ${unit}, up ${changePct.toFixed(1)}% versus the prior period. Consider checking appliance usage or possible leaks.`
      });
      return;
    }

    if (changePct <= -10) {
      advice.push({
        type: 'success',
        title: `${titleType} Usage Improved`,
        message: `Great job. Your recent average is ${recentAvg.toFixed(2)} ${unit}, down ${Math.abs(changePct).toFixed(1)}% versus the prior period.`
      });
      return;
    }

    advice.push({
      type: 'info',
      title: `${titleType} Usage Stable`,
      message: `Your ${titleType.toLowerCase()} usage is stable at ${recentAvg.toFixed(2)} ${unit} (change ${changePct.toFixed(1)}%).`
    });
  });

  return advice;
}

async function generateSuggestions(tenantData) {
  const suggestions = [];
  const utilities = tenantData.utilities || [];

  if (tenantData.rentPayments?.length > 0) {
    const pending = tenantData.rentPayments.filter((r) => r.status === 'pending').length;
    const paid = tenantData.rentPayments.filter((r) => r.status === 'paid').length;
    const paymentRate = paid / (paid + pending) * 100;

    if (paymentRate < 80) {
      suggestions.push({
        type: 'warning',
        title: 'Payment History Alert',
        message: `Your payment rate is ${paymentRate.toFixed(0)}%. Maintain above 90% to avoid penalties.`
      });
    }
  }

  // Get current MERALCO rates for electricity insights
  let meralcoRates = null;
  try {
    meralcoRates = await getMeralcoRates();
  } catch (err) {
    console.warn('Failed to get Meralco rates in suggestions:', err.message);
  }

  if (utilities.length >= 3) {
    const utilitySummaries = summarizeUtilities(utilities);

    utilitySummaries.forEach((item) => {
      if (item.avgReading > 0) {
        let message = `Average usage: ${item.avgReading} ${item.unit} (${item.symbol}${item.avgCost}).`;
        
        // Add electricity rate info if available
        if (item.type.toLowerCase() === 'electricity' && meralcoRates) {
          const trend = meralcoRates.trend === 'up' ? '📈 increasing' : '📉 decreasing';
          message += ` Electricity rates are ${trend} (${Math.abs(meralcoRates.rate_change_percent).toFixed(2)}% change).`;
        }

        suggestions.push({
          type: 'info',
          title: `${item.type[0].toUpperCase() + item.type.slice(1)} Usage Trend`,
          message
        });
      }
    });
  }

  // Analyze utility history trend using recent vs previous periods for AI guidance.
  suggestions.push(...buildUtilityUsageSuggestion(utilities));

  // Add current electricity rate as a suggestion if available
  if (meralcoRates && meralcoRates.rate_kwh) {
    const rateInfo = `Current MERALCO rate: ₱${meralcoRates.rate_kwh.toFixed(2)}/kWh`;
    const trendEmoji = meralcoRates.trend === 'up' ? '⬆️' : meralcoRates.trend === 'down' ? '⬇️' : '➡️';
    suggestions.push({
      type: 'info',
      title: 'Electricity Rate Update',
      message: `${rateInfo} (${trendEmoji} ${meralcoRates.trend} by ${Math.abs(meralcoRates.rate_change_percent || 0).toFixed(2)}%)`
    });
  }

  if (tenantData.complaints?.length > 0) {
    const unresolved = tenantData.complaints.filter((c) => c.status !== 'resolved').length;
    if (unresolved > 0) {
      suggestions.push({
        type: 'info',
        title: 'Pending Complaints',
        message: `You have ${unresolved} unresolved complaint(s). Expected resolution: 2-3 days.`
      });
    }
  }

  if (suggestions.length === 0) {
    suggestions.push({
      type: 'success',
      title: 'All Good!',
      message: 'Your account is in good standing. Keep maintaining your payments and utilities!'
    });
  }

  return suggestions;
}

module.exports = { generateSuggestions };