import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { requireProjectOwnership } from '@/lib/authHelpers';

// PATCH - Confirm scheduled post (finalize date and time)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; postId: string }> }
) {
  try {
    const { projectId, postId } = await params;
    const body = await request.json();

    const auth = await requireProjectOwnership(request, projectId);
    if (auth.error) return auth.error;
    const { supabase } = auth;
    
    // Update the post with confirmation status
    const { data, error } = await supabase
      .from('calendar_scheduled_posts')
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
      logger.error('Database error:', error);
      throw error;
    }

    return NextResponse.json({ post: data });
  } catch (error) {
    logger.error('Error confirming scheduled post:', error);
    return NextResponse.json({ error: 'Failed to confirm scheduled post' });
  }
}
