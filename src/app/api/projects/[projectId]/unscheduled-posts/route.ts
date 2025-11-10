import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { createSupabaseWithToken } from '@/lib/supabaseServer';

async function getAuthorizedProjectContext(request: Request, projectId: string) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const token = authHeader.substring(7);
  const supabase = createSupabaseWithToken(token);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, client:clients!inner(user_id)')
    .eq('id', projectId)
    .single();

  if (projectError) {
    logger.error('Project ownership check failed:', projectError);
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  if (!project || !project.client || project.client.user_id !== user.id) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { supabase, user };
}

// GET - Fetch all unscheduled posts for a project
export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;

    const authContext = await getAuthorizedProjectContext(request, projectId);
    if ('error' in authContext) {
      return authContext.error;
    }

    const { supabase } = authContext;
    
    const { data, error } = await supabase
      .from('calendar_unscheduled_posts')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    
    if (error) {
      logger.error('Database error:', error);
      throw error;
    }

    return NextResponse.json({ posts: data });
  } catch (error) {
    logger.error('Error fetching unscheduled posts:', error);
    return NextResponse.json({ error: 'Failed to fetch unscheduled posts' });
  }
}

// POST - Create a new unscheduled post
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const body = await request.json();

    const authContext = await getAuthorizedProjectContext(request, projectId);
    if ('error' in authContext) {
      return authContext.error;
    }

    const { supabase } = authContext;
    
    // Ensure image_url field is included in the post data
    const postData = {
      project_id: projectId,
      post_data: body.postData,
      image_url: body.postData?.image_url || null, // Extract image_url from postData
    };

    const { data, error } = await supabase
      .from('calendar_unscheduled_posts')
      .insert(postData)
      .select()
      .single();
    
    if (error) {
      logger.error('Database error:', error);
      throw error;
    }

    return NextResponse.json({ post: data });
  } catch (error) {
    logger.error('Error creating unscheduled post:', error);
    return NextResponse.json({ error: 'Failed to create unscheduled post' });
  }
}
