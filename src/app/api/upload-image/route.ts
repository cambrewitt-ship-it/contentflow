import { NextRequest, NextResponse } from 'next/server';
import { base64ToBlob } from '../../../lib/blobUpload';
import logger from '@/lib/logger';
import { createSupabaseWithToken, createSupabaseAdmin } from '@/lib/supabaseServer';

// Allowed image MIME types
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp'
];

// Maximum file size: 10MB in bytes
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    // 1. AUTHENTICATION CHECK - Must be logged in to upload
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('⚠️ Unauthorized upload attempt - no authorization header');
      return NextResponse.json(
        {
          error: 'Authentication required',
          details: 'User must be logged in to upload images'
        },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const supabase = createSupabaseWithToken(token);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      logger.warn('⚠️ Unauthorized upload attempt - invalid token', { authError });
      return NextResponse.json(
        {
          error: 'Authentication required',
          details: 'User must be logged in to upload images'
        },
        { status: 401 }
      );
    }

    // 2. PARSE REQUEST DATA
    const { imageData, filename } = await request.json();

    if (!imageData) {
      return NextResponse.json(
        { error: 'Image data is required' },
        { status: 400 }
      );
    }

    if (!filename) {
      return NextResponse.json(
        { error: 'Filename is required' },
        { status: 400 }
      );
    }

    // 3. VALIDATE FILE TYPE
    const mimeType = imageData.match(/data:([^;]+)/)?.[1] || 'image/jpeg';

    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      logger.warn('⚠️ Upload rejected - invalid file type', {
        userId: user.id,
        mimeType,
        filename,
        allowedTypes: ALLOWED_MIME_TYPES
      });
      return NextResponse.json(
        {
          error: 'Invalid file type',
          details: `Only these image types are allowed: ${ALLOWED_MIME_TYPES.join(', ')}`
        },
        { status: 400 }
      );
    }

    // 4. VALIDATE FILE SIZE
    // Calculate approximate file size from base64 (base64 is ~33% larger than actual binary)
    const base64Data = imageData.split(',')[1] || imageData;
    const base64Length = base64Data.length;
    const padding = (base64Data.match(/=/g) || []).length;
    const approximateFileSize = (base64Length * 0.75) - padding;

    if (approximateFileSize > MAX_FILE_SIZE) {
      logger.warn('⚠️ Upload rejected - file too large', {
        userId: user.id,
        fileSize: approximateFileSize,
        maxSize: MAX_FILE_SIZE,
        filename
      });
      return NextResponse.json(
        {
          error: 'File too large',
          details: `Maximum file size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`
        },
        { status: 400 }
      );
    }

    // 5. CONVERT AND UPLOAD
    const blob = base64ToBlob(imageData, mimeType);
    const admin = createSupabaseAdmin();
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `uploads/${user.id}-${Date.now()}-${safeName}`;
    const buffer = Buffer.from(await blob.arrayBuffer());

    const { error: storageError } = await admin.storage
      .from('media')
      .upload(storagePath, buffer, { contentType: mimeType, upsert: false });

    if (storageError) {
      logger.error('❌ Storage upload failed:', storageError);
      return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
    }

    const { data: { publicUrl } } = admin.storage.from('media').getPublicUrl(storagePath);

    logger.info('✅ Image uploaded successfully', { userId: user.id, storagePath, mimeType });

    return NextResponse.json({
      success: true,
      url: publicUrl,
      filename: storagePath
    });

  } catch (error: any) {
    logger.error('❌ Error uploading image to blob:', error);
    return NextResponse.json(
      { error: 'Failed to upload image to blob storage' },
      { status: 500 }
    );
  }
}
