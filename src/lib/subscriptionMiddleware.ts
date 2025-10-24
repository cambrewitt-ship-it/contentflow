import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyJWT } from './auth';

// Create Supabase client with service role for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_SUPABASE_SERVICE_ROLE!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export interface SubscriptionCheckResult {
  allowed: boolean;
  subscription?: any;
  error?: string;
}

// Check if user can perform social media posting
export async function checkSocialMediaPostingPermission(
  request: NextRequest
): Promise<SubscriptionCheckResult> {
  try {
    // Verify authentication
    const authResult = await verifyJWT(request);
    if (!authResult.success) {
      return {
        allowed: false,
        error: 'Unauthorized'
      };
    }

    const userId = authResult.userId;

    // Get user's subscription
    const { data: subscription, error } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No subscription found - user is on freemium by default
        return {
          allowed: false,
          error: 'Social media posting is not available on the freemium plan. Please upgrade to post to social media.'
        };
      }
      console.error('Error fetching subscription:', error);
      return {
        allowed: false,
        error: 'Failed to check subscription status'
      };
    }

    // Check if user is on freemium tier
    if (subscription.subscription_tier === 'freemium') {
      return {
        allowed: false,
        subscription,
        error: 'Social media posting is not available on the freemium plan. Please upgrade to post to social media.'
      };
    }

    // Check if subscription is active
    if (subscription.subscription_status !== 'active' && subscription.subscription_status !== 'trialing') {
      return {
        allowed: false,
        subscription,
        error: 'Your subscription is not active. Please update your payment method or contact support.'
      };
    }

    // Check monthly post limit
    if (subscription.max_posts_per_month !== -1 && subscription.posts_used_this_month >= subscription.max_posts_per_month) {
      return {
        allowed: false,
        subscription,
        error: `You have reached your monthly post limit of ${subscription.max_posts_per_month} posts. Please upgrade your plan or wait until next month.`
      };
    }

    return {
      allowed: true,
      subscription
    };
  } catch (error) {
    console.error('Subscription check error:', error);
    return {
      allowed: false,
      error: 'Internal server error'
    };
  }
}

// Check if user can use AI credits
export async function checkAICreditsPermission(
  request: NextRequest,
  creditsNeeded: number = 1
): Promise<SubscriptionCheckResult> {
  try {
    // Verify authentication
    const authResult = await verifyJWT(request);
    if (!authResult.success) {
      return {
        allowed: false,
        error: 'Unauthorized'
      };
    }

    const userId = authResult.userId;

    // Get user's subscription
    const { data: subscription, error } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No subscription found - user is on freemium by default
        return {
          allowed: false,
          error: 'AI credits are not available without a subscription. Please sign up for a plan.'
        };
      }
      console.error('Error fetching subscription:', error);
      return {
        allowed: false,
        error: 'Failed to check subscription status'
      };
    }

    // Check if subscription is active
    if (subscription.subscription_status !== 'active' && subscription.subscription_status !== 'trialing') {
      return {
        allowed: false,
        subscription,
        error: 'Your subscription is not active. Please update your payment method or contact support.'
      };
    }

    // Check AI credits limit
    const remainingCredits = subscription.max_ai_credits_per_month - subscription.ai_credits_used_this_month;
    if (remainingCredits < creditsNeeded) {
      return {
        allowed: false,
        subscription,
        error: `Insufficient AI credits. You have ${remainingCredits} credits remaining but need ${creditsNeeded}. Please upgrade your plan or wait until next month.`
      };
    }

    return {
      allowed: true,
      subscription
    };
  } catch (error) {
    console.error('AI credits check error:', error);
    return {
      allowed: false,
      error: 'Internal server error'
    };
  }
}

// Check if user can add more clients
export async function checkClientLimitPermission(
  request: NextRequest
): Promise<SubscriptionCheckResult> {
  try {
    // Verify authentication
    const authResult = await verifyJWT(request);
    if (!authResult.success) {
      return {
        allowed: false,
        error: 'Unauthorized'
      };
    }

    const userId = authResult.userId;

    // Get user's subscription
    const { data: subscription, error } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No subscription found - user is on freemium by default
        return {
          allowed: false,
          error: 'Client management is not available without a subscription. Please sign up for a plan.'
        };
      }
      console.error('Error fetching subscription:', error);
      return {
        allowed: false,
        error: 'Failed to check subscription status'
      };
    }

    // Check if subscription is active
    if (subscription.subscription_status !== 'active' && subscription.subscription_status !== 'trialing') {
      return {
        allowed: false,
        subscription,
        error: 'Your subscription is not active. Please update your payment method or contact support.'
      };
    }

    // Check client limit
    if (subscription.max_clients !== -1 && subscription.clients_used >= subscription.max_clients) {
      return {
        allowed: false,
        subscription,
        error: `You have reached your client limit of ${subscription.max_clients} clients. Please upgrade your plan to add more clients.`
      };
    }

    return {
      allowed: true,
      subscription
    };
  } catch (error) {
    console.error('Client limit check error:', error);
    return {
      allowed: false,
      error: 'Internal server error'
    };
  }
}

// Wrapper function for AI credit checking
export async function withAICreditCheck(
  request: NextRequest,
  creditsNeeded: number = 1
): Promise<{ allowed: boolean; userId?: string; error?: string }> {
  const result = await checkAICreditsPermission(request, creditsNeeded);
  return {
    allowed: result.allowed,
    userId: result.subscription?.user_id,
    error: result.error
  };
}

// Track AI credit usage
export async function trackAICreditUsage(userId: string, creditsUsed: number = 1) {
  try {
    const { error } = await supabaseAdmin
      .from('subscriptions')
      .update({
        ai_credits_used_this_month: supabaseAdmin.raw('ai_credits_used_this_month + ?', [creditsUsed])
      })
      .eq('user_id', userId);

    if (error) {
      console.error('Error tracking AI credit usage:', error);
    }
  } catch (error) {
    console.error('Error tracking AI credit usage:', error);
  }
}

// Wrapper function for client limit checking
export async function withClientLimitCheck(
  request: NextRequest
): Promise<{ allowed: boolean; userId?: string; error?: string }> {
  const result = await checkClientLimitPermission(request);
  return {
    allowed: result.allowed,
    userId: result.subscription?.user_id,
    error: result.error
  };
}

// Track client creation
export async function trackClientCreation(userId: string) {
  try {
    const { error } = await supabaseAdmin
      .from('subscriptions')
      .update({
        clients_used: supabaseAdmin.raw('clients_used + 1')
      })
      .eq('user_id', userId);

    if (error) {
      console.error('Error tracking client creation:', error);
    }
  } catch (error) {
    console.error('Error tracking client creation:', error);
  }
}