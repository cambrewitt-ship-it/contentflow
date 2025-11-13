# Fix Stripe Price IDs

## 🚨 Issue Found

Your `.env.local` has **Product IDs** instead of **Price IDs**:
- ❌ `NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID=prod_TDLVAf0thijyvM` (Product ID)
- ✅ Should be: `price_XXXXX` (Price ID)

Also, you're using **live keys** which is fine, but make sure you're testing with real payments or switch to test keys.

## 🔧 How to Get Price IDs

### Option 1: Using Stripe Dashboard (Easiest)

1. Go to your [Stripe Products page](https://dashboard.stripe.com/products)
2. Click on each product (In-House, Freelancer, Agency)
3. In the product details page, look for the **"Pricing"** section
4. Copy the **Price ID** (starts with `price_`)
5. It will look like: `price_1234567890abcdefghij`

### Option 2: Using Stripe CLI

```bash
# List all your prices
stripe prices list

# Look for the prices attached to your products
# Copy the "id" field (starts with price_)
```

### Option 3: Check the Product Page URL

When you click on a product in the Stripe dashboard, look at the pricing section. You should see something like:

```
Price: $35.00 / month
Price ID: price_1234567890abcdefghij  <-- Copy this
```

## 📝 Update Your .env.local

Replace the lines in your `.env.local` with the correct Price IDs:

```bash
# Replace these Product IDs with actual Price IDs
NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID=price_YOUR_STARTER_PRICE_ID_HERE
NEXT_PUBLIC_STRIPE_PROFESSIONAL_PRICE_ID=price_YOUR_PROFESSIONAL_PRICE_ID_HERE
NEXT_PUBLIC_STRIPE_AGENCY_PRICE_ID=price_YOUR_AGENCY_PRICE_ID_HERE

# Also add your webhook secret (get from Stripe CLI or Dashboard)
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET_HERE
```

## 🔍 How to Tell Product ID vs Price ID

- **Product ID**: `prod_XXXXX` - This identifies the product itself
- **Price ID**: `price_XXXXX` - This identifies the specific pricing for that product

You need the **Price ID** because that's what Stripe uses in checkout sessions.

## 🎯 Quick Test

After updating, your pricing page should work. The error you saw ("<!DOCTYPE" is not valid JSON) happened because the API couldn't find valid Price IDs and returned an error page.

## ⚠️ Note About Live Keys

You're using live Stripe keys (`sk_live_`). This means:
- ✅ Real payments will be processed
- ❌ You can't use test cards like `4242 4242 4242 4242`
- 💰 Actual charges will occur

If you want to test without real charges, switch to **test keys**:
1. Go to [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys)
2. Toggle to "Test mode" (switch in the sidebar)
3. Copy your test keys (`sk_test_...` and `pk_test_...`)
4. Use those in `.env.local` instead

## 🚀 Next Steps

1. Get the correct Price IDs from Stripe Dashboard
2. Update `.env.local` with the Price IDs
3. Restart your dev server: `npm run dev`
4. Try clicking "Subscribe" again

Let me know once you've updated the Price IDs!

