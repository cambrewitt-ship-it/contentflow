import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { isValidImageData } from '../../../../lib/blobUpload';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('🚀 Creating posts - Full request body:', JSON.stringify(body, null, 2));
    
    // Handle both array format and individual post format
    let posts, clientId, projectId, status = 'draft';
    
    if (body.posts && Array.isArray(body.posts)) {
      // Array format: { posts: [...], clientId, projectId }
      posts = body.posts;
      clientId = body.clientId;
      projectId = body.projectId;
      status = body.status || 'draft';
    } else if (body.caption && body.image_url) {
      // Individual post format: { caption, image_url, client_id, project_id, ... }
      posts = [body];
      clientId = body.client_id;
      projectId = body.project_id;
      status = body.status || 'draft';
    } else {
      throw new Error('Invalid request format - expected either posts array or individual post data');
    }
    
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
    const postsToInsert = posts.map((post: { caption: string; image_url: string; notes?: string; edit_reason?: string }) => {
      console.log('📝 Saving post with caption:', post.caption);
      return {
        client_id: clientId,
        project_id: projectId || 'default',
        caption: post.caption,
        image_url: post.image_url, // Fixed: was expecting 'imageUrl' but getting 'image_url'
        media_type: 'image',
        status: status,
        notes: post.notes || '',
        // New editing fields
        original_caption: post.caption, // Set original caption on creation
        edit_count: 0, // Start with 0 edits
        needs_reapproval: false, // New posts don't need reapproval
        approval_status: 'pending', // Default approval status
        edit_reason: post.edit_reason || null
      };
    });
    
    console.log('📝 Posts to insert into database:', JSON.stringify(postsToInsert, null, 2));
    
    const { data: postsData, error: postsError } = await supabase
      .from('posts')
      .insert(postsToInsert)
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
    
    // CRITICAL STEP: Also create entries in calendar_unscheduled_posts table to ensure they appear in the calendar
    if (postsData && postsData.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const calendarPosts = postsData.map((post: any) => ({
        project_id: projectId || 'default',
        client_id: clientId,
        caption: post.caption,
        image_url: post.image_url, // Use the image_url from the posts table
        post_notes: post.notes || '',
        status: 'draft'
      }));
      
      const { data: calendarData, error: calendarError } = await supabase
        .from('calendar_unscheduled_posts')
        .insert(calendarPosts)
        .select();
      
      if (calendarError) {
        console.error('❌ Error creating calendar posts:', calendarError);
        // Don't throw here - posts were created successfully, just calendar sync failed
        console.warn('⚠️ Posts created but failed to sync to calendar system');
      } else {
        console.log('✅ Posts synced to calendar system:', calendarData);
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
