#!/usr/bin/env node

const BASE_URL = 'http://localhost:3000';

async function makeRequest() {
  try {
    const response = await fetch(`${BASE_URL}/api/rate-limit-test`);
    const data = await response.json();
    const headers = Object.fromEntries(response.headers.entries());
    
    return {
      status: response.status,
      headers: headers,
      data: data
    };
  } catch (error) {
    return {
      status: 0,
      headers: {},
      data: null,
      error: error.message
    };
  }
}

async function testRateLimit() {
  console.log('🧪 Testing Rate Limiting...\n');
  
  // Make 15 requests (should hit the public limit of 10)
  for (let i = 1; i <= 15; i++) {
    const result = await makeRequest();
    
    console.log(`Request ${i}:`);
    console.log(`  Status: ${result.status}`);
    console.log(`  X-RateLimit-Limit: ${result.headers['x-ratelimit-limit'] || 'Not set'}`);
    console.log(`  X-RateLimit-Remaining: ${result.headers['x-ratelimit-remaining'] || 'Not set'}`);
    console.log(`  X-RateLimit-Reset: ${result.headers['x-ratelimit-reset'] || 'Not set'}`);
    
    if (result.status === 429) {
      console.log(`  🚫 RATE LIMITED!`);
      console.log(`  Response:`, result.data);
    } else {
      console.log(`  ✅ Allowed`);
    }
    
    console.log('');
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

testRateLimit().catch(console.error);
