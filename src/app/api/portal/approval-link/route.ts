import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resolvePortalToken } from '@/lib/portalAuth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_SUPABASE_SERVICE_ROLE!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, postIds, expiresInDays = 30 } = body;

    if (!token) return NextResponse.json({ error: 'Token is required' }, { status: 401 });
    if (!postIds || !Array.isArray(postIds) || postIds.length === 0) {
      return NextResponse.json({ error: 'Post IDs are required' }, { status: 400 });
    }

    const resolved = await resolvePortalToken(token);
    if (!resolved) return NextResponse.json({ error: 'Invalid portal token' }, { status: 401 });
    const { clientId } = resolved;

    // Verify posts belong to this client
    const { data: posts } = await supabase
      .from('calendar_scheduled_posts')
      .select('id, project_id')
      .eq('client_id', clientId)
      .in('id', postIds);

    if (!posts || posts.length === 0) {
      return NextResponse.json({ error: 'No valid posts found' }, { status: 404 });
    }

    const validPostIds = posts.map(p => p.id);
    const projectIds = new Set(posts.map(p => p.project_id).filter(Boolean));
    const projectId = projectIds.size === 1 ? Array.from(projectIds)[0] : null;

    const share_token = crypto.randomUUID();
    const expires_at = new Date();
    expires_at.setDate(expires_at.getDate() + expiresInDays);

    const { data: session, error: sessionError } = await supabase
      .from('client_approval_sessions')
      .insert({ project_id: projectId, client_id: clientId, share_token, expires_at: expires_at.toISOString() })
      .select()
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Failed to create approval session' }, { status: 500 });
    }

    // Create post approvals
    const approvals = validPostIds.map(post_id => ({
      session_id: session.id,
      post_id,
      post_type: 'planner_scheduled',
      approval_status: 'pending',
    }));

    await supabase.from('post_approvals').insert(approvals);

    const host = request.headers.get('host');
    const protocol = host && host.includes('localhost') ? 'http' : 'https';
    const shareUrl = `${protocol}://${host}/approval/${share_token}`;

    return NextResponse.json({ session, share_url: shareUrl });
  } catch (error) {
    console.error('Portal approval link error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
