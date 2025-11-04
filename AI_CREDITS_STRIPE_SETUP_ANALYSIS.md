# AI Credit Selling System - Complete Setup Analysis

## 📊 Current Implementation Status

### ✅ What's Already Done (Code Side)

1. **Credit Packages Configuration** ✅
   - File: `src/lib/creditPackages.ts`
   - Defines 3 packages:
     - Small: 50 credits for $9.99
     - Medium: 150 credits for $24.99 (popular)
     - Large: 500 credits for $74.99

2. **Checkout API** ✅
   - File: `src/app/api/stripe/credits/checkout/route.ts`
   - Creates Stripe checkout sessions for one-time payments
   - Validates user authentication and subscription status
   - Sets up proper metadata for webhook handling

3. **Webhook Handler** ✅
   - File: `src/app/api/stripe/webhook/route.ts`
   - Handles `checkout.session.completed` events
   - Processes credit purchases via `addPurchasedCredits()` function
   - Includes proper error handling and logging

4. **Purchase Dialog UI** ✅
   - File: `src/components/BuyCreditsDialog.tsx`
   - Beautiful modal showing all credit packages
   - Displays price per credit for comparison
   - Handles loading states and errors

5. **Database Schema** ✅
   - `subscriptions` table: Already has `max_ai_credits_per_month` column
   - `user_profiles` table: Has `ai_credits_purchased` column (from `add-ai-credits-purchased-column.sql`)
   - Credit purchase logic increases `max_ai_credits_per_month` (not `ai_credits_purchased`)

6. **Subscription Helpers** ✅
   - File: `src/lib/subscriptionHelpers.ts`
   - `addPurchasedCredits()` function implemented
   - Increases `max_ai_credits_per_month` when credits are purchased
   - Handles unlimited subscriptions correctly

---

## 🚨 What Needs to Be Done

### 1. Stripe Dashboard Setup (CRITICAL)

#### A. Create One-Time Payment Products

You need to create **3 one-time payment products** (NOT subscriptions) in Stripe:

**Step-by-Step:**

1. Go to [Stripe Dashboard → Products](https://dashboard.stripe.com/products)
2. Click **"+ Add product"** for each package:

   **Product 1: Small AI Credit Pack**
   - Name: `Small AI Credit Pack`
   - Description: `50 AI Credits`
   - Pricing: 
     - Pricing model: **One-time** (NOT recurring)
     - Price: `$9.99` (USD)
   - Copy the **Price ID** (starts with `price_xxxxx`)

   **Product 2: Medium AI Credit Pack**
   - Name: `Medium AI Credit Pack`
   - Description: `150 AI Credits`
   - Pricing:
     - Pricing model: **One-time**
     - Price: `$24.99` (USD)
   - Copy the **Price ID**

   **Product 3: Large AI Credit Pack**
   - Name: `Large AI Credit Pack`
   - Description: `500 AI Credits`
   - Pricing:
     - Pricing model: **One-time**
     - Price: `$74.99` (USD)
   - Copy the **Price ID**

**⚠️ CRITICAL:** These must be **ONE-TIME** payments, not recurring subscriptions!

#### B. Get Stripe API Keys

1. Go to [Stripe Dashboard → API Keys](https://dashboard.stripe.com/apikeys)
2. Copy your **Secret Key**:
   - Test mode: `sk_test_xxxxx`
   - Live mode: `sk_live_xxxxx` (for production)

#### C. Set Up Webhook Endpoint

**For Local Development:**

1. Install Stripe CLI:
   ```bash
   brew install stripe/stripe-cli/stripe
   ```

2. Login to Stripe CLI:
   ```bash
   stripe login
   ```

3. Start webhook forwarding:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

4. Copy the webhook signing secret (starts with `whsec_xxxxx`) from the terminal output

**For Production:**

1. Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
2. Click **"+ Add endpoint"**
3. Enter your webhook URL:
   - Production: `https://yourdomain.com/api/stripe/webhook`
   - Development: Your ngrok/tunnel URL
4. Select these events to listen for:
   - ✅ `checkout.session.completed` (REQUIRED for credit purchases)
   - ✅ `customer.subscription.created`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
   - ✅ `invoice.paid`
   - ✅ `invoice.payment_failed`
5. Click **"Add endpoint"**
6. Copy the **Signing secret** (starts with `whsec_xxxxx`)

### 2. Environment Variables Setup

Add these to your `.env.local` file:

```bash
# Stripe Configuration (REQUIRED)
STRIPE_SECRET_KEY=sk_test_YOUR_SECRET_KEY_HERE
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET_HERE

# AI Credit Package Price IDs (REQUIRED - from Step 1.A above)
NEXT_PUBLIC_STRIPE_CREDITS_50_PRICE_ID=price_xxxxx
NEXT_PUBLIC_STRIPE_CREDITS_150_PRICE_ID=price_xxxxx
NEXT_PUBLIC_STRIPE_CREDITS_500_PRICE_ID=price_xxxxx

# Base URL for redirects (REQUIRED)
NEXT_PUBLIC_BASE_URL=http://localhost:3000  # or your production URL

# Supabase Configuration (should already exist)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_SUPABASE_SERVICE_ROLE=your_service_role_key
```

**⚠️ Important Notes:**
- `NEXT_PUBLIC_*` variables are exposed to the browser
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are server-only (no `NEXT_PUBLIC_` prefix)
- For production, use live keys (`sk_live_` not `sk_test_`)

### 3. Database Verification

Verify these database tables and columns exist:

**Check `subscriptions` table:**
```sql
-- Verify column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'subscriptions' 
AND column_name = 'max_ai_credits_per_month';
```

**Check `user_profiles` table:**
```sql
-- Verify column exists (may not be used, but should exist)
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
AND column_name = 'ai_credits_purchased';
```

**Note:** The current implementation adds credits to `max_ai_credits_per_month` in the `subscriptions` table, not to `ai_credits_purchased` in `user_profiles`. This is correct behavior.

### 4. Testing Checklist

Once everything is set up, test the flow:

#### Test 1: Credit Purchase Flow
- [ ] User with active subscription can see credit badge
- [ ] Clicking credit badge opens `BuyCreditsDialog`
- [ ] All 3 packages are displayed correctly
- [ ] Selecting a package redirects to Stripe Checkout
- [ ] Using test card `4242 4242 4242 4242` completes payment
- [ ] After payment, user is redirected back to billing page
- [ ] Credits are added to user's `max_ai_credits_per_month`
- [ ] Credit count updates in the UI

#### Test 2: Webhook Handling
- [ ] Webhook receives `checkout.session.completed` event
- [ ] Metadata is correctly parsed (`userId`, `credits`, `type`)
- [ ] `addPurchasedCredits()` is called successfully
- [ ] Database is updated correctly
- [ ] No errors in webhook logs

#### Test 3: Error Handling
- [ ] Unauthenticated user cannot purchase (401 error)
- [ ] User without subscription cannot purchase (400 error)
- [ ] Invalid price ID is rejected (400 error)
- [ ] Webhook signature verification works
- [ ] Failed payments don't add credits

---

## 🔍 Code Implementation Details

### How Credit Purchase Works

1. **User Flow:**
   ```
   User clicks credit badge → BuyCreditsDialog opens → 
   User selects package → Calls /api/stripe/credits/checkout → 
   Redirects to Stripe Checkout → Payment completed → 
   Stripe sends webhook → Credits added to subscription
   ```

2. **Key Files:**
   - `src/app/api/stripe/credits/checkout/route.ts` - Creates checkout session
   - `src/app/api/stripe/webhook/route.ts` - Handles payment completion
   - `src/lib/subscriptionHelpers.ts` - Adds credits to subscription
   - `src/lib/creditPackages.ts` - Package definitions

3. **Credit Addition Logic:**
   - Located in `subscriptionHelpers.ts::addPurchasedCredits()`
   - Adds to `max_ai_credits_per_month` (increases monthly limit)
   - Credits never expire (they permanently increase the limit)
   - Handles unlimited subscriptions (stays unlimited)

---

## ⚠️ Common Issues & Solutions

### Issue 1: "Price ID not found" error
**Solution:** Make sure:
- Products are created as **one-time** payments (not recurring)
- Price IDs are correctly copied from Stripe Dashboard
- Environment variables are set and server is restarted

### Issue 2: Webhook not receiving events
**Solution:** 
- Verify webhook URL is correct
- For local dev, ensure `stripe listen` is running
- Check webhook secret matches in `.env.local`
- Verify webhook events are selected in Stripe Dashboard

### Issue 3: Credits not added after purchase
**Solution:**
- Check webhook logs in Stripe Dashboard
- Verify `checkout.session.completed` event is received
- Check webhook handler logs for errors
- Verify `userId` is in checkout session metadata

### Issue 4: "No subscription found" error
**Solution:**
- User must have an active subscription to purchase credits
- Verify user has a record in `subscriptions` table
- Check `stripe_customer_id` exists on subscription

---

## 📝 Quick Setup Checklist

- [ ] Create 3 one-time payment products in Stripe Dashboard
- [ ] Copy Price IDs for all 3 products
- [ ] Get Stripe Secret Key from API Keys page
- [ ] Set up webhook endpoint (local or production)
- [ ] Copy webhook signing secret
- [ ] Add all environment variables to `.env.local`
- [ ] Restart development server
- [ ] Test with Stripe test card `4242 4242 4242 4242`
- [ ] Verify credits are added after purchase
- [ ] Check webhook logs for successful events

---

## 🎯 Next Steps After Setup

1. **Monitor Webhooks:** Check Stripe Dashboard → Webhooks for delivery status
2. **Test Production:** Switch to live Stripe keys when ready
3. **Add Email Notifications:** Send confirmation emails when credits are purchased
4. **Add Purchase History:** Show credit purchase history in billing page
5. **Analytics:** Track credit package popularity

---

## 📚 Related Documentation

- `AI_CREDITS_SELLING_SETUP.md` - Original setup guide
- `STRIPE_SETUP_INSTRUCTIONS.md` - General Stripe setup
- `STRIPE_WEBHOOK_SETUP.md` - Webhook configuration details

---

## 💡 Important Reminders

1. **One-Time vs Recurring:** Credit packages MUST be one-time payments, not subscriptions
2. **Environment Variables:** Restart server after adding env vars
3. **Webhook Secret:** Different for local dev vs production
4. **Test Mode:** Use test keys (`sk_test_`) for development
5. **Live Mode:** Switch to live keys (`sk_live_`) for production
6. **Metadata:** Checkout sessions must include `userId`, `credits`, and `type: 'credit_purchase'`

