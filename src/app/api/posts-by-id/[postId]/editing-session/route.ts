import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import logger from '@/lib/logger';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;

// POST - Start editing session
export async function POST(
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = await params;
    const body = await request.json();
    
    const { 
      client_id, 
      edited_by_user_id,
      force_start = false
    } = body;
    
    if (!client_id || !edited_by_user_id) {
      return NextResponse.json(
        { error: 'client_id and edited_by_user_id are required' },
        { status: 400 }

    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    // Get current post status
    const { data: currentPost, error: fetchError } = await supabase
      .from('posts')
      .select(`
        id, client_id, status, currently_editing_by, editing_started_at,
        currently_editing_by_user:clients!posts_currently_editing_by_fkey(id, name, email)
      `)
      .eq('id', postId)
      .single();
    
    if (fetchError) {
      logger.error('❌ Error fetching post for editing session:', fetchError);
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Post not found' },
          { status: 404 }

      }
      return NextResponse.json(
        { error: 'Failed to fetch post' },
        { status: 500 }

    }
    
    // Verify authorization
    if (currentPost.client_id !== client_id) {
      return NextResponse.json(
        { error: 'Unauthorized: Post does not belong to this client' },
        { status: 403 }

    }
    
    // Check if post can be edited
    if (!['draft', 'ready', 'scheduled'].includes(currentPost.status)) {
      return NextResponse.json(
        { 
          error: 'Cannot start editing session for this post status',
          currentStatus: currentPost.status
        },
        { status: 400 }

    }
    
    // Check for concurrent editing
    const now = new Date();
    const editingTimeout = 30 * 60 * 1000; // 30 minutes
    const isCurrentlyBeingEdited = currentPost.currently_editing_by && 
      currentPost.editing_started_at && 
      (now.getTime() - new Date(currentPost.editing_started_at).getTime()) < editingTimeout;
    
    if (isCurrentlyBeingEdited && currentPost.currently_editing_by !== edited_by_user_id && !force_start) {
      return NextResponse.json(
        { 
          error: 'Post is currently being edited by another user',
          currentlyEditingBy: currentPost.currently_editing_by_user,
          editingStartedAt: currentPost.editing_started_at,
          canForceStart: true,
          message: 'Use force_start=true to override the current session'
        },
        { status: 409 }

    }
    
    // Start editing session
    const { data: updatedPost, error: updateError } = await supabase
      .from('posts')
      .update({
        currently_editing_by: edited_by_user_id,
        editing_started_at: now.toISOString(),
        last_modified_at: now.toISOString()
      })
      .eq('id', postId)
      .eq('client_id', client_id)
      .select(`
        id, currently_editing_by, editing_started_at, last_modified_at,
        currently_editing_by_user:clients!posts_currently_editing_by_fkey(id, name, email)
      `)
      .single();
    
    if (updateError) {
      logger.error('❌ Error starting editing session:', updateError);
      return NextResponse.json(
        { error: 'Failed to start editing session' },
        { status: 500 }

    }

    return NextResponse.json({
      success: true,
      message: 'Editing session started successfully',
      editingSession: {
        postId: updatedPost.id,
        currentlyEditingBy: updatedPost.currently_editing_by_user,
        editingStartedAt: updatedPost.editing_started_at,
        lastModifiedAt: updatedPost.last_modified_at
      }

  } catch (error) {
    logger.error('💥 Unexpected error in POST editing session:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start editing session' },
      { status: 500 }

  }
}

// DELETE - End editing session
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = await params;
    const body = await request.json();
    
    const { 
      client_id, 
      edited_by_user_id,
      force_end = false
    } = body;
    
    if (!client_id || !edited_by_user_id) {
      return NextResponse.json(
        { error: 'client_id and edited_by_user_id are required' },
        { status: 400 }

    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    // Get current editing status
    const { data: currentPost, error: fetchError } = await supabase
      .from('posts')
      .select('id, client_id, currently_editing_by, editing_started_at')
      .eq('id', postId)
      .single();
    
    if (fetchError) {
      logger.error('❌ Error fetching post for ending session:', fetchError);
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Post not found' },
          { status: 404 }

      }
      return NextResponse.json(
        { error: 'Failed to fetch post' },
        { status: 500 }

    }
    
    // Verify authorization
    if (currentPost.client_id !== client_id) {
      return NextResponse.json(
        { error: 'Unauthorized: Post does not belong to this client' },
        { status: 403 }

    }
    
    // Check if user can end this session
    if (currentPost.currently_editing_by !== edited_by_user_id && !force_end) {
      return NextResponse.json(
        { 
          error: 'Cannot end editing session started by another user',
          currentlyEditingBy: currentPost.currently_editing_by,
          canForceEnd: true,
          message: 'Use force_end=true to force end the session'
        },
        { status: 403 }

    }
    
    // End editing session
    const { error: updateError } = await supabase
      .from('posts')
      .update({
        currently_editing_by: null,
        editing_started_at: null
      })
      .eq('id', postId)
      .eq('client_id', client_id);
    
    if (updateError) {
      logger.error('❌ Error ending editing session:', updateError);
      return NextResponse.json(
        { error: 'Failed to end editing session' },
        { status: 500 }

    }

    return NextResponse.json({
      success: true,
      message: 'Editing session ended successfully'

  } catch (error) {
    logger.error('💥 Unexpected error in DELETE editing session:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to end editing session' },
      { status: 500 }

  }
}

// GET - Check editing session status
export async function GET(
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = await params;
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('client_id');
    
    if (!clientId) {
      return NextResponse.json(
        { error: 'client_id is required' },
        { status: 400 }

    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    const { data: post, error } = await supabase
      .from('posts')
      .select(`
        id, client_id, status, currently_editing_by, editing_started_at, last_modified_at,
        currently_editing_by_user:clients!posts_currently_editing_by_fkey(id, name, email)
      `)
      .eq('id', postId)
      .eq('client_id', clientId)
      .single();
    
    if (error) {
      logger.error('❌ Error checking editing session status:', error);
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Post not found' },
          { status: 404 }

      }
      return NextResponse.json(
        { error: 'Failed to check editing session status' },
        { status: 500 }

    }
    
    const now = new Date();
    const editingTimeout = 30 * 60 * 1000; // 30 minutes
    const isCurrentlyBeingEdited = post.currently_editing_by && 
      post.editing_started_at && 
      (now.getTime() - new Date(post.editing_started_at).getTime()) < editingTimeout;
    
    return NextResponse.json({
      success: true,
      editingSession: {
        isActive: isCurrentlyBeingEdited,
        currentlyEditingBy: isCurrentlyBeingEdited ? post.currently_editing_by_user : null,
        editingStartedAt: post.editing_started_at,
        lastModifiedAt: post.last_modified_at,
        canEdit: ['draft', 'ready', 'scheduled'].includes(post.status),
        status: post.status
      }

  } catch (error) {
    logger.error('💥 Unexpected error in GET editing session:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to check editing session status' },
      { status: 500 }

  }
}
