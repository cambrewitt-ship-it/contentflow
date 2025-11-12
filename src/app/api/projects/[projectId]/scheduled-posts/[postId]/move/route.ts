import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { requireProjectOwnership } from '@/lib/authHelpers';

// PATCH - Move scheduled post to new date
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
      logger.error('Database error:', error);
      throw error;
    }

    return NextResponse.json({ post: data });
  } catch (error) {
    logger.error('Error moving scheduled post:', error);
    return NextResponse.json({ error: 'Failed to move scheduled post' });
  }
}
