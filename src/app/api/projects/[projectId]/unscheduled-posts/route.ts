import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import logger from '@/lib/logger';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;

// GET - Fetch all unscheduled posts for a project
export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
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

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
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
