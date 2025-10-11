# Stripe Webhook Setup for Production

## 🎯 Quick Setup

You need to configure Stripe webhooks so your app is notified when subscription events occur (payments, cancellations, renewals, etc.).

### Step 1: Add Webhook Endpoint in Stripe Dashboard

1. **Go to Stripe Dashboard**: https://dashboard.stripe.com/webhooks

2. **Click "Add endpoint"**

3. **Configure the endpoint**:
   - **Endpoint URL**: `https://contentflow-v2.vercel.app/api/stripe/webhook`
   - **Description**: ContentFlow V2 Production Webhook
   - **API Version**: Use the latest (should be 2025-09-30 or similar)

4. **Select events to listen to**: Click "Select events" and add these 6 events:
   ```
   ✅ checkout.session.completed
   ✅ customer.subscription.created
   ✅ customer.subscription.updated
   ✅ customer.subscription.deleted
   ✅ invoice.paid
   ✅ invoice.payment_failed
   ```

5. **Click "Add endpoint"**

### Step 2: Copy Webhook Signing Secret

After creating the endpoint, you'll see the webhook details page:

1. **Find the "Signing secret"** section
2. **Click "Reveal"** to show the secret
3. **Copy the secret** (starts with `whsec_`)

### Step 3: Update Environment Variables

#### For Local Development (.env.local):

Update your local `.env.local` file:
```bash
STRIPE_WEBHOOK_SECRET=whsec_YOUR_SIGNING_SECRET_HERE
```

Then restart your dev server:
```bash
npm run dev
```

#### For Production (Vercel):

1. **Go to Vercel Dashboard**: https://vercel.com/your-project/settings/environment-variables
2. **Add new environment variable**:
   - **Name**: `STRIPE_WEBHOOK_SECRET`
   - **Value**: `whsec_YOUR_SIGNING_SECRET_HERE`
   - **Environment**: Production (and Preview if needed)
3. **Click "Save"**
4. **Redeploy** your app to apply the changes

### Step 4: Test the Webhook

1. **Go back to Stripe Dashboard** > Webhooks > Your endpoint
2. **Click "Send test webhook"**
3. **Select event**: `checkout.session.completed`
4. **Click "Send test webhook"**
5. **Check the response**: Should show `200 OK`

If you see any errors, check:
- ✅ Webhook URL is correct (`https://contentflow-v2.vercel.app/api/stripe/webhook`)
- ✅ Signing secret is correctly set in Vercel environment variables
- ✅ App has been redeployed after adding the environment variable

## 🔍 How to Verify Webhooks Are Working

### Check Webhook Logs in Stripe

1. Go to: https://dashboard.stripe.com/webhooks
2. Click on your webhook endpoint
3. Click "Logs" tab
4. You should see successful `200` responses when events occur

### Check Your Database

After a successful checkout:
1. Go to your Supabase dashboard
2. Check the `subscriptions` table
3. You should see a new row with:
   - `user_id`
   - `stripe_customer_id`
   - `stripe_subscription_id`
   - `subscription_status`: "active"
   - Correct tier and limits

### Test Flow

1. **Subscribe** to a plan on `/pricing`
2. **Complete checkout** in Stripe
3. **Webhook fires** (check Stripe webhook logs)
4. **Database updates** (check Supabase)
5. **View subscription** at `/dashboard/subscription`

## 🚨 Troubleshooting

### Webhook Returns 401 Unauthorized

**Problem**: The webhook endpoint requires authentication  
**Solution**: The webhook route should NOT require auth (it's already fixed in your code)

### Webhook Returns 400 Bad Request

**Problem**: Invalid signature  
**Solution**: 
- Make sure `STRIPE_WEBHOOK_SECRET` matches the signing secret in Stripe Dashboard
- Verify the secret is set in production environment (Vercel)

### Webhook Times Out

**Problem**: Database or Stripe API slow  
**Solution**: Check Supabase and Stripe status pages

### Subscription Not Showing After Checkout

**Problem**: Webhook didn't fire or failed  
**Solution**:
1. Check Stripe webhook logs for errors
2. Manually sync using the sync script (if needed)
3. Verify `STRIPE_WEBHOOK_SECRET` is correctly set

## 📋 Current Configuration

Your app is configured with:
- **Production URL**: `https://contentflow-v2.vercel.app`
- **Webhook Endpoint**: `https://contentflow-v2.vercel.app/api/stripe/webhook`
- **Stripe Mode**: Live (production)

Make sure to set `STRIPE_WEBHOOK_SECRET` in both:
1. ✅ `.env.local` (for local development)
2. ⚠️  Vercel Environment Variables (for production)

## 🎉 Once Complete

After setting up webhooks:
- ✅ New subscriptions are automatically created in your database
- ✅ Subscription updates (upgrades/downgrades) sync automatically
- ✅ Cancellations are reflected immediately
- ✅ Payment failures are tracked
- ✅ Billing history is automatically recorded

Your subscription system is now fully automated! 🚀

