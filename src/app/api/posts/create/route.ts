import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { clientId, projectId, posts, status = 'draft' } = await request.json();
    
    console.log('Creating posts:', { clientId, projectId, postsCount: posts.length, status });
    
    const supabase = createRouteHandlerClient({ cookies });
    
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
      console.error('Supabase error:', error);
      throw error;
    }
    
    console.log('Posts created successfully:', data);
    return NextResponse.json({ success: true, posts: data });
  } catch (error) {
    console.error('Error creating posts:', error);
    return NextResponse.json({ error: 'Failed to create posts' }, { status: 500 });
  }
}
