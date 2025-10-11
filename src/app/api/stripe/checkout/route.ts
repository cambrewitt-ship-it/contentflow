import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
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

export async function POST(req: NextRequest) {
  try {
    const { priceId } = await req.json();

    if (!priceId) {
      return NextResponse.json(
        { error: 'Price ID is required' },
        { status: 400 }
      );
    }

    // Get user from session
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Cookie: req.headers.get('cookie') || '',
          },
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user already has a subscription
    let subscription = await getUserSubscription(user.id);
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
      successUrl: `${baseUrl}/dashboard/subscription?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${baseUrl}/pricing?canceled=true`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}

