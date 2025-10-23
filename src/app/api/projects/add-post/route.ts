import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isValidImageData } from '../../../../lib/blobUpload';
import logger from '@/lib/logger';

export async function POST(request: Request) {
  try {

    // Initialize Supabase inside the function to ensure env vars are loaded
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_SUPABASE_SERVICE_ROLE || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      logger.error('❌ Missing Supabase environment variables');
      return NextResponse.json({ error: 'Server configuration error' 
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const body = await request.json();
    const { projectId, post } = body;
    
    logger.debug('Adding post to project', {
      projectId,
      hasClientId: !!(post?.clientId || post?.client_id),
      hasCaption: !!post?.caption,
      hasImage: !!post?.generatedImage

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

      }

    }
    
    // Insert into calendar_unscheduled_posts

    // Get the user ID from the request headers (passed from the frontend)
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    const insertData = {
      project_id: projectId,
      client_id: post.clientId || post.client_id,
      caption: post.caption,
      image_url: post.generatedImage,
      post_notes: post.notes || '',
      approval_status: 'pending' // Set default approval status
    
    logger.debug(, {
    };

const 
    });

    $3{ data, error } = await supabase
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

      throw error;
    }

    return NextResponse.json({ success: true, post: data });
    
  } catch (error) {
    logger.error('Error adding post to project:', error);
    return NextResponse.json({ error: 'Failed to add post' 
  }
}
