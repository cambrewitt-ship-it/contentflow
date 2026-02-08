import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/authHelpers';

const TRIAL_DURATION_DAYS = 14;

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    const { supabase, user } = auth;

    const userId = user.id;

    // Check if user already has a subscription
    const { data: existingSubscription, error: fetchError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching existing subscription:', fetchError);
      return NextResponse.json(
        { error: 'Failed to check existing subscription' },
        { status: 500 }
      );
    }

    // If user already has a subscription, return error
    if (existingSubscription) {
      return NextResponse.json(
        { error: 'User already has an active subscription' },
        { status: 400 }
      );
    }

    // Calculate trial end date
    const trialStartDate = new Date();
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + TRIAL_DURATION_DAYS);

    // Create trial subscription with professional-tier limits
    const { data: subscription, error: createError } = await supabase
      .from('subscriptions')
      .insert({
        user_id: userId,
        stripe_customer_id: `trial_${userId}`, // Placeholder until they upgrade
        stripe_subscription_id: null,
        stripe_price_id: null,
        subscription_tier: 'trial',
        subscription_status: 'trialing',
        current_period_start: trialStartDate.toISOString(),
        current_period_end: trialEndDate.toISOString(),
        max_clients: 5, // Professional tier limits
        max_posts_per_month: 150,
        max_ai_credits_per_month: 500,
        clients_used: 0,
        posts_used_this_month: 0,
        ai_credits_used_this_month: 0,
        usage_reset_date: trialStartDate.toISOString(),
        metadata: {
          created_via: 'trial_signup',
          created_at: trialStartDate.toISOString(),
          trial_type: '14_day_no_cc',
          trial_duration_days: TRIAL_DURATION_DAYS,
        },
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating trial subscription:', createError);
      return NextResponse.json(
        { error: 'Failed to create trial subscription' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      subscription: {
        id: subscription.id,
        tier: subscription.subscription_tier,
        status: subscription.subscription_status,
        trialEndsAt: trialEndDate.toISOString(),
        maxClients: subscription.max_clients,
        maxPostsPerMonth: subscription.max_posts_per_month,
        maxAICreditsPerMonth: subscription.max_ai_credits_per_month,
      },
    });
  } catch (error) {
    console.error('Trial subscription error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
