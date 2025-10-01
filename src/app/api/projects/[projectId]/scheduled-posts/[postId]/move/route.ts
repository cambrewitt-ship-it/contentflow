import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;

// PATCH - Move scheduled post to new date
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; postId: string }> }
) {
  try {
    const { projectId, postId } = await params;
    const body = await request.json();
    
    console.log('Moving scheduled post:', postId, 'to new date:', body.newScheduledDate);
    
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    // Update the post with new date
    // Note: week_index and day_index columns don't exist in the actual table schema
    const { data, error } = await supabase
      .from('calendar_scheduled_posts')
      .update({
        scheduled_date: body.newScheduledDate,
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
    
    console.log('Post moved successfully - ID:', data?.id);
    return NextResponse.json({ post: data });
  } catch (error) {
    console.error('Error moving scheduled post:', error);
    return NextResponse.json({ error: 'Failed to move scheduled post' }, { status: 500 });
  }
}
