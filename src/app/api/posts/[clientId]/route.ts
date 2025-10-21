import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import logger from '@/lib/logger';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;

    // Create Supabase client with service role for admin access (exact same pattern as working APIs)
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        last_edited_by:clients!posts_last_edited_by_fkey(id, name, email)
      `)
      .eq('client_id', clientId)
      .in('status', ['draft', 'ready'])
      .order('created_at', { ascending: false });
    
    if (error) {
      logger.error('❌ Supabase error:', error);
      logger.error('❌ Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint

      throw error;
    }

    if (data && data.length > 0) {

    }
    return NextResponse.json({ posts: data || [] });
  } catch (error) {
    logger.error('💥 Error fetching posts:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch posts',
      details: error instanceof Error ? error.message : String(error)
    
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { postId } = await request.json();
    const { clientId } = await params;

    if (!postId) {
      logger.error('❌ Missing postId in request body');
      return NextResponse.json(
        { error: 'Post ID is required' },
        { status: 400 }

    }

    // Use the same Supabase client creation that works in other APIs
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Delete the post
    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId)
      .eq('client_id', clientId); // Ensure user can only delete their client's posts
    
    if (error) {
      logger.error('❌ Supabase delete error:', error);
      logger.error('❌ Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint

      return NextResponse.json(
        { error: `Database error: ${error.message}` },
        { status: 500 }

    }

    return NextResponse.json({ success: true, message: 'Post deleted successfully' });
    
  } catch (error) {
    logger.error('💥 Unexpected error in DELETE:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete post' },
      { status: 500 }

  }
}
