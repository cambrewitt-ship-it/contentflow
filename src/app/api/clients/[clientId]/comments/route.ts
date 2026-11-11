import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { requireClientOwnership } from '@/lib/authHelpers';
import { createSupabaseAdmin } from '@/lib/supabaseServer';
import { runAfterResponse } from '@/lib/analytics/store';
import { COMMENTS_SETUP_MESSAGE, isMissingTable, listComments } from '@/lib/comments/store';
import { commentsSyncedAt, refreshComments } from '@/lib/comments/sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// The client's comments inbox. GET lists stored comments (refreshing from Zernio in the
// background when stale); POST { action: "sync" } refreshes now.

type Params = { params: Promise<{ clientId: string }> };
const VIEWS = new Set(['needs_reply', 'all', 'questions', 'negative', 'ads', 'hidden', 'auto']);

export async function GET(request: NextRequest, { params }: Params) {
  const { clientId } = await params;
  const auth = await requireClientOwnership(request, clientId);
  if (auth.error) return auth.error;
  const view = request.nextUrl.searchParams.get('view') ?? 'needs_reply';

  try {
    const admin = createSupabaseAdmin();
    const comments = await listComments(admin, clientId, {
      view: (VIEWS.has(view) ? view : 'needs_reply') as 'needs_reply',
    });
    if (comments === 'missing_table') {
      return NextResponse.json({ success: true, comments: [], setupRequired: COMMENTS_SETUP_MESSAGE });
    }
    const { count: needsReply } = await admin
      .from('client_comments')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .eq('status', 'new')
      .eq('is_own', false);
    const syncedAt = await commentsSyncedAt(admin, clientId);
    runAfterResponse(async () => {
      await refreshComments(createSupabaseAdmin(), clientId);
    });
    return NextResponse.json({ success: true, comments, needsReply: needsReply ?? 0, syncedAt });
  } catch (error) {
    logger.error('GET comments error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load comments' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const { clientId } = await params;
  const auth = await requireClientOwnership(request, clientId);
  if (auth.error) return auth.error;
  try {
    const result = await refreshComments(createSupabaseAdmin(), clientId, { force: true });
    return NextResponse.json({ success: true, result });
  } catch (error) {
    if (isMissingTable(error as { code?: string })) {
      return NextResponse.json({ success: false, error: COMMENTS_SETUP_MESSAGE }, { status: 503 });
    }
    logger.error('POST comments sync error:', error);
    return NextResponse.json({ success: false, error: "Couldn't refresh comments from Zernio" }, { status: 502 });
  }
}
