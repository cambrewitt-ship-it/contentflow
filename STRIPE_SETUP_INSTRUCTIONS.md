# Stripe Setup Instructions

## ✅ What's Been Done

1. ✅ Enabled Stripe API routes:
   - `/api/stripe/checkout` - For creating checkout sessions
   - `/api/stripe/portal` - For managing subscriptions
   - `/api/stripe/webhook` - For handling Stripe events
   - `/api/stripe/subscription` - For fetching subscription data

2. ✅ Added missing environment variables to `.env.local`

3. ✅ All helper libraries are in place (`stripe.ts`, `subscriptionHelpers.ts`)

## 🔧 What You Need To Do

### Step 1: Create Stripe Products

1. Go to [Stripe Dashboard - Products](https://dashboard.stripe.com/test/products)
2. Create 3 products with recurring prices:

   **Product 1: In-House**
   - Name: In-House
   - Price: $35/month
   - Copy the Price ID (starts with `price_`)

   **Product 2: Freelancer**
   - Name: Freelancer
   - Price: $79/month
   - Copy the Price ID (starts with `price_`)

   **Product 3: Agency**
   - Name: Agency
   - Price: $199/month
   - Copy the Price ID (starts with `price_`)

### Step 2: Get Stripe API Keys

1. Go to [Stripe Dashboard - API Keys](https://dashboard.stripe.com/test/apikeys)
2. Copy your **Secret Key** (starts with `sk_test_`)

### Step 3: Update Environment Variables

Open `.env.local` and replace these placeholder values:

```bash
# Replace with your actual Stripe secret key
STRIPE_SECRET_KEY=sk_test_YOUR_ACTUAL_KEY_HERE

# Replace with your actual price IDs from Step 1
NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID=price_YOUR_STARTER_PRICE_ID
NEXT_PUBLIC_STRIPE_PROFESSIONAL_PRICE_ID=price_YOUR_PROFESSIONAL_PRICE_ID
NEXT_PUBLIC_STRIPE_AGENCY_PRICE_ID=price_YOUR_AGENCY_PRICE_ID
```

### Step 4: Set Up Webhooks (Important!)

#### For Local Development:

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

4. Copy the webhook signing secret (starts with `whsec_`) that appears in the terminal

5. Update `.env.local`:
   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET_HERE
   ```

#### For Production:

1. Go to [Stripe Dashboard - Webhooks](https://dashboard.stripe.com/test/webhooks)
2. Click "Add endpoint"
3. Enter your webhook URL: `https://contentmanager.ngrok.app/api/stripe/webhook`
4. Select these events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
5. Copy the webhook signing secret
6. Update `.env.local` with the production webhook secret

### Step 5: Set Up Database

Run the subscription table migration in your Supabase SQL Editor:

```bash
# Copy contents from create-subscriptions-table.sql
# Paste into Supabase SQL Editor and execute
```

Or use the SQL Editor at: https://limpakrfkywxiitvgvwh.supabase.co

### Step 6: Restart Your Dev Server

```bash
npm run dev
```

### Step 7: Test It Out

1. Visit: `http://localhost:3000/pricing`
2. Click "Subscribe" on any tier
3. Use test card: `4242 4242 4242 4242`
   - Expiry: Any future date
   - CVC: Any 3 digits
4. Complete checkout
5. You should be redirected back to `/dashboard/subscription`

## 🧪 Test Cards

| Card Number | Scenario |
|-------------|----------|
| `4242 4242 4242 4242` | Successful payment |
| `4000 0000 0000 9995` | Declined payment |
| `4000 0000 0000 0341` | Requires authentication |

## 🔍 Troubleshooting

### "Failed to fetch" error
- Make sure you've restarted your dev server after adding environment variables
- Check that all Stripe environment variables are set

### Webhook errors
- For local testing, make sure `stripe listen` is running
- Check that the webhook secret matches between Stripe CLI output and `.env.local`

### Database errors
- Make sure you've run the `create-subscriptions-table.sql` migration
- Check that `SUPABASE_SERVICE_ROLE_KEY` is set correctly

## 📚 Additional Resources

- [STRIPE_QUICK_START.md](./STRIPE_QUICK_START.md) - Full integration guide
- [STRIPE_INTEGRATION_GUIDE.md](./STRIPE_INTEGRATION_GUIDE.md) - Complete documentation
- [Stripe Documentation](https://stripe.com/docs)

## ⚠️ Important Notes

1. **Test Mode**: All setup uses Stripe test mode. Switch to live keys for production.
2. **Webhooks Required**: Subscriptions won't work properly without webhooks configured.
3. **Database Required**: The `subscriptions` and `billing_history` tables must exist.
4. **Environment Variables**: Restart your dev server after updating `.env.local`.

## 🎉 Once Complete

After completing all steps, your pricing page should work! Users will be able to:
- Subscribe to any tier
- Be redirected to Stripe Checkout
- Have their subscription automatically created in your database
- Manage their subscription via the Customer Portal

Need help? Check the troubleshooting section above or the full guides in the documentation files.

