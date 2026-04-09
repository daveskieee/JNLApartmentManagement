const axios = require('axios');

const LOCAL_TRANSLATIONS = {
  en: {
    es: {
      hello: 'hola',
      hi: 'hola',
      apartment: 'apartamento',
      assistant: 'asistente',
      please: 'por favor',
      check: 'revisar',
      pending: 'pendiente',
      status: 'estado',
      today: 'hoy',
      yesterday: 'ayer',
      reminder: 'recordatorio',
      usage: 'consumo',
      bill: 'factura',
      submit: 'enviar',
      maintenance: 'mantenimiento',
      how: 'como',
      are: 'estas',
      you: 'tu',
      rent: 'alquiler',
      water: 'agua',
      electricity: 'electricidad',
      complaint: 'queja',
      payment: 'pago',
      due: 'vencimiento',
      thanks: 'gracias',
    },
    fr: {
      hello: 'bonjour',
      hi: 'salut',
      apartment: 'appartement',
      assistant: 'assistant',
      please: 's il vous plait',
      check: 'verifier',
      pending: 'en attente',
      status: 'statut',
      today: 'aujourd hui',
      yesterday: 'hier',
      reminder: 'rappel',
      usage: 'consommation',
      bill: 'facture',
      submit: 'soumettre',
      maintenance: 'maintenance',
      how: 'comment',
      are: 'etes',
      you: 'vous',
      rent: 'loyer',
      water: 'eau',
      electricity: 'electricite',
      complaint: 'plainte',
      payment: 'paiement',
      due: 'echeance',
      thanks: 'merci',
    },
    de: {
      hello: 'hallo',
      hi: 'hallo',
      apartment: 'wohnung',
      assistant: 'assistent',
      please: 'bitte',
      check: 'prufen',
      pending: 'ausstehend',
      status: 'status',
      today: 'heute',
      yesterday: 'gestern',
      reminder: 'erinnerung',
      usage: 'verbrauch',
      bill: 'rechnung',
      submit: 'einreichen',
      maintenance: 'wartung',
      how: 'wie',
      are: 'bist',
      you: 'du',
      rent: 'miete',
      water: 'wasser',
      electricity: 'strom',
      complaint: 'beschwerde',
      payment: 'zahlung',
      due: 'faellig',
      thanks: 'danke',
    }
  }
};

const LOCAL_PHRASE_TRANSLATIONS = {
  en: {
    es: {
      'how are you': 'como estas',
      'how can i help': 'como puedo ayudar',
      'payment due': 'pago vencido',
      'rent payment due': 'pago de alquiler vencido',
      'submit a complaint': 'enviar una queja',
      'utility usage': 'consumo de servicios',
      'thank you': 'gracias',
    },
    fr: {
      'how are you': 'comment allez vous',
      'how can i help': 'comment puis je aider',
      'payment due': 'paiement echeance',
      'rent payment due': 'paiement du loyer echeance',
      'submit a complaint': 'soumettre une plainte',
      'utility usage': 'consommation des services',
      'thank you': 'merci',
    },
    de: {
      'how are you': 'wie geht es dir',
      'how can i help': 'wie kann ich helfen',
      'payment due': 'zahlung faellig',
      'rent payment due': 'mietzahlung faellig',
      'submit a complaint': 'eine beschwerde einreichen',
      'utility usage': 'nebenkosten verbrauch',
      'thank you': 'danke',
    },
  }
};

function preserveCasing(original, translated) {
  if (!original) return translated;
  if (original === original.toUpperCase()) return translated.toUpperCase();
  if (original[0] && original[0] === original[0].toUpperCase()) {
    return translated[0].toUpperCase() + translated.slice(1);
  }
  return translated;
}

function translateLocally(text, sourceLang, targetLang) {
  if (!text || sourceLang === targetLang) return text;

  const phraseDict = LOCAL_PHRASE_TRANSLATIONS[sourceLang]?.[targetLang] || {};
  const dict = LOCAL_TRANSLATIONS[sourceLang]?.[targetLang];
  if (!dict) return text;

  let working = String(text);
  Object.entries(phraseDict).forEach(([from, to]) => {
    const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`\\b${escaped}\\b`, 'gi');
    working = working.replace(pattern, (matched) => preserveCasing(matched, to));
  });

  return working.split(/(\b)/).map((token) => {
    const key = token.toLowerCase();
    const mapped = dict[key];
    if (!mapped) return token;
    return preserveCasing(token, mapped);
  }).join('');
}

async function translateText(text, sourceLang = 'en', targetLang = 'es') {
  const apiKey = process.env.HUGGINGFACE_API_KEY;

  if (!apiKey || apiKey === 'hf_default') {
    console.log('HuggingFace API key not configured for translation, using local fallback');
    return translateLocally(text, sourceLang, targetLang);
  }

  try {
    console.log(`Translating from ${sourceLang} to ${targetLang}:`, text.substring(0, 50) + '...');

    const model = `Helsinki-NLP/opus-mt-${sourceLang}-${targetLang}`;

    const response = await axios.post(
      `https://api-inference.huggingface.co/models/${model}`,
      { inputs: text },
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 15000
      }
    );

    console.log('Translation result:', response.data);

    if (response.data && Array.isArray(response.data) && response.data[0]?.translation_text) {
      return response.data[0].translation_text;
    }

    return translateLocally(text, sourceLang, targetLang);
  } catch (error) {
    console.error('Translation error:', error.response?.status, error.message);
    return translateLocally(text, sourceLang, targetLang);
  }
}

// Detect language with weighted heuristic tokens.
function detectLanguage(text) {
  const spanishWords = ['hola', 'como', 'estas', 'usted', 'gracias', 'alquiler', 'agua', 'queja', 'pago', 'vencimiento'];
  const frenchWords = ['bonjour', 'comment', 'allez', 'vous', 'merci', 'loyer', 'eau', 'plainte', 'paiement', 'echeance'];
  const germanWords = ['hallo', 'wie', 'geht', 'danke', 'miete', 'wasser', 'strom', 'beschwerde', 'zahlung', 'faellig'];

  const words = String(text)
    .toLowerCase()
    .replace(/[^\p{L}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const spanishCount = words.filter((word) => spanishWords.includes(word)).length;
  const frenchCount = words.filter((word) => frenchWords.includes(word)).length;
  const germanCount = words.filter((word) => germanWords.includes(word)).length;

  if (spanishCount >= 2 && spanishCount > frenchCount && spanishCount > germanCount) return 'es';
  if (frenchCount >= 2 && frenchCount > spanishCount && frenchCount > germanCount) return 'fr';
  if (germanCount >= 2 && germanCount > spanishCount && germanCount > frenchCount) return 'de';

  if (spanishCount === 1 && frenchCount === 0 && germanCount === 0) return 'es';
  if (frenchCount === 1 && spanishCount === 0 && germanCount === 0) return 'fr';
  if (germanCount === 1 && spanishCount === 0 && frenchCount === 0) return 'de';

  return 'en'; // Default to English
}

module.exports = { translateText, detectLanguage };