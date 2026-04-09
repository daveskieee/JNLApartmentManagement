const { translateText, detectLanguage } = require('./services/translation');
const enhancedChatbot = require('./services/enhanced-chatbot');

async function testAIComponents() {
  console.log('Testing AI Components...\n');

  // Test 1: Language Detection
  console.log('1. Testing Language Detection:');
  const testMessages = [
    'Hello, how are you?',
    'Hola, ¿cómo estás?',
    'Bonjour, comment allez-vous?',
    'Hallo, wie geht es dir?'
  ];

  for (const msg of testMessages) {
    const lang = detectLanguage(msg);
    console.log(`  "${msg}" → ${lang}`);
  }

  // Test 2: Translation (if API key is available)
  console.log('\n2. Testing Translation:');
  try {
    const translated = await translateText('Hello, how are you?', 'en', 'es');
    console.log(`  English: "Hello, how are you?"`);
    console.log(`  Spanish: "${translated}"`);
  } catch (error) {
    console.log('  Translation test failed:', error.message);
  }

  // Test 3: Enhanced Chatbot (if API key is available)
  console.log('\n3. Testing Enhanced Chatbot:');
  try {
    const response = await enhancedChatbot.generateResponse('Hello, can you help me with my rent?');
    console.log(`  User: "Hello, can you help me with my rent?"`);
    console.log(`  Bot: "${response || 'No response generated'}"`);
  } catch (error) {
    console.log('  Enhanced chatbot test failed:', error.message);
  }

  console.log('\nAI Components test completed!');
}

// Run the test
testAIComponents().catch(console.error);