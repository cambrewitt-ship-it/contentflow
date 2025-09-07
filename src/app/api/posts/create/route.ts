import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { isValidImageData } from '../../../../lib/blobUpload';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;

export async function POST(request: Request) {
  try {
    const { clientId, projectId, posts, status = 'draft' } = await request.json();
    
    console.log('🚀 Creating posts:', { clientId, projectId, postsCount: posts.length, status });
    
    // Validate image URLs in posts
    for (const post of posts) {
      if (post.image_url) {
        const validation = isValidImageData(post.image_url);
        if (!validation.isValid) {
          console.error('❌ Invalid image URL in post:', post.image_url);
          return NextResponse.json(
            { error: `Invalid image URL: ${post.image_url}` },
            { status: 400 }
          );
        }
        console.log('✅ Valid image URL detected:', validation.type);
      }
    }
    
    // Create Supabase client with service role for admin access (exact same pattern as working APIs)
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    console.log('📊 About to insert posts into database...');
    
    // Create posts in the main posts table
    const { data: postsData, error: postsError } = await supabase
      .from('posts')
      .insert(
        posts.map((post: { caption: string; image_url: string; notes?: string }) => ({
          client_id: clientId,
          project_id: projectId || 'default',
          caption: post.caption,
          image_url: post.image_url, // Fixed: was expecting 'imageUrl' but getting 'image_url'
          media_type: 'image',
          status: status,
          notes: post.notes || ''
        }))
      )
      .select();
    
    if (postsError) {
      console.error('❌ Supabase error creating posts:', postsError);
      console.error('❌ Error details:', {
        code: postsError.code,
        message: postsError.message,
        details: postsError.details,
        hint: postsError.hint
      });
      throw postsError;
    }
    
    console.log('✅ Posts created successfully in posts table:', postsData);
    
    // CRITICAL STEP: Also create entries in planner_unscheduled_posts table to ensure they appear in the planner
    if (postsData && postsData.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const plannerPosts = postsData.map((post: any) => ({
        project_id: projectId || 'default',
        client_id: clientId,
        caption: post.caption,
        image_url: post.image_url, // Use the image_url from the posts table
        post_notes: post.notes || '',
        status: 'draft'
      }));
      
      const { data: plannerData, error: plannerError } = await supabase
        .from('planner_unscheduled_posts')
        .insert(plannerPosts)
        .select();
      
      if (plannerError) {
        console.error('❌ Error creating planner posts:', plannerError);
        // Don't throw here - posts were created successfully, just planner sync failed
        console.warn('⚠️ Posts created but failed to sync to planner system');
      } else {
        console.log('✅ Posts synced to planner system:', plannerData);
      }
    }
    
    return NextResponse.json({ success: true, posts: postsData });
  } catch (error) {
    console.error('💥 Error creating posts:', error);
    return NextResponse.json({ 
      error: 'Failed to create posts',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
