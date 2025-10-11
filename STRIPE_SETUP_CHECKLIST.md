# Stripe Integration Setup Checklist

Use this checklist to ensure your Stripe integration is properly configured.

## ✅ Step-by-Step Setup

### 1. Database Setup

- [ ] Run the SQL migration from `create-subscriptions-table.sql` in Supabase SQL Editor
- [ ] Verify `subscriptions` table exists
- [ ] Verify `billing_history` table exists
- [ ] Test RLS policies work correctly

### 2. Stripe Dashboard - Products

- [ ] Create "Starter" product at $35/month
  - Copy Price ID → Add to `.env.local` as `NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID`
- [ ] Create "Professional" product at $79/month
  - Copy Price ID → Add to `.env.local` as `NEXT_PUBLIC_STRIPE_PROFESSIONAL_PRICE_ID`
- [ ] Create "Agency" product at $199/month
  - Copy Price ID → Add to `.env.local` as `NEXT_PUBLIC_STRIPE_AGENCY_PRICE_ID`

### 3. Stripe Dashboard - Webhooks

- [ ] Go to Developers > Webhooks
- [ ] Add webhook endpoint (production: `https://yourdomain.com/api/stripe/webhook`)
- [ ] Select these events:
  - [ ] `checkout.session.completed`
  - [ ] `customer.subscription.created`
  - [ ] `customer.subscription.updated`
  - [ ] `customer.subscription.deleted`
  - [ ] `invoice.paid`
  - [ ] `invoice.payment_failed`
- [ ] Copy webhook signing secret → Add to `.env.local` as `STRIPE_WEBHOOK_SECRET`

### 4. Environment Variables

Add these to your `.env.local` file:

```bash
# Stripe Keys
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Price IDs
NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID=price_...
NEXT_PUBLIC_STRIPE_PROFESSIONAL_PRICE_ID=price_...
NEXT_PUBLIC_STRIPE_AGENCY_PRICE_ID=price_...

# App URL
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Supabase (already set)
SUPABASE_SERVICE_ROLE_KEY=your_key
```

### 5. Local Testing Setup (Optional)

- [ ] Install Stripe CLI: `brew install stripe/stripe-cli/stripe`
- [ ] Login: `stripe login`
- [ ] Forward webhooks: `stripe listen --forward-to localhost:3000/api/stripe/webhook`
- [ ] Use the webhook secret from CLI output in `.env.local`

### 6. Testing

- [ ] Visit `/pricing` - should see 3 pricing tiers
- [ ] Click "Subscribe" on Starter plan
- [ ] Complete checkout with test card `4242 4242 4242 4242`
- [ ] Verify redirect to `/dashboard/subscription?success=true`
- [ ] Check Supabase `subscriptions` table - should have your record
- [ ] Visit `/dashboard/subscription` - should see active subscription
- [ ] Click "Manage Billing" - should open Stripe Customer Portal
- [ ] Try creating a client - should increment `clients_used`
- [ ] Try creating a post - should increment `posts_used_this_month`
- [ ] Try making AI request - should increment `ai_credits_used_this_month`

### 7. Test Subscription Limits

**Starter Plan Limits:**
- [ ] Try adding 2 clients - 2nd should fail with 403 error
- [ ] Create 30 posts - 31st should fail
- [ ] Use 100 AI credits - 101st should fail

**Professional Plan:**
- [ ] Upgrade to Professional via Customer Portal
- [ ] Verify limits increased (5 clients, 150 posts, 500 AI credits)
- [ ] Test new limits work correctly

**Agency Plan:**
- [ ] Upgrade to Agency via Customer Portal
- [ ] Verify unlimited clients and posts work
- [ ] Verify 2000 AI credits limit

### 8. Webhook Testing

- [ ] Trigger `stripe trigger checkout.session.completed` (using Stripe CLI)
- [ ] Check webhook logs in Stripe Dashboard
- [ ] Verify webhook created/updated subscription in database
- [ ] Test invoice.paid event
- [ ] Test subscription.deleted event

### 9. Customer Portal

- [ ] Enable Customer Portal in Stripe Dashboard (Settings > Billing)
- [ ] Configure allowed actions:
  - [ ] Update payment method
  - [ ] Cancel subscription
  - [ ] Update subscription (upgrade/downgrade)
  - [ ] View invoices
- [ ] Test portal from `/dashboard/subscription`
- [ ] Try changing payment method
- [ ] Try canceling subscription
- [ ] Try upgrading/downgrading

### 10. Production Deployment

Before going live:

- [ ] Replace all test keys with live keys
- [ ] Update webhook endpoint to production URL
- [ ] Re-create products in live mode (if needed)
- [ ] Test complete checkout flow in production
- [ ] Verify webhooks work in production
- [ ] Set up monitoring/alerts for failed webhooks
- [ ] Test subscription limits in production
- [ ] Document support process for subscription issues

## 🔍 Verification Commands

Test your setup with these commands:

```bash
# Check if subscriptions table exists
# Run in Supabase SQL Editor:
SELECT * FROM subscriptions LIMIT 1;

# Test API routes
curl http://localhost:3000/api/stripe/subscription

# Test webhook locally (requires Stripe CLI)
stripe trigger checkout.session.completed

# View Stripe logs
stripe logs tail
```

## 🚨 Common Issues

### Issue: Webhook not receiving events
**Solution**: 
- Check webhook secret is correct
- Verify endpoint URL is publicly accessible
- Use Stripe CLI for local testing
- Check Stripe Dashboard > Webhooks for error logs

### Issue: Checkout not creating subscription
**Solution**:
- Verify Price IDs are correct
- Check user is authenticated
- Ensure database migration ran successfully
- Check Supabase RLS policies

### Issue: Subscription limits not enforced
**Solution**:
- Verify middleware is added to API routes
- Check usage tracking functions are called
- Verify subscription record exists in database
- Check subscription status is 'active' or 'trialing'

## 📞 Need Help?

- Review `STRIPE_INTEGRATION_GUIDE.md` for detailed documentation
- Check Stripe Dashboard > Developers > Logs
- Test webhooks using Stripe CLI: `stripe listen`
- Verify environment variables: `echo $STRIPE_SECRET_KEY`

## 🎉 Success Criteria

Your integration is complete when:

✅ Users can subscribe to any tier  
✅ Subscriptions sync to database via webhooks  
✅ Users can manage subscriptions via Customer Portal  
✅ API routes respect subscription limits  
✅ Usage counters increment correctly  
✅ Users can upgrade/downgrade plans  
✅ Billing history is tracked  
✅ All tests pass  

---

**Last Updated**: Check `STRIPE_INTEGRATION_GUIDE.md` for latest documentation

