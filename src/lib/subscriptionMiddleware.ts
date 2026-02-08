import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

export interface Subscription {
  user_id: string;
  subscription_status: string;
  subscription_tier: string;
  max_posts_per_month: number;
  posts_used_this_month: number;
  max_ai_credits_per_month: number;
  ai_credits_used_this_month: number;
  max_clients: number;
  clients_used: number;
}

export interface SubscriptionCheckResult {
  allowed: boolean;
  subscription?: Subscription;
  error?: string;
  userId?: string;
}

// Check if user can perform social media posting
export async function checkSocialMediaPostingPermission(
  request: NextRequest
): Promise<SubscriptionCheckResult> {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        allowed: false,
        error: 'Authentication required'
      };
    }

    const token = authHeader.split(' ')[1];
    
    // Get the authenticated user using the token
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return {
        allowed: false,
        error: 'Authentication required'
      };
    }

    const userId = user.id;

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
          error: 'Social media posting is not available on the free plan. Please upgrade to post to social media.'
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
        error: 'Social media posting is not available on the free plan. Please upgrade to post to social media.'
      };
    }

    // Check if trial has expired (for no-CC trials managed by our system)
    if (subscription.subscription_tier === 'trial' && subscription.subscription_status === 'trialing') {
      const trialEndDate = subscription.current_period_end
        ? new Date(subscription.current_period_end)
        : null;

      if (trialEndDate && trialEndDate < new Date()) {
        return {
          allowed: false,
          subscription,
          error: 'Your trial has expired. Please upgrade to continue posting to social media.'
        };
      }
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
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        allowed: false,
        error: 'Authentication required'
      };
    }

    const token = authHeader.split(' ')[1];
    
    // Get the authenticated user using the token
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return {
        allowed: false,
        error: 'Authentication required'
      };
    }

    const userId = user.id;

    // Get user's purchased credits
    const { data: userProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('ai_credits_purchased')
      .eq('id', userId)
      .single();
    
    const purchasedCredits = userProfile?.ai_credits_purchased ?? 0;

    // Get user's subscription
    const { data: subscription, error } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No subscription found - check if user has purchased credits
        if (purchasedCredits >= creditsNeeded) {
          return {
            allowed: true,
            subscription: undefined,
            userId
          };
        }
        return {
          allowed: false,
          error: 'AI credits are not available without a subscription. Please sign up for a plan.',
          userId
        };
      }
      console.error('Error fetching subscription:', error);
      return {
        allowed: false,
        error: 'Failed to check subscription status',
        userId
      };
    }

    // Check if subscription is active
    if (subscription.subscription_status !== 'active' && subscription.subscription_status !== 'trialing') {
      // Even if subscription is not active, check purchased credits
      if (purchasedCredits >= creditsNeeded) {
        return {
          allowed: true,
          subscription,
          userId
        };
      }
      return {
        allowed: false,
        subscription,
        error: 'Your subscription is not active. Please update your payment method or contact support.',
        userId
      };
    }

    // Check AI credits limit
    // -1 means unlimited credits
    if (subscription.max_ai_credits_per_month === -1) {
      // Unlimited credits - always allow
      return {
        allowed: true,
        subscription,
        userId
      };
    }
    
    // Calculate total available credits: purchased + monthly remaining
    const monthlyMax = subscription.max_ai_credits_per_month;
    let monthlyRemaining = 0;
    
    if (monthlyMax === -1) {
      // Unlimited credits - always allow
      monthlyRemaining = 999999; // Large number for calculation
    } else {
      monthlyRemaining = Math.max(0, monthlyMax - subscription.ai_credits_used_this_month);
    }
    
    const totalAvailableCredits = purchasedCredits + monthlyRemaining;
    
    if (totalAvailableCredits < creditsNeeded) {
      return {
        allowed: false,
        subscription,
        error: `Insufficient AI credits. You have ${totalAvailableCredits} credits remaining (${purchasedCredits} purchased + ${monthlyRemaining} monthly) but need ${creditsNeeded}. Please purchase more credits or wait until next month.`,
        userId
      };
    }

    return {
      allowed: true,
      subscription,
      userId
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
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        allowed: false,
        error: 'Authentication required'
      };
    }

    const token = authHeader.split(' ')[1];
    
    // Get the authenticated user using the token
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return {
        allowed: false,
        error: 'Authentication required'
      };
    }

    const userId = user.id;

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
    userId: result.userId,
    error: result.error
  };
}

// Track AI credit usage
// Prioritizes purchased credits first, then monthly credits
export async function trackAICreditUsage(
  userId: string, 
  creditsUsed: number = 1,
  actionType: string = 'generate_captions',
  clientId?: string,
  metadata?: Record<string, unknown>
) {
  try {
    // First check if user has purchased credits available
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('ai_credits_purchased')
      .eq('id', userId)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('Error fetching user profile for credit tracking:', profileError);
    }

    const purchasedCredits = userProfile?.ai_credits_purchased ?? 0;
    let creditType: 'purchased' | 'monthly' = 'monthly';
    let updateError = null;

    // Prioritize purchased credits: use them first if available
    if (purchasedCredits > 0) {
      // Decrement purchased credits
      const newPurchasedCredits = Math.max(0, purchasedCredits - creditsUsed);
      
      const { error: purchaseError } = await supabaseAdmin
        .from('user_profiles')
        .update({
          ai_credits_purchased: newPurchasedCredits
        })
        .eq('id', userId);

      if (purchaseError) {
        console.error('Error decrementing purchased credits:', purchaseError);
        updateError = purchaseError;
      }
      creditType = 'purchased';
    } else {
      // No purchased credits available, use monthly credits
      const { data: subscription, error: subscriptionError } = await supabaseAdmin
        .from('subscriptions')
        .select('ai_credits_used_this_month')
        .eq('user_id', userId)
        .single();

      if (subscriptionError || !subscription) {
        console.error('Error fetching subscription for AI credit tracking:', subscriptionError);
        return;
      }

      // Increment monthly usage
      const { error: monthlyError } = await supabaseAdmin
        .from('subscriptions')
        .update({
          ai_credits_used_this_month: subscription.ai_credits_used_this_month + creditsUsed
        })
        .eq('user_id', userId);

      if (monthlyError) {
        console.error('Error tracking monthly AI credit usage:', monthlyError);
        updateError = monthlyError;
      }
    }

    // Log to ai_credit_usage table for analytics (even if there was an update error)
    try {
      await supabaseAdmin
        .from('ai_credit_usage')
        .insert({
          user_id: userId,
          credit_type: creditType,
          action_type: actionType,
          credits_used: creditsUsed,
          client_id: clientId || null,
          metadata: metadata || {}
        });
    } catch (logError) {
      // Log error but don't fail the whole operation
      console.error('Error logging to ai_credit_usage table:', logError);
    }

    if (updateError) {
      console.error('Error tracking AI credit usage:', updateError);
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
    // First get the current subscription to verify it exists and get current value
    const { data: subscription, error: fetchError } = await supabaseAdmin
      .from('subscriptions')
      .select('clients_used')
      .eq('user_id', userId)
      .single();

    if (fetchError || !subscription) {
      console.error('Error fetching subscription for client tracking:', fetchError);
      return;
    }

    // Update with increment
    const { error } = await supabaseAdmin
      .from('subscriptions')
      .update({
        clients_used: subscription.clients_used + 1
      })
      .eq('user_id', userId);

    if (error) {
      console.error('Error tracking client creation:', error);
    }
  } catch (error) {
    console.error('Error tracking client creation:', error);
  }
}

// Check if user can add more posts
export async function checkPostLimitPermission(
  request: NextRequest
): Promise<SubscriptionCheckResult> {
  return checkSocialMediaPostingPermission(request);
}

// Wrapper function for post limit checking
export async function withPostLimitCheck(
  request: NextRequest
): Promise<{ allowed: boolean; userId?: string; error?: string }> {
  const result = await checkPostLimitPermission(request);
  return {
    allowed: result.allowed,
    userId: result.subscription?.user_id,
    error: result.error
  };
}

// Track post creation
export async function trackPostCreation(userId: string) {
  try {
    // First get the current subscription to verify it exists and get current value
    const { data: subscription, error: fetchError } = await supabaseAdmin
      .from('subscriptions')
      .select('posts_used_this_month')
      .eq('user_id', userId)
      .single();

    if (fetchError || !subscription) {
      console.error('Error fetching subscription for post tracking:', fetchError);
      return;
    }

    // Update with increment
    const { error } = await supabaseAdmin
      .from('subscriptions')
      .update({
        posts_used_this_month: subscription.posts_used_this_month + 1
      })
      .eq('user_id', userId);

    if (error) {
      console.error('Error tracking post creation:', error);
    }
  } catch (error) {
    console.error('Error tracking post creation:', error);
  }
}