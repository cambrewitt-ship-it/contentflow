import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { requireClientOwnership } from '@/lib/authHelpers';
import { createSupabaseAdmin } from '@/lib/supabaseServer';
import { CommentActionError, performCommentAction } from '@/lib/comments/store';
import type { CommentAction } from '@/lib/comments/types';

export const dynamic = 'force-dynamic';

// Act on one comment: reply, private reply (DM), hide/unhide, like/unlike, delete,
// mark done / reopen. Body: { action, message? }.

type Params = { params: Promise<{ clientId: string; commentId: string }> };
const ACTIONS = new Set<CommentAction>(['reply', 'private_reply', 'hide', 'unhide', 'like', 'unlike', 'delete', 'done', 'reopen']);

export async function POST(request: NextRequest, { params }: Params) {
  const { clientId, commentId } = await params;
  const auth = await requireClientOwnership(request, clientId);
  if (auth.error) return auth.error;
  const body = await request.json().catch(() => null);
  const action = body?.action as CommentAction;
  if (!ACTIONS.has(action)) return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });

  try {
    const comment = await performCommentAction(createSupabaseAdmin(), clientId, commentId, action, {
      message: typeof body?.message === 'string' ? body.message.slice(0, 2000) : undefined,
      userId: auth.user.id,
    });
    return NextResponse.json({ success: true, comment });
  } catch (error) {
    if (error instanceof CommentActionError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    logger.error('Comment action error:', error);
    return NextResponse.json({ success: false, error: 'That didn’t work — try again' }, { status: 500 });
  }
}
