import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { base64ToBlob } from '../../../lib/blobUpload';
import logger from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
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
    
    // Check if BLOB_READ_WRITE_TOKEN is available
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      logger.warn('⚠️ BLOB_READ_WRITE_TOKEN not configured, returning error');
      return NextResponse.json(
        { error: 'Blob storage not configured' },
        { status: 500 }
      );
    }

    // Convert base64 to blob
    const mimeType = imageData.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
    const blob = base64ToBlob(imageData, mimeType);

    // Upload to Vercel Blob
    const result = await put(filename, blob, {
      access: 'public',
    });

    return NextResponse.json({ 
      success: true, 
      url: result.url,
      filename: result.pathname
    });
    
  } catch (error) {
    logger.error('❌ Error uploading image to blob:', error);
    return NextResponse.json(
      { error: 'Failed to upload image to blob storage' },
      { status: 500 }
    );
  }
}
