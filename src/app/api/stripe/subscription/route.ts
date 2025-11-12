import { NextRequest, NextResponse } from 'next/server';
import { getUserSubscription, getBillingHistory } from '@/lib/subscriptionHelpers';
import logger from '@/lib/logger';
import { requireAuth } from '@/lib/authHelpers';

// Force dynamic rendering - prevents static generation at build time
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (auth.error) return auth.error;
    const { user } = auth;

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
    logger.error('Get subscription error:', error);
    return NextResponse.json(
      { error: 'Failed to get subscription' },
      { status: 500 }
    );
  }
}
