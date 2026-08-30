import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { requireAuth } from '@/lib/authHelpers';
import { createSupabaseAdmin } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

// PATCH /api/notifications/mark-all-read — mark every unread notification
// for the current user as read.
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    const { user } = auth;

    const admin = createSupabaseAdmin();
    const { error } = await admin
      .from('agency_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('read_at', null);

    if (error) {
      logger.error('Failed to mark all notifications read:', error);
      return NextResponse.json({ success: false, error: 'Failed to update notifications' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('PATCH /api/notifications/mark-all-read error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
