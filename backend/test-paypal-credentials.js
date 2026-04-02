#!/usr/bin/env node

// Load environment variables
require('dotenv').config();

console.log('🔍 Checking PayPal Credentials Configuration\n');
console.log('========================================\n');

// Check backend environment variables
console.log('📌 Backend .env Variables:');
console.log(`   PAYPAL_MODE: ${process.env.PAYPAL_MODE || 'NOT SET'}`);
console.log(`   PAYPAL_CLIENT_ID: ${process.env.PAYPAL_CLIENT_ID ? process.env.PAYPAL_CLIENT_ID.substring(0, 20) + '...' : 'NOT SET'}`);
console.log(`   PAYPAL_CLIENT_SECRET: ${process.env.PAYPAL_CLIENT_SECRET ? process.env.PAYPAL_CLIENT_SECRET.substring(0, 20) + '...' : 'NOT SET'}`);

console.log('\n========================================\n');

// Test PayPal authentication
const axios = require('axios');

const getPayPalAccessToken = async () => {
  try {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    const mode = process.env.PAYPAL_MODE || 'sandbox';

    if (!clientId || !clientSecret) {
      console.log('❌ CRITICAL: PayPal credentials not found in .env!');
      return null;
    }

    const apiBase = mode === 'live' 
      ? 'https://api.paypal.com'
      : 'https://api.sandbox.paypal.com';

    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    console.log('🔐 Testing PayPal Authentication:');
    console.log(`   Mode: ${mode}`);
    console.log(`   API Base: ${apiBase}`);
    console.log(`   Auth Header: ${auth.substring(0, 20)}...\n`);

    console.log('⏳ Sending request to PayPal OAuth endpoint...');
    
    const response = await axios.post(
      `${apiBase}/v1/oauth2/token`,
      'grant_type=client_credentials',
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 10000
      }
    );

    if (response.data && response.data.access_token) {
      console.log('✅ SUCCESS! PayPal authentication works!\n');
      console.log('📊 Details:');
      console.log(`   Access Token: ${response.data.access_token.substring(0, 30)}...`);
      console.log(`   Token Type: ${response.data.token_type}`);
      console.log(`   Expires In: ${response.data.expires_in} seconds`);
      return response.data.access_token;
    }
  } catch (error) {
    console.error('❌ FAILED to authenticate with PayPal!\n');
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Error:', error.response.data);
    } else if (error.code) {
      console.error(`   Error Code: ${error.code}`);
      console.error(`   Message: ${error.message}`);
    } else {
      console.error('   Error:', error.message);
    }
    return null;
  }
};

getPayPalAccessToken().then(token => {
  console.log('\n========================================\n');
  if (token) {
    console.log('✅ YOUR PAYPAL CREDENTIALS ARE WORKING!\n');
    console.log('You can now use PayPal to process payments.');
  } else {
    console.log('❌ YOUR PAYPAL CREDENTIALS ARE NOT WORKING!\n');
    console.log('Please check:');
    console.log('   1. The .env file has correct PAYPAL_CLIENT_ID');
    console.log('   2. The .env file has correct PAYPAL_CLIENT_SECRET');
    console.log('   3. The credentials are for the correct PayPal account');
    console.log('   4. You have internet connection');
  }
  process.exit(0);
});
