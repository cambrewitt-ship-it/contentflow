/**
 * Upload Content Manager logo to Supabase Storage
 * Run with: node upload-logo-to-supabase.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.NEXT_SUPABASE_SERVICE_ROLE;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_SUPABASE_SERVICE_ROLE in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function uploadLogo() {
  try {
    console.log('📤 Uploading logo to Supabase Storage...');

    // Read the logo file
    const logoPath = path.join(__dirname, 'public', 'cm-logo.png');
    const logoBuffer = fs.readFileSync(logoPath);

    // Upload to Supabase Storage
    // First, ensure the bucket exists (create if not)
    const { data: buckets, error: bucketListError } = await supabase.storage.listBuckets();
    
    if (bucketListError) {
      console.error('❌ Error listing buckets:', bucketListError);
      process.exit(1);
    }

    const bucketName = 'public-assets';
    const bucketExists = buckets?.some(b => b.name === bucketName);

    if (!bucketExists) {
      console.log('📦 Creating public-assets bucket...');
      const { error: createError } = await supabase.storage.createBucket(bucketName, {
        public: true,
        fileSizeLimit: 5242880, // 5MB
      });

      if (createError) {
        console.error('❌ Error creating bucket:', createError);
        process.exit(1);
      }
      console.log('✅ Bucket created successfully');
    }

    // Upload the logo
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload('cm-logo.png', logoBuffer, {
        contentType: 'image/png',
        cacheControl: '3600',
        upsert: true, // Overwrite if exists
      });

    if (error) {
      console.error('❌ Error uploading logo:', error);
      process.exit(1);
    }

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl('cm-logo.png');

    console.log('✅ Logo uploaded successfully!');
    console.log('\n📎 Public URL:');
    console.log(urlData.publicUrl);
    console.log('\n📧 Use this URL in your Supabase email templates:');
    console.log(`<img src="${urlData.publicUrl}" alt="Content Manager" style="max-width: 200px;" />`);

  } catch (err) {
    console.error('💥 Unexpected error:', err);
    process.exit(1);
  }
}

uploadLogo();

