import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/authHelpers';
import { stripe, getTierByPriceId } from '@/lib/stripe';
import { getUserSubscription, upsertSubscription } from '@/lib/subscriptionHelpers';
import logger from '@/lib/logger';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * API endpoint to fix a subscription by retrieving missing data from Stripe
 * POST /api/admin/fix-subscription
 * Body: { userId?: string } - if not provided, fixes the authenticated user's subscription
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (auth.error) return auth.error;
    const { user } = auth;

    const body = await req.json().catch(() => ({}));
    const targetUserId = body.userId || user.id;

    // Get the subscription from database
    const subscription = await getUserSubscription(targetUserId);

    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      );
    }

    if (!subscription.stripe_subscription_id) {
      return NextResponse.json(
        { error: 'No Stripe subscription ID found' },
        { status: 400 }
      );
    }

    logger.info(`Fixing subscription for user ${targetUserId}, Stripe subscription: ${subscription.stripe_subscription_id}`);

    // Retrieve subscription from Stripe
    const stripeSubscription = await stripe.subscriptions.retrieve(
      subscription.stripe_subscription_id
    );

    const priceId = stripeSubscription.items.data[0]?.price.id;
    const periodStart = stripeSubscription.current_period_start;
    const periodEnd = stripeSubscription.current_period_end;

    if (!priceId) {
      return NextResponse.json(
        { error: 'No price ID found in Stripe subscription' },
        { status: 400 }
      );
    }

    // Determine tier from price ID
    const tier = getTierByPriceId(priceId);

    if (!tier) {
      logger.warn(`Could not determine tier for price ID: ${priceId}`);
    }

    // Update the subscription with data from Stripe
    const updatedSubscription = await upsertSubscription({
      user_id: targetUserId,
      stripe_customer_id: subscription.stripe_customer_id,
      stripe_subscription_id: subscription.stripe_subscription_id,
      stripe_price_id: priceId,
      subscription_tier: tier || subscription.subscription_tier,
      subscription_status: stripeSubscription.status,
      current_period_start: new Date(periodStart * 1000).toISOString(),
      current_period_end: new Date(periodEnd * 1000).toISOString(),
      cancel_at_period_end: stripeSubscription.cancel_at_period_end,
    });

    logger.info(`✅ Fixed subscription for user ${targetUserId}, tier: ${tier || subscription.subscription_tier}, priceId: ${priceId}`);

    return NextResponse.json({
      success: true,
      subscription: updatedSubscription,
      message: 'Subscription fixed successfully',
    });
  } catch (error) {
    logger.error('Error fixing subscription:', error);
    return NextResponse.json(
      { error: 'Failed to fix subscription', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

