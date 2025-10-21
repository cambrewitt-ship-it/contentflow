import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import logger from '@/lib/logger';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Create Supabase client with service role for admin access
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    // First verify the post exists and get basic info
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('id, client_id, caption, created_at')
      .eq('id', postId)
      .single();
    
    if (postError) {
      logger.error('❌ Error fetching post:', postError);
      if (postError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Post not found' },
          { status: 404 }

      }
      return NextResponse.json(
        { error: `Database error: ${postError.message}` },
        { status: 500 }

    }
    
    // Fetch revisions with editor information
    const { data: revisions, error: revisionsError } = await supabase
      .from('post_revisions')
      .select(`
        *,
        edited_by:clients!post_revisions_edited_by_fkey(id, name, email)
      `)
      .eq('post_id', postId)
      .order('edited_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (revisionsError) {
      logger.error('❌ Supabase revisions error:', revisionsError);
      return NextResponse.json(
        { error: `Database error: ${revisionsError.message}` },
        { status: 500 }

    }
    
    // Get total count for pagination
    const { count, error: countError } = await supabase
      .from('post_revisions')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', postId);
    
    if (countError) {
      logger.error('❌ Error getting revision count:', countError);
    }

    return NextResponse.json({ 
      revisions: revisions || [],
      totalCount: count || 0,
      hasMore: (count || 0) > offset + limit,
      post: {
        id: post.id,
        current_caption: post.caption,
        created_at: post.created_at
      }

  } catch (error) {
    logger.error('💥 Unexpected error in GET revisions:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch revisions' },
      { status: 500 }

  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = await params;
    const body = await request.json();

    const { 
      previous_caption, 
      new_caption, 
      edit_reason, 
      edited_by_user_id 
    } = body;
    
    // Validate required fields
    if (!previous_caption || !new_caption || !edited_by_user_id) {
      return NextResponse.json(
        { error: 'previous_caption, new_caption, and edited_by_user_id are required' },
        { status: 400 }

    }
    
    // Create Supabase client with service role for admin access
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    // Verify the post exists
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('id, client_id')
      .eq('id', postId)
      .single();
    
    if (postError) {
      logger.error('❌ Error fetching post for revision:', postError);
      if (postError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Post not found' },
          { status: 404 }

      }
      return NextResponse.json(
        { error: `Database error: ${postError.message}` },
        { status: 500 }

    }
    
    // Get the next revision number
    const { data: maxRevision, error: maxError } = await supabase
      .from('post_revisions')
      .select('revision_number')
      .eq('post_id', postId)
      .order('revision_number', { ascending: false })
      .limit(1)
      .single();
    
    if (maxError && maxError.code !== 'PGRST116') {
      logger.error('❌ Error getting max revision number:', maxError);
      return NextResponse.json(
        { error: `Database error: ${maxError.message}` },
        { status: 500 }

    }
    
    const nextRevisionNumber = (maxRevision?.revision_number || 0) + 1;
    
    // Create the revision
    const { data: revision, error: revisionError } = await supabase
      .from('post_revisions')
      .insert({
        post_id: postId,
        edited_by: edited_by_user_id,
        previous_caption: previous_caption,
        new_caption: new_caption,
        edit_reason: edit_reason,
        revision_number: nextRevisionNumber
      })
      .select(`
        *,
        edited_by:clients!post_revisions_edited_by_fkey(id, name, email)
      `)
      .single();
    
    if (revisionError) {
      logger.error('❌ Supabase revision creation error:', revisionError);
      return NextResponse.json(
        { error: `Database error: ${revisionError.message}` },
        { status: 500 }

    }

    return NextResponse.json({ 
      success: true, 
      revision: revision,
      message: 'Revision created successfully'

  } catch (error) {
    logger.error('💥 Unexpected error in POST revision:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create revision' },
      { status: 500 }

  }
}
