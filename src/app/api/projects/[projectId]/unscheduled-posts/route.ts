import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;

// GET - Fetch all unscheduled posts for a project
export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    console.log('Fetching unscheduled posts for project:', projectId);
    
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    const { data, error } = await supabase
      .from('planner_unscheduled_posts')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Database error:', error);
      throw error;
    }
    
    console.log('Unscheduled posts:', data);
    return NextResponse.json({ posts: data });
  } catch (error) {
    console.error('Error fetching unscheduled posts:', error);
    return NextResponse.json({ error: 'Failed to fetch unscheduled posts' }, { status: 500 });
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
    
    console.log('Creating unscheduled post for project:', projectId);
    
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    const { data, error } = await supabase
      .from('planner_unscheduled_posts')
      .insert({
        project_id: projectId,
        post_data: body.postData
      })
      .select()
      .single();
    
    if (error) {
      console.error('Database error:', error);
      throw error;
    }
    
    console.log('Created unscheduled post:', data);
    return NextResponse.json({ post: data });
  } catch (error) {
    console.error('Error creating unscheduled post:', error);
    return NextResponse.json({ error: 'Failed to create unscheduled post' }, { status: 500 });
  }
}
