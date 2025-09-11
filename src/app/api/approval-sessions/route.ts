import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
// Temporary inline types to resolve import issue
interface ClientApprovalSession {
  id: string;
  project_id: string;
  client_id: string;
  share_token: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

interface CreateSessionRequest {
  project_id: string;
  client_id: string;
  expires_in_days?: number;
  selected_post_ids?: string[];
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_SUPABASE_SERVICE_ROLE!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Create new approval session
export async function POST(request: NextRequest) {
  try {
    const body: CreateSessionRequest = await request.json();
    const { project_id, client_id, expires_in_days = 30, selected_post_ids = [] } = body;

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
      console.error('❌ Error creating approval session:', error);
      return NextResponse.json(
        { error: 'Failed to create approval session' },
        { status: 500 }
      );
    }

    // Create post approvals for selected posts only
    if (selected_post_ids.length > 0) {
      console.log(`📝 Creating post approvals for ${selected_post_ids.length} selected posts`);
      
      // Get all posts from both tables to determine their types
      const [scheduledPosts, otherScheduledPosts] = await Promise.all([
        supabase
          .from('planner_scheduled_posts')
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

      // Create post approvals for planner_scheduled_posts
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
          console.error('❌ Error creating planner post approvals:', plannerError);
        } else {
          console.log(`✅ Created ${plannerApprovals.length} planner post approvals`);
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
          console.error('❌ Error creating scheduled post approvals:', scheduledError);
        } else {
          console.log(`✅ Created ${scheduledApprovals.length} scheduled post approvals`);
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
    console.error('❌ Error in approval sessions API:', error);
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

    const { data: sessions, error } = await supabase
      .from('client_approval_sessions')
      .select('*')
      .eq('project_id', project_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching approval sessions:', error);
      return NextResponse.json(
        { error: 'Failed to fetch approval sessions' },
        { status: 500 }
      );
    }

    return NextResponse.json({ sessions });

  } catch (error) {
    console.error('❌ Error in approval sessions GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
