import { NextRequest, NextResponse } from 'next/server';
import { stripe, getTierByPriceId } from '@/lib/stripe';
import {
  upsertSubscription,
  getTierLimits,
} from '@/lib/subscriptionHelpers';
import logger from '@/lib/logger';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('session_id');
    const success = searchParams.get('success');

    if (!sessionId || success !== 'true') {
      // Redirect to pricing if no valid session
      return NextResponse.redirect(new URL('/pricing?error=invalid_session', req.url));
    }

    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const userId = session.metadata?.userId;

    if (!userId) {
      logger.error('No userId in checkout session metadata');
      return NextResponse.redirect(new URL('/pricing?error=no_user', req.url));
    }

    // Try to get the user's session
    // Next.js 15+ requires await for cookies()
    const supabase = createRouteHandlerClient({ 
      cookies: async () => await cookies() 
    });
    const { data: { session: authSession } } = await supabase.auth.getSession();

    // If this is a subscription checkout, sync it immediately
    if (session.mode === 'subscription' && session.subscription) {
      const subscriptionId = session.subscription as string;
      
      try {
        // Retrieve the subscription from Stripe
        const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
        const customerId = stripeSubscription.customer as string;
        const priceId = stripeSubscription.items.data[0]?.price.id;

        if (!priceId) {
          logger.error('No price ID found in subscription');
        } else {
          // Determine the tier from the price ID
          const tier = getTierByPriceId(priceId) || 'starter';
          const limits = getTierLimits(tier);

          // Get period dates
          const periodStart = (stripeSubscription as any).current_period_start as number;
          const periodEnd = (stripeSubscription as any).current_period_end as number;

          // Upsert the subscription in our database
          try {
            await upsertSubscription({
              user_id: userId,
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

            logger.info(`✅ Synced subscription ${subscriptionId} for user ${userId}, tier: ${tier}`);
          } catch (error) {
            logger.error(`Failed to upsert subscription for user ${userId} in callback:`, error);
            // Re-throw to be caught by outer try-catch
            throw error;
          }
        }
      } catch (error) {
        logger.error('Failed to sync subscription from Stripe:', error);
        // Continue anyway - webhook will handle it
      }
    }

    // Check if user is authenticated
    if (authSession && authSession.user.id === userId) {
      // User is authenticated, redirect to billing page with success message
      const billingUrl = new URL('/settings/billing', req.url);
      billingUrl.searchParams.set('success', 'true');
      billingUrl.searchParams.set('session_id', sessionId);
      return NextResponse.redirect(billingUrl);
    } else {
      // User is not authenticated, redirect to login with redirectTo preserving session_id
      // The subscription has already been synced above, so when they log in and get redirected,
      // the billing page will show the updated subscription
      const loginUrl = new URL('/auth/login', req.url);
      const redirectTo = `/settings/billing?success=true&session_id=${sessionId}`;
      loginUrl.searchParams.set('redirectTo', redirectTo);
      logger.info(`Redirecting unauthenticated user ${userId} to login, will redirect to: ${redirectTo}`);
      return NextResponse.redirect(loginUrl);
    }
  } catch (error) {
    logger.error('Stripe callback error:', error);
    return NextResponse.redirect(new URL('/pricing?error=callback_failed', req.url));
  }
}

