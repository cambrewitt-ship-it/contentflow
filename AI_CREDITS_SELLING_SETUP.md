# AI Credits Selling System - Setup Guide

## Overview

The AI credit selling system has been implemented and allows users to purchase additional AI credits through one-time payments via Stripe. When users run low on credits, they can click the credit badge in the topbar to open a purchase dialog.

## What's Been Implemented

### 1. Credit Context Fix ✅
- **Fixed**: `CreditsContext` now correctly fetches from the `subscriptions` table instead of a non-existent `users` table
- **Fixed**: Calculates remaining credits as `max_ai_credits_per_month - ai_credits_used_this_month`
- **Fixed**: Topbar now shows correct credits (e.g., 8 credits for 2/10 used)

### 2. Credit Packages ✅
- **File**: `src/lib/creditPackages.ts`
- Defines three credit packages:
  - **Small Pack**: 50 credits for $9.99
  - **Medium Pack**: 150 credits for $24.99 (popular)
  - **Large Pack**: 500 credits for $74.99

### 3. Credit Purchase API ✅
- **File**: `src/app/api/stripe/credits/checkout/route.ts`
- Creates Stripe checkout session for one-time credit purchases
- Requires user to have an active subscription
- Redirects to Stripe Checkout for payment

### 4. Webhook Handler ✅
- **File**: `src/app/api/stripe/webhook/route.ts` (updated)
- Handles `checkout.session.completed` events for credit purchases
- Adds purchased credits to user's `max_ai_credits_per_month`
- Credits never expire (they increase the monthly limit)

### 5. Purchase Dialog UI ✅
- **File**: `src/components/BuyCreditsDialog.tsx`
- Beautiful modal showing all available credit packages
- Displays price per credit for comparison
- Highlights popular package
- Handles loading states and errors

### 6. Credit Badge Integration ✅
- **File**: `src/components/CreditBadge.tsx` (updated)
- Credit badge is now clickable
- Opens purchase dialog when clicked
- Shows unlimited credits (∞) for unlimited subscriptions

### 7. Subscription Helper ✅
- **File**: `src/lib/subscriptionHelpers.ts` (updated)
- Added `addPurchasedCredits()` function
- Increases `max_ai_credits_per_month` when credits are purchased
- Handles unlimited subscriptions correctly

## Required Stripe Setup

### Step 1: Create Stripe Products

In your Stripe Dashboard, create three one-time payment products:

1. **Small Credit Pack**
   - Name: "Small AI Credit Pack"
   - Price: $9.99 (one-time)
   - Description: "50 AI Credits"

2. **Medium Credit Pack**
   - Name: "Medium AI Credit Pack"
   - Price: $24.99 (one-time)
   - Description: "150 AI Credits"

3. **Large Credit Pack**
   - Name: "Large AI Credit Pack"
   - Price: $74.99 (one-time)
   - Description: "500 AI Credits"

### Step 2: Get Price IDs

For each product created above, copy the **Price ID** (starts with `price_`).

### Step 3: Add Environment Variables

Add these to your `.env.local` file:

```bash
# AI Credit Package Price IDs (from Stripe Dashboard)
NEXT_PUBLIC_STRIPE_CREDITS_50_PRICE_ID=price_xxxxx
NEXT_PUBLIC_STRIPE_CREDITS_150_PRICE_ID=price_xxxxx
NEXT_PUBLIC_STRIPE_CREDITS_500_PRICE_ID=price_xxxxx
```

### Step 4: Update Credit Packages

Update `src/lib/creditPackages.ts` if your price IDs don't match the environment variable names:

```typescript
export const CREDIT_PACKAGES: CreditPackage[] = [
  {
    id: 'small',
    name: 'Small Pack',
    credits: 50,
    price: 999,
    priceId: process.env.NEXT_PUBLIC_STRIPE_CREDITS_50_PRICE_ID || '',
    // ...
  },
  // ...
];
```

## How It Works

1. **User clicks credit badge** in topbar
2. **Purchase dialog opens** showing available packages
3. **User selects a package** and clicks "Buy Now"
4. **Redirects to Stripe Checkout** for secure payment
5. **After successful payment**, Stripe sends webhook event
6. **Webhook handler** adds credits to user's `max_ai_credits_per_month`
7. **User is redirected back** to billing page with success message
8. **Credits are immediately available** (no expiration)

## Testing

1. Log in as a user with a subscription
2. Click the credit badge in the topbar
3. Select a credit package and complete checkout
4. Verify credits are added to your subscription
5. Check that the credit badge updates correctly

## Notes

- Credits increase the **monthly limit**, not the remaining credits
- Purchased credits **never expire** (they add to the base limit)
- Users must have an **active subscription** to purchase credits
- Webhook must be configured in Stripe Dashboard to point to your webhook endpoint

## Future Enhancements

- [ ] Add credit usage history/analytics
- [ ] Send email notification when credits are added
- [ ] Add gift credit functionality
- [ ] Show credit purchase history in billing page
- [ ] Add promo codes/discounts for credit packages

