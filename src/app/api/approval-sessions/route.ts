import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { requireAuth, requireClientOwnership } from '@/lib/authHelpers';
interface CreateSessionRequest {
  project_id: string;
  client_id: string;
  expires_in_days?: number;
  selected_post_ids?: string[];
}
// Create new approval session
export async function POST(request: NextRequest) {
  try {
    const body: CreateSessionRequest = await request.json();
    const { project_id, client_id, expires_in_days = 30, selected_post_ids = [] } = body;

    if (!project_id || !client_id) {
      return NextResponse.json(
        { error: 'project_id and client_id are required' },
        { status: 400 }
      );
    }

    const clientAuth = await requireClientOwnership(request, client_id);
    if (clientAuth.error) return clientAuth.error;
    const { supabase, user } = clientAuth;

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, client_id')
      .eq('id', project_id)
      .single();

    if (projectError) {
      logger.error('❌ Error verifying project ownership:', projectError);
      if (projectError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Project not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to verify project ownership' },
        { status: 500 }
      );
    }

    if (!project || project.client_id !== client_id) {
      logger.warn('Forbidden approval session creation attempt', {
        project_id,
        client_id,
        userId: user.id
      });
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Generate unique share token
    const share_token = crypto.randomUUID();
    
    // Calculate expiration date
    const expires_at = new Date();
    expires_at.setDate(expires_at.getDate() + expires_in_days);

    const { data: session, error } = await supabase
      .from('client_approval_sessions')
      .insert({
        project_id,
        client_id,
        share_token,
        expires_at: expires_at.toISOString()
      })
      .select()
      .single();

    if (error) {
      logger.error('❌ Error creating approval session:', error);
      return NextResponse.json(
        { error: 'Failed to create approval session' },
        { status: 500 }
      );
    }

    // Create post approvals for selected posts only
    if (selected_post_ids.length > 0) {

      // Get all posts from both tables to determine their types
      const [scheduledPosts, otherScheduledPosts] = await Promise.all([
        supabase
          .from('calendar_scheduled_posts')
          .select('id')
          .eq('project_id', project_id)
          .in('id', selected_post_ids),
        supabase
          .from('scheduled_posts')
          .select('id')
          .eq('project_id', project_id)
          .in('id', selected_post_ids)
      ]);

      const scheduledPostIds = scheduledPosts.data?.map(p => p.id) || [];
      const otherScheduledPostIds = otherScheduledPosts.data?.map(p => p.id) || [];

      // Create post approvals for calendar_scheduled_posts
      if (scheduledPostIds.length > 0) {
        const plannerApprovals = scheduledPostIds.map(post_id => ({
          session_id: session.id,
          post_id,
          post_type: 'planner_scheduled',
          approval_status: 'pending'
        }));

        const { error: plannerError } = await supabase
          .from('post_approvals')
          .insert(plannerApprovals);

        if (plannerError) {
          logger.error('❌ Error creating planner post approvals:', plannerError);
        } else {

        }
      }

      // Create post approvals for scheduled_posts
      if (otherScheduledPostIds.length > 0) {
        const scheduledApprovals = otherScheduledPostIds.map(post_id => ({
          session_id: session.id,
          post_id,
          post_type: 'scheduled',
          approval_status: 'pending'
        }));

        const { error: scheduledError } = await supabase
          .from('post_approvals')
          .insert(scheduledApprovals);

        if (scheduledError) {
          logger.error('❌ Error creating scheduled post approvals:', scheduledError);
        } else {

        }
      }
    }

    // Use ngrok URL for local development, Vercel URL for production
    const baseUrl = process.env.NODE_ENV === 'development' 
      ? 'https://contentmanager.ngrok.app'
      : 'https://contentflow-v2-rnt3yo2jb-cambrewitt-6402s-projects.vercel.app';
    
    const share_url = `${baseUrl}/approval/${share_token}`;

    return NextResponse.json({
      session,
      share_url
    });
  } catch (error) {
    logger.error('❌ Error in approval sessions API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Get approval session by project_id
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const project_id = searchParams.get('project_id');

    if (!project_id) {
      return NextResponse.json(
        { error: 'project_id is required' },
        { status: 400 }
      );
    }

    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    const { supabase, user } = auth;

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, client_id')
      .eq('id', project_id)
      .single();

    if (projectError) {
      logger.error('❌ Error verifying project access:', projectError);
      if (projectError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Project not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to verify project access' },
        { status: 500 }
      );
    }

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    const { data: clientCheck, error: clientError } = await supabase
      .from('clients')
      .select('id, user_id')
      .eq('id', project.client_id)
      .single();

    if (clientError) {
      logger.error('❌ Error verifying client ownership for approval sessions:', clientError);
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
      logger.warn('Unauthorized approval session fetch attempt', {
        project_id,
        clientId: project.client_id,
        userId: user.id
      });
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const { data: sessions, error } = await supabase
      .from('client_approval_sessions')
      .select('*')
      .eq('project_id', project_id)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('❌ Error fetching approval sessions:', error);
      return NextResponse.json(
        { error: 'Failed to fetch approval sessions' },
        { status: 500 }
      );
    }

    return NextResponse.json({ sessions });

  } catch (error) {
    logger.error('❌ Error in approval sessions GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
