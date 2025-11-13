#!/usr/bin/env node

/**
 * Test script to verify Stripe Customer Portal configuration
 * 
 * Run with: node scripts/test-stripe-portal.js
 */

require('dotenv').config({ path: '.env.local' });
const Stripe = require('stripe');

const REQUIRED_ENV_VARS = [
  'STRIPE_SECRET_KEY',
  'NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID',
  'NEXT_PUBLIC_STRIPE_PROFESSIONAL_PRICE_ID',
  'NEXT_PUBLIC_STRIPE_AGENCY_PRICE_ID',
];

console.log('🔍 Stripe Customer Portal Configuration Test\n');
console.log('='.repeat(50));

// Check environment variables
console.log('\n📋 Checking Environment Variables...');
let allEnvVarsPresent = true;
REQUIRED_ENV_VARS.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`✅ ${varName}: ${value.substring(0, 20)}...`);
  } else {
    console.log(`❌ ${varName}: MISSING`);
    allEnvVarsPresent = false;
  }
});

if (!allEnvVarsPresent) {
  console.log('\n❌ Some environment variables are missing. Please check your .env.local file.');
  process.exit(1);
}

// Initialize Stripe
const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = new Stripe(stripeKey, {
  apiVersion: '2025-09-30.clover',
});

// Determine if using test or live mode
const isTestMode = stripeKey.startsWith('sk_test_');
console.log(`\n🔑 Mode: ${isTestMode ? '🧪 TEST MODE' : '🚀 LIVE MODE'}`);

async function testStripeConnection() {
  console.log('\n🔌 Testing Stripe API Connection...');
  try {
    const balance = await stripe.balance.retrieve();
    console.log('✅ Successfully connected to Stripe API');
    console.log(`   Available balance: ${balance.available.map(b => 
      `${(b.amount / 100).toFixed(2)} ${b.currency.toUpperCase()}`
    ).join(', ')}`);
    return true;
  } catch (error) {
    console.log('❌ Failed to connect to Stripe API');
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

async function checkCustomerPortalConfiguration() {
  console.log('\n🏢 Checking Customer Portal Configuration...');
  try {
    // Try to retrieve portal configuration
    const configurations = await stripe.billingPortal.configurations.list({ limit: 1 });
    
    if (configurations.data.length === 0) {
      console.log('⚠️  No customer portal configuration found');
      console.log('   Please activate the customer portal in Stripe Dashboard:');
      console.log('   Settings → Billing → Customer Portal → Activate');
      return false;
    }

    const config = configurations.data[0];
    console.log('✅ Customer portal is configured');
    console.log(`   Configuration ID: ${config.id}`);
    console.log(`   Business name: ${config.business_profile?.headline || 'Not set'}`);
    
    // Check features
    console.log('\n   Enabled features:');
    if (config.features?.customer_update?.enabled) {
      console.log('   ✅ Customer can update their information');
    }
    if (config.features?.invoice_history?.enabled) {
      console.log('   ✅ Invoice history is visible');
    }
    if (config.features?.payment_method_update?.enabled) {
      console.log('   ✅ Payment method update is enabled');
    }
    if (config.features?.subscription_cancel?.enabled) {
      console.log('   ✅ Subscription cancellation is enabled');
    }
    if (config.features?.subscription_update?.enabled) {
      console.log('   ✅ Subscription update is enabled');
    }
    
    return true;
  } catch (error) {
    console.log('❌ Failed to check portal configuration');
    console.log(`   Error: ${error.message}`);
    
    if (error.code === 'resource_missing') {
      console.log('\n   The customer portal is not activated.');
      console.log('   To activate it:');
      console.log('   1. Go to https://dashboard.stripe.com/settings/billing/portal');
      console.log('   2. Click "Activate test link" (for test mode) or "Activate" (for live mode)');
      console.log('   3. Configure your portal settings');
    }
    
    return false;
  }
}

async function testPortalSessionCreation() {
  console.log('\n🧪 Testing Portal Session Creation...');
  try {
    // First, try to get or create a test customer
    let customer;
    const customers = await stripe.customers.list({ limit: 1 });
    
    if (customers.data.length === 0) {
      console.log('   Creating test customer...');
      customer = await stripe.customers.create({
        email: 'test@example.com',
        description: 'Test customer for portal session',
      });
      console.log(`   ✅ Created test customer: ${customer.id}`);
    } else {
      customer = customers.data[0];
      console.log(`   Using existing customer: ${customer.id}`);
    }

    // Try to create a portal session
    const returnUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const session = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: `${returnUrl}/settings/billing`,
    });

    console.log('✅ Successfully created portal session');
    console.log(`   Session ID: ${session.id}`);
    console.log(`   Portal URL: ${session.url}`);
    console.log(`   Return URL: ${session.return_url}`);
    
    return true;
  } catch (error) {
    console.log('❌ Failed to create portal session');
    console.log(`   Error: ${error.message}`);
    
    if (error.code === 'customer_portal_not_enabled') {
      console.log('\n   ⚠️  The customer portal is not enabled.');
      console.log('   Please activate it in your Stripe Dashboard:');
      console.log('   https://dashboard.stripe.com/settings/billing/portal');
    }
    
    return false;
  }
}

async function checkPrices() {
  console.log('\n💰 Checking Price IDs...');
  const priceIds = [
    { name: 'In-House', id: process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID },
    { name: 'Freelancer', id: process.env.NEXT_PUBLIC_STRIPE_PROFESSIONAL_PRICE_ID },
    { name: 'Agency', id: process.env.NEXT_PUBLIC_STRIPE_AGENCY_PRICE_ID },
  ];

  let allPricesValid = true;
  for (const price of priceIds) {
    try {
      const priceData = await stripe.prices.retrieve(price.id);
      console.log(`✅ ${price.name}: $${(priceData.unit_amount / 100).toFixed(2)}/${priceData.recurring.interval}`);
    } catch (error) {
      console.log(`❌ ${price.name}: Invalid price ID (${price.id})`);
      allPricesValid = false;
    }
  }
  
  return allPricesValid;
}

async function runTests() {
  console.log('\nStarting tests...\n');
  
  const apiConnected = await testStripeConnection();
  if (!apiConnected) {
    console.log('\n❌ Cannot proceed without Stripe API connection');
    return;
  }

  await checkPrices();
  const portalConfigured = await checkCustomerPortalConfiguration();
  
  if (portalConfigured) {
    await testPortalSessionCreation();
  }

  console.log('\n' + '='.repeat(50));
  console.log('\n📊 Summary\n');
  
  if (apiConnected && portalConfigured) {
    console.log('✅ All checks passed! Your Stripe Customer Portal is ready.');
    console.log('\nNext steps:');
    console.log('1. Start your Next.js app: npm run dev');
    console.log('2. Go to /settings/billing');
    console.log('3. Click "Manage Billing" button');
    console.log('4. You should be redirected to Stripe Customer Portal');
  } else {
    console.log('⚠️  Some issues were found. Please review the errors above.');
    console.log('\nQuick fixes:');
    console.log('- Activate Customer Portal: https://dashboard.stripe.com/settings/billing/portal');
    console.log('- Check your .env.local file for correct API keys');
    console.log('- Verify price IDs match your Stripe products');
  }
  
  console.log('\n');
}

// Run the tests
runTests().catch(error => {
  console.error('\n❌ Unexpected error:', error);
  process.exit(1);
});

