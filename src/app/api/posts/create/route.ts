import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;

export async function POST(request: Request) {
  try {
    const { clientId, projectId, posts, status = 'draft' } = await request.json();
    
    console.log('🚀 Creating posts:', { clientId, projectId, postsCount: posts.length, status });
    
    // Create Supabase client with service role for admin access (exact same pattern as working APIs)
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
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
