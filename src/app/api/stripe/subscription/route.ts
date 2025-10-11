import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getUserSubscription, getBillingHistory } from '@/lib/subscriptionHelpers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(req: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
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
      return NextResponse.json({ 
        error: 'Authentication required', 
        details: 'Invalid or expired token'
      }, { status: 401 });
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

