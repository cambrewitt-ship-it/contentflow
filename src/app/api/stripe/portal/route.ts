import { NextRequest, NextResponse } from 'next/server';
import { createCustomerPortalSession } from '@/lib/stripe';
import { getUserSubscription } from '@/lib/subscriptionHelpers';
import logger from '@/lib/logger';
import { requireAuth } from '@/lib/authHelpers';

// Force dynamic rendering - prevents static generation at build time
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (auth.error) return auth.error;
    const { user } = auth;

    // Get user's subscription
    const subscription = await getUserSubscription(user.id);

    if (!subscription) {
      logger.error('Portal: No subscription found for user');
      return NextResponse.json(
        { error: 'No subscription found', details: 'Please subscribe to a plan first' },
        { status: 404 }
      );
    }

    if (!subscription.stripe_customer_id) {
      logger.error('Portal: No Stripe customer ID for user');
      return NextResponse.json(
        { error: 'Invalid subscription', details: 'Missing Stripe customer ID' },
        { status: 400 }
      );
    }

    // Create customer portal session
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const returnUrl = `${baseUrl}/settings/billing`;
    
    const portalSession = await createCustomerPortalSession(
      subscription.stripe_customer_id,
      returnUrl
    );

    if (!portalSession.url) {
      logger.error('Portal: No URL in portal session');
      return NextResponse.json(
        { error: 'Portal session error', details: 'No URL returned from Stripe' },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: portalSession.url });
  } catch (error: any) {
    logger.error('Portal session error:', {
      message: error.message,
      type: error.type,
      code: error.code
    });
    return NextResponse.json(
      { 
        error: 'Failed to create portal session',
        details: error.message || 'An unexpected error occurred'
      },
      { status: 500 }
    );
  }
}
