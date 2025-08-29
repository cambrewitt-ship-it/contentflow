import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;

// PATCH - Confirm scheduled post (finalize date and time)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; postId: string }> }
) {
  try {
    const { projectId, postId } = await params;
    const body = await request.json();
    
    console.log('Confirming scheduled post:', postId);
    
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    // Update the post with confirmation status
    const { data, error } = await supabase
      .from('planner_scheduled_posts')
      .update({
        scheduled_date: body.scheduledDate,
        scheduled_time: body.scheduledTime,
        is_confirmed: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', postId)
      .eq('project_id', projectId)
      .select()
      .single();
    
    if (error) {
      console.error('Database error:', error);
      throw error;
    }
    
    console.log('Post confirmed successfully:', data);
    return NextResponse.json({ post: data });
  } catch (error) {
    console.error('Error confirming scheduled post:', error);
    return NextResponse.json({ error: 'Failed to confirm scheduled post' }, { status: 500 });
  }
}
