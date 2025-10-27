import { NextRequest, NextResponse } from 'next/server';
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

export async function POST(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    
    // Get the authenticated user using the token
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userId = user.id;

    // Check if user already has a subscription
    const { data: existingSubscription, error: fetchError } = await supabaseAdmin
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
    const { data: subscription, error: createError } = await supabaseAdmin
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
