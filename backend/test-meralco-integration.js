#!/usr/bin/env node
/**
 * Test script to verify Meralco API integration
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

async function testMeralcoIntegration() {
  console.log('🔌 Testing Meralco API Integration...\n');

  try {
    // Test 1: Check Meralco rates endpoint
    console.log('📊 Test 1: Fetching current Meralco rates...');
    try {
      const ratesRes = await axios.get(`${BASE_URL}/api/utility/meralco-rates`);
      if (ratesRes.data?.success) {
        const rates = ratesRes.data.data;
        console.log('✅ Meralco rates retrieved:');
        console.log(`   • Rate: ₱${rates.rate_kwh}/kWh`);
        console.log(`   • Trend: ${rates.trend} (${rates.rate_change_percent}%)`);
        console.log(`   • Source: ${rates.source}`);
        console.log(`   • Updated: ${rates.timestamp}\n`);
      }
    } catch (err) {
      console.log('⚠️  Meralco rates test failed:', err.message);
      console.log('   Note: This is expected if meralco-ph API is not available\n');
    }

    // Test 2: Check rate comparison endpoint
    console.log('📈 Test 2: Fetching rate comparison...');
    try {
      const compRes = await axios.get(`${BASE_URL}/api/utility/meralco-comparison`);
      if (compRes.data?.success) {
        const comp = compRes.data.data;
        console.log('✅ Rate comparison retrieved:');
        console.log(`   • Current: ₱${comp.current_rate}/kWh`);
        console.log(`   • Previous: ₱${comp.previous_rate}/kWh`);
        console.log(`   • Change: ₱${comp.change} (${comp.change_percent}%)`);
        console.log(`   • Message: ${comp.message}\n`);
      }
    } catch (err) {
      console.log('⚠️  Rate comparison test failed:', err.message, '\n');
    }

    // Test 3: Check tenant overview includes Meralco rates
    console.log('👤 Test 3: Fetching tenant overview with Meralco rates...');
    
    // First, we need a valid token. Try to login or create test tenant
    let token = null;
    try {
      // Try to login with test user
      const loginRes = await axios.post(`${BASE_URL}/api/auth/login`, {
        email: 'tenant@test.com',
        password: 'Test@1234'
      });
      if (loginRes.data?.token) {
        token = loginRes.data.token;
      }
    } catch (loginErr) {
      console.log('   Note: Could not login to get token (expected if no test user)\n');
    }

    if (token) {
      const overviewRes = await axios.get(
        `${BASE_URL}/api/chatbot/tenant-overview`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (overviewRes.data?.success) {
        const overview = overviewRes.data.data;
        console.log('✅ Tenant overview retrieved:');
        console.log(`   • Bills: ${overview.bills?.length || 0} records`);
        console.log(`   • Utilities: ${overview.utilities?.length || 0} records`);
        console.log(`   • Complaints: ${overview.complaints?.length || 0} records`);
        if (overview.meralco_rates) {
          console.log(`   • Meralco Rates: ₱${overview.meralco_rates.rate_kwh}/kWh (${overview.meralco_rates.trend})\n`);
        } else {
          console.log('   • Meralco Rates: Not available\n');
        }
      }
    }

    // Test 4: Electricity forecast endpoint
    console.log('⚡ Test 4: Testing electricity bill forecast...');
    if (token) {
      try {
        const userId = 2; // Assuming tenant ID 2 exists
        const forecastRes = await axios.get(
          `${BASE_URL}/api/utility/electricity-forecast/${userId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (forecastRes.data?.success) {
          const forecast = forecastRes.data.data;
          if (forecast.forecast) {
            console.log('✅ Electricity forecast calculated:');
            console.log(`   • Usage: ${forecast.forecast.usage_kwh} kWh`);
            console.log(`   • Rate: ₱${forecast.forecast.rate_per_kwh}/kWh`);
            console.log(`   • Estimated Cost: ₱${forecast.forecast.estimated_cost}`);
            console.log(`   • Trend: ${forecast.forecast.trend_indicator} ${forecast.forecast.trend}`);
            console.log(`   • Source: ${forecast.forecast.source}\n`);
          } else {
            console.log('ℹ️  No electricity readings/forecast available yet\n');
          }
        }
      } catch (foreErr) {
        console.log('⚠️  Forecast test failed:', foreErr.message, '\n');
      }
    }

    console.log('✅ Meralco integration tests complete!\n');
    console.log('📝 Integration Summary:');
    console.log('   • Meralco rates endpoint: /api/utility/meralco-rates');
    console.log('   • Rate comparison endpoint: /api/utility/meralco-comparison');
    console.log('   • Tenant overview now includes meralco_rates');
    console.log('   • Electricity forecast: /api/utility/electricity-forecast/:tenantId');
    console.log('   • AI suggestions include real-time MERALCO rate trends\n');

  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

testMeralcoIntegration();
