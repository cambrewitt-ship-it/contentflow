import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  getUserSubscription,
  checkSubscriptionLimit,
  incrementUsage,
} from './subscriptionHelpers';

/**
 * Middleware to check if user has an active subscription
 */
export async function requireActiveSubscription(req: NextRequest) {
  try {
    // Check for Authorization header first (Bearer token)
    const authHeader = req.headers.get('authorization');
    let user = null;
    let authError = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Use service role key to verify the token
      const token = authHeader.split(' ')[1];
      const supabaseServiceRole = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_SUPABASE_SERVICE_ROLE!
      );

      const result = await supabaseServiceRole.auth.getUser(token);
      user = result.data.user;
      authError = result.error;
    } else {
      // Fall back to cookie-based authentication
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

      const result = await supabase.auth.getUser();
      user = result.data.user;
      authError = result.error;
    }

    if (authError || !user) {
      return {
        authorized: false,
        response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      };
    }

    const subscription = await getUserSubscription(user.id);

    if (!subscription) {
      return {
        authorized: false,
        response: NextResponse.json(
          { error: 'No active subscription found' },
          { status: 403 }
        ),
      };
    }

    if (
      subscription.subscription_status !== 'active' &&
      subscription.subscription_status !== 'trialing'
    ) {
      return {
        authorized: false,
        response: NextResponse.json(
          {
            error: 'Your subscription is not active',
            status: subscription.subscription_status,
          },
          { status: 403 }
        ),
      };
    }

    return {
      authorized: true,
      user,
      subscription,
    };
  } catch (error) {
    console.error('Subscription check error:', error);
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Failed to verify subscription' },
        { status: 500 }
      ),
    };
  }
}

/**
 * Check if user can add a new client
 */
export async function canAddClient(userId: string) {
  const { allowed, current, max } = await checkSubscriptionLimit(
    userId,
    'clients'
  );

  return {
    allowed,
    current,
    max,
    message: allowed
      ? 'Client can be added'
      : `You have reached your client limit (${current}/${max}). Please upgrade your plan.`,
  };
}

/**
 * Check if user can schedule a post
 */
export async function canSchedulePost(userId: string) {
  const { allowed, current, max } = await checkSubscriptionLimit(
    userId,
    'posts'
  );

  return {
    allowed,
    current,
    max,
    message: allowed
      ? 'Post can be scheduled'
      : `You have reached your monthly post limit (${current}/${max}). Please upgrade your plan or wait for the next billing cycle.`,
  };
}

/**
 * Check if user can use AI credits
 */
export async function canUseAICredits(userId: string, creditsRequired: number = 1) {
  const { allowed, current, max } = await checkSubscriptionLimit(
    userId,
    'ai_credits'
  );

  // Check if user has enough credits for this specific request
  const hasEnoughCredits = max === -1 || current + creditsRequired <= max;

  return {
    allowed: allowed && hasEnoughCredits,
    current,
    max,
    required: creditsRequired,
    message:
      allowed && hasEnoughCredits
        ? 'AI credits available'
        : `Insufficient AI credits. You need ${creditsRequired} credits but only have ${max - current} remaining. Please upgrade your plan.`,
  };
}

/**
 * Middleware wrapper to check client limits
 */
export async function withClientLimitCheck(req: NextRequest) {
  const authCheck = await requireActiveSubscription(req);

  if (!authCheck.authorized) {
    return authCheck.response!;
  }

  const canAdd = await canAddClient(authCheck.user!.id);

  if (!canAdd.allowed) {
    return NextResponse.json(
      {
        error: canAdd.message,
        current: canAdd.current,
        max: canAdd.max,
      },
      { status: 403 }
    );
  }

  return {
    authorized: true,
    user: authCheck.user,
    subscription: authCheck.subscription,
  };
}

/**
 * Middleware wrapper to check post limits
 */
export async function withPostLimitCheck(req: NextRequest) {
  const authCheck = await requireActiveSubscription(req);

  if (!authCheck.authorized) {
    return authCheck.response!;
  }

  const canSchedule = await canSchedulePost(authCheck.user!.id);

  if (!canSchedule.allowed) {
    return NextResponse.json(
      {
        error: canSchedule.message,
        current: canSchedule.current,
        max: canSchedule.max,
      },
      { status: 403 }
    );
  }

  return {
    authorized: true,
    user: authCheck.user,
    subscription: authCheck.subscription,
  };
}

/**
 * Middleware wrapper to check AI credit limits
 */
export async function withAICreditCheck(
  req: NextRequest,
  creditsRequired: number = 1
) {
  const authCheck = await requireActiveSubscription(req);

  if (!authCheck.authorized) {
    return authCheck.response!;
  }

  const canUse = await canUseAICredits(authCheck.user!.id, creditsRequired);

  if (!canUse.allowed) {
    return NextResponse.json(
      {
        error: canUse.message,
        current: canUse.current,
        max: canUse.max,
        required: canUse.required,
      },
      { status: 403 }
    );
  }

  return {
    authorized: true,
    user: authCheck.user,
    subscription: authCheck.subscription,
  };
}

/**
 * Track client creation (increment usage)
 */
export async function trackClientCreation(userId: string) {
  try {
    await incrementUsage(userId, 'clients', 1);
    return { success: true };
  } catch (error) {
    console.error('Failed to track client creation:', error);
    return { success: false, error };
  }
}

/**
 * Track post creation (increment usage)
 */
export async function trackPostCreation(userId: string) {
  try {
    await incrementUsage(userId, 'posts', 1);
    return { success: true };
  } catch (error) {
    console.error('Failed to track post creation:', error);
    return { success: false, error };
  }
}

/**
 * Track AI credit usage (increment usage)
 */
export async function trackAICreditUsage(userId: string, credits: number = 1) {
  try {
    await incrementUsage(userId, 'ai_credits', credits);
    return { success: true };
  } catch (error) {
    console.error('Failed to track AI credit usage:', error);
    return { success: false, error };
  }
}

/**
 * Helper to get user ID from request
 */
export async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
  try {
    // Check for Authorization header first (Bearer token)
    const authHeader = req.headers.get('authorization');
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Use service role key to verify the token
      const token = authHeader.split(' ')[1];
      const supabaseServiceRole = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_SUPABASE_SERVICE_ROLE!
      );

      const { data: { user } } = await supabaseServiceRole.auth.getUser(token);
      return user?.id || null;
    } else {
      // Fall back to cookie-based authentication
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
      } = await supabase.auth.getUser();

      return user?.id || null;
    }
  } catch (error) {
    console.error('Failed to get user from request:', error);
    return null;
  }
}

