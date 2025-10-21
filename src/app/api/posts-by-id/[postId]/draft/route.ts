import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import logger from '@/lib/logger';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;

// GET - Retrieve draft changes
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
      .select('id, client_id, draft_changes, last_modified_at')
      .eq('id', postId)
      .eq('client_id', clientId)
      .single();
    
    if (error) {
      logger.error('❌ Error fetching draft changes:', error);
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Post not found' },
          { status: 404 }

      }
      return NextResponse.json(
        { error: 'Failed to fetch draft changes' },
        { status: 500 }

    }
    
    const hasDraftChanges = post.draft_changes && Object.keys(post.draft_changes).length > 0;
    
    return NextResponse.json({
      success: true,
      hasDraftChanges,
      draftData: post.draft_changes || null,
      lastModifiedAt: post.last_modified_at

  } catch (error) {
    logger.error('💥 Unexpected error in GET draft:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to retrieve draft changes' },
      { status: 500 }

  }
}

// POST - Save draft changes
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
      draftData 
    } = body;
    
    if (!client_id || !edited_by_user_id || !draftData) {
      return NextResponse.json(
        { error: 'client_id, edited_by_user_id, and draftData are required' },
        { status: 400 }

    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    const enhancedDraftData = {
      ...draftData,
      saved_at: new Date().toISOString(),
      saved_by: edited_by_user_id
    };

const { data: updatedPost, error } = await supabase
      .from('posts')
      .update({ 
        draft_changes: enhancedDraftData,
        last_modified_at: new Date().toISOString()
      })
      .eq('id', postId)
      .eq('client_id', client_id)
      .select('id, draft_changes, last_modified_at')
      .single();
    
    if (error) {
      logger.error('❌ Error saving draft changes:', error);
      return NextResponse.json(
        { error: 'Failed to save draft changes' },
        { status: 500 }

    }

    return NextResponse.json({
      success: true,
      message: 'Draft changes saved successfully',
      draftData: updatedPost.draft_changes,
      lastModifiedAt: updatedPost.last_modified_at

  } catch (error) {
    logger.error('💥 Unexpected error in POST draft:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save draft changes' },
      { status: 500 }

  }
}

// DELETE - Clear draft changes
export async function DELETE(
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
    
    const { error } = await supabase
      .from('posts')
      .update({ draft_changes: {} })
      .eq('id', postId)
      .eq('client_id', clientId);
    
    if (error) {
      logger.error('❌ Error clearing draft changes:', error);
      return NextResponse.json(
        { error: 'Failed to clear draft changes' },
        { status: 500 }

    }

    return NextResponse.json({
      success: true,
      message: 'Draft changes cleared successfully'

  } catch (error) {
    logger.error('💥 Unexpected error in DELETE draft:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to clear draft changes' },
      { status: 500 }

  }
}
