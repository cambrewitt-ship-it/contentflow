import logger from '@/lib/logger';
import { createSupabaseWithToken } from '@/lib/supabaseServer';

import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const supabase = createSupabaseWithToken(token);

    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: projectOwnership, error: ownershipError } = await supabase
      .from('projects')
      .select('id, client:clients!inner(user_id)')
      .eq('id', projectId)
      .single();

    if (ownershipError) {
      logger.error('Project ownership check failed:', ownershipError);
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!projectOwnership || !projectOwnership.client || projectOwnership.client.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (error) {
      logger.error('Database error:', error);
      throw error;
    }

    return NextResponse.json({ project: data });
  } catch (error) {
    logger.error('Error fetching project:', error);
    return NextResponse.json({ error: 'Failed to fetch project' });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const body = await request.json();

    // Validate projectId
    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'Project ID is required' },
        { status: 400 }
      );
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const supabase = createSupabaseWithToken(token);

    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data: projectOwnership, error: ownershipError } = await supabase
      .from('projects')
      .select('id, client:clients!inner(user_id)')
      .eq('id', projectId)
      .single();

    if (ownershipError) {
      logger.error('❌ Project ownership check failed:', ownershipError);
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    if (!projectOwnership || !projectOwnership.client || projectOwnership.client.user_id !== user.id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    // First, get the current project to merge with existing posts
    const { data: currentProject, error: fetchError } = await supabase
      .from('projects')
      .select('content_metadata')
      .eq('id', projectId)
      .single();

    if (fetchError) {
      logger.error('❌ Error fetching current project:', fetchError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch current project' },
        { status: 500 }
      );
    }

    // Merge the new post with existing posts
    const existingPosts = currentProject.content_metadata?.posts || [];
    const newPost = body.newPost;

    const updatedContentMetadata = {
      ...currentProject.content_metadata,
      posts: [...existingPosts, newPost]
    };

    // Update the project
    const { data, error } = await supabase
      .from('projects')
      .update({
        content_metadata: updatedContentMetadata,
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId)
      .select();

    if (error) {
      logger.error('❌ Supabase update error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      project: data[0]
    });

  } catch (error) {
    logger.error('❌ Unexpected error updating project:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
