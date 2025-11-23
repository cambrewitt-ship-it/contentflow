import { NextRequest, NextResponse } from 'next/server';
import { getUserSubscription, getBillingHistory, upsertSubscription } from '@/lib/subscriptionHelpers';
import { stripe, getTierByPriceId } from '@/lib/stripe';
import logger from '@/lib/logger';
import { requireAuth } from '@/lib/authHelpers';

// Force dynamic rendering - prevents static generation at build time
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (auth.error) return auth.error;
    const { user } = auth;

    // Get user's subscription and billing history
    let subscription = await getUserSubscription(user.id);
    
    // Auto-fix: If subscription exists but is missing critical fields, fix it
    if (subscription && subscription.stripe_subscription_id && !subscription.stripe_price_id) {
      try {
        logger.info(`Auto-fixing subscription for user ${user.id} - missing stripe_price_id`);
        
        // Retrieve subscription from Stripe
        const stripeSubscription = await stripe.subscriptions.retrieve(
          subscription.stripe_subscription_id
        );

        const priceId = stripeSubscription.items.data[0]?.price.id;
        const periodStart = stripeSubscription.current_period_start;
        const periodEnd = stripeSubscription.current_period_end;

        if (priceId) {
          const tier = getTierByPriceId(priceId);
          
          // Update the subscription with missing data
          subscription = await upsertSubscription({
            user_id: user.id,
            stripe_customer_id: subscription.stripe_customer_id,
            stripe_subscription_id: subscription.stripe_subscription_id,
            stripe_price_id: priceId,
            subscription_tier: tier || subscription.subscription_tier,
            subscription_status: stripeSubscription.status,
            current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : undefined,
            current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : undefined,
            cancel_at_period_end: stripeSubscription.cancel_at_period_end,
          });
          
          logger.info(`✅ Auto-fixed subscription for user ${user.id}`);
        }
      } catch (fixError) {
        logger.error('Error auto-fixing subscription:', fixError);
        // Continue with original subscription even if fix fails
      }
    }
    
    const billingHistory = subscription
      ? await getBillingHistory(user.id)
      : [];

    return NextResponse.json({
      subscription,
      billingHistory,
    });
  } catch (error) {
    logger.error('Get subscription error:', error);
    return NextResponse.json(
      { error: 'Failed to get subscription' },
      { status: 500 }
    );
  }
}
