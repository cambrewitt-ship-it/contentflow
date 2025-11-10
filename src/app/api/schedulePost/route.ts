// src/app/api/schedulePost/route.ts
import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { createSupabaseWithToken } from '@/lib/supabaseServer';

async function getAuthorizedContext(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }) };
  }

  const token = authHeader.substring(7);
  const supabase = createSupabaseWithToken(token);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }) };
  }

  return { supabase, user };
}

async function verifyClientOwnership(
  supabase: ReturnType<typeof createSupabaseWithToken>,
  clientId: string,
  userId: string
) {
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('id, user_id')
    .eq('id', clientId)
    .single();

  if (clientError) {
    logger.error('Client ownership verification failed', clientError);
    return false;
  }

  if (!client || client.user_id !== userId) {
    logger.warn('Forbidden schedulePost access attempt - client mismatch', { clientId, userId });
    return false;
  }

  return true;
}

async function verifyProjectOwnership(
  supabase: ReturnType<typeof createSupabaseWithToken>,
  projectId: string,
  userId: string
) {
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, client_id, client:clients!inner(user_id)')
    .eq('id', projectId)
    .single();

  if (projectError) {
    logger.error('Project ownership verification failed', projectError);
    return null;
  }

  if (!project || !project.client || project.client.user_id !== userId) {
    logger.warn('Forbidden schedulePost access attempt - project mismatch', { projectId, userId });
    return null;
  }

  return project;
}

export async function POST(req: NextRequest) {
  try {
    const authContext = await getAuthorizedContext(req);
    if ('error' in authContext) {
      return authContext.error;
    }

    const { supabase, user } = authContext;
    const body = await req.json();
    const { client_id, project_id, post_id, scheduled_time, account_ids, image_url } = body ?? {};

    if (!client_id || !project_id || !post_id || !scheduled_time || !account_ids) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    // Validate account_ids is an array
    if (!Array.isArray(account_ids) || account_ids.length === 0) {
      return NextResponse.json({ success: false, error: 'account_ids must be a non-empty array' }, { status: 400 });
    }

    const ownsClient = await verifyClientOwnership(supabase, client_id, user.id);
    if (!ownsClient) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const project = await verifyProjectOwnership(supabase, project_id, user.id);
    if (!project) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    if (project.client_id !== client_id) {
      logger.warn('schedulePost mismatch between project and client', {
        projectId: project_id,
        clientId: client_id,
        userId: user.id,
      });
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('scheduled_posts')
      .insert([{
        client_id,
        project_id,
        post_id,
        scheduled_time,
        account_ids, // Store as JSONB array
        status: 'scheduled',
        image_url: image_url || null // Include image_url field
      }])
      .select('*')
      .single();

    if (error) {
      logger.error('Supabase insert error', error);
      return NextResponse.json({ success: false, error: error.message || 'DB insert failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data.id, record: data }, { status: 200 });
  } catch (err: unknown) {
    logger.error('Unexpected error in schedulePost route', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
