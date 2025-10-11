#!/usr/bin/env node

/**
 * CORS Testing Script
 * 
 * This script tests the CORS configuration by making requests
 * with different origins and methods.
 */

const https = require('https');
const http = require('http');

// Configuration
const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';
const TEST_ORIGINS = [
  'http://localhost:3000',      // Allowed in development
  'http://localhost:3001',      // Allowed in development
  'https://malicious-site.com', // Should be blocked
  'https://your-production-domain.com', // Should be allowed in production
];

const TEST_ROUTES = [
  '/api/clients',
  '/api/portal/calendar',
  '/api/portal/upload',
];

// Test results
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
  console.log(`${prefix} [${timestamp}] ${message}`);
}

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https');
    const client = isHttps ? https : http;
    
    const requestOptions = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const req = client.request(url, requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: data
        });
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function testCorsPreflight(origin, route) {
  const url = `${BASE_URL}${route}`;
  
  try {
    const response = await makeRequest(url, {
      method: 'OPTIONS',
      headers: {
        'Origin': origin,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Content-Type, Authorization'
      }
    });

    const isAllowed = response.status === 200;
    const hasCorsHeaders = response.headers['access-control-allow-origin'];
    
    return {
      origin,
      route,
      status: response.status,
      hasCorsHeaders,
      isAllowed,
      headers: response.headers
    };
  } catch (error) {
    return {
      origin,
      route,
      error: error.message,
      isAllowed: false
    };
  }
}

async function testCorsRequest(origin, route) {
  const url = `${BASE_URL}${route}`;
  
  try {
    const response = await makeRequest(url, {
      method: 'GET',
      headers: {
        'Origin': origin
      }
    });

    const isAllowed = response.status !== 403;
    const hasCorsHeaders = response.headers['access-control-allow-origin'];
    
    return {
      origin,
      route,
      status: response.status,
      hasCorsHeaders,
      isAllowed,
      data: response.data
    };
  } catch (error) {
    return {
      origin,
      route,
      error: error.message,
      isAllowed: false
    };
  }
}

async function runTests() {
  log('Starting CORS tests...');
  log(`Testing against: ${BASE_URL}`);
  
  // Test preflight requests
  log('\n🔍 Testing CORS Preflight Requests...');
  for (const origin of TEST_ORIGINS) {
    for (const route of TEST_ROUTES) {
      const result = await testCorsPreflight(origin, route);
      results.tests.push({ type: 'preflight', ...result });
      
      if (result.isAllowed) {
        results.passed++;
        log(`Preflight: ${origin} -> ${route} - ALLOWED (${result.status})`, 'success');
      } else {
        results.failed++;
        log(`Preflight: ${origin} -> ${route} - BLOCKED (${result.status})`, 'error');
      }
    }
  }

  // Test actual requests
  log('\n🔍 Testing CORS Actual Requests...');
  for (const origin of TEST_ORIGINS) {
    for (const route of TEST_ROUTES) {
      const result = await testCorsRequest(origin, route);
      results.tests.push({ type: 'request', ...result });
      
      if (result.isAllowed) {
        results.passed++;
        log(`Request: ${origin} -> ${route} - ALLOWED (${result.status})`, 'success');
      } else {
        results.failed++;
        log(`Request: ${origin} -> ${route} - BLOCKED (${result.status})`, 'error');
      }
    }
  }

  // Summary
  log('\n📊 Test Summary:');
  log(`Total tests: ${results.passed + results.failed}`);
  log(`Passed: ${results.passed}`, 'success');
  log(`Failed: ${results.failed}`, results.failed > 0 ? 'error' : 'success');

  // Detailed results
  log('\n📋 Detailed Results:');
  results.tests.forEach(test => {
    const status = test.isAllowed ? '✅' : '❌';
    const type = test.type.toUpperCase();
    log(`${status} ${type}: ${test.origin} -> ${test.route} (${test.status})`);
    
    if (test.error) {
      log(`   Error: ${test.error}`, 'error');
    }
    
    if (test.hasCorsHeaders) {
      log(`   CORS Headers: Present`);
    } else {
      log(`   CORS Headers: Missing`, 'error');
    }
  });

  // Recommendations
  log('\n💡 Recommendations:');
  const blockedAllowed = results.tests.filter(t => !t.isAllowed && 
    (t.origin.includes('localhost') || t.origin.includes('127.0.0.1')));
  
  if (blockedAllowed.length > 0) {
    log('⚠️  Some localhost origins were blocked. Check your CORS configuration.', 'error');
  }

  const allowedMalicious = results.tests.filter(t => t.isAllowed && 
    t.origin.includes('malicious-site.com'));
  
  if (allowedMalicious.length > 0) {
    log('⚠️  Malicious origins were allowed. This is a security risk!', 'error');
  }

  const missingCorsHeaders = results.tests.filter(t => t.isAllowed && !t.hasCorsHeaders);
  if (missingCorsHeaders.length > 0) {
    log('⚠️  Some allowed requests are missing CORS headers.', 'error');
  }

  if (results.failed === 0 && missingCorsHeaders.length === 0) {
    log('🎉 All CORS tests passed! Your configuration is working correctly.', 'success');
  }
}

// Run the tests
runTests().catch(error => {
  log(`Test execution failed: ${error.message}`, 'error');
  process.exit(1);
});
