import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resolvePortalToken } from '@/lib/portalAuth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_SUPABASE_SERVICE_ROLE!
);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const postId = searchParams.get('postId');

  if (!token || !postId) {
    return NextResponse.json({ error: 'token and postId are required' }, { status: 400 });
  }

  const resolved = await resolvePortalToken(token);
  if (!resolved) {
    return NextResponse.json({ error: 'Invalid portal token' }, { status: 401 });
  }

  const { clientId } = resolved;

  // Verify the post belongs to this client before returning history
  const { data: post, error: postError } = await supabase
    .from('calendar_scheduled_posts')
    .select('id')
    .eq('id', postId)
    .eq('client_id', clientId)
    .single();

  if (postError || !post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  const { data: history, error } = await supabase
    .from('post_approval_history')
    .select('id, changed_at, changed_by, previous_approval_status, new_approval_status, previous_client_feedback, new_client_feedback')
    .eq('post_id', postId)
    .order('changed_at', { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }

  return NextResponse.json({ history: history ?? [] });
}
