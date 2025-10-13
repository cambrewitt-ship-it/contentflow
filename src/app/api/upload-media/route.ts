import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { base64ToBlob } from '../../../lib/blobUpload';
import logger from '@/lib/logger';

// Supported media types
const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const SUPPORTED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/mpeg'];

// File size limits
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB

export async function POST(request: NextRequest) {
  try {
    const { mediaData, filename, mediaType } = await request.json();
    
    if (!mediaData) {
      return NextResponse.json(
        { error: 'Media data is required' },
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
      logger.warn('BLOB_READ_WRITE_TOKEN not configured');
      return NextResponse.json(
        { error: 'Blob storage not configured' },
        { status: 500 }
      );
    }
    
    // Detect MIME type from base64 data
    const mimeType = mediaData.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
    
    // Validate media type
    const isImage = SUPPORTED_IMAGE_TYPES.includes(mimeType);
    const isVideo = SUPPORTED_VIDEO_TYPES.includes(mimeType);
    
    if (!isImage && !isVideo) {
      return NextResponse.json(
        { error: `Unsupported media type: ${mimeType}. Supported types: images (JPG, PNG, GIF, WebP) and videos (MP4, MOV, AVI, WebM, MPEG)` },
        { status: 400 }
      );
    }
    
    // Convert base64 to blob
    const blob = base64ToBlob(mediaData, mimeType);
    
    // Check file size limits
    const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
    const sizeMB = (blob.size / (1024 * 1024)).toFixed(2);
    
    if (blob.size > maxSize) {
      return NextResponse.json(
        { error: `File too large (${sizeMB}MB). Maximum size: ${isVideo ? '100MB' : '10MB'}` },
        { status: 400 }
      );
    }
    
    // Upload to Vercel Blob
    const result = await put(filename, blob, {
      access: 'public',
      contentType: mimeType,
    });
    
    return NextResponse.json({ 
      success: true, 
      url: result.url,
      filename: result.pathname,
      mediaType: isVideo ? 'video' : 'image',
      mimeType: mimeType,
      size: blob.size
    });
    
  } catch (error) {
    logger.error('Error uploading media to blob:', error);
    return NextResponse.json(
      { error: 'Failed to upload media to blob storage' },
      { status: 500 }
    );
  }
}

