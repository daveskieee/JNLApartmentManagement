const axios = require('axios');

// Test data - you need to login first to get a token
const API_URL = 'http://localhost:5001/api';

// Mock JWT token (you'll need to get a real one from login)
const testToken = 'your_jwt_token_here';

const testQuestions = [
  'What about my rent?',
  'How do I lessen my water bill?',
  'What is my unit number?',
  'How do I contact the owner?',
  'Can you give me some suggestions?',
  'What are the building rules?',
  'How do I file a complaint?',
  'What is 2+2?', // This should go to HuggingFace API
  'Tell me a joke', // This should go to HuggingFace API
];

async function testChatbot() {
  console.log('Testing Chatbot API...\n');

  for (const question of testQuestions) {
    try {
      console.log(`Q: ${question}`);
      
      const response = await axios.post(
        `${API_URL}/chatbot/query`,
        { message: question },
        {
          headers: {
            'Authorization': `Bearer ${testToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`A: ${response.data.message}\n`);
    } catch (error) {
      console.error(`Error: ${error.response?.data?.message || error.message}\n`);
    }
  }
}

console.log('NOTE: You need to get a valid JWT token from login first!');
console.log('Steps:');
console.log('1. Open http://localhost:3001 in browser');
console.log('2. Login or register a test account');
console.log('3. Open browser DevTools -> Network tab');
console.log('4. Make a chatbot request and copy the Authorization header token');
console.log('5. Replace testToken in this script\n');

// Uncomment when you have a valid token:
// testChatbot();
