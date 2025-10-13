# Stripe Customer Portal Setup

## Overview
The Stripe Customer Portal allows your users to manage their subscription, update payment methods, view invoices, and more - all hosted by Stripe.

## Setup Steps

### 1. Enable Customer Portal in Stripe Dashboard

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/)
2. Navigate to **Settings** → **Billing** → **Customer portal**
3. Click **Activate** if not already activated

### 2. Configure Portal Settings

Configure what customers can do in the portal:

#### Business Information
- Add your business name
- Add support email/phone
- Add terms of service and privacy policy URLs

#### Functionality
Enable/configure these features:
- ✅ **Invoice history** - Let customers view past invoices
- ✅ **Update payment method** - Let customers update their card
- ✅ **Cancel subscriptions** - Allow customers to cancel
  - Set cancellation behavior (immediate or at period end)
  - Optionally require cancellation reason
- ✅ **Pause subscriptions** (optional)
- ✅ **Update subscription** - Let customers upgrade/downgrade

#### Customer Update Options
- Allow customers to update their email address
- Allow customers to update billing address

### 3. Environment Variables

Make sure these are set in your `.env.local`:

```env
# Stripe Secret Key (Required for API calls)
STRIPE_SECRET_KEY=sk_test_... or sk_live_...

# Stripe Price IDs for each tier
NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID=price_...
NEXT_PUBLIC_STRIPE_PROFESSIONAL_PRICE_ID=price_...
NEXT_PUBLIC_STRIPE_AGENCY_PRICE_ID=price_...

# Base URL (for return URL)
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### 4. Test the Portal

1. Create a test subscription in development mode
2. Go to `/settings/billing` in your app
3. Click **Manage Billing**
4. You should be redirected to Stripe's Customer Portal

### 5. Common Issues & Troubleshooting

#### Issue: "Customer portal is not enabled"
**Solution:** Activate the customer portal in Stripe Dashboard (Settings → Billing → Customer portal)

#### Issue: Button doesn't do anything
**Solution:** 
- Check browser console for errors
- Verify user has an active subscription
- Check that `stripe_customer_id` exists in the subscription record
- Ensure Stripe secret key is valid

#### Issue: "Invalid customer ID"
**Solution:**
- Verify the subscription record has a valid `stripe_customer_id`
- Check that the customer exists in Stripe Dashboard

#### Issue: Redirect URL not working
**Solution:**
- Ensure `NEXT_PUBLIC_BASE_URL` is set correctly
- For production, use your actual domain (e.g., `https://yourapp.com`)
- For local development, use `http://localhost:3000`

### 6. Testing in Development

Use Stripe's test mode:
1. Use test credit card: `4242 4242 4242 4242`
2. Any future expiry date
3. Any CVC
4. Any ZIP code

### 7. Production Checklist

Before going live:
- [ ] Customer portal is activated in **live mode**
- [ ] Business information is filled out
- [ ] Terms of service and privacy policy URLs are added
- [ ] Cancellation settings are configured
- [ ] `STRIPE_SECRET_KEY` uses live key (`sk_live_...`)
- [ ] All price IDs are from live mode
- [ ] `NEXT_PUBLIC_BASE_URL` is set to production domain
- [ ] Test the flow end-to-end in live mode

## Features Available in Customer Portal

Once configured, users can:
- 📄 View and download invoices
- 💳 Update payment method
- 📧 Update email address
- 🏢 Update billing information
- 📊 View subscription details
- ⬆️ Upgrade subscription (if enabled)
- ⬇️ Downgrade subscription (if enabled)
- ⏸️ Pause subscription (if enabled)
- ❌ Cancel subscription (if enabled)

## API Endpoint

The portal is accessed via: `POST /api/stripe/portal`

**Request:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "url": "https://billing.stripe.com/session/live_..."
}
```

## Security Notes

- Portal sessions are temporary and expire after a short time
- Users must be authenticated to create a portal session
- Portal sessions are tied to the specific Stripe customer
- Users can only see their own subscription data

## Support

If users have issues:
1. Check server logs for detailed error messages
2. Verify subscription exists and has `stripe_customer_id`
3. Test with a different browser/clear cache
4. Check Stripe Dashboard for any service issues

