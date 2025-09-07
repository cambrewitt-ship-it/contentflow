import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { uploadImageToBlob, base64ToBlob } from '../../../../lib/blobUpload';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_SUPABASE_SERVICE_ROLE!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Starting image migration to blob storage...');
    
    // Get all posts with base64 images
    const { data: posts, error } = await supabase
      .from('planner_scheduled_posts')
      .select('id, image_url')
      .like('image_url', 'data:image%')
      .limit(5); // Process 5 at a time to avoid timeouts

    if (error) {
      throw error;
    }

    console.log(`📊 Found ${posts?.length || 0} posts with base64 images`);

    const results = [];

    for (const post of posts || []) {
      try {
        console.log(`🔄 Migrating post ${post.id}...`);
        
        // Convert base64 to blob
        const blob = base64ToBlob(post.image_url);
        
        // Upload to blob storage
        const blobUrl = await uploadImageToBlob(blob, `migrated-${post.id}.png`);
        
        // Update database with blob URL
        const { error: updateError } = await supabase
          .from('planner_scheduled_posts')
          .update({ image_url: blobUrl })
          .eq('id', post.id);

        if (updateError) {
          throw updateError;
        }

        results.push({ id: post.id, success: true, blobUrl });
        console.log(`✅ Migrated post ${post.id} to ${blobUrl}`);
        
      } catch (error) {
        console.error(`❌ Failed to migrate post ${post.id}:`, error);
        results.push({ id: post.id, success: false, error: error.message });
      }
    }

    return NextResponse.json({
      message: `Migrated ${results.filter(r => r.success).length} of ${results.length} posts`,
      results
    });

  } catch (error) {
    console.error('❌ Migration error:', error);
    return NextResponse.json(
      { error: 'Migration failed' },
      { status: 500 }
    );
  }
}
