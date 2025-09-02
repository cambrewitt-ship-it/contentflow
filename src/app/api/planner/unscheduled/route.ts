import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_SUPABASE_SERVICE_ROLE!
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  
  try {
    const { data, error } = await supabase
      .from('planner_unscheduled_posts')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return NextResponse.json({ posts: data || [] });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Ensure image_url field is included in the post data
    const postData = {
      ...body,
      image_url: body.image_url || null // Ensure image_url field is present
    };
    
    const { data, error } = await supabase
      .from('planner_unscheduled_posts')
      .insert(postData)
      .select()
      .single();
    
    if (error) throw error;
    
    return NextResponse.json({ success: true, post: data });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 });
  }
}
