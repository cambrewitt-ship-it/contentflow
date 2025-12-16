import { NextRequest, NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import logger from '@/lib/logger';

// Supported media types
const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const SUPPORTED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/mpeg'];

// File size limits
const MAX_IMAGE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB

export async function POST(request: NextRequest) {
  try {
    // Check if BLOB_READ_WRITE_TOKEN is available first
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      const errorMsg = 'BLOB_READ_WRITE_TOKEN environment variable is not set. Please add it to your .env.local file or Vercel environment variables.';
      logger.error(errorMsg);
      console.error('❌ [BLOB UPLOAD ERROR]:', errorMsg);
      console.error('💡 Fix: Add BLOB_READ_WRITE_TOKEN to .env.local (development) or Vercel environment variables (production)');
      return NextResponse.json(
        {
          error: 'Blob storage not configured - missing BLOB_READ_WRITE_TOKEN',
          details: 'Please configure BLOB_READ_WRITE_TOKEN in your environment variables'
        },
        { status: 500 }
      );
    }

    const body = await request.json() as HandleUploadBody;

    // Extract file info from the request body
    // When Vercel Blob sends 'blob.generate-client-token', the payload structure is different
    const clientPayloadStr = (body as any).payload?.clientPayload;
    const clientPayload = clientPayloadStr ? JSON.parse(clientPayloadStr) : null;
    const fileType = clientPayload?.type || body.type;
    const filename = (body as any).payload?.pathname || body.filename;

    logger.info('📥 Presigned URL request received', {
      type: body.type,
      fileType,
      filename,
      hasToken: !!process.env.BLOB_READ_WRITE_TOKEN
    });

    // Validate that we have the required fields
    if (!body.type) {
      logger.error('Missing required fields in request', { body });
      return NextResponse.json(
        { error: 'Missing required field: type' },
        { status: 400 }
      );
    }

    // Validate media type (skip validation if this is a token generation request)
    if (body.type !== 'blob.generate-client-token' && fileType) {
      const isImage = SUPPORTED_IMAGE_TYPES.includes(fileType);
      const isVideo = SUPPORTED_VIDEO_TYPES.includes(fileType);

      if (!isImage && !isVideo) {
        return NextResponse.json(
          {
            error: `Unsupported media type: ${fileType}. Supported types: images (JPG, PNG, GIF, WebP) and videos (MP4, MOV, AVI, WebM, MPEG)`,
          },
          { status: 400 }
        );
      }
    }

    // Determine if file is image or video for size validation
    const isImage = fileType && SUPPORTED_IMAGE_TYPES.includes(fileType);
    const isVideo = fileType && SUPPORTED_VIDEO_TYPES.includes(fileType);

    // Validate file size
    const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
    
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // Validate file size from client payload
        const size = clientPayload?.size as number | undefined;
        if (size && size > maxSize) {
          const sizeMB = (size / (1024 * 1024)).toFixed(2);
          const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(0);
          throw new Error(`File too large (${sizeMB}MB). Maximum size: ${maxSizeMB}MB`);
        }

        return {
          allowedContentTypes: isVideo ? SUPPORTED_VIDEO_TYPES : SUPPORTED_IMAGE_TYPES,
          maximumSizeInBytes: maxSize,
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        logger.info('✅ Media uploaded successfully', {
          url: blob.url,
          size: `${(blob.size / (1024 * 1024)).toFixed(2)}MB`,
          type: blob.contentType,
        });
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logger.error('Error generating presigned upload URL:', {
      error: errorMessage,
      hasToken: !!process.env.BLOB_READ_WRITE_TOKEN,
      tokenLength: process.env.BLOB_READ_WRITE_TOKEN?.length,
      details: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack?.split('\n').slice(0, 5).join('\n')
      } : error
    });
    
    return NextResponse.json(
      { 
        error: 'Failed to generate upload URL',
        message: errorMessage,
        hint: !process.env.BLOB_READ_WRITE_TOKEN ? 'BLOB_READ_WRITE_TOKEN not configured' : undefined
      },
      { status: 500 }
    );
  }
}
