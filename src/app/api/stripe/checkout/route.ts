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

    if (subscription) {
      // User already has a subscription, use existing customer ID
      customerId = subscription.stripe_customer_id;
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
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const session = await createCheckoutSession({
      customerId,
      priceId,
      userId: user.id,
      successUrl: `${baseUrl}/settings/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
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
