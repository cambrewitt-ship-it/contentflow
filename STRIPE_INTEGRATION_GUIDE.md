# Stripe Subscription Integration Guide

This guide explains how to set up and use the Stripe subscription system in your Next.js app.

## Table of Contents

1. [Overview](#overview)
2. [Installation](#installation)
3. [Environment Variables](#environment-variables)
4. [Database Setup](#database-setup)
5. [Stripe Dashboard Setup](#stripe-dashboard-setup)
6. [Testing the Integration](#testing-the-integration)
7. [Subscription Tiers](#subscription-tiers)
8. [API Routes](#api-routes)
9. [Usage Examples](#usage-examples)
10. [Troubleshooting](#troubleshooting)

## Overview

This integration provides:
- **3 Subscription Tiers**: In-House ($35/mo), Freelancer ($79/mo), Agency ($199/mo)
- **Usage Tracking**: Track clients, posts, and AI credits
- **Subscription Management**: Users can upgrade, downgrade, and cancel
- **Webhook Handling**: Automatic subscription updates via Stripe webhooks
- **Middleware Protection**: API routes check subscription limits automatically

## Installation

The necessary packages have already been installed:

```bash
npm install stripe @stripe/stripe-js
```

## Environment Variables

Add these variables to your `.env.local` file:

```bash
# Stripe Secret Key (from Stripe Dashboard > Developers > API keys)
STRIPE_SECRET_KEY=sk_test_...

# Stripe Webhook Secret (from Stripe Dashboard > Developers > Webhooks)
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Price IDs (from Stripe Dashboard > Products)
NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID=price_...
NEXT_PUBLIC_STRIPE_PROFESSIONAL_PRICE_ID=price_...
NEXT_PUBLIC_STRIPE_AGENCY_PRICE_ID=price_...

# Base URL for redirects
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Supabase Service Role Key (for admin operations)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Database Setup

Run the database migration to create the necessary tables:

```sql
-- Run this SQL in your Supabase SQL Editor
-- File: create-subscriptions-table.sql
```

The migration creates:
- `subscriptions` table: Stores user subscription data
- `billing_history` table: Stores invoice records
- Indexes for performance
- RLS policies for security
- Triggers for automatic updates

### To run the migration:

1. Open your Supabase Dashboard
2. Go to SQL Editor
3. Copy the contents of `create-subscriptions-table.sql`
4. Execute the SQL

## Stripe Dashboard Setup

### Step 1: Create Products and Prices

1. Log into your [Stripe Dashboard](https://dashboard.stripe.com)
2. Go to **Products** > **Add Product**
3. Create three products:

#### In-House Plan
- **Name**: In-House
- **Description**: Perfect for individuals managing a single brand internally
- **Price**: $35/month recurring
- **Copy the Price ID** and add to `.env.local` as `NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID`

#### Freelancer Plan
- **Name**: Freelancer
- **Description**: For growing freelancers and boutique agencies
- **Price**: $79/month recurring
- **Copy the Price ID** and add to `.env.local` as `NEXT_PUBLIC_STRIPE_PROFESSIONAL_PRICE_ID`

#### Agency Plan
- **Name**: Agency
- **Description**: For established agencies with multiple clients
- **Price**: $199/month recurring
- **Copy the Price ID** and add to `.env.local` as `NEXT_PUBLIC_STRIPE_AGENCY_PRICE_ID`

### Step 2: Set Up Webhook

1. Go to **Developers** > **Webhooks**
2. Click **Add endpoint**
3. Enter your endpoint URL:
   - Local development: Use [Stripe CLI](#using-stripe-cli-for-local-development)
   - Production: `https://yourdomain.com/api/stripe/webhook`
4. Select these events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
5. Copy the **Signing secret** and add to `.env.local` as `STRIPE_WEBHOOK_SECRET`

### Step 3: Enable Customer Portal (Optional but Recommended)

1. Go to **Settings** > **Billing** > **Customer portal**
2. Enable the portal
3. Configure what customers can do:
   - ✅ Update payment method
   - ✅ Cancel subscription
   - ✅ Update subscription (upgrade/downgrade)
   - ✅ View invoice history

## Using Stripe CLI for Local Development

For local webhook testing, use the Stripe CLI:

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe  # macOS
# or download from https://stripe.com/docs/stripe-cli

# Login to your Stripe account
stripe login

# Forward webhooks to your local server
stripe listen --forward-to localhost:3000/api/stripe/webhook

# This will display a webhook signing secret
# Copy it and add to .env.local as STRIPE_WEBHOOK_SECRET
```

## Testing the Integration

### 1. Test the Pricing Page

Visit `http://localhost:3000/pricing` to see the pricing tiers.

### 2. Test Checkout Flow

1. Click "Subscribe" on any tier
2. Use Stripe test card: `4242 4242 4242 4242`
3. Use any future expiry date and any CVC
4. Complete the checkout
5. You should be redirected to `/dashboard/subscription?success=true`

### 3. Test Subscription Management

1. Visit `/dashboard/subscription`
2. You should see your active subscription
3. Click "Manage Billing" to test the Customer Portal
4. Try updating payment method, viewing invoices, etc.

### 4. Test Subscription Limits

Try these scenarios:

**Test Client Limits (In-House Plan = 1 client)**
```bash
# Create a client via API
curl -X POST http://localhost:3000/api/clients/create \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Client",
    "company_description": "Test company"
  }'

# Try to create a second client (should fail with 403)
```

**Test AI Credit Limits**
```bash
# Make AI requests until limit is reached
# Should return 403 when limit exceeded
```

**Test Post Limits**
```bash
# Create posts via API
# Should return 403 when monthly limit exceeded
```

## Subscription Tiers

### In-House - $35/month
- 1 Client Account
- 30 Posts per month
- 100 AI Credits per month
- Basic Analytics
- Email Support

### Freelancer - $79/month
- 5 Client Accounts
- 150 Posts per month
- 500 AI Credits per month
- Advanced Analytics
- Priority Email Support
- Custom Branding

### Agency - $199/month
- Unlimited Client Accounts
- Unlimited Posts per month
- 2000 AI Credits per month
- Advanced Analytics
- White-Label Options
- Priority Phone & Email Support
- Dedicated Account Manager

## API Routes

### Checkout

**POST** `/api/stripe/checkout`

Create a Stripe Checkout session.

```typescript
const response = await fetch('/api/stripe/checkout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    priceId: 'price_...'
  })
});

const { url } = await response.json();
window.location.href = url; // Redirect to Stripe Checkout
```

### Customer Portal

**POST** `/api/stripe/portal`

Open the Stripe Customer Portal for subscription management.

```typescript
const response = await fetch('/api/stripe/portal', {
  method: 'POST'
});

const { url } = await response.json();
window.location.href = url; // Redirect to Customer Portal
```

### Get Subscription

**GET** `/api/stripe/subscription`

Get user's current subscription and billing history.

```typescript
const response = await fetch('/api/stripe/subscription');
const { subscription, billingHistory } = await response.json();
```

### Webhook Handler

**POST** `/api/stripe/webhook`

Handles Stripe webhook events (called by Stripe, not by your app).

## Usage Examples

### Check Subscription Limits in Your Code

```typescript
import { checkSubscriptionLimit } from '@/lib/subscriptionHelpers';

// Check if user can add a client
const { allowed, current, max } = await checkSubscriptionLimit(
  userId,
  'clients'
);

if (!allowed) {
  // Show upgrade prompt
  console.log(`Client limit reached: ${current}/${max}`);
}
```

### Protect API Routes with Middleware

```typescript
import { withClientLimitCheck } from '@/lib/subscriptionMiddleware';

export async function POST(req: NextRequest) {
  // Check subscription limits
  const subscriptionCheck = await withClientLimitCheck(req);
  if (!subscriptionCheck.authorized) {
    return subscriptionCheck as NextResponse;
  }

  const userId = subscriptionCheck.user!.id;

  // Your API logic here...
}
```

### Track Usage

```typescript
import { trackClientCreation, trackPostCreation, trackAICreditUsage } from '@/lib/subscriptionMiddleware';

// After creating a client
await trackClientCreation(userId);

// After creating a post
await trackPostCreation(userId);

// After using AI
await trackAICreditUsage(userId, 1);
```

### Display Subscription Info in UI

```typescript
'use client';

import { useEffect, useState } from 'react';

export function SubscriptionWidget() {
  const [subscription, setSubscription] = useState(null);

  useEffect(() => {
    fetch('/api/stripe/subscription')
      .then(res => res.json())
      .then(data => setSubscription(data.subscription));
  }, []);

  if (!subscription) return <div>Loading...</div>;

  return (
    <div>
      <h3>{subscription.subscription_tier} Plan</h3>
      <p>Status: {subscription.subscription_status}</p>
      <p>Clients: {subscription.clients_used} / {subscription.max_clients}</p>
      <p>Posts: {subscription.posts_used_this_month} / {subscription.max_posts_per_month}</p>
      <p>AI Credits: {subscription.ai_credits_used_this_month} / {subscription.max_ai_credits_per_month}</p>
    </div>
  );
}
```

## Troubleshooting

### Webhook Not Working

1. **Check webhook secret**: Make sure `STRIPE_WEBHOOK_SECRET` is correct
2. **Verify endpoint**: Ensure webhook endpoint is publicly accessible (use ngrok for local testing)
3. **Check Stripe logs**: Go to Stripe Dashboard > Developers > Webhooks > Click on your webhook > View logs
4. **Test webhook**: Use Stripe CLI to test: `stripe trigger checkout.session.completed`

### Checkout Not Creating Subscription

1. **Check Price IDs**: Ensure price IDs in `.env.local` match your Stripe dashboard
2. **Verify user exists**: User must be authenticated
3. **Check database**: Verify `subscriptions` table exists and has proper RLS policies

### Subscription Limits Not Working

1. **Check middleware**: Ensure API routes are using subscription middleware
2. **Verify tracking**: Make sure usage tracking functions are called after successful operations
3. **Database state**: Check subscription record in database to verify limits and usage counters

### Customer Portal Not Opening

1. **Enable portal**: Make sure Customer Portal is enabled in Stripe Dashboard
2. **Check customer ID**: Verify user has a valid `stripe_customer_id` in database
3. **Return URL**: Ensure return URL is whitelisted in Stripe portal settings

### Common Error Messages

**"No active subscription found"**
- User hasn't subscribed yet
- Subscription was canceled
- Webhook hasn't processed yet (wait a few seconds)

**"You have reached your client limit"**
- User is on In-House plan and trying to add 2nd client
- Upgrade to Freelancer or Agency plan

**"Insufficient AI credits"**
- Monthly AI credit limit reached
- Wait for next billing cycle or upgrade plan

## Production Checklist

Before deploying to production:

- [ ] Replace test Stripe keys with live keys
- [ ] Update webhook endpoint to production URL
- [ ] Test live checkout flow end-to-end
- [ ] Verify webhook events are received
- [ ] Test subscription management in Customer Portal
- [ ] Verify RLS policies in production database
- [ ] Set up monitoring for failed webhook events
- [ ] Add error logging for subscription operations
- [ ] Test all subscription tier limits
- [ ] Document subscription policies for users
- [ ] Set up email notifications for payment failures
- [ ] Test subscription upgrade/downgrade flows
- [ ] Verify proration settings in Stripe Dashboard

## Support

For issues with:
- **Stripe Integration**: Check [Stripe Documentation](https://stripe.com/docs)
- **Webhook Events**: Use Stripe Dashboard webhook logs
- **Subscription Logic**: Review `/src/lib/subscriptionHelpers.ts`
- **API Routes**: Check `/src/app/api/stripe/` directory

## Additional Resources

- [Stripe API Reference](https://stripe.com/docs/api)
- [Stripe Checkout Documentation](https://stripe.com/docs/payments/checkout)
- [Stripe Customer Portal](https://stripe.com/docs/billing/subscriptions/integrating-customer-portal)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Stripe Testing](https://stripe.com/docs/testing)

