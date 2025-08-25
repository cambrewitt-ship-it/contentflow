import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { clientId, projectId, posts, status = 'draft' } = await request.json();
    
    console.log('🚀 Creating posts:', { clientId, projectId, postsCount: posts.length, status });
    
    const supabase = createRouteHandlerClient({ cookies });
    
    console.log('📊 About to insert posts into database...');
    
    const { data, error } = await supabase
      .from('posts')
      .insert(
        posts.map((post: any) => ({
          client_id: clientId,
          project_id: projectId || 'default',
          caption: post.caption,
          image_url: post.imageUrl,
          media_type: 'image',
          status: status,
          notes: post.notes || ''
        }))
      )
      .select();
    
    if (error) {
      console.error('❌ Supabase error:', error);
      console.error('❌ Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      throw error;
    }
    
    console.log('✅ Posts created successfully:', data);
    return NextResponse.json({ success: true, posts: data });
  } catch (error) {
    console.error('💥 Error creating posts:', error);
    return NextResponse.json({ 
      error: 'Failed to create posts',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
