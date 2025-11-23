import { NextRequest, NextResponse } from 'next/server';
import {
  createStripeCustomer,
  createCheckoutSession,
  getTierByPriceId,
} from '@/lib/stripe';
import {
  getUserSubscription,
  upsertSubscription,
  getTierLimits,
} from '@/lib/subscriptionHelpers';
import logger from '@/lib/logger';
import { requireAuth } from '@/lib/authHelpers';

// Force dynamic rendering - prevents static generation at build time
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { priceId } = await req.json();

    if (!priceId) {
      return NextResponse.json(
        { error: 'Price ID is required' },
        { status: 400 }
      );
    }

    const auth = await requireAuth(req);
    if (auth.error) return auth.error;
    const { user } = auth;

    // Check if user already has a subscription
    const subscription = await getUserSubscription(user.id);
    let customerId: string;

    if (subscription && subscription.stripe_customer_id) {
      // Check if the customer ID is a freemium placeholder (starts with "freemium_")
      // Freemium users have placeholder IDs that don't exist in Stripe
      if (subscription.stripe_customer_id.startsWith('freemium_')) {
        // Create a new real Stripe customer for freemium users upgrading
        const customer = await createStripeCustomer(user.email!, user.id);
        customerId = customer.id;
        // Update the subscription record with the real Stripe customer ID
        // Preserve existing subscription fields to avoid NOT NULL constraint violations
        await upsertSubscription({
          user_id: user.id,
          stripe_customer_id: customerId,
          subscription_tier: subscription.subscription_tier,
          subscription_status: subscription.subscription_status,
          max_clients: subscription.max_clients,
          max_posts_per_month: subscription.max_posts_per_month,
          max_ai_credits_per_month: subscription.max_ai_credits_per_month,
        });
      } else {
        // Use existing real Stripe customer ID
        customerId = subscription.stripe_customer_id;
      }
    } else {
      // Create new Stripe customer
      const customer = await createStripeCustomer(user.email!, user.id);
      customerId = customer.id;
    }

    // Determine the tier from the price ID
    const tier = getTierByPriceId(priceId);
    if (!tier) {
      return NextResponse.json(
        { error: 'Invalid price ID' },
        { status: 400 }
      );
    }

    // Create checkout session
    // Get base URL from request headers to support multiple domains
    const origin = req.headers.get('origin');
    const host = req.headers.get('host') || 'localhost:3000';
    
    let baseUrl: string;
    if (origin) {
      // Use origin header if available (includes protocol)
      baseUrl = origin;
    } else {
      // Fallback: construct from host and protocol
      const protocol = req.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
      baseUrl = `${protocol}://${host}`;
    }
    
    const session = await createCheckoutSession({
      customerId,
      priceId,
      userId: user.id,
      successUrl: `${baseUrl}/api/stripe/callback?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${baseUrl}/pricing?canceled=true`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    logger.error('Checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
