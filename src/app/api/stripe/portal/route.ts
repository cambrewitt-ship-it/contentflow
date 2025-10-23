import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createCustomerPortalSession } from '@/lib/stripe';
import { getUserSubscription } from '@/lib/subscriptionHelpers';
import logger from '@/lib/logger';

// Force dynamic rendering - prevents static generation at build time
export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;

export async function POST(req: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.error('Portal: No authorization header');
      return NextResponse.json({ 
        error: 'Authentication required', 
        details: 'User must be logged in'
      }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    
    // Create Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    // Get the authenticated user using the token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      logger.error('Portal: Authentication failed:', { error: authError?.message });
      return NextResponse.json({ 
        error: 'Authentication required', 
        details: 'Invalid or expired token'
      }, { status: 401 });
    }

    // Get user's subscription
    const subscription = await getUserSubscription(user.id);

    if (!subscription) {
      logger.error('Portal: No subscription found for user');
      return NextResponse.json(
        { error: 'No subscription found', details: 'Please subscribe to a plan first' },
        { status: 404 }

    }

    if (!subscription.stripe_customer_id) {
      logger.error('Portal: No Stripe customer ID for user');
      return NextResponse.json(
        { error: 'Invalid subscription', details: 'Missing Stripe customer ID' },
        { status: 400 }

    }

    // Create customer portal session
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const returnUrl = `${baseUrl}/settings/billing`;
    
    const portalSession = await createCustomerPortalSession(
      subscription.stripe_customer_id,
      returnUrl

    if (!portalSession.url) {
      logger.error('Portal: No URL in portal session');
      return NextResponse.json(
        { error: 'Portal session error', details: 'No URL returned from Stripe' },
        { status: 500 }

    }

    return NextResponse.json({ url: portalSession.url });
  } catch (error: any) {
    logger.error('Portal session error:', {
      message: error.message,
      type: error.type,
      code: error.code

    return NextResponse.json(
      { 
        error: 'Failed to create portal session',
        details: error.message || 'An unexpected error occurred'
      },
      { status: 500 }

  }
}

