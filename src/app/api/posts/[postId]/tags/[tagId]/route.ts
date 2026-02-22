import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { requireAuth } from '@/lib/authHelpers';
import { createSupabaseAdmin } from '@/lib/supabaseServer';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string; tagId: string }> }
) {
  try {
    const { postId, tagId } = await params;

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

    // Use admin client for delete since we've already verified ownership
    // This bypasses RLS which can be complex for junction tables
    const adminSupabase = createSupabaseAdmin();
    const { error } = await adminSupabase
      .from('post_tags')
      .delete()
      .eq('post_id', postId)
      .eq('tag_id', tagId);

    if (error) {
      logger.error('❌ Error removing tag from post:', error);
      return NextResponse.json(
        { error: 'Failed to remove tag from post', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('💥 Error in DELETE post tag route:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
