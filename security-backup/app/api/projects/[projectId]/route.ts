import logger from '@/lib/logger';

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
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
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    const body = await request.json()

    // Validate projectId
    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'Project ID is required' },
        { status: 400 }
      )
    }

    // Validate environment variables
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      logger.error('❌ Missing environment variables:', {
        supabaseUrl: !!supabaseUrl,
        supabaseServiceRoleKey: !!supabaseServiceRoleKey
      })
      return NextResponse.json(
        { success: false, error: 'Database configuration error' },
        { status: 500 }
      )
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    // First, get the current project to merge with existing posts
    const { data: currentProject, error: fetchError } = await supabase
      .from('projects')
      .select('content_metadata')
      .eq('id', projectId)
      .single()

    if (fetchError) {
      logger.error('❌ Error fetching current project:', fetchError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch current project' },
        { status: 500 }
      )
    }

    // Merge the new post with existing posts
    const existingPosts = currentProject.content_metadata?.posts || []
    const newPost = body.newPost
    
    const updatedContentMetadata = {
      ...currentProject.content_metadata,
      posts: [...existingPosts, newPost]
    }

    // Update the project
    const { data, error } = await supabase
      .from('projects')
      .update({
        content_metadata: updatedContentMetadata,
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId)
      .select()

    if (error) {
      logger.error('❌ Supabase update error:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      project: data[0]
    })

  } catch (error) {
    logger.error('❌ Unexpected error updating project:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
