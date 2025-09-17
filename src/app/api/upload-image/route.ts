import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { base64ToBlob } from '../../../lib/blobUpload';

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
      console.warn('⚠️ BLOB_READ_WRITE_TOKEN not configured, returning error');
      return NextResponse.json(
        { error: 'Blob storage not configured' },
        { status: 500 }
      );
    }
    
    console.log('🔄 Uploading image to Vercel Blob:', { filename, dataLength: imageData.length });
    
    // Convert base64 to blob
    const mimeType = imageData.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
    const blob = base64ToBlob(imageData, mimeType);
    
    console.log('📦 Created blob:', { size: blob.size, type: blob.type });
    
    // Upload to Vercel Blob
    const result = await put(filename, blob, {
      access: 'public',
    });
    
    console.log('✅ Image uploaded to blob:', result.url);
    
    return NextResponse.json({ 
      success: true, 
      url: result.url,
      filename: result.pathname
    });
    
  } catch (error) {
    console.error('❌ Error uploading image to blob:', error);
    return NextResponse.json(
      { error: 'Failed to upload image to blob storage' },
      { status: 500 }
    );
  }
}
