import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import logger from '@/lib/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_SUPABASE_SERVICE_ROLE!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Public route - submit approval by share token (no auth required)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      share_token,
      post_id, 
      post_type, 
      approval_status, 
      client_comments,
      edited_caption 
    } = body;

    logger.debug('POST /approval-sessions/submit-approval', {
      tokenPreview: share_token?.substring(0, 8) + '...',
      post_id,
      post_type,
      approval_status,
      has_comments: !!client_comments,
      has_edited_caption: !!edited_caption,
    });

    const validStatuses = ['approved', 'rejected', 'needs_attention'];
    if (!validStatuses.includes(approval_status)) {
      logger.error('❌ Invalid approval_status:', approval_status);
      return NextResponse.json(
        { error: `Invalid approval status: ${approval_status}` },
        { status: 400 }
      );
    }

    if (!share_token || !post_id || !post_type || !approval_status) {
      logger.error('❌ Missing required fields:', {
        has_share_token: !!share_token,
        has_post_id: !!post_id,
        has_post_type: !!post_type,
        has_approval_status: !!approval_status,
      });
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get session by share token
    const { data: session, error: sessionError } = await supabase
      .from('client_approval_sessions')
      .select('id, client_id, project_id, expires_at')
      .eq('share_token', share_token)
      .single();

    if (sessionError || !session) {
      logger.error('❌ Session not found:', sessionError);
      return NextResponse.json(
        { error: 'Invalid or expired approval link' },
        { status: 404 }
      );
    }

    // Check if session is expired
    if (new Date(session.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'This approval link has expired' },
        { status: 410 }
      );
    }

    // Verify post belongs to the session's project
    const tableName = post_type === 'planner_scheduled' ? 'calendar_scheduled_posts' : 'scheduled_posts';
    const { data: postRecord, error: postError } = await supabase
      .from(tableName)
      .select('id, project_id, client_id')
      .eq('id', post_id)
      .single();

    if (postError || !postRecord) {
      logger.error('❌ Post not found:', postError);
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    // Verify post belongs to session's client
    if (postRecord.client_id !== session.client_id) {
      logger.warn('Post client mismatch', {
        postClientId: postRecord.client_id,
        sessionClientId: session.client_id
      });
      return NextResponse.json(
        { error: 'Post does not belong to this approval session' },
        { status: 403 }
      );
    }

    // Verify post belongs to session's project (if project_id is set)
    // If session.project_id is null, accept posts with null project_id
    if (session.project_id !== null && postRecord.project_id !== session.project_id) {
      logger.warn('Post project mismatch', {
        postProjectId: postRecord.project_id,
        sessionProjectId: session.project_id
      });
      return NextResponse.json(
        { error: 'Post does not belong to this approval session' },
        { status: 403 }
      );
    }
    
    if (session.project_id === null && postRecord.project_id !== null) {
      logger.warn('Post project mismatch - session has no project but post does', {
        postProjectId: postRecord.project_id,
        sessionProjectId: session.project_id
      });
      return NextResponse.json(
        { error: 'Post does not belong to this approval session' },
        { status: 403 }
      );
    }

    // Update post caption if client edited it
    if (edited_caption && edited_caption.trim() !== '') {
      const { error: captionUpdateError } = await supabase
        .from(tableName)
        .update({ 
          caption: edited_caption,
          updated_at: new Date().toISOString(),
        })
        .eq('id', post_id);

      if (captionUpdateError) {
        logger.error('❌ Error updating caption:', captionUpdateError);
        return NextResponse.json(
          { error: 'Failed to update caption' },
          { status: 500 }
        );
      }
    }

    // Update the post status in the calendar table
    const statusUpdate: any = {
      approval_status,
      updated_at: new Date().toISOString(),
    };

    if (approval_status === 'needs_attention') {
      statusUpdate.needs_attention = true;
      statusUpdate.client_feedback = client_comments;
    } else {
      statusUpdate.needs_attention = false;
      statusUpdate.client_feedback = client_comments || null;
    }

    const { error: statusUpdateError } = await supabase
      .from(tableName)
      .update(statusUpdate)
      .eq('id', post_id);

    if (statusUpdateError) {
      logger.error('❌ Error updating post status:', statusUpdateError);
      return NextResponse.json(
        { error: 'Failed to update post status' },
        { status: 500 }
      );
    }

    // Update or create post approval record
    const { data: existingApproval, error: checkError } = await supabase
      .from('post_approvals')
      .select('*')
      .eq('session_id', session.id)
      .eq('post_id', post_id)
      .eq('post_type', post_type)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      logger.error('❌ Error checking existing approval:', checkError);
      return NextResponse.json(
        { error: 'Failed to check existing approval' },
        { status: 500 }
      );
    }

    let approval;
    if (existingApproval) {
      // Update existing approval
      const { data, error } = await supabase
        .from('post_approvals')
        .update({
          approval_status,
          client_comments: client_comments || null,
          approved_at: approval_status === 'approved' ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingApproval.id)
        .select()
        .single();

      if (error) {
        logger.error('❌ Error updating approval:', error);
        return NextResponse.json(
          { error: 'Failed to update approval' },
          { status: 500 }
        );
      }

      approval = data;
    } else {
      // Create new approval
      const { data, error } = await supabase
        .from('post_approvals')
        .insert({
          session_id: session.id,
          post_id,
          post_type,
          approval_status,
          client_comments: client_comments || null,
          approved_at: approval_status === 'approved' ? new Date().toISOString() : null,
        })
        .select()
        .single();

      if (error) {
        logger.error('❌ Error creating approval:', error);
        return NextResponse.json(
          { error: 'Failed to create approval' },
          { status: 500 }
        );
      }

      approval = data;
    }

    return NextResponse.json({
      success: true,
      approval,
    });

  } catch (error) {
    logger.error('❌ Error in submit-approval API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

