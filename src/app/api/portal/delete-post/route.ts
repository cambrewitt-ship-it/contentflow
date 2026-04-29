import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import logger from '@/lib/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_SUPABASE_SERVICE_ROLE!
);

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { portal_token, post_id } = body;

    if (!portal_token || !post_id) {
      return NextResponse.json({ error: 'portal_token and post_id are required' }, { status: 400 });
    }

    // Validate portal token and get the client it belongs to
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id')
      .eq('portal_token', portal_token)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: 'Invalid portal token' }, { status: 401 });
    }

    // Fetch the post and confirm it belongs to this client
    const { data: post, error: fetchError } = await supabase
      .from('calendar_scheduled_posts')
      .select('id, client_id, late_post_id')
      .eq('id', post_id)
      .eq('client_id', client.id)
      .single();

    if (fetchError || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // If the post is scheduled in LATE, delete it there first
    if (post.late_post_id) {
      if (!process.env.LATE_API_KEY) {
        logger.error('LATE_API_KEY not configured');
        return NextResponse.json({ error: 'LATE API key not configured' }, { status: 500 });
      }

      const lateResponse = await fetch(`https://getlate.dev/api/v1/posts/${post.late_post_id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${process.env.LATE_API_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (!lateResponse.ok) {
        const errorText = await lateResponse.text();
        logger.error(`Failed to delete post ${post.late_post_id} from LATE:`, errorText);
        return NextResponse.json({ error: 'Failed to delete from LATE', details: errorText }, { status: lateResponse.status });
      }
    }

    const { error: deleteError } = await supabase
      .from('calendar_scheduled_posts')
      .delete()
      .eq('id', post_id)
      .eq('client_id', client.id);

    if (deleteError) {
      logger.error('Failed to delete post from DB:', deleteError);
      return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('Unexpected error in portal delete-post:', err);
    return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 });
  }
}
