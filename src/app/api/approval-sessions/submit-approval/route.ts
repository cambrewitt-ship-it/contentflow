import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import logger from '@/lib/logger';
import { commentPostTypeFor, type ApprovalPostType } from '@/lib/approvalSessions';

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

    // Get session by share token (include client name for comment author)
    const { data: session, error: sessionError } = await supabase
      .from('client_approval_sessions')
      .select('id, client_id, expires_at, clients(name)')
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

    // The session's post_approvals rows are the source of truth for which posts a link covers
    const { data: sessionApproval, error: membershipError } = await supabase
      .from('post_approvals')
      .select('id')
      .eq('session_id', session.id)
      .eq('post_id', post_id)
      .eq('post_type', post_type)
      .maybeSingle();

    if (membershipError) {
      logger.error('❌ Error checking session membership:', membershipError);
      return NextResponse.json({ error: 'Failed to verify approval link' }, { status: 500 });
    }
    if (!sessionApproval) {
      return NextResponse.json({ error: 'Post does not belong to this approval session' }, { status: 403 });
    }

    const isPost = post_type !== 'portal_upload';
    let previousStatus: { approval_status: string | null; client_feedback: string | null } | null = null;

    // Look up the post in the right table
    if (post_type === 'portal_upload') {
      const { data: uploadRecord, error: uploadError } = await supabase
        .from('client_uploads')
        .select('id, client_id')
        .eq('id', post_id)
        .single();

      if (uploadError || !uploadRecord) {
        logger.error('❌ Upload not found:', uploadError);
        return NextResponse.json({ error: 'Post not found' }, { status: 404 });
      }

      if (uploadRecord.client_id !== session.client_id) {
        return NextResponse.json({ error: 'Post does not belong to this approval session' }, { status: 403 });
      }

      // Update notes if client edited caption
      if (edited_caption && edited_caption.trim() !== '') {
        await supabase
          .from('client_uploads')
          .update({ notes: edited_caption, updated_at: new Date().toISOString() })
          .eq('id', post_id);
      }
    } else {
      const tableName = post_type === 'planner_scheduled' ? 'calendar_scheduled_posts' : 'scheduled_posts';
      const { data: postRecord, error: postError } = await supabase
        .from(tableName)
        .select('id, client_id, approval_status, client_feedback')
        .eq('id', post_id)
        .single();

      if (postError || !postRecord) {
        logger.error('❌ Post not found:', postError);
        return NextResponse.json({ error: 'Post not found' }, { status: 404 });
      }

      if (postRecord.client_id !== session.client_id) {
        return NextResponse.json({ error: 'Post does not belong to this approval session' }, { status: 403 });
      }

      previousStatus = {
        approval_status: postRecord.approval_status ?? null,
        client_feedback: postRecord.client_feedback ?? null,
      };

      // Update post caption if client edited it
      if (edited_caption && edited_caption.trim() !== '') {
        const { error: captionUpdateError } = await supabase
          .from(tableName)
          .update({ caption: edited_caption, updated_at: new Date().toISOString() })
          .eq('id', post_id);

        if (captionUpdateError) {
          logger.error('❌ Error updating caption:', captionUpdateError);
          return NextResponse.json({ error: 'Failed to update caption' }, { status: 500 });
        }
      }

      // Update the post status in the calendar table
      const statusUpdate: any = {
        approval_status,
        updated_at: new Date().toISOString(),
        needs_attention: approval_status === 'needs_attention',
        client_feedback: client_comments || null,
      };

      const { error: statusUpdateError } = await supabase
        .from(tableName)
        .update(statusUpdate)
        .eq('id', post_id);

      if (statusUpdateError) {
        logger.error('❌ Error updating post status:', statusUpdateError);
        return NextResponse.json({ error: 'Failed to update post status' }, { status: 500 });
      }
    }

    const { data: approval, error: approvalError } = await supabase
      .from('post_approvals')
      .update({
        approval_status,
        client_comments: client_comments || null,
        approved_at: approval_status === 'approved' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionApproval.id)
      .select()
      .single();

    if (approvalError) {
      logger.error('❌ Error updating approval:', approvalError);
      return NextResponse.json(
        { error: 'Failed to update approval' },
        { status: 500 }
      );
    }

    // Same history trail as approvals made inside the portal
    if (isPost) {
      const { error: historyError } = await supabase
        .from('post_approval_history')
        .insert({
          post_id,
          changed_by: 'approval_link',
          previous_approval_status: previousStatus?.approval_status ?? null,
          new_approval_status: approval_status,
          previous_client_feedback: previousStatus?.client_feedback ?? null,
          new_client_feedback: client_comments || null,
          metadata: { session_id: session.id, post_type },
        });
      if (historyError) logger.warn('Failed to write approval history', historyError);
    }

    // Write client_comments into the post_comments thread so they appear in the portal modal
    if (client_comments && client_comments.trim()) {
      const commentPostType = commentPostTypeFor(post_type as ApprovalPostType);

      const clientName =
        (session as any).clients?.name ?? 'Client';

      await supabase
        .from('post_comments')
        .insert({
          post_id,
          post_type: commentPostType,
          party_id: null,
          user_id: null,
          author_name: clientName,
          author_type: 'portal_party',
          content: client_comments.trim(),
        });
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

