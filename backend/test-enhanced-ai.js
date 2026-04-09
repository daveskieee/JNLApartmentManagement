const { translateText, detectLanguage } = require('./services/translation');
const enhancedChatbot = require('./services/enhanced-chatbot');
const { analyzeSentiment } = require('./services/sentiment');

async function testAIComponents() {
  console.log('🚀 Testing Enhanced AI Components...\n');

  // Test 1: Language Detection
  console.log('1. 🗣️  Language Detection Test:');
  const testMessages = [
    'Hello, how are you today?',
    'Hola, ¿cómo estás?',
    'Bonjour, comment allez-vous?',
    'Hallo, wie geht es dir?'
  ];

  for (const msg of testMessages) {
    const lang = detectLanguage(msg);
    console.log(`   "${msg}" → Detected: ${lang}`);
  }

  console.log('');

  // Test 2: Sentiment Analysis
  console.log('2. 😊 Sentiment Analysis Test:');
  const complaintTexts = [
    'The apartment is great, very clean and well maintained!',
    'The water is leaking from the faucet, please fix it urgently.',
    'Everything is fine, no issues at all.',
    'This is unacceptable! The elevator has been broken for 3 days!'
  ];

  for (const text of complaintTexts) {
    try {
      const sentiment = await analyzeSentiment(text);
      if (sentiment) {
        const emoji = sentiment.label === 'POSITIVE' ? '😊' : '😠';
        console.log(`   ${emoji} "${text.substring(0, 40)}..." → ${sentiment.label} (${(sentiment.score * 100).toFixed(1)}% confidence)`);
      } else {
        console.log(`   ❓ "${text.substring(0, 40)}..." → Analysis failed`);
      }
    } catch (error) {
      console.log(`   ❌ "${text.substring(0, 40)}..." → Error: ${error.message}`);
    }
  }

  console.log('');

  // Test 3: Translation
  console.log('3. 🌍 Translation Test:');
  try {
    const original = 'Hello, I need help with my rent payment.';
    const translated = await translateText(original, 'en', 'es');
    console.log(`   English: "${original}"`);
    console.log(`   Spanish: "${translated}"`);
  } catch (error) {
    console.log(`   ❌ Translation failed: ${error.message}`);
  }

  console.log('');

  // Test 4: Enhanced Chatbot
  console.log('4. 🤖 Enhanced Chatbot Test:');
  const testQueries = [
    'Hello, can you help me with my rent?',
    'I have a complaint about the water',
    'How do I pay my utilities?'
  ];

  for (const query of testQueries) {
    try {
      console.log(`   Query: "${query}"`);
      const response = await enhancedChatbot.generateResponse(query);
      if (response) {
        console.log(`   🤖 Response: "${response}"`);
      } else {
        console.log(`   🤖 Response: No response generated`);
      }
      console.log('');
    } catch (error) {
      console.log(`   ❌ Chatbot error: ${error.message}\n`);
    }
  }

  console.log('✅ AI Components Test Completed!');
}

// Run the test
testAIComponents().catch(console.error);