import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { requireAuth } from '@/lib/authHelpers';
import { createSupabaseAdmin } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

// ── DELETE: take a post back out of drafts ────────────────────────────────────
// The candidate row itself is kept (it's swipe training data) — only the drafts
// flag is cleared, which removes it from the Drafts section on the page.

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ candidateId: string }> }
) {
  try {
    const { candidateId } = await params;
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    const { user } = auth;

    const admin = createSupabaseAdmin();

    const { data: candidate } = await admin
      .from('autopilot_candidates')
      .select('*, autopilot_plans!inner(user_id)')
      .eq('id', candidateId)
      .maybeSingle();

    if (!candidate) {
      return NextResponse.json({ success: false, error: 'Draft not found' }, { status: 404 });
    }
    if ((candidate.autopilot_plans as { user_id: string } | null)?.user_id !== user.id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { error } = await admin
      .from('autopilot_candidates')
      .update({ saved_to_drafts: false, saved_to_drafts_at: null, updated_at: new Date().toISOString() })
      .eq('id', candidateId);

    if (error) {
      logger.error('DELETE /api/autopilot/drafts/[candidateId] error:', error);
      return NextResponse.json({ success: false, error: 'Failed to remove draft' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('DELETE /api/autopilot/drafts/[candidateId] error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
