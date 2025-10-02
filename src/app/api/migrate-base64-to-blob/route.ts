import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { put } from '@vercel/blob';

// Helper function to convert base64 to blob
function base64ToBlob(base64String: string, mimeType: string): Blob {
  const base64Data = base64String.replace(/^data:image\/[a-z]+;base64,/, '');
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

// Helper function to upload base64 image to Vercel Blob
async function uploadBase64ToBlob(base64String: string, filename: string): Promise<string> {
  const mimeType = base64String.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
  const blob = base64ToBlob(base64String, mimeType);
  
  const result = await put(filename, blob, {
    access: 'public',
  });
  
  return result.url;
}

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Starting migration of base64 images to Vercel Blob URLs...');
    
    // Check for required environment variables
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'Supabase environment variables are required' },
        { status: 500 }
      );
    }
    
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { error: 'BLOB_READ_WRITE_TOKEN environment variable is required' },
        { status: 500 }
      );
    }
    
    // Create Supabase client inside the function
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    const { dryRun = false, limit = 10 } = await request.json().catch(() => ({}));
    
    // Get all posts with base64 images from both tables
    const tables = ['calendar_unscheduled_posts', 'calendar_scheduled_posts', 'scheduled_posts'];
    let totalConverted = 0;
    let totalFound = 0;
    const results = [];
    
    for (const tableName of tables) {
      console.log(`\n📋 Processing table: ${tableName}`);
      
      // Get posts with base64 images
      const { data: posts, error: fetchError } = await supabase
        .from(tableName)
        .select('id, image_url, caption, created_at')
        .like('image_url', 'data:image%')
        .limit(limit);
      
      if (fetchError) {
        console.error(`❌ Error fetching from ${tableName}:`, fetchError);
        results.push({
          table: tableName,
          error: fetchError.message,
          converted: 0
        });
        continue;
      }
      
      if (!posts || posts.length === 0) {
        console.log(`✅ No base64 images found in ${tableName}`);
        results.push({
          table: tableName,
          converted: 0,
          message: 'No base64 images found'
        });
        continue;
      }
      
      totalFound += posts.length;
      console.log(`🔍 Found ${posts.length} posts with base64 images in ${tableName}`);
      
      let tableConverted = 0;
      
      // Process each post
      for (const post of posts) {
        try {
          console.log(`\n🔄 Processing post ${post.id} from ${tableName}...`);
          console.log(`   Caption: ${post.caption?.substring(0, 50)}...`);
          console.log(`   Image length: ${post.image_url?.length} characters`);
          
          if (dryRun) {
            console.log(`   🔍 DRY RUN: Would convert this image`);
            tableConverted++;
            continue;
          }
          
          // Generate filename
          const timestamp = Date.now();
          const fileExtension = post.image_url.match(/data:image\/([a-z]+)/)?.[1] || 'jpg';
          const filename = `migrated-${tableName}-${post.id}-${timestamp}.${fileExtension}`;
          
          // Upload to Vercel Blob
          const blobUrl = await uploadBase64ToBlob(post.image_url, filename);
          console.log(`   ✅ Uploaded to blob: ${blobUrl}`);
          
          // Update database with blob URL
          const { error: updateError } = await supabase
            .from(tableName)
            .update({ image_url: blobUrl })
            .eq('id', post.id);
          
          if (updateError) {
            console.error(`   ❌ Error updating database:`, updateError);
            continue;
          }
          
          console.log(`   ✅ Updated database with blob URL`);
          tableConverted++;
          totalConverted++;
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          console.error(`   ❌ Error processing post ${post.id}:`, error);
          continue;
        }
      }
      
      results.push({
        table: tableName,
        converted: tableConverted,
        found: posts.length
      });
    }
    
    console.log(`\n🎉 Migration completed! Converted ${totalConverted} images to Vercel Blob URLs`);
    
    return NextResponse.json({
      success: true,
      message: `Migration completed! Converted ${totalConverted} images to Vercel Blob URLs`,
      totalFound,
      totalConverted,
      results,
      dryRun
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    return NextResponse.json(
      { error: 'Migration failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
