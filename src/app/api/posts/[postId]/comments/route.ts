import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import logger from '@/lib/logger';
import { resolvePortalToken } from '@/lib/portalAuth';
import { requireAuth } from '@/lib/authHelpers';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_SUPABASE_SERVICE_ROLE!
);

const AddCommentSchema = z.object({
  portal_token: z.string().uuid().optional(),
  author_name: z.string().min(1).max(200),
  content: z.string().min(1).max(5000),
  post_type: z.enum(['scheduled', 'calendar_scheduled']).default('calendar_scheduled'),
});

// GET /api/posts/[postId]/comments
// Fetches thread. Accessible by agency or portal party.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = await params;
    const { searchParams } = new URL(request.url);
    const portalToken = searchParams.get('portal_token');
    const postType = searchParams.get('post_type') ?? 'calendar_scheduled';

    let clientId: string | null = null;

    if (portalToken) {
      const resolved = await resolvePortalToken(portalToken);
      if (!resolved) {
        return NextResponse.json({ error: 'Invalid portal token' }, { status: 401 });
      }
      clientId = resolved.clientId;
    } else {
      const auth = await requireAuth(request);
      if (auth.error) return auth.error;
      const { supabase, user } = auth;

      const postTable = postType === 'calendar_scheduled' ? 'calendar_scheduled_posts' : 'scheduled_posts';
      const { data: post } = await supabase
        .from(postTable)
        .select('client_id')
        .eq('id', postId)
        .maybeSingle();

      if (!post) {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 });
      }

      const { data: clientCheck } = await supabase
        .from('clients')
        .select('id')
        .eq('id', post.client_id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!clientCheck) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const { data: comments, error } = await supabaseAdmin
      .from('post_comments')
      .select(`
        id,
        author_name,
        author_type,
        content,
        created_at,
        party:party_id (
          id,
          name,
          role,
          color
        )
      `)
      .eq('post_id', postId)
      .eq('post_type', postType)
      .order('created_at', { ascending: true });

    if (error) {
      logger.error('Error fetching post comments:', error);
      return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
    }

    return NextResponse.json({ comments: comments ?? [] });
  } catch (error) {
    logger.error('Comments GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/posts/[postId]/comments
// Adds a comment. Can come from agency (Bearer) or portal party (portal_token in body).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = await params;
    const body = await request.json();
    const parsed = AddCommentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { portal_token, author_name, content, post_type } = parsed.data;

    let partyId: string | null = null;
    let userId: string | null = null;
    let authorType: 'agency' | 'portal_party';

    if (portal_token) {
      // Portal party comment
      const resolved = await resolvePortalToken(portal_token);
      if (!resolved) {
        return NextResponse.json({ error: 'Invalid portal token' }, { status: 401 });
      }
      partyId = resolved.party?.id ?? null;
      authorType = 'portal_party';

      // Verify post belongs to client
      const postTable = post_type === 'calendar_scheduled' ? 'calendar_scheduled_posts' : 'scheduled_posts';
      const { data: post } = await supabaseAdmin
        .from(postTable)
        .select('client_id')
        .eq('id', postId)
        .maybeSingle();

      if (!post || post.client_id !== resolved.clientId) {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 });
      }
    } else {
      // Agency comment
      const auth = await requireAuth(request);
      if (auth.error) return auth.error;
      const { supabase, user } = auth;

      userId = user.id;
      authorType = 'agency';

      const postTable = post_type === 'calendar_scheduled' ? 'calendar_scheduled_posts' : 'scheduled_posts';
      const { data: post } = await supabase
        .from(postTable)
        .select('client_id')
        .eq('id', postId)
        .maybeSingle();

      if (!post) {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 });
      }

      const { data: clientCheck } = await supabase
        .from('clients')
        .select('id')
        .eq('id', post.client_id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!clientCheck) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const { data: comment, error } = await supabaseAdmin
      .from('post_comments')
      .insert({
        post_id: postId,
        post_type,
        party_id: partyId,
        user_id: userId,
        author_name,
        author_type: authorType,
        content,
      })
      .select(`
        id,
        author_name,
        author_type,
        content,
        created_at,
        party:party_id (
          id,
          name,
          role,
          color
        )
      `)
      .single();

    if (error) {
      logger.error('Error creating comment:', error);
      return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });
    }

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    logger.error('Comments POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
