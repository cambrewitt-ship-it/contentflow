import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isValidImageData } from '../../../../lib/blobUpload';

export async function POST(request: Request) {
  try {
    console.log('🚀 POST /api/projects/add-post - Request received');
    
    // Initialize Supabase inside the function to ensure env vars are loaded
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing Supabase environment variables');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const body = await request.json();
    const { projectId, post } = body;
    
    console.log('📋 Request body:', {
      projectId,
      post: {
        clientId: post?.clientId,
        caption: post?.caption?.substring(0, 50) + '...',
        generatedImage: post?.generatedImage ? 'Present' : 'Missing',
        notes: post?.notes
      }
    });
    
    // Validate required fields
    if (!projectId) {
      console.error('❌ Missing projectId');
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }
    
    if (!post.clientId && !post.client_id) {
      console.error('❌ Missing clientId');
      return NextResponse.json({ error: 'Client ID is required' }, { status: 400 });
    }
    
    if (!post.caption) {
      console.error('❌ Missing caption');
      return NextResponse.json({ error: 'Caption is required' }, { status: 400 });
    }
    
    // Validate image URL if present
    if (post.generatedImage) {
      const validation = isValidImageData(post.generatedImage);
      if (!validation.isValid) {
        console.error('❌ Invalid image URL in post:', post.generatedImage);
        return NextResponse.json(
          { error: `Invalid image URL: ${post.generatedImage}` },
          { status: 400 }
        );
      }
      console.log('✅ Valid image URL detected:', validation.type);
    }
    
    // Insert into planner_unscheduled_posts (not planner_posts)
    console.log('💾 Inserting into planner_unscheduled_posts table...');
    
    // Get the user ID from the request headers (passed from the frontend)
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    console.log('🔐 Auth context:', {
      hasAuthHeader: !!authHeader,
      hasToken: !!token,
      tokenLength: token?.length
    });

    const insertData = {
      project_id: projectId,
      client_id: post.clientId || post.client_id,
      caption: post.caption,
      image_url: post.generatedImage,
      post_notes: post.notes || '',
      approval_status: 'pending' // Set default approval status
    };
    
    console.log('📝 Insert data:', {
      project_id: insertData.project_id,
      client_id: insertData.client_id,
      caption: insertData.caption?.substring(0, 50) + '...',
      image_url: insertData.image_url ? 'Present' : 'Missing',
      post_notes: insertData.post_notes
    });
    
    const { data, error } = await supabase
      .from('planner_unscheduled_posts')
      .insert(insertData)
      .select()
      .single();
    
    if (error) {
      console.error('❌ Database error:', error);
      console.error('❌ Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      throw error;
    }
    
    console.log('✅ Successfully inserted post:', data?.id);
    return NextResponse.json({ success: true, post: data });
    
  } catch (error) {
    console.error('Error adding post to project:', error);
    return NextResponse.json({ error: 'Failed to add post' }, { status: 500 });
  }
}
