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
      .from('planner_scheduled_posts')
      .select('*')
      .eq('project_id', projectId)
      .order('scheduled_date', { ascending: true });
    
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
    
    // Move from unscheduled to scheduled
    const { data: scheduled, error: scheduleError } = await supabase
      .from('planner_scheduled_posts')
      .insert(body.scheduledPost)
      .select()
      .single();
    
    if (scheduleError) throw scheduleError;
    
    // Delete from unscheduled
    const { error: deleteError } = await supabase
      .from('planner_unscheduled_posts')
      .delete()
      .eq('id', body.unscheduledId);
    
    if (deleteError) throw deleteError;
    
    return NextResponse.json({ success: true, post: scheduled });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed to schedule post' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { postId, updates } = await request.json();
    
    const { data, error } = await supabase
      .from('planner_scheduled_posts')
      .update(updates)
      .eq('id', postId);
    
    if (error) throw error;
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}
