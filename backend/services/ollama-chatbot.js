const axios = require('axios');

const MANAGEMENT_PHONE = process.env.MANAGEMENT_PHONE || '(02) 1234-5678';
const MANAGEMENT_EMAIL = process.env.MANAGEMENT_EMAIL || 'admin@apartmentmgmt.com';
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'mistral:7b';

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function trimText(value, maxLength = 180) {
  const text = String(value || '').trim();
  if (!text) return null;
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

function compactRentPayment(payment) {
  return {
    id: payment.id || null,
    amount: toNumber(payment.amount),
    currency: payment.currency || 'PHP',
    status: payment.status || null,
    due_date: payment.due_date || null,
    paid_at: payment.paid_at || payment.payment_date || null,
    created_at: payment.created_at || null,
    payment_method: payment.payment_method || payment.method || null,
    reference_number: payment.reference_number || payment.reference || null,
  };
}

function compactUtilityReading(reading) {
  return {
    id: reading.id || null,
    utility_type: reading.utility_type || reading.meter_type || null,
    reading: toNumber(reading.reading),
    unit: reading.unit || null,
    estimated_cost: toNumber(reading.estimated_cost),
    water_rate: toNumber(reading.water_rate),
    currency: reading.currency || 'PHP',
    reading_date: reading.reading_date || null,
    created_at: reading.created_at || null,
  };
}

function compactComplaint(complaint) {
  return {
    id: complaint.id || null,
    title: complaint.title || complaint.subject || complaint.category || 'Complaint',
    category: complaint.category || null,
    status: complaint.status || null,
    priority: complaint.priority || null,
    created_at: complaint.created_at || null,
    updated_at: complaint.updated_at || null,
    description: trimText(complaint.description || complaint.details || complaint.message),
  };
}

function sanitizeOllamaResponse(content) {
  const text = String(content || '').replace(/\r/g, '').trim();
  if (!text) return null;

  const lines = text
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line, index, array) => !(line === '' && array[index - 1] === ''));

  const limitedLines = [];
  let bulletCount = 0;

  for (const line of lines) {
    if (line.startsWith('- ')) {
      bulletCount += 1;
      if (bulletCount > 4) {
        break;
      }
    }
    limitedLines.push(line);
    if (limitedLines.join('\n').length > 650) {
      break;
    }
  }

  return limitedLines.join('\n').trim();
}

function pickLatestByType(utilities, type) {
  const rows = (utilities || [])
    .filter((u) => String(u.utility_type || u.meter_type || '').toLowerCase().includes(type))
    .sort((a, b) => new Date(b.reading_date || b.created_at || 0).getTime() - new Date(a.reading_date || a.created_at || 0).getTime());
  return rows[0] || null;
}

function buildTenantContext(tenantData, apartmentInfo, meralcoRates) {
  const rentPayments = tenantData?.rentPayments || [];
  const utilities = tenantData?.utilities || [];
  const complaints = tenantData?.complaints || [];

  const pendingRents = rentPayments.filter((r) => {
    const status = String(r.status || '').toLowerCase();
    return status !== 'paid' && toNumber(r.amount) > 0;
  });
  const unresolvedComplaints = (tenantData?.complaints || []).filter((c) => {
    const status = String(c.status || '').toLowerCase();
    return status !== 'resolved' && status !== 'closed';
  });

  const latestWater = pickLatestByType(utilities, 'water');
  const latestElectric = pickLatestByType(utilities, 'electric');

  return {
    generated_at: new Date().toISOString(),
    apartment: {
      unit_number: apartmentInfo?.unit_number || null,
      building: apartmentInfo?.building || null,
      floor: apartmentInfo?.floor || null,
    },
    rent: {
      pending_count: pendingRents.length,
      pending_total: Number(pendingRents.reduce((sum, r) => sum + Number(r.amount || 0), 0).toFixed(2)),
      currency: pendingRents[0]?.currency || 'PHP',
      recent_records: rentPayments.slice(0, 8).map(compactRentPayment),
    },
    utilities: {
      latest_water: latestWater
        ? {
            reading: latestWater.reading,
            unit: latestWater.unit || 'm3',
            estimated_cost: latestWater.estimated_cost,
            water_rate: latestWater.water_rate,
            reading_date: latestWater.reading_date,
          }
        : null,
      latest_electricity: latestElectric
        ? {
            reading: latestElectric.reading,
            unit: latestElectric.unit || 'kWh',
            estimated_cost: latestElectric.estimated_cost,
            currency: latestElectric.currency || 'PHP',
            reading_date: latestElectric.reading_date,
          }
        : null,
      meralco_rate_kwh: meralcoRates?.rate_kwh || null,
      meralco_trend: meralcoRates?.trend || null,
      recent_records: utilities.slice(0, 10).map(compactUtilityReading),
    },
    complaints: {
      unresolved_count: unresolvedComplaints.length,
      recent_records: complaints.slice(0, 6).map(compactComplaint),
    },
  };
}

const APARTMENT_KEYWORDS = [
  'rent', 'payment', 'payments', 'bill', 'billing',
  'utility', 'utilities', 'water', 'electric', 'electricity', 'gas', 'usage', 'reading', 'consumption',
  'complaint', 'complaints', 'issue', 'maintenance', 'repair', 'fix',
  'unit', 'apartment', 'floor', 'building', 'lease', 'contract', 'deposit', 'parking',
  'policy', 'rules', 'regulation', 'management', 'admin', 'landlord', 'due date'
];

function isApartmentMessage(message) {
  const msg = String(message || '').toLowerCase();
  return APARTMENT_KEYWORDS.some((keyword) => msg.includes(keyword));
}

async function generateOllamaResponse(message, tenantData, apartmentInfo, meralcoRates) {
  try {
    const isTenantQuery = isApartmentMessage(message);
    const tenantContext = isTenantQuery ? buildTenantContext(tenantData, apartmentInfo, meralcoRates) : null;

    const systemPrompt = isTenantQuery
      ? [
          'You are the AI Resident Specialist for JNLapartment.',
          'Be professional, concise, and use markdown bullet points only when useful.',
          'Your expertise is strictly apartment management: rent, utilities, complaints, maintenance, and policies.',
          'Prioritize provided tenant context data when answering.',
          'When the tenant asks about payments, complaints, or utilities, use the recent_records arrays and cite the relevant dates, statuses, amounts, readings, or costs from that context.',
          'Answer only the user\'s exact question. Do not include unrelated sections or extra summaries from other categories.',
          'Keep the response short: maximum 4 bullet points or 80 words unless the user explicitly asks for more detail.',
          `If specific apartment information is missing, respond exactly: "I don't have the specific details for that in my database. Please contact our management team at ${MANAGEMENT_PHONE} / ${MANAGEMENT_EMAIL} for an official answer."`,
          'Do not claim data that is not in the provided context.',
        ].join(' ')
      : [
          'You are a friendly AI assistant for JNLapartment residents.',
          'Respond naturally and warmly to casual messages in 1-2 short sentences.',
          'Do not mention or reveal any tenant data, payments, utilities, or complaint records.',
          'At the end of your reply, briefly mention you are available to help with apartment concerns.',
        ].join(' ');

    const userPrompt = isTenantQuery
      ? [`Tenant context JSON: ${JSON.stringify(tenantContext)}`, `User message: ${message}`].join('\n\n')
      : message;

    const response = await axios.post(
      `${OLLAMA_BASE_URL}/api/chat`,
      {
        model: OLLAMA_MODEL,
        stream: false,
        options: {
          temperature: 0.2,
          num_predict: 180,
        },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      },
      {
        timeout: 25000,
      }
    );

    const content = response?.data?.message?.content;
    return typeof content === 'string' && content.trim() ? sanitizeOllamaResponse(content) : null;
  } catch (error) {
    console.warn('[OLLAMA] Local model call failed:', error.response?.status || error.message);
    return null;
  }
}

module.exports = { generateOllamaResponse };
