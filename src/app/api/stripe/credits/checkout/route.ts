import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { stripe } from '@/lib/stripe';
import { getCreditPackageByPriceId } from '@/lib/creditPackages';
import { getUserSubscription } from '@/lib/subscriptionHelpers';
import logger from '@/lib/logger';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;

export async function POST(req: NextRequest) {
  try {
    const { priceId } = await req.json();

    if (!priceId) {
      return NextResponse.json(
        { error: 'Price ID is required' },
        { status: 400 }
      );
    }

    // Verify the credit package exists
    const creditPackage = getCreditPackageByPriceId(priceId);
    if (!creditPackage) {
      return NextResponse.json(
        { error: 'Invalid credit package price ID' },
        { status: 400 }
      );
    }

    // Get the authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.error('No authorization header found');
      return NextResponse.json(
        { 
          error: 'Authentication required', 
          details: 'User must be logged in to purchase credits'
        }, 
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    
    // Create Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    // Get the authenticated user using the token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      logger.error('Authentication error:', { error: authError?.message });
      return NextResponse.json(
        { 
          error: 'Authentication required', 
          details: 'User must be logged in to purchase credits'
        }, 
        { status: 401 }
      );
    }

    // Get user's subscription to get their Stripe customer ID
    const subscription = await getUserSubscription(user.id);
    
    if (!subscription || !subscription.stripe_customer_id) {
      return NextResponse.json(
        { 
          error: 'No subscription found', 
          details: 'You must have an active subscription to purchase credits'
        }, 
        { status: 400 }
      );
    }

    // Create Stripe checkout session for one-time payment
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const session = await stripe.checkout.sessions.create({
      customer: subscription.stripe_customer_id,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'payment', // One-time payment, not subscription
      success_url: `${baseUrl}/settings/billing?success=true&credits_purchased=${creditPackage.credits}`,
      cancel_url: `${baseUrl}/settings/billing?canceled=true`,
      metadata: {
        userId: user.id,
        creditPackageId: creditPackage.id,
        credits: creditPackage.credits.toString(),
        type: 'credit_purchase',
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    logger.error('Credit checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

