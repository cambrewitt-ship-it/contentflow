import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { getCreditPackageByPriceId } from '@/lib/creditPackages';
import { getUserSubscription } from '@/lib/subscriptionHelpers';
import logger from '@/lib/logger';
import { requireAuth } from '@/lib/authHelpers';

// Force dynamic rendering
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

    // Verify the credit package exists
    const creditPackage = getCreditPackageByPriceId(priceId);
    if (!creditPackage) {
      return NextResponse.json(
        { error: 'Invalid credit package price ID' },
        { status: 400 }
      );
    }

    const auth = await requireAuth(req);
    if (auth.error) return auth.error;
    const { user } = auth;

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

