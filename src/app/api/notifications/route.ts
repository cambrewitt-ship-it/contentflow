import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { requireAuth } from '@/lib/authHelpers';
import { createSupabaseAdmin } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

// GET /api/notifications — list the current user's in-app notifications,
// newest first. ?unreadOnly=true filters to unread. ?limit caps result count
// (default 30, max 100).
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    const { user } = auth;

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 30));

    const admin = createSupabaseAdmin();
    let query = admin
      .from('agency_notifications')
      .select('id, client_id, type, title, body, link, metadata, read_at, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (unreadOnly) query = query.is('read_at', null);

    const { data, error } = await query;
    if (error) {
      logger.error('Failed to fetch notifications:', error);
      return NextResponse.json({ success: false, error: 'Failed to fetch notifications' }, { status: 500 });
    }

    const { count: unreadCount } = await admin
      .from('agency_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('read_at', null);

    return NextResponse.json({ success: true, notifications: data ?? [], unreadCount: unreadCount ?? 0 });
  } catch (error) {
    logger.error('GET /api/notifications error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
