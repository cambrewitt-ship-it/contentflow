import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isValidImageData } from '../../../../lib/blobUpload';

export async function POST(request: Request) {
  try {
    // Initialize Supabase inside the function to ensure env vars are loaded
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase environment variables');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const body = await request.json();
    const { projectId, post } = body;
    
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
    const { data, error } = await supabase
      .from('planner_unscheduled_posts')
      .insert({
        project_id: projectId,
        client_id: post.clientId || post.client_id,
        caption: post.caption,
        image_url: post.generatedImage,
        post_notes: post.notes || ''
      })
      .select()
      .single();
    
    if (error) {
      console.error('Database error:', error);
      throw error;
    }
    
    return NextResponse.json({ success: true, post: data });
    
  } catch (error) {
    console.error('Error adding post to project:', error);
    return NextResponse.json({ error: 'Failed to add post' }, { status: 500 });
  }
}
