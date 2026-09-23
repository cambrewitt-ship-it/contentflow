import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { requireAuth, requireClientOwnership } from '@/lib/authHelpers';
import { createSupabaseAdmin } from '@/lib/supabaseServer';
import { ApprovalSessionError, buildApprovalShareUrl, createApprovalSession } from '@/lib/approvalSessions';
interface CreateSessionRequest {
  client_id: string;
  expires_in_days?: number;
  selected_post_ids?: string[];
}
// Create new approval session
export async function POST(request: NextRequest) {
  try {
    const body: CreateSessionRequest = await request.json();
    const { client_id, expires_in_days = 30, selected_post_ids = [] } = body;

    if (!client_id) {
      return NextResponse.json(
        { error: 'client_id is required' },
        { status: 400 }
      );
    }

    const clientAuth = await requireClientOwnership(request, client_id);
    if (clientAuth.error) return clientAuth.error;

    // Same session shape as the portal's One-time Link (see src/lib/approvalSessions.ts)
    const session = await createApprovalSession(createSupabaseAdmin(), {
      clientId: client_id,
      postIds: selected_post_ids,
      expiresInDays: expires_in_days,
    });

    return NextResponse.json({
      session,
      share_url: buildApprovalShareUrl(request, session.share_token),
    });
  } catch (error) {
    if (error instanceof ApprovalSessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
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
