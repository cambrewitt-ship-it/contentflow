import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { requireAuth } from '@/lib/authHelpers';

// Create or update post approval
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      session_id, 
      post_id, 
      post_type, 
      approval_status, 
      client_comments,
      edited_caption 
    } = body;

    // Add detailed validation logging
    logger.debug('POST /post-approvals', {
      session_id,
      post_id,
      post_type,
      approval_status,
      client_comments,
      edited_caption,
    });

    const validStatuses = ['approved', 'rejected', 'needs_attention'];
    if (!validStatuses.includes(approval_status)) {
      logger.error('❌ Invalid approval_status:', approval_status);
      return NextResponse.json(
        { error: `Invalid approval status: ${approval_status}` },
        { status: 400 }
      );
    }

    if (!session_id || !post_id || !post_type || !approval_status) {
      logger.error('❌ Missing required fields:', {
        has_session_id: !!session_id,
        has_post_id: !!post_id,
        has_post_type: !!post_type,
        has_approval_status: !!approval_status,
      });
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    const { supabase, user } = auth;

    // Check if session exists and is not expired
    const { data: session, error: sessionError } = await supabase
      .from('client_approval_sessions')
      .select('id, client_id, expires_at')
      .eq('id', session_id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    const { data: clientCheck, error: clientError } = await supabase
      .from('clients')
      .select('id, user_id')
      .eq('id', session.client_id)
      .single();

    if (clientError) {
      logger.error('❌ Error verifying client ownership for post approvals:', clientError);
      if (clientError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Forbidden' },
          { status: 403 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to verify client ownership' },
        { status: 500 }
      );
    }

    if (!clientCheck || clientCheck.user_id !== user.id) {
      logger.warn('Forbidden post approval update attempt', {
        session_id,
        post_id,
        userId: user.id,
        sessionClientId: session.client_id
      });
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Check if session is expired
    if (new Date(session.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Session has expired' },
        { status: 410 }
      );
    }

    const tableName = post_type === 'planner_scheduled' ? 'calendar_scheduled_posts' : 'scheduled_posts';
    const { data: postRecord, error: postError } = await supabase
      .from(tableName)
      .select('id, client_id')
      .eq('id', post_id)
      .single();

    if (postError && postError.code !== 'PGRST116') {
      logger.error('❌ Error verifying post ownership:', postError);
      return NextResponse.json(
        { error: 'Failed to verify post ownership' },
        { status: 500 }
      );
    }

    if (!postRecord) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    if (postRecord.client_id !== session.client_id) {
      logger.warn('Forbidden post approval modification due to client mismatch', {
        session_id,
        post_id,
        sessionClientId: session.client_id,
        postClientId: postRecord.client_id,
        userId: user.id
      });
      return NextResponse.json(
        { error: 'Forbidden' },
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

    // Also update the post status in the same table
    const statusUpdate: any = {
      approval_status,
      updated_at: new Date().toISOString(),
    };

    if (approval_status === 'needs_attention') {
      statusUpdate.needs_attention = true;
      statusUpdate.client_feedback = client_comments;
    } else {
      statusUpdate.needs_attention = false;
      statusUpdate.client_feedback = client_comments || null; // Still save comments even for approved/rejected
    }

    const { error: statusUpdateError } = await supabase
      .from(tableName)
      .update(statusUpdate)
      .eq('id', post_id)
      .select(); // Add select to see what was updated

    if (statusUpdateError) {
      logger.error('❌ Error updating post status:', statusUpdateError);
      return NextResponse.json(
        { error: 'Failed to update post status' },
        { status: 500 }
      );
    }

    // Check if approval already exists
    const { data: existingApproval, error: checkError } = await supabase
      .from('post_approvals')
      .select('*')
      .eq('session_id', session_id)
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
          session_id,
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
    logger.error('❌ Error in post-approvals API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Get approvals for a session
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const session_id = searchParams.get('session_id');

    if (!session_id) {
      return NextResponse.json(
        { error: 'session_id is required' },
        { status: 400 }
      );
    }

    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    const { supabase } = auth;

    const { data: session, error: sessionError } = await supabase
      .from('client_approval_sessions')
      .select('id, client_id')
      .eq('id', session_id)
      .single();

    if (sessionError) {
      logger.error('❌ Error verifying approval session:', sessionError);
      if (sessionError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to verify session' },
        { status: 500 }
      );
    }

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    const { data: clientCheck, error: clientError } = await supabase
      .from('clients')
      .select('id, user_id')
      .eq('id', session.client_id)
      .single();

    if (clientError) {
      logger.error('❌ Error verifying client ownership for post approvals GET:', clientError);
      if (clientError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Forbidden' },
          { status: 403 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to verify client ownership' },
        { status: 500 }
      );
    }

    if (!clientCheck || clientCheck.user_id !== auth.user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const { data: approvals, error } = await supabase
      .from('post_approvals')
      .select('*')
      .eq('session_id', session_id)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('❌ Error fetching approvals:', error);
      return NextResponse.json(
        { error: 'Failed to fetch approvals' },
        { status: 500 }
      );
    }

    return NextResponse.json({ approvals });

  } catch (error) {
    logger.error('❌ Error in post-approvals GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
