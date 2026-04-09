const { summarizeUtilities } = require('./utility-analytics');

const MANAGEMENT_PHONE = process.env.MANAGEMENT_PHONE || '(02) 1234-5678';
const MANAGEMENT_EMAIL = process.env.MANAGEMENT_EMAIL || 'admin@apartmentmgmt.com';

const OFF_TOPIC_KEYWORDS = [
  'joke', 'recipe', 'weather forecast', 'stock market', 'bitcoin', 'crypto', 'sports score',
  'movie review', 'song lyrics', 'video game', 'programming', 'homework', 'politics', 'celebrity'
];

const APARTMENT_DOMAIN_KEYWORDS = [
  'rent', 'payment', 'bill', 'utility', 'water', 'electric', 'electricity', 'gas',
  'complaint', 'maintenance', 'repair', 'unit', 'apartment', 'room', 'address',
  'policy', 'rules', 'lease', 'contract', 'deposit', 'parking', 'tenant', 'landlord',
  'manager', 'admin', 'due', 'usage', 'consumption', 'meter'
];

function getCurrencySymbol(currency) {
  if (!currency) return '₱';
  const normalized = currency.toUpperCase();
  if (normalized === 'USD') return '$';
  if (normalized === 'EUR') return '€';
  if (normalized === 'GBP') return '£';
  return '₱';
}

function formatMoney(amount, currency) {
  const symbol = getCurrencySymbol(currency);
  return symbol + Number(amount).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function getMissingDetailsMessage() {
  return `I don't have the specific details for that in my database. Please contact our management team at ${MANAGEMENT_PHONE} / ${MANAGEMENT_EMAIL} for an official answer.`;
}

function isApartmentDomainQuestion(msg) {
  return APARTMENT_DOMAIN_KEYWORDS.some((keyword) => msg.includes(keyword));
}

function isOutOfFieldQuestion(msg) {
  return OFF_TOPIC_KEYWORDS.some((keyword) => msg.includes(keyword));
}

function buildOutOfFieldGuard() {
  return "I'm an AI and don't have feelings, but I'm here to help you with your apartment-related concerns. If you have any questions about rent, utilities, complaints, or maintenance, feel free to ask!";
}

function sortByDateDesc(items) {
  return (items || [])
    .slice()
    .sort((a, b) => new Date(b.reading_date || b.created_at || 0).getTime() - new Date(a.reading_date || a.created_at || 0).getTime());
}

function analyzeUsageAgainstForecast(utilities, expectedType) {
  const rows = sortByDateDesc(utilities)
    .filter((u) => (u.utility_type || u.meter_type || '').toLowerCase().includes(expectedType.toLowerCase()));

  if (rows.length < 4) {
    return null;
  }

  const latest = Number(rows[0]?.reading || rows[0]?.reading_value || 0);
  const previousWindow = rows.slice(1, 4);
  const forecast = previousWindow.reduce((sum, r) => sum + Number(r.reading || r.reading_value || 0), 0) / previousWindow.length;

  if (!Number.isFinite(latest) || !Number.isFinite(forecast) || forecast <= 0) {
    return null;
  }

  const ratio = latest / forecast;
  const deltaPct = ((latest - forecast) / forecast) * 100;
  return {
    latest,
    forecast,
    ratio,
    deltaPct
  };
}

function summarizeUtilitiesResponse(utilities) {
  const items = summarizeUtilities(utilities);
  if (items.length === 0) return getMissingDetailsMessage();
  return `**Utility Summary**\n${items.map((item) => `- ${item.summary}`).join('\n')}`;
}

function getLatestUtility(utilities, expectedType) {
  if (!utilities || utilities.length === 0) return null;
  const normalizedType = expectedType.toLowerCase();
  return utilities.find((u) => (u.utility_type || u.meter_type || '').toLowerCase().includes(normalizedType));
}

function buildTenantSummary(tenantData, meralcoRates) {
  const lines = [];
  const pendingRents = tenantData.rentPayments?.filter((r) => r.status === 'pending') || [];

  if (pendingRents.length > 0) {
    const totalPending = pendingRents.reduce((sum, r) => sum + (r.amount || 0), 0);
    const currency = pendingRents[0]?.currency || 'PHP';
    lines.push(`- **Pending Rent:** ${pendingRents.length} payment(s) totaling ${formatMoney(totalPending, currency)}.`);
  } else {
    lines.push('- **Rent Status:** Account is current.');
  }

  const latestWater = getLatestUtility(tenantData.utilities, 'water');
  if (latestWater) {
    const rate = latestWater.water_rate != null ? ` Latest water rate is ${formatMoney(latestWater.water_rate, latestWater.currency || 'PHP')}/m³.` : '';
    lines.push(`- **Water:** Latest reading ${latestWater.reading}${latestWater.unit || 'm³'}.${rate}`);
  }

  const latestElectric = getLatestUtility(tenantData.utilities, 'electricity');
  if (latestElectric) {
    const cost = latestElectric.estimated_cost ? ` costing ${formatMoney(latestElectric.estimated_cost, latestElectric.currency || 'PHP')}` : '';
    const meralco = meralcoRates?.rate_kwh ? ` Current MERALCO rate is ₱${meralcoRates.rate_kwh.toFixed(2)}/kWh (${meralcoRates.trend}).` : '';
    lines.push(`- **Electricity:** Latest reading ${latestElectric.reading}${latestElectric.unit || 'kWh'}${cost}.${meralco}`);
  }

  const unresolved = tenantData.complaints?.filter((c) => c.status !== 'resolved' && c.status !== 'closed').length || 0;
  if (unresolved > 0) {
    lines.push(`- **Complaints:** ${unresolved} unresolved complaint(s).`);
  } else {
    lines.push('- **Complaints:** No unresolved complaints at the moment.');
  }

  return `**JNLapartment Resident Support**\n${lines.join('\n')}\nNeed anything else about rent, utilities, maintenance, or policies?`;
}

function generateFallbackResponse(tenantData, apartmentInfo, meralcoRates) {
  return buildTenantSummary(tenantData, meralcoRates);
}

async function generateSmartResponse(message, tenantData, apartmentInfo, meralcoRates = null) {
  const msg = (message || '').toLowerCase();

  if (
    msg === 'hi' || msg === 'hello' || msg === 'hey' ||
    msg === 'hola' || msg === 'ola' || msg.includes('good morning') || msg.includes('good evening')
  ) {
    return '**JNLapartment Support**\n- I can help with rent payment status, utility usage, complaints, and building policies.\n- Try: "Do I have rent due?" or "Show my latest water usage."';
  }

  if (isOutOfFieldQuestion(msg)) {
    return buildOutOfFieldGuard(message);
  }

  if (msg.includes('rent') || msg.includes('payment')) {
    const rentRows = tenantData.rentPayments || [];
    const asksPaymentHistory = [
      'show', 'list', 'recent', 'latest', 'history', 'status', 'paid', 'payments'
    ].some((keyword) => msg.includes(keyword));

    if (asksPaymentHistory) {
      if (rentRows.length === 0) {
        return getMissingDetailsMessage();
      }

      const recentPayments = rentRows
        .slice()
        .sort((a, b) => new Date(b.paid_at || b.payment_date || b.created_at || 0).getTime() - new Date(a.paid_at || a.payment_date || a.created_at || 0).getTime())
        .slice(0, 5);

      const lines = recentPayments.map((payment) => {
        const amount = formatMoney(payment.amount || 0, payment.currency || 'PHP');
        const status = String(payment.status || 'unknown').toLowerCase();
        const dateLabel = payment.paid_at || payment.payment_date || payment.created_at || payment.due_date || 'Date not available';
        return `- ${amount} · ${status} · ${dateLabel}`;
      });

      const pending = rentRows.filter((r) => String(r.status || '').toLowerCase() !== 'paid' && Number(r.amount || 0) > 0);
      let answer = `**Recent Payments**\n${lines.join('\n')}`;
      if (pending.length > 0) {
        const pendingTotal = pending.reduce((sum, r) => sum + Number(r.amount || 0), 0);
        answer += `\n- Pending total: ${formatMoney(pendingTotal, pending[0]?.currency || 'PHP')}`;
      } else {
        answer += '\n- No pending payments at this time.';
      }
      return answer;
    }

    const outstanding = rentRows.filter((r) => {
      const status = String(r.status || '').toLowerCase();
      const amount = Number(r.amount || 0);
      return status !== 'paid' && amount > 0;
    });

    if (outstanding.length > 0) {
      const total = outstanding.reduce((sum, r) => sum + (r.amount || 0), 0);
      const currency = outstanding[0]?.currency || 'PHP';
      const dueDate = outstanding
        .map((r) => r.due_date)
        .filter(Boolean)
        .sort()[0];
      return `**Rent Balance**\n- Pending payments: **${outstanding.length}**\n- Total due: **${formatMoney(total, currency)}**\n- Nearest due date: ${dueDate || 'Not available'}\n- Payment steps: Open the **Payment** page and complete payment before due date.`;
    }

    return '**Rent Balance**\n- Your rent account is up to date.\n- Payment steps: Open the **Payment** page, choose a method, and submit when your next bill appears.\n- Standard schedule: 1st of each month.';
  }

  if (msg.includes('how') && (msg.includes('pay') || msg.includes('payment') || msg.includes('billing'))) {
    return '**How to Pay**\n- Go to the **Payment** page in the app\n- Select your bill and choose a payment method (GCash, PayPal, or bank transfer)\n- Submit and keep your receipt\n- For questions, contact management at ' + MANAGEMENT_PHONE;
  }

  if (msg.includes('next billing') || msg.includes('billing date') || msg.includes('billing schedule') || msg.includes('due date')) {
    const rentRows = tenantData.rentPayments || [];
    const nextDue = rentRows.map((r) => r.due_date).filter(Boolean).sort()[0];
    return `**Billing Schedule**\n- Rent is billed on the 1st of each month\n- Nearest recorded due date: ${nextDue || 'Not available'}\n- Check the Payment page for your full billing history`;
  }

  if (
    msg.includes('water') ||
    msg.includes('electric') ||
    msg.includes('electricity') ||
    msg.includes('gas') ||
    msg.includes('utility') ||
    msg.includes('consumption') ||
    (msg.includes('bill') && !msg.includes('pay') && !msg.includes('billing'))
  ) {
    const utilities = tenantData.utilities || [];
    if (utilities.length === 0) {
      return getMissingDetailsMessage();
    }

    const askedElectric = msg.includes('electric') || msg.includes('electricity') || msg.includes('power');
    const askedWater = msg.includes('water');
    const askedGas = msg.includes('gas');
    const summaries = summarizeUtilities(utilities);

    if (askedWater || askedElectric || askedGas) {
      const askedType = askedWater ? 'water' : askedElectric ? 'electricity' : 'gas';
      const item = summaries.find((entry) => entry.type.includes(askedType));
      if (!item) {
        return getMissingDetailsMessage();
      }
      let answer = `**${askedType[0].toUpperCase() + askedType.slice(1)} Usage**\n- ${item.summary}`;

      const forecastAnalysis = analyzeUsageAgainstForecast(tenantData.utilities || [], askedType);
      if (forecastAnalysis) {
        answer += `\n- Forecast baseline: ${forecastAnalysis.forecast.toFixed(2)} ${item.unit}`;
        if (forecastAnalysis.ratio > 1.1) {
          answer += `\n- **High Usage:** Current usage is ${forecastAnalysis.deltaPct.toFixed(1)}% above forecast. Please request a maintenance check for possible leaks or appliance faults.`;
        } else {
          answer += `\n- Usage vs forecast: ${forecastAnalysis.deltaPct.toFixed(1)}%`;
        }
      }

      if (askedType === 'water') {
        const latestWater = getLatestUtility(tenantData.utilities || [], 'water');
        if (latestWater?.water_rate != null) {
          answer += `\n- Current water rate: ${formatMoney(latestWater.water_rate, latestWater.currency || 'PHP')}/m³`;
        }
      }
      if (askedType === 'electricity' && meralcoRates?.rate_kwh) {
        answer += `\n- Current MERALCO rate: ₱${meralcoRates.rate_kwh.toFixed(2)}/kWh (${meralcoRates.trend})`;
      }
      return answer;
    }

    return summarizeUtilitiesResponse(utilities);
  }

  if (msg.includes('complaint') || msg.includes('issue') || msg.includes('problem') || msg.includes('file')) {
    const openComplaints = tenantData.complaints?.filter((c) => c.status === 'submitted' || c.status === 'in_progress') || [];
    if (openComplaints.length > 0) {
      return `**Complaints**\n- Pending complaints: **${openComplaints.length}**\n- Submit updates in the Complaints section\n- Typical handling time: 24-48 hours`;
    }
    return '**Complaints**\n- No pending complaints right now.\n- If needed, submit a new report with details and a photo.';
  }

  if (msg.includes('maintenance') || msg.includes('repair') || msg.includes('fix')) {
    return '**Maintenance**\n- Submit a complaint with clear details and a photo\n- Team contact target: within 24 hours for scheduling';
  }

  if (msg.includes('unit') || msg.includes('apartment') || msg.includes('room') || msg.includes('address')) {
    if (apartmentInfo && apartmentInfo.unit_number) {
      return `**Unit Details**\n- Unit number: **${apartmentInfo.unit_number}**\n- Building: ${apartmentInfo.building || 'Main'}\n- Floor: ${apartmentInfo.floor || 'Not specified'}`;
    }
    return getMissingDetailsMessage();
  }

  if (msg.includes('contact') || msg.includes('owner') || msg.includes('landlord') || msg.includes('admin') || msg.includes('manager')) {
    return `**Management Contact**\n- Phone: ${MANAGEMENT_PHONE}\n- Email: ${MANAGEMENT_EMAIL}\n- Office hours: Mon-Fri 9AM-6PM`;
  }

  if (msg.includes('building') || msg.includes('rules') || msg.includes('policy') || msg.includes('regulation')) {
    const unknownPolicyKeywords = ['gym', 'pool', 'internet', 'wifi', 'clubhouse', 'amenity'];
    if (unknownPolicyKeywords.some((keyword) => msg.includes(keyword))) {
      return getMissingDetailsMessage();
    }
    return '**Building Policies**\n- Quiet hours: 10 PM - 7 AM\n- Pets: allowed with approval\n- Guests: registration required\n- Parking: available on Level B2\nFor official policy updates, contact management.';
  }

  if (msg.includes('suggest') || msg.includes('advice') || msg.includes('help') || msg.includes('recommend')) {
    const suggestions = [];
    if (tenantData.rentPayments?.some((r) => r.status === 'pending')) {
      suggestions.push('Pay pending rent early to avoid late fees.');
    }
    if (tenantData.utilities && tenantData.utilities.length > 5) {
      const recent = tenantData.utilities.slice(0, 3);
      const older = tenantData.utilities.slice(3, 6);
      const recentAvg = recent.reduce((s, u) => s + (u.reading || 0), 0) / recent.length;
      const olderAvg = older.reduce((s, u) => s + (u.reading || 0), 0) / older.length;
      if (olderAvg > 0 && recentAvg > olderAvg * 1.2) {
        suggestions.push('**High Usage:** Water usage increased over baseline. Please request a maintenance leak check.');
      }
    }
    if (meralcoRates?.rate_kwh) {
      suggestions.push(`Current MERALCO rate is ₱${meralcoRates.rate_kwh.toFixed(2)}/kWh (${meralcoRates.trend}).`);
    }
    if (!tenantData.complaints?.some((c) => c.status !== 'resolved' && c.status !== 'closed')) {
      suggestions.push('No unresolved complaints at this time.');
    }
    return suggestions.length > 0 ? `**Recommended Actions**\n${suggestions.map((s) => `- ${s}`).join('\n')}` : '**Recommended Actions**\n- Keep paying rent on time and monitor utility usage trends.';
  }

  if (isApartmentDomainQuestion(msg)) {
    return getMissingDetailsMessage();
  }

  return null;
}

module.exports = { generateSmartResponse, generateFallbackResponse };
