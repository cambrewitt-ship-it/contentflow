#!/usr/bin/env node

/**
 * Rate Limiting Test Script
 * 
 * This script tests the rate limiting functionality by making requests
 * to different API endpoints and monitoring the rate limit responses.
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

// Test configurations
const tests = [
  {
    name: 'AI Endpoint Test',
    url: `${BASE_URL}/api/ai`,
    method: 'POST',
    body: { action: 'test' },
    expectedLimit: 20,
    expectedWindow: '1 hour',
    requests: 25, // Make more requests than the limit
  },
  {
    name: 'Public API Test',
    url: `${BASE_URL}/api/test-db`,
    method: 'GET',
    expectedLimit: 10,
    expectedWindow: '15 minutes',
    requests: 15, // Make more requests than the limit
  },
  {
    name: 'Portal Endpoint Test',
    url: `${BASE_URL}/api/portal/validate?token=test-token`,
    method: 'GET',
    expectedLimit: 50,
    expectedWindow: '15 minutes',
    requests: 55, // Make more requests than the limit
  },
];

// Helper function to make HTTP requests
async function makeRequest(url, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    const data = await response.text();
    
    return {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      data: data ? JSON.parse(data) : null,
    };
  } catch (error) {
    return {
      status: 0,
      headers: {},
      data: null,
      error: error.message,
    };
  }
}

// Helper function to parse rate limit headers
function parseRateLimitHeaders(headers) {
  return {
    limit: parseInt(headers['x-ratelimit-limit']) || 0,
    remaining: parseInt(headers['x-ratelimit-remaining']) || 0,
    reset: headers['x-ratelimit-reset'],
    retryAfter: headers['retry-after'],
  };
}

// Helper function to wait
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Main test function
async function runTest(testConfig) {
  console.log(`\n🧪 Running ${testConfig.name}...`);
  console.log(`📊 Expected: ${testConfig.expectedLimit} requests per ${testConfig.expectedWindow}`);
  console.log(`📤 Making ${testConfig.requests} requests...\n`);

  const results = [];
  let rateLimited = false;
  let firstRateLimitRequest = null;

  for (let i = 1; i <= testConfig.requests; i++) {
    const result = await makeRequest(testConfig.url, testConfig.method, testConfig.body);
    const rateLimitInfo = parseRateLimitHeaders(result.headers);
    
    results.push({
      request: i,
      status: result.status,
      rateLimit: rateLimitInfo,
      data: result.data,
    });

    // Check if we hit rate limit
    if (result.status === 429) {
      if (!rateLimited) {
        rateLimited = true;
        firstRateLimitRequest = i;
        console.log(`🚫 Rate limit hit at request ${i}`);
        console.log(`📊 Rate limit info:`, rateLimitInfo);
      }
    } else if (i <= 5 || i % 5 === 0) {
      // Log first 5 requests and every 5th request
      console.log(`✅ Request ${i}: Status ${result.status}, Remaining: ${rateLimitInfo.remaining}`);
    }

    // Small delay between requests
    await wait(100);
  }

  // Analyze results
  const successfulRequests = results.filter(r => r.status === 200 || r.status === 201);
  const rateLimitedRequests = results.filter(r => r.status === 429);
  const errorRequests = results.filter(r => r.status >= 400 && r.status !== 429);

  console.log(`\n📈 Results for ${testConfig.name}:`);
  console.log(`✅ Successful requests: ${successfulRequests.length}`);
  console.log(`🚫 Rate limited requests: ${rateLimitedRequests.length}`);
  console.log(`❌ Error requests: ${errorRequests.length}`);

  if (rateLimited) {
    console.log(`🎯 First rate limit hit at request: ${firstRateLimitRequest}`);
    
    // Check if rate limiting worked as expected
    if (firstRateLimitRequest <= testConfig.expectedLimit) {
      console.log(`✅ Rate limiting working correctly (hit limit at ${firstRateLimitRequest} <= ${testConfig.expectedLimit})`);
    } else {
      console.log(`⚠️  Rate limiting may not be working (hit limit at ${firstRateLimitRequest} > ${testConfig.expectedLimit})`);
    }
  } else {
    console.log(`⚠️  No rate limiting detected - this might indicate an issue`);
  }

  // Show sample rate limit response
  if (rateLimitedRequests.length > 0) {
    const sampleResponse = rateLimitedRequests[0];
    console.log(`\n📋 Sample rate limit response:`);
    console.log(`Status: ${sampleResponse.status}`);
    console.log(`Headers:`, sampleResponse.rateLimit);
    if (sampleResponse.data) {
      console.log(`Body:`, JSON.stringify(sampleResponse.data, null, 2));
    }
  }

  return {
    testName: testConfig.name,
    totalRequests: testConfig.requests,
    successfulRequests: successfulRequests.length,
    rateLimitedRequests: rateLimitedRequests.length,
    errorRequests: errorRequests.length,
    firstRateLimitRequest,
    rateLimitWorking: rateLimited && firstRateLimitRequest <= testConfig.expectedLimit,
  };
}

// Main execution
async function main() {
  console.log('🚀 Starting Rate Limiting Tests');
  console.log(`🌐 Base URL: ${BASE_URL}`);
  console.log('⏰ This may take a few minutes...\n');

  const allResults = [];

  for (const testConfig of tests) {
    try {
      const result = await runTest(testConfig);
      allResults.push(result);
      
      // Wait between tests
      await wait(2000);
    } catch (error) {
      console.error(`❌ Test failed: ${testConfig.name}`, error);
      allResults.push({
        testName: testConfig.name,
        error: error.message,
      });
    }
  }

  // Summary
  console.log('\n📊 Test Summary:');
  console.log('================');
  
  allResults.forEach(result => {
    if (result.error) {
      console.log(`❌ ${result.testName}: FAILED - ${result.error}`);
    } else if (result.rateLimitWorking) {
      console.log(`✅ ${result.testName}: PASSED - Rate limiting working correctly`);
    } else {
      console.log(`⚠️  ${result.testName}: ISSUE - Rate limiting may not be working as expected`);
    }
  });

  const passedTests = allResults.filter(r => r.rateLimitWorking).length;
  const totalTests = allResults.filter(r => !r.error).length;
  
  console.log(`\n🎯 Overall: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All rate limiting tests passed!');
  } else {
    console.log('⚠️  Some tests failed. Check the configuration and try again.');
  }
}

// Run the tests
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { runTest, makeRequest, parseRateLimitHeaders };
