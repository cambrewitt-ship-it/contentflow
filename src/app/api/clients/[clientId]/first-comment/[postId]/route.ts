import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { requireClientOwnership } from '@/lib/authHelpers';
import { createSupabaseAdmin } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

// A calendar post's "first comment" (usually the link), posted as soon as the post
// goes live. GET / PUT { firstComment }.

type Params = { params: Promise<{ clientId: string; postId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { clientId, postId } = await params;
  const auth = await requireClientOwnership(request, clientId);
  if (auth.error) return auth.error;
  const { data, error } = await createSupabaseAdmin()
    .from('calendar_scheduled_posts')
    .select('first_comment, first_comment_posted_at')
    .eq('id', postId)
    .eq('client_id', clientId)
    .maybeSingle();
  if (error) return NextResponse.json({ success: true, firstComment: null, unavailable: true });
  return NextResponse.json({ success: true, firstComment: data?.first_comment ?? null, postedAt: data?.first_comment_posted_at ?? null });
}

export async function PUT(request: NextRequest, { params }: Params) {
  const { clientId, postId } = await params;
  const auth = await requireClientOwnership(request, clientId);
  if (auth.error) return auth.error;
  const body = await request.json().catch(() => null);
  const firstComment = typeof body?.firstComment === 'string' ? body.firstComment.trim().slice(0, 2000) : '';
  const { error } = await createSupabaseAdmin()
    .from('calendar_scheduled_posts')
    .update({ first_comment: firstComment || null, first_comment_posted_at: null })
    .eq('id', postId)
    .eq('client_id', clientId);
  if (error) {
    logger.error('Save first comment error:', error);
    return NextResponse.json(
      { success: false, error: error.code === '42703' ? 'First comments need migrations/036-comments-and-feed-checker.sql' : 'Could not save' },
      { status: 500 }
    );
  }
  return NextResponse.json({ success: true, firstComment: firstComment || null });
}
