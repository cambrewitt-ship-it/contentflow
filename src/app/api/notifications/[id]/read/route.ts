import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { requireAuth } from '@/lib/authHelpers';
import { createSupabaseAdmin } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

// PATCH /api/notifications/[id]/read — mark one notification as read.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    const { user } = auth;

    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from('agency_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id')
      .maybeSingle();

    if (error) {
      logger.error('Failed to mark notification read:', error);
      return NextResponse.json({ success: false, error: 'Failed to update notification' }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ success: false, error: 'Notification not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('PATCH /api/notifications/[id]/read error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
