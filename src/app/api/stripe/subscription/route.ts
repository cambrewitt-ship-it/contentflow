import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getUserSubscription, getBillingHistory } from '@/lib/subscriptionHelpers';

export async function GET(req: NextRequest) {
  try {
    // Get user from session
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
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's subscription and billing history
    const subscription = await getUserSubscription(user.id);
    const billingHistory = subscription
      ? await getBillingHistory(user.id)
      : [];

    return NextResponse.json({
      subscription,
      billingHistory,
    });
  } catch (error) {
    console.error('Get subscription error:', error);
    return NextResponse.json(
      { error: 'Failed to get subscription' },
      { status: 500 }
    );
  }
}

