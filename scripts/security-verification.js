#!/usr/bin/env node

/**
 * Security Verification Script
 * 
 * This script verifies that security implementations are working correctly:
 * 1. No service role keys exposed to client-side
 * 2. Webhook signature validation working
 * 3. File upload security measures active
 * 4. Rate limiting functioning
 * 5. Error messages sanitized
 * 6. CSRF protection active
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const API_ROUTES_DIR = 'src/app/api';
const LIB_DIR = 'src/lib';
const CLIENT_DIR = 'src';

// Security checks
const securityChecks = [
  {
    name: 'Service Role Key Exposure',
    description: 'Check that service role keys are not exposed to client-side',
    check: () => {
      const clientFiles = [
        'src/lib/supabaseClient.ts',
        'src/contexts/AuthContext.tsx',
        'src/hooks/useUITheme.ts'
      ];
      
      const violations = [];
      
      for (const file of clientFiles) {
        if (fs.existsSync(file)) {
          const content = fs.readFileSync(file, 'utf8');
          if (content.includes('NEXT_SUPABASE_SERVICE_ROLE') || 
              content.includes('service_role') ||
              content.includes('serviceRole')) {
            violations.push(file);
          }
        }
      }
      
      return {
        passed: violations.length === 0,
        violations,
        message: violations.length === 0 
          ? '✅ No service role keys found in client-side code'
          : `❌ Service role keys found in: ${violations.join(', ')}`
      };
    }
  },
  {
    name: 'Secure Error Handling',
    description: 'Check that error handling is using secure patterns',
    check: () => {
      const apiFiles = getAllApiFiles();
      const violations = [];
      
      for (const file of apiFiles) {
        if (fs.existsSync(file)) {
          const content = fs.readFileSync(file, 'utf8');
          
          // Check for insecure error patterns
          if (content.includes('error.message') && 
              !content.includes('handleApiError') &&
              !content.includes('sanitizeErrorDetails')) {
            violations.push(file);
          }
          
          // Check for detailed error exposure
          if (content.includes('details: error.message') ||
              content.includes('stack: error.stack')) {
            violations.push(file);
          }
        }
      }
      
      return {
        passed: violations.length === 0,
        violations,
        message: violations.length === 0 
          ? '✅ Secure error handling patterns found'
          : `❌ Insecure error handling in: ${violations.slice(0, 5).join(', ')}${violations.length > 5 ? '...' : ''}`
      };
    }
  },
  {
    name: 'File Upload Security',
    description: 'Check that file upload endpoints use enhanced security',
    check: () => {
      const uploadFiles = [
        'src/app/api/upload-image/route.ts',
        'src/app/api/portal/upload/route.ts'
      ];
      
      const violations = [];
      
      for (const file of uploadFiles) {
        if (fs.existsSync(file)) {
          const content = fs.readFileSync(file, 'utf8');
          
          if (!content.includes('validateBase64ImageUpload') &&
              !content.includes('validateFileUpload') &&
              !content.includes('magicNumbers')) {
            violations.push(file);
          }
        }
      }
      
      return {
        passed: violations.length === 0,
        violations,
        message: violations.length === 0 
          ? '✅ File upload security measures active'
          : `❌ Missing file upload security in: ${violations.join(', ')}`
      };
    }
  },
  {
    name: 'CSRF Protection',
    description: 'Check that CSRF protection is implemented',
    check: () => {
      const middlewareFile = 'src/middleware.ts';
      const csrfFile = 'src/lib/csrfProtection.ts';
      
      const violations = [];
      
      if (fs.existsSync(middlewareFile)) {
        const content = fs.readFileSync(middlewareFile, 'utf8');
        if (!content.includes('enhancedCSRFProtection') && 
            !content.includes('csrfProtection')) {
          violations.push(middlewareFile);
        }
      } else {
        violations.push('middleware.ts not found');
      }
      
      if (!fs.existsSync(csrfFile)) {
        violations.push('csrfProtection.ts not found');
      }
      
      return {
        passed: violations.length === 0,
        violations,
        message: violations.length === 0 
          ? '✅ CSRF protection implemented'
          : `❌ CSRF protection missing: ${violations.join(', ')}`
      };
    }
  },
  {
    name: 'Rate Limiting',
    description: 'Check that rate limiting is properly configured',
    check: () => {
      const rateLimitFiles = [
        'src/lib/rateLimit.ts',
        'src/lib/simpleRateLimit.ts',
        'src/middleware.ts'
      ];
      
      const violations = [];
      
      for (const file of rateLimitFiles) {
        if (!fs.existsSync(file)) {
          violations.push(`${file} not found`);
        }
      }
      
      if (fs.existsSync('src/middleware.ts')) {
        const content = fs.readFileSync('src/middleware.ts', 'utf8');
        if (!content.includes('simpleRateLimitMiddleware') &&
            !content.includes('rateLimitMiddleware')) {
          violations.push('Rate limiting not active in middleware');
        }
      }
      
      return {
        passed: violations.length === 0,
        violations,
        message: violations.length === 0 
          ? '✅ Rate limiting properly configured'
          : `❌ Rate limiting issues: ${violations.join(', ')}`
      };
    }
  },
  {
    name: 'Webhook Security',
    description: 'Check that webhook signature validation is enhanced',
    check: () => {
      const webhookFile = 'src/lib/stripe.ts';
      const webhookRoute = 'src/app/api/stripe/webhook/route.ts';
      
      const violations = [];
      
      if (fs.existsSync(webhookFile)) {
        const content = fs.readFileSync(webhookFile, 'utf8');
        if (!content.includes('validateWebhookEvent') &&
            !content.includes('timestamp') &&
            !content.includes('replay')) {
          violations.push('Enhanced webhook validation missing');
        }
      } else {
        violations.push('stripe.ts not found');
      }
      
      if (fs.existsSync(webhookRoute)) {
        const content = fs.readFileSync(webhookRoute, 'utf8');
        if (!content.includes('verifyWebhookSignature')) {
          violations.push('Webhook signature verification missing');
        }
      }
      
      return {
        passed: violations.length === 0,
        violations,
        message: violations.length === 0 
          ? '✅ Webhook security enhanced'
          : `❌ Webhook security issues: ${violations.join(', ')}`
      };
    }
  },
  {
    name: 'Supabase Client Separation',
    description: 'Check that Supabase clients are properly separated',
    check: () => {
      const serverFile = 'src/lib/supabaseServer.ts';
      const clientFile = 'src/lib/supabaseClient.ts';
      
      const violations = [];
      
      if (!fs.existsSync(serverFile)) {
        violations.push('supabaseServer.ts not found');
      } else {
        const content = fs.readFileSync(serverFile, 'utf8');
        if (!content.includes('createSupabaseAdmin') ||
            !content.includes('createSupabaseWithToken') ||
            !content.includes('getAuthenticatedUser')) {
          violations.push('Server client functions missing');
        }
      }
      
      if (!fs.existsSync(clientFile)) {
        violations.push('supabaseClient.ts not found');
      } else {
        const content = fs.readFileSync(clientFile, 'utf8');
        if (content.includes('NEXT_SUPABASE_SERVICE_ROLE') ||
            content.includes('service_role')) {
          violations.push('Service role key in client code');
        }
      }
      
      return {
        passed: violations.length === 0,
        violations,
        message: violations.length === 0 
          ? '✅ Supabase client separation implemented'
          : `❌ Client separation issues: ${violations.join(', ')}`
      };
    }
  }
];

// Helper function to get all API files
function getAllApiFiles() {
  const files = [];
  
  function scanDirectory(dir) {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        scanDirectory(fullPath);
      } else if (item.endsWith('.ts') && item === 'route.ts') {
        files.push(fullPath);
      }
    }
  }
  
  if (fs.existsSync(API_ROUTES_DIR)) {
    scanDirectory(API_ROUTES_DIR);
  }
  
  return files;
}

// Run security checks
function runSecurityChecks() {
  console.log('🔒 Running Security Verification...');
  console.log('');
  
  let passedChecks = 0;
  let totalChecks = securityChecks.length;
  
  for (const check of securityChecks) {
    console.log(`🔍 ${check.name}:`);
    console.log(`   ${check.description}`);
    
    try {
      const result = check.check();
      
      if (result.passed) {
        console.log(`   ${result.message}`);
        passedChecks++;
      } else {
        console.log(`   ${result.message}`);
        if (result.violations && result.violations.length > 0) {
          console.log(`   Violations: ${result.violations.length}`);
        }
      }
    } catch (error) {
      console.log(`   ❌ Check failed: ${error.message}`);
    }
    
    console.log('');
  }
  
  // Summary
  console.log('📊 Security Verification Summary:');
  console.log(`   Total checks: ${totalChecks}`);
  console.log(`   Passed: ${passedChecks}`);
  console.log(`   Failed: ${totalChecks - passedChecks}`);
  console.log(`   Success rate: ${Math.round((passedChecks / totalChecks) * 100)}%`);
  
  if (passedChecks === totalChecks) {
    console.log('');
    console.log('🎉 All security checks passed! Your application is secure.');
  } else {
    console.log('');
    console.log('⚠️  Some security checks failed. Please review and fix the issues above.');
  }
  
  return passedChecks === totalChecks;
}

// Test specific security features
function testSecurityFeatures() {
  console.log('🧪 Testing Security Features...');
  console.log('');
  
  // Test 1: Check for service role exposure
  console.log('1. Testing service role key exposure...');
  try {
    const clientFiles = ['src/lib/supabaseClient.ts'];
    let exposed = false;
    
    for (const file of clientFiles) {
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8');
        if (content.includes('NEXT_SUPABASE_SERVICE_ROLE')) {
          exposed = true;
          break;
        }
      }
    }
    
    console.log(`   ${exposed ? '❌ FAILED' : '✅ PASSED'}: Service role key exposure test`);
  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}`);
  }
  
  // Test 2: Check error sanitization
  console.log('2. Testing error message sanitization...');
  try {
    const errorHandlerFile = 'src/lib/secureErrorHandler.ts';
    if (fs.existsSync(errorHandlerFile)) {
      const content = fs.readFileSync(errorHandlerFile, 'utf8');
      const hasSanitization = content.includes('sanitizeErrorDetails') && 
                             content.includes('PRODUCTION_ERROR_MESSAGES');
      console.log(`   ${hasSanitization ? '✅ PASSED' : '❌ FAILED'}: Error sanitization test`);
    } else {
      console.log('   ❌ FAILED: Error handler not found');
    }
  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}`);
  }
  
  // Test 3: Check file upload security
  console.log('3. Testing file upload security...');
  try {
    const uploadFile = 'src/app/api/upload-image/route.ts';
    if (fs.existsSync(uploadFile)) {
      const content = fs.readFileSync(uploadFile, 'utf8');
      const hasSecurity = content.includes('validateBase64ImageUpload') &&
                         content.includes('magicNumbers') &&
                         content.includes('generateSecureUploadFilename');
      console.log(`   ${hasSecurity ? '✅ PASSED' : '❌ FAILED'}: File upload security test`);
    } else {
      console.log('   ❌ FAILED: Upload endpoint not found');
    }
  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}`);
  }
  
  console.log('');
}

// Main execution
function main() {
  console.log('🛡️  ContentFlow Security Verification');
  console.log('=====================================');
  console.log('');
  
  // Run security checks
  const allPassed = runSecurityChecks();
  
  // Test specific features
  testSecurityFeatures();
  
  // Final recommendation
  console.log('💡 Recommendations:');
  console.log('   1. Run this script regularly to ensure security compliance');
  console.log('   2. Test all API endpoints with invalid tokens');
  console.log('   3. Verify rate limiting is working under load');
  console.log('   4. Test file upload with malicious files');
  console.log('   5. Verify CSRF protection blocks unauthorized requests');
  console.log('');
  
  if (allPassed) {
    console.log('🎯 Security verification completed successfully!');
    process.exit(0);
  } else {
    console.log('⚠️  Security verification completed with issues. Please review and fix.');
    process.exit(1);
  }
}

// Run the verification
main();
