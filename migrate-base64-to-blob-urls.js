#!/usr/bin/env node

/**
 * Migration script to convert base64 images to Vercel Blob URLs
 * This fixes the issue with extremely long URLs in the edit functionality
 */

const { createClient } = require('@supabase/supabase-js');
const { put } = require('@vercel/blob');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Helper function to convert base64 to blob
function base64ToBlob(base64String, mimeType) {
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
async function uploadBase64ToBlob(base64String, filename) {
  try {
    const mimeType = base64String.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
    const blob = base64ToBlob(base64String, mimeType);
    
    const result = await put(filename, blob, {
      access: 'public',
    });
    
    return result.url;
  } catch (error) {
    console.error('Error uploading to blob:', error);
    throw error;
  }
}

// Main migration function
async function migrateBase64ToBlobUrls() {
  console.log('🚀 Starting migration of base64 images to Vercel Blob URLs...');
  
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('❌ BLOB_READ_WRITE_TOKEN environment variable is required');
    process.exit(1);
  }
  
  try {
    // Get all posts with base64 images from both tables
    const tables = ['planner_unscheduled_posts', 'planner_scheduled_posts', 'scheduled_posts'];
    let totalConverted = 0;
    
    for (const tableName of tables) {
      console.log(`\n📋 Processing table: ${tableName}`);
      
      // Get posts with base64 images
      const { data: posts, error: fetchError } = await supabase
        .from(tableName)
        .select('id, image_url, caption')
        .like('image_url', 'data:image%');
      
      if (fetchError) {
        console.error(`❌ Error fetching from ${tableName}:`, fetchError);
        continue;
      }
      
      if (!posts || posts.length === 0) {
        console.log(`✅ No base64 images found in ${tableName}`);
        continue;
      }
      
      console.log(`🔍 Found ${posts.length} posts with base64 images in ${tableName}`);
      
      // Process each post
      for (const post of posts) {
        try {
          console.log(`\n🔄 Processing post ${post.id} from ${tableName}...`);
          console.log(`   Caption: ${post.caption?.substring(0, 50)}...`);
          console.log(`   Image length: ${post.image_url?.length} characters`);
          
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
          totalConverted++;
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          console.error(`   ❌ Error processing post ${post.id}:`, error);
          continue;
        }
      }
    }
    
    console.log(`\n🎉 Migration completed! Converted ${totalConverted} images to Vercel Blob URLs`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateBase64ToBlobUrls()
    .then(() => {
      console.log('✅ Migration script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateBase64ToBlobUrls };
