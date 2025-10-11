#!/usr/bin/env node

/**
 * CSP Header Testing Script
 * 
 * Tests that security headers are properly configured
 * Run: node scripts/test-csp.js [url]
 * Default URL: http://localhost:3000
 */

const http = require('http');
const https = require('https');

const testUrl = process.argv[2] || 'http://localhost:3000';
const url = new URL(testUrl);
const client = url.protocol === 'https:' ? https : http;

console.log('\n🔒 Testing Security Headers\n');
console.log(`Target: ${testUrl}\n`);
console.log('='.repeat(60));

client.get(testUrl, (res) => {
  const headers = res.headers;
  
  console.log('\n📋 Security Headers Status:\n');
  
  // CSP Header
  const csp = headers['content-security-policy'];
  if (csp) {
    console.log('✅ Content-Security-Policy: PRESENT');
    console.log(`   ${csp.substring(0, 80)}...`);
    
    // Check critical directives
    const directives = {
      "default-src 'self'": csp.includes("default-src 'self'"),
      "frame-ancestors 'none'": csp.includes("frame-ancestors 'none'"),
      "object-src 'none'": csp.includes("object-src 'none'"),
      "style-src 'unsafe-inline'": csp.includes("style-src") && csp.includes("'unsafe-inline'"),
      "img-src blob: data:": csp.includes("img-src") && csp.includes("blob:") && csp.includes("data:"),
    };
    
    console.log('\n   CSP Directives:');
    Object.entries(directives).forEach(([directive, present]) => {
      console.log(`   ${present ? '✅' : '❌'} ${directive}`);
    });
  } else {
    console.log('❌ Content-Security-Policy: MISSING');
  }
  
  // X-Frame-Options
  console.log('\n' + '-'.repeat(60) + '\n');
  const xFrameOptions = headers['x-frame-options'];
  if (xFrameOptions) {
    console.log(`✅ X-Frame-Options: ${xFrameOptions}`);
  } else {
    console.log('❌ X-Frame-Options: MISSING');
  }
  
  // HSTS (only expected in production)
  const hsts = headers['strict-transport-security'];
  if (hsts) {
    console.log(`✅ Strict-Transport-Security: ${hsts}`);
  } else {
    console.log(`⚠️  Strict-Transport-Security: MISSING (OK for development)`);
  }
  
  // X-Content-Type-Options
  const xContentType = headers['x-content-type-options'];
  if (xContentType === 'nosniff') {
    console.log(`✅ X-Content-Type-Options: ${xContentType}`);
  } else {
    console.log('❌ X-Content-Type-Options: MISSING or incorrect');
  }
  
  // X-DNS-Prefetch-Control
  const dnsPrefetch = headers['x-dns-prefetch-control'];
  if (dnsPrefetch === 'off') {
    console.log(`✅ X-DNS-Prefetch-Control: ${dnsPrefetch}`);
  } else {
    console.log('❌ X-DNS-Prefetch-Control: MISSING or incorrect');
  }
  
  // X-Download-Options
  const downloadOptions = headers['x-download-options'];
  if (downloadOptions === 'noopen') {
    console.log(`✅ X-Download-Options: ${downloadOptions}`);
  } else {
    console.log('❌ X-Download-Options: MISSING or incorrect');
  }
  
  // X-XSS-Protection
  const xssProtection = headers['x-xss-protection'];
  if (xssProtection) {
    console.log(`✅ X-XSS-Protection: ${xssProtection}`);
  } else {
    console.log('❌ X-XSS-Protection: MISSING');
  }
  
  // Referrer-Policy
  const referrerPolicy = headers['referrer-policy'];
  if (referrerPolicy) {
    console.log(`✅ Referrer-Policy: ${referrerPolicy}`);
  } else {
    console.log('❌ Referrer-Policy: MISSING');
  }
  
  // Permissions-Policy
  const permissionsPolicy = headers['permissions-policy'];
  if (permissionsPolicy) {
    console.log(`✅ Permissions-Policy: ${permissionsPolicy}`);
  } else {
    console.log('❌ Permissions-Policy: MISSING');
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Summary:\n');
  
  const requiredHeaders = [
    csp,
    xFrameOptions,
    xContentType === 'nosniff',
    dnsPrefetch === 'off',
    downloadOptions === 'noopen',
    xssProtection,
    referrerPolicy,
    permissionsPolicy
  ].filter(Boolean).length;
  
  const totalRequired = 8;
  const hstsOptional = hsts ? 1 : 0;
  
  console.log(`   Required headers present: ${requiredHeaders}/${totalRequired}`);
  console.log(`   Optional headers present: ${hstsOptional}/1 (HSTS - production only)`);
  
  if (requiredHeaders === totalRequired) {
    console.log('\n   ✅ All required security headers are configured correctly!\n');
  } else {
    console.log('\n   ⚠️  Some security headers are missing. Check configuration.\n');
  }
  
  // Full header dump (optional)
  if (process.argv.includes('--verbose')) {
    console.log('\n' + '='.repeat(60));
    console.log('\n📝 All Response Headers:\n');
    Object.entries(headers).forEach(([key, value]) => {
      console.log(`   ${key}: ${value}`);
    });
    console.log();
  }
  
}).on('error', (err) => {
  console.error('\n❌ Error testing headers:', err.message);
  console.error('\nTips:');
  console.error('  - Make sure your dev server is running: npm run dev');
  console.error('  - Check the URL is correct');
  console.error('  - For HTTPS, ensure certificates are valid\n');
  process.exit(1);
});

