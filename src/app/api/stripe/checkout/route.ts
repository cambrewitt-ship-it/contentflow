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
import logger from '@/lib/logger';

// Force dynamic rendering - prevents static generation at build time
export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: NextRequest) {
  try {
    const { priceId } = await req.json();

    if (!priceId) {
      return NextResponse.json(
        { error: 'Price ID is required' },
        { status: 400 }
      );
    }

    // Get the authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.error('No authorization header found');
      return NextResponse.json({ 
        error: 'Authentication required', 
        details: 'User must be logged in to subscribe'
      }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    
    // Create Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    // Get the authenticated user using the token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      logger.error('Authentication error:', { error: authError?.message });
      return NextResponse.json({ 
        error: 'Authentication required', 
        details: 'User must be logged in to subscribe'
      }, { status: 401 });
    }

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

