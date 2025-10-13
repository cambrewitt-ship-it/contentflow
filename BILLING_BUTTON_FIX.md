# Billing Button Fix - Quick Start

## Problem
The "Manage Billing" button in `/settings/billing` doesn't open the Stripe Customer Portal.

## Solution Summary
The button is now fixed with improved error handling and logging. The most common cause is that **the Stripe Customer Portal needs to be activated** in your Stripe Dashboard.

---

## Quick Fix Steps

### 1. Activate Stripe Customer Portal (Most Common Issue)

**Option A: Via Stripe Dashboard**
1. Go to https://dashboard.stripe.com/
2. Navigate to **Settings** → **Billing** → **Customer portal**
3. Click the **"Activate test link"** button (or "Activate" for live mode)
4. Configure the portal settings:
   - Add business name
   - Enable features you want (invoice history, payment method update, etc.)
   - Save settings

**Option B: Quick activation link**
- Test mode: https://dashboard.stripe.com/test/settings/billing/portal
- Live mode: https://dashboard.stripe.com/settings/billing/portal

### 2. Verify Your Setup

Run the test script:
```bash
node scripts/test-stripe-portal.js
```

This will check:
- ✅ Environment variables are set
- ✅ Stripe API connection works
- ✅ Customer portal is configured
- ✅ Portal session can be created
- ✅ Price IDs are valid

### 3. Test the Button

1. Start your development server: `npm run dev`
2. Navigate to `/settings/billing`
3. Click **"Manage Billing"**
4. You should be redirected to Stripe's Customer Portal

### 4. Check Browser Console for Errors

If it still doesn't work, open the browser console (F12) and look for logs:
- `[Billing] Requesting portal session...` - Button was clicked
- `[Billing] Portal response:` - Shows the API response
- `[Billing] Redirecting to portal:` - Shows the Stripe URL

Check the server logs for:
- `[Portal] User authenticated:` - User ID
- `[Portal] Creating portal session for customer:` - Stripe customer ID
- `[Portal] Portal session created successfully:` - Session ID

---

## Common Issues & Solutions

### Issue 1: "Customer portal is not enabled"
**Solution:** Activate it in Stripe Dashboard (see Step 1 above)

### Issue 2: "No subscription found"
**Solution:** 
- Make sure you have an active subscription
- Check the `subscriptions` table in Supabase
- Verify `user_id` and `stripe_customer_id` are set

### Issue 3: "Missing Stripe customer ID"
**Solution:**
- Your subscription record is missing `stripe_customer_id`
- This should be set when the subscription is created via webhook
- Check your Stripe webhook configuration

### Issue 4: Button doesn't do anything (no error)
**Solution:**
- Check browser console for JavaScript errors
- Verify you're logged in
- Clear browser cache and cookies
- Try in an incognito window

### Issue 5: Invalid API key
**Solution:**
- Check `.env.local` has correct `STRIPE_SECRET_KEY`
- Make sure it starts with `sk_test_` (test) or `sk_live_` (live)
- Don't confuse it with `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

---

## Environment Variables Checklist

Make sure these are in your `.env.local`:

```bash
# Required for Customer Portal
STRIPE_SECRET_KEY=sk_test_...                              # or sk_live_... for production
NEXT_PUBLIC_BASE_URL=http://localhost:3000                 # or your production URL

# Required for subscriptions (not directly for portal, but good to have)
NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID=price_...
NEXT_PUBLIC_STRIPE_PROFESSIONAL_PRICE_ID=price_...
NEXT_PUBLIC_STRIPE_AGENCY_PRICE_ID=price_...
```

---

## What Was Changed

### Files Modified:

1. **`src/app/api/stripe/portal/route.ts`**
   - ✅ Added detailed error logging
   - ✅ Better error messages
   - ✅ Validates `stripe_customer_id` exists
   - ✅ Returns more helpful error responses
   - ✅ Fixed return URL to go back to `/settings/billing`

2. **`src/app/settings/billing/page.tsx`**
   - ✅ Added console logging for debugging
   - ✅ Better error messages shown to user
   - ✅ Improved error handling
   - ✅ Shows detailed error from API response

### Files Created:

1. **`STRIPE_CUSTOMER_PORTAL_SETUP.md`** - Complete setup guide
2. **`scripts/test-stripe-portal.js`** - Automated testing script
3. **`BILLING_BUTTON_FIX.md`** - This file

---

## How It Works

```
User clicks "Manage Billing"
    ↓
Frontend makes POST to /api/stripe/portal
    ↓
Backend authenticates user
    ↓
Backend gets user's subscription & stripe_customer_id
    ↓
Backend creates Stripe Billing Portal session
    ↓
Stripe returns a temporary portal URL
    ↓
Frontend redirects user to Stripe portal
    ↓
User manages subscription, payment, etc. on Stripe
    ↓
User clicks "Return to app"
    ↓
Redirected back to /settings/billing
```

---

## Stripe Customer Portal Features

Once working, users can:
- 💳 Update payment method (add/remove cards)
- 📄 View and download invoices
- 📧 Update billing email
- 🏢 Update billing address
- ⬆️ Upgrade subscription tier
- ⬇️ Downgrade subscription tier
- ❌ Cancel subscription
- ⏸️ Pause subscription (if enabled)

---

## Production Checklist

Before deploying to production:

- [ ] Customer portal is activated in **live mode**
- [ ] `STRIPE_SECRET_KEY` uses live key (`sk_live_...`)
- [ ] `NEXT_PUBLIC_BASE_URL` is set to production domain
- [ ] Portal settings are configured (business info, features)
- [ ] Terms of service and privacy policy URLs are added
- [ ] Tested the portal flow end-to-end in live mode
- [ ] Cancellation policy is configured as desired
- [ ] Invoice branding is set up

---

## Getting Help

If you're still having issues:

1. **Check server logs** - Look for `[Portal]` prefixed messages
2. **Check browser console** - Look for `[Billing]` prefixed messages
3. **Run the test script** - `node scripts/test-stripe-portal.js`
4. **Check Stripe Dashboard** - Look for any errors or warnings
5. **Review the setup guide** - See `STRIPE_CUSTOMER_PORTAL_SETUP.md`

## Support Links

- Stripe Customer Portal Docs: https://stripe.com/docs/billing/subscriptions/integrating-customer-portal
- Stripe Dashboard (Test): https://dashboard.stripe.com/test/dashboard
- Stripe Dashboard (Live): https://dashboard.stripe.com/dashboard
- Portal Settings: https://dashboard.stripe.com/settings/billing/portal

