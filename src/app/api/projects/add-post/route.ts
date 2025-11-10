import { NextResponse } from 'next/server';
import { isValidImageData } from '../../../../lib/blobUpload';
import logger from '@/lib/logger';
import { requireClientOwnership, requireProjectOwnership } from '@/lib/authHelpers';

export async function POST(request: Request) {
  try {

    const body = await request.json();
    const { projectId, post } = body;
    
    logger.debug('Adding post to project', {
      projectId,
      hasClientId: !!(post?.clientId || post?.client_id),
      hasCaption: !!post?.caption,
      hasImage: !!post?.generatedImage
    });

    // Validate required fields
    if (!projectId) {
      logger.error('❌ Missing projectId');
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }
    
    if (!post.clientId && !post.client_id) {
      logger.error('❌ Missing clientId');
      return NextResponse.json({ error: 'Client ID is required' }, { status: 400 });
    }
    
    if (!post.caption) {
      logger.error('❌ Missing caption');
      return NextResponse.json({ error: 'Caption is required' }, { status: 400 });
    }
    
    // Validate image URL if present
    if (post.generatedImage) {
      const validation = isValidImageData(post.generatedImage);
      if (!validation.isValid) {
        logger.error('❌ Invalid image URL in post:', post.generatedImage);
        return NextResponse.json(
          { error: `Invalid image URL: ${post.generatedImage}` },
          { status: 400 }
        );
      }
    }
    
    const projectAuth = await requireProjectOwnership(request, projectId);
    if (projectAuth.error) return projectAuth.error;

    const clientId = post.clientId || post.client_id;
    const clientAuth = await requireClientOwnership(request, clientId);
    if (clientAuth.error) return clientAuth.error;

    const supabase = clientAuth.supabase;

    const insertData = {
      project_id: projectId,
      client_id: clientId,
      caption: post.caption,
      image_url: post.generatedImage,
      post_notes: post.notes || '',
      approval_status: 'pending' // Set default approval status
    };

    logger.debug('InsertData', insertData);

    const { data, error } = await supabase
      .from('calendar_unscheduled_posts')
      .insert(insertData)
      .select()
      .single();
    
    if (error) {
      logger.error('❌ Database error:', error);
      logger.error('❌ Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      throw error;
    }

    return NextResponse.json({ success: true, post: data });
    
  } catch (error) {
    logger.error('Error adding post to project:', error);
    return NextResponse.json({ error: 'Failed to add post' });
  }
}
