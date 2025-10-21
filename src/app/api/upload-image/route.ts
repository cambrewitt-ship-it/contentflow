import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { put } from '@vercel/blob';
import { base64ToBlob } from '../../../lib/blobUpload';
import logger from '@/lib/logger';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE!;

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
      return NextResponse.json({ 
        error: 'Authentication required', 
        details: 'User must be logged in to upload images'
      }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    
    // Create Supabase client with the user's token
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    // Get the authenticated user using the token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      logger.warn('⚠️ Unauthorized upload attempt - invalid token', { authError });
      return NextResponse.json({ 
        error: 'Authentication required', 
        details: 'User must be logged in to upload images'
      }, { status: 401 });
    }

    // 2. PARSE REQUEST DATA
    const { imageData, filename } = await request.json();
    
    if (!imageData) {
      return NextResponse.json(
        { error: 'Image data is required' },
        { status: 400 }

    }
    
    if (!filename) {
      return NextResponse.json(
        { error: 'Filename is required' },
        { status: 400 }

    }
    
    // 3. VALIDATE FILE TYPE
    const mimeType = imageData.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
    
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      logger.warn('⚠️ Upload rejected - invalid file type', { 
        userId: user.id, 
        mimeType, 
        filename,
        allowedTypes: ALLOWED_MIME_TYPES 

      return NextResponse.json(
        { 
          error: 'Invalid file type', 
          details: `Only these image types are allowed: ${ALLOWED_MIME_TYPES.join(', ')}` 
        },
        { status: 400 }

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

      return NextResponse.json(
        { 
          error: 'File too large', 
          details: `Maximum file size is ${MAX_FILE_SIZE / (1024 * 1024)}MB` 
        },
        { status: 400 }

    }
    
    // 5. CHECK BLOB STORAGE CONFIGURATION
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      logger.warn('⚠️ BLOB_READ_WRITE_TOKEN not configured, returning error');
      return NextResponse.json(
        { error: 'Blob storage not configured' },
        { status: 500 }

    }

    // 6. CONVERT AND UPLOAD
    // Convert base64 to blob
    const blob = base64ToBlob(imageData, mimeType);

    // Upload to Vercel Blob
    const result = await put(filename, blob, {
      access: 'public',

    logger.info('✅ Image uploaded successfully', { 
      userId: user.id, 
      filename: result.pathname,
      size: approximateFileSize,
      mimeType 

    return NextResponse.json({ 
      success: true, 
      url: result.url,
      filename: result.pathname

  } catch (error) {
    logger.error('❌ Error uploading image to blob:', error);
    return NextResponse.json(
      { error: 'Failed to upload image to blob storage' },
      { status: 500 }

  }
}
