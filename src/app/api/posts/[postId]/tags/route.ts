import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import logger from '@/lib/logger';
import { requireAuth } from '@/lib/authHelpers';
import { createSupabaseAdmin } from '@/lib/supabaseServer';

const addTagSchema = z.object({
  tag_id: z.string().uuid(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = await params;

    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    const supabase = auth.supabase;

    // Check if post exists in calendar_scheduled_posts (calendar posts)
    const { data: calendarPost, error: calendarError } = await supabase
      .from('calendar_scheduled_posts')
      .select('id, client_id')
      .eq('id', postId)
      .maybeSingle();

    // If not found in calendar_scheduled_posts, check posts table
    let post: any = calendarPost;
    let clientId: string | null = null;
    
    if (!post) {
      const { data: regularPost, error: regularError } = await supabase
        .from('posts')
        .select('id, client_id')
        .eq('id', postId)
        .maybeSingle();
      post = regularPost;
    }

    if (!post) {
      logger.error('Post not found', { postId, calendarError });
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    clientId = post.client_id;

    // Verify client ownership
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, user_id')
      .eq('id', clientId)
      .single();

    if (clientError || !client || client.user_id !== auth.user.id) {
      logger.error('Client ownership verification failed', { clientError, clientId, userId: auth.user.id });
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: postTags, error } = await supabase
      .from('post_tags')
      .select('tag_id, tags(*)')
      .eq('post_id', postId);

    if (error) {
      logger.error('❌ Error fetching post tags:', error);
      return NextResponse.json(
        { error: 'Failed to fetch post tags', details: error.message },
        { status: 500 }
      );
    }

    const tags = (postTags || []).map((pt: any) => ({
      id: pt.tags.id,
      name: pt.tags.name,
      color: pt.tags.color,
    }));

    return NextResponse.json({ success: true, tags });
  } catch (error) {
    logger.error('💥 Error in GET post tags route:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = await params;
    const body = await request.json();
    const parsed = addTagSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    const supabase = auth.supabase;

    // Check if post exists in calendar_scheduled_posts (calendar posts)
    const { data: calendarPost, error: calendarError } = await supabase
      .from('calendar_scheduled_posts')
      .select('id, client_id')
      .eq('id', postId)
      .maybeSingle();

    // If not found in calendar_scheduled_posts, check posts table
    let post: any = calendarPost;
    let clientId: string | null = null;
    
    if (!post) {
      const { data: regularPost, error: regularError } = await supabase
        .from('posts')
        .select('id, client_id')
        .eq('id', postId)
        .maybeSingle();
      post = regularPost;
    }

    if (!post) {
      logger.error('Post not found', { postId, calendarError });
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    clientId = post.client_id;

    // Verify client ownership
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, user_id')
      .eq('id', clientId)
      .single();

    if (clientError || !client || client.user_id !== auth.user.id) {
      logger.error('Client ownership verification failed', { clientError, clientId, userId: auth.user.id });
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { tag_id } = parsed.data;

    // Check if tag is already assigned to this post
    const { data: existing } = await supabase
      .from('post_tags')
      .select('id')
      .eq('post_id', postId)
      .eq('tag_id', tag_id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'Tag already assigned to this post' },
        { status: 409 }
      );
    }

    // Use admin client for insert since we've already verified ownership
    // This bypasses RLS which can be complex for junction tables
    const adminSupabase = createSupabaseAdmin();
    const { data: postTag, error } = await adminSupabase
      .from('post_tags')
      .insert([{ post_id: postId, tag_id }])
      .select('id, tag_id, tags(*)')
      .single();

    if (error) {
      logger.error('❌ Error adding tag to post:', error);
      return NextResponse.json(
        { error: 'Failed to add tag to post', details: error.message },
        { status: 500 }
      );
    }

    const tag = (postTag as any).tags;
    return NextResponse.json({
      success: true,
      tag: {
        id: tag.id,
        name: tag.name,
        color: tag.color,
      },
    });
  } catch (error) {
    logger.error('💥 Error in POST post tags route:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
