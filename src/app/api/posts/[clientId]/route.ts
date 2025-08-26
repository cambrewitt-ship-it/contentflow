import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    console.log('🔍 Fetching posts for client:', clientId);
    
    // Create Supabase client with service role for admin access (same pattern as other APIs)
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    console.log('📊 About to query posts table...');
    
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('client_id', clientId)
      .in('status', ['draft', 'ready'])
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ Supabase error:', error);
      console.error('❌ Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      throw error;
    }
    
    console.log('✅ Posts fetched:', data?.length || 0, 'posts found');
    if (data && data.length > 0) {
      console.log('📝 Sample post:', data[0]);
    }
    return NextResponse.json({ posts: data || [] });
  } catch (error) {
    console.error('💥 Error fetching posts:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch posts',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
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
