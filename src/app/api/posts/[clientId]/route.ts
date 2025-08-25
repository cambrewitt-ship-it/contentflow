import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    console.log('Fetching posts for client:', clientId);
    
    const supabase = createRouteHandlerClient({ cookies: await cookies() });
    
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('client_id', clientId)
      .eq('status', 'draft')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }
    
    console.log('Posts fetched:', data?.length || 0);
    return NextResponse.json({ posts: data || [] });
  } catch (error) {
    console.error('Error fetching posts:', error);
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { postId } = await request.json();
    const { clientId } = await params;
    
    console.log('Deleting post:', postId, 'for client:', clientId);
    
    const supabase = createRouteHandlerClient({ cookies: await cookies() });
    
    // Delete the post completely from the database
    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId)
      .eq('client_id', clientId);
    
    if (error) {
      console.error('Supabase delete error:', error);
      throw error;
    }
    
    console.log('Post deleted successfully:', postId);
    return NextResponse.json({ success: true, message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Error deleting post:', error);
    return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 });
  }
}
