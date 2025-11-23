import { NextRequest, NextResponse } from 'next/server';
import { stripe, getTierByPriceId } from '@/lib/stripe';
import {
  upsertSubscription,
  getSubscriptionByCustomerId,
  getTierLimits,
} from '@/lib/subscriptionHelpers';
import logger from '@/lib/logger';
import { requireAuth } from '@/lib/authHelpers';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (auth.error) return auth.error;
    const { user } = auth;

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Verify the session belongs to this user
    const userId = session.metadata?.userId;
    if (userId !== user.id) {
      return NextResponse.json(
        { error: 'Session does not belong to this user' },
        { status: 403 }
      );
    }

    // If this is a subscription checkout, retrieve and sync the subscription
    if (session.mode === 'subscription' && session.subscription) {
      const subscriptionId = session.subscription as string;
      
      try {
        // Retrieve the subscription from Stripe
        const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
        const customerId = stripeSubscription.customer as string;
        const priceId = stripeSubscription.items.data[0]?.price.id;

        if (!priceId) {
          return NextResponse.json(
            { error: 'No price ID found in subscription' },
            { status: 400 }
          );
        }

        // Determine the tier from the price ID
        const tier = getTierByPriceId(priceId) || 'starter';
        const limits = getTierLimits(tier);

        // Get period dates
        const periodStart = (stripeSubscription as any).current_period_start as number;
        const periodEnd = (stripeSubscription as any).current_period_end as number;

        // Upsert the subscription in our database
        await upsertSubscription({
          user_id: user.id,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          stripe_price_id: priceId,
          subscription_tier: tier,
          subscription_status: stripeSubscription.status,
          current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : undefined,
          current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : undefined,
          cancel_at_period_end: stripeSubscription.cancel_at_period_end,
          max_clients: limits.maxClients,
          max_posts_per_month: limits.maxPostsPerMonth,
          max_ai_credits_per_month: limits.maxAICreditsPerMonth,
        });

        logger.info(`✅ Synced subscription ${subscriptionId} for user ${user.id}, tier: ${tier}`);

        return NextResponse.json({
          success: true,
          subscription: {
            tier,
            status: stripeSubscription.status,
          },
        });
      } catch (error) {
        logger.error('Failed to sync subscription from Stripe:', error);
        return NextResponse.json(
          { error: 'Failed to sync subscription', details: error instanceof Error ? error.message : 'Unknown error' },
          { status: 500 }
        );
      }
    }

    // If not a subscription checkout, just return success
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Verify checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to verify checkout session', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

