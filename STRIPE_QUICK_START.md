# Stripe Integration - Quick Start Guide

## 🎯 What Was Implemented

A complete Stripe subscription system with:
- ✅ 3 pricing tiers (Starter, Professional, Agency)
- ✅ Checkout flow with Stripe Checkout
- ✅ Subscription management via Customer Portal
- ✅ Webhook handling for automatic updates
- ✅ Usage tracking (clients, posts, AI credits)
- ✅ Middleware to enforce subscription limits
- ✅ Beautiful UI for pricing and subscription management

## 🚀 Quick Setup (5 minutes)

### 1. Run Database Migration

```sql
-- Copy contents from create-subscriptions-table.sql
-- Paste into Supabase SQL Editor and execute
```

### 2. Create Stripe Products

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/test/products)
2. Create 3 products:
   - **Starter**: $35/month
   - **Professional**: $79/month  
   - **Agency**: $199/month
3. Copy each Price ID

### 3. Add Environment Variables

```bash
# Add to .env.local
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID=price_...
NEXT_PUBLIC_STRIPE_PROFESSIONAL_PRICE_ID=price_...
NEXT_PUBLIC_STRIPE_AGENCY_PRICE_ID=price_...
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### 4. Set Up Webhooks (for local testing)

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login and forward webhooks
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Copy the webhook secret to .env.local
```

### 5. Test It Out

```bash
# Start your dev server
npm run dev

# Visit the pricing page
open http://localhost:3000/pricing

# Subscribe using test card: 4242 4242 4242 4242
# Check your subscription at /dashboard/subscription
```

## 📁 Files Created

### Database
- `create-subscriptions-table.sql` - Database schema

### Backend
- `src/lib/stripe.ts` - Stripe utility functions
- `src/lib/subscriptionHelpers.ts` - Supabase subscription operations
- `src/lib/subscriptionMiddleware.ts` - Middleware for route protection
- `src/app/api/stripe/checkout/route.ts` - Checkout session creation
- `src/app/api/stripe/portal/route.ts` - Customer Portal access
- `src/app/api/stripe/subscription/route.ts` - Get subscription data
- `src/app/api/stripe/webhook/route.ts` - Webhook event handler

### Frontend
- `src/app/pricing/page.tsx` - Pricing page UI
- `src/app/dashboard/subscription/page.tsx` - Subscription management UI

### Documentation
- `STRIPE_INTEGRATION_GUIDE.md` - Complete documentation
- `STRIPE_SETUP_CHECKLIST.md` - Setup checklist
- `STRIPE_QUICK_START.md` - This file

### Updated Files (subscription checks added)
- `src/app/api/ai/route.ts` - AI credit checks
- `src/app/api/clients/create/route.ts` - Client limit checks
- `src/app/api/posts/create/route.ts` - Post limit checks

## 🎨 Subscription Tiers

| Feature | Starter | Professional | Agency |
|---------|---------|--------------|--------|
| **Price** | $35/mo | $79/mo | $199/mo |
| **Clients** | 1 | 5 | Unlimited |
| **Posts/Month** | 30 | 150 | Unlimited |
| **AI Credits/Month** | 100 | 500 | 2000 |
| **Analytics** | Basic | Advanced | Advanced |
| **Support** | Email | Priority Email | Phone + Email |
| **Branding** | - | Custom | White-Label |
| **Account Manager** | - | - | ✅ |

## 🔗 Key Routes

| Route | Purpose |
|-------|---------|
| `/pricing` | Display pricing tiers and subscribe |
| `/dashboard/subscription` | Manage subscription and view usage |
| `/api/stripe/checkout` | Create checkout session |
| `/api/stripe/portal` | Open Customer Portal |
| `/api/stripe/subscription` | Get subscription data |
| `/api/stripe/webhook` | Handle Stripe events |

## 💡 Usage Examples

### Check Limits Before Action

```typescript
import { checkSubscriptionLimit } from '@/lib/subscriptionHelpers';

const { allowed, current, max } = await checkSubscriptionLimit(
  userId,
  'clients'
);

if (!allowed) {
  // Show upgrade prompt
}
```

### Protect API Route

```typescript
import { withClientLimitCheck } from '@/lib/subscriptionMiddleware';

export async function POST(req: NextRequest) {
  const check = await withClientLimitCheck(req);
  if (!check.authorized) return check;
  
  const userId = check.user!.id;
  // Your logic here...
}
```

### Track Usage

```typescript
import { trackClientCreation } from '@/lib/subscriptionMiddleware';

// After successfully creating a client
await trackClientCreation(userId);
```

## 🧪 Test Cards

| Card Number | Scenario |
|-------------|----------|
| `4242 4242 4242 4242` | Successful payment |
| `4000 0000 0000 9995` | Declined payment |
| `4000 0000 0000 0341` | Requires authentication |

Use any future expiry date and any CVC.

## 📊 How It Works

### 1. User Subscribes
1. User visits `/pricing`
2. Clicks "Subscribe" → redirected to Stripe Checkout
3. Completes payment
4. Redirected back to `/dashboard/subscription?success=true`

### 2. Webhook Updates Database
1. Stripe sends `checkout.session.completed` event
2. Webhook creates subscription record in database
3. Sets initial limits based on tier

### 3. Usage Tracking
1. User creates client/post or uses AI
2. API route checks subscription limit
3. If allowed, operation proceeds
4. Usage counter increments in database

### 4. Subscription Management
1. User visits `/dashboard/subscription`
2. Clicks "Manage Billing"
3. Opens Stripe Customer Portal
4. Can upgrade, downgrade, or cancel
5. Webhook updates database on changes

## 🔧 Configuration

The subscription tiers are configured in `src/lib/stripe.ts`:

```typescript
export const SUBSCRIPTION_TIERS = {
  starter: {
    name: 'Starter',
    priceId: process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID!,
    price: 35,
    maxClients: 1,
    maxPostsPerMonth: 30,
    maxAICreditsPerMonth: 100,
    features: [...]
  },
  // ...
}
```

To modify limits, update this configuration and redeploy.

## 🚨 Important Notes

1. **Test Mode**: All setup uses Stripe test mode. Switch to live keys for production.
2. **Webhooks**: Required for subscriptions to work. Must be set up in Stripe Dashboard.
3. **Service Role**: Webhooks need Supabase service role key to update database.
4. **RLS Policies**: Database has Row Level Security enabled for user protection.
5. **Usage Reset**: Monthly counters reset automatically based on billing cycle.

## 📚 Full Documentation

For complete details, see:
- `STRIPE_INTEGRATION_GUIDE.md` - Complete guide
- `STRIPE_SETUP_CHECKLIST.md` - Step-by-step checklist

## ✅ Next Steps

1. Complete the 5-minute setup above
2. Test the full flow with test card
3. Verify webhooks are working
4. Test subscription limits
5. Customize pricing/features as needed
6. Switch to live mode when ready

## 🎉 You're Done!

Your Stripe subscription system is ready to use. Users can now:
- Subscribe to any tier
- Manage their subscription
- Be automatically restricted by their plan limits
- Upgrade/downgrade at any time
- View their usage and billing history

Need help? Check `STRIPE_INTEGRATION_GUIDE.md` for troubleshooting.

