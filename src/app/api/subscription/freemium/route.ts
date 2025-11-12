import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/authHelpers';

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

    // Create freemium subscription
    const { data: subscription, error: createError } = await supabase
      .from('subscriptions')
      .insert({
        user_id: userId,
        stripe_customer_id: `freemium_${userId}`, // Unique identifier for freemium users
        stripe_subscription_id: null,
        stripe_price_id: null,
        subscription_tier: 'freemium',
        subscription_status: 'active',
        max_clients: 1,
        max_posts_per_month: 0, // No social media posting
        max_ai_credits_per_month: 10,
        clients_used: 0,
        posts_used_this_month: 0,
        ai_credits_used_this_month: 0,
        usage_reset_date: new Date().toISOString(),
        metadata: {
          created_via: 'freemium_signup',
          created_at: new Date().toISOString(),
        },
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating freemium subscription:', createError);
      return NextResponse.json(
        { error: 'Failed to create freemium subscription' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      subscription: {
        id: subscription.id,
        tier: subscription.subscription_tier,
        status: subscription.subscription_status,
        maxClients: subscription.max_clients,
        maxPostsPerMonth: subscription.max_posts_per_month,
        maxAICreditsPerMonth: subscription.max_ai_credits_per_month,
      },
    });
  } catch (error) {
    console.error('Freemium subscription error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
