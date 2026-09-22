import { NextResponse } from 'next/server';
import { isValidMediaData, base64ToBlob } from '../../../../lib/blobUpload';
import logger from '@/lib/logger';
import { uploadBufferToLate, LateUploadError } from '@/lib/lateMedia';

// Configure route to accept larger payloads for video uploads
export const runtime = 'nodejs';
export const maxDuration = 60; // Allow up to 60 seconds for video processing

export async function POST(request: Request) {
  // VERSION 2 - WITH COMPRESSION - If you see this, the new code is running
  console.log('🟢🟢🟢 [upload-media] VERSION 2 WITH COMPRESSION - POST request received');

  try {
    const body = await request.json();
    const { imageBlob } = body;

    console.log('🔵 [upload-media] Request body parsed', {
      hasImageBlob: !!imageBlob,
      imageBlobType: typeof imageBlob,
      imageBlobLength: imageBlob?.length || 0,
      imageBlobStart: typeof imageBlob === 'string' ? imageBlob.substring(0, 100) : 'not a string'
    });

    logger.info('Upload-media request received', {
      hasImageBlob: !!imageBlob,
      imageBlobType: typeof imageBlob,
      imageBlobLength: imageBlob?.length || 0,
      imageBlobPrefix: imageBlob?.substring?.(0, 50) || 'N/A'
    });

    if (!imageBlob) {
      logger.error('No imageBlob provided in request body');
      return NextResponse.json({ error: 'No image data provided' }, { status: 400 });
    }

    // Check if this is already a LATE media URL - if so, skip upload and return it directly
    if (typeof imageBlob === 'string' && imageBlob.includes('getlate.dev')) {
      logger.info('Image is already a LATE media URL, returning directly', {
        url: imageBlob.substring(0, 100)
      });
      return NextResponse.json({ lateMediaUrl: imageBlob });
    }

    // Validate media data (supports both blob URLs and base64, images and videos)
    const validation = isValidMediaData(imageBlob);
    logger.info('Media validation result', validation);

    if (!validation.isValid) {
      logger.error('Media validation failed:', validation);
      return NextResponse.json({
        error: 'Invalid media data - must be blob URL or base64 (image or video)',
        validation
      }, { status: 400 });
    }

    let buffer: Buffer;
    let detectedMimeType: string | null = null;

    if (validation.type === 'blob') {
      // Fetch media from blob URL or HTTPS URL
      logger.info('Fetching media from URL', { url: imageBlob.substring(0, 100) });

      try {
        const response = await fetch(imageBlob);
        if (!response.ok) {
          logger.error('Failed to fetch media from URL', {
            status: response.status,
            statusText: response.statusText,
            url: imageBlob.substring(0, 100)
          });
          return NextResponse.json({
            error: 'Failed to fetch media from URL',
            status: response.status,
            statusText: response.statusText
          }, { status: 400 });
        }

        // Get MIME type from response headers
        detectedMimeType = response.headers.get('content-type');
        logger.info('Detected content-type from URL', { contentType: detectedMimeType });

        const arrayBuffer = await response.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
        logger.info('Successfully fetched media', { bufferSize: buffer.length });
      } catch (fetchError) {
        logger.error('Error fetching media URL', {
          error: fetchError instanceof Error ? fetchError.message : String(fetchError),
          url: imageBlob.substring(0, 100)
        });
        return NextResponse.json({
          error: 'Error fetching media from URL',
          details: fetchError instanceof Error ? fetchError.message : String(fetchError)
        }, { status: 400 });
      }
    } else {
      // Handle base64 (supports both images and videos)
      const base64Data = imageBlob.replace(/^data:(image|video)\/[^;]+;base64,/, '');
      buffer = Buffer.from(base64Data, 'base64');
      // Extract MIME type from the data URL
      detectedMimeType = imageBlob.match(/data:([^;]+)/)?.[1] || null;
    }

    // Determine appropriate content type and filename extension
    const isVideo = validation.mediaType === 'video' || detectedMimeType?.startsWith('video/');

    // Use detected MIME type or fall back to defaults
    const mimeType = detectedMimeType || (isVideo ? 'video/mp4' : 'image/jpeg');

    try {
      const mediaUrl = await uploadBufferToLate(buffer, mimeType, !!isVideo);
      logger.info('Upload successful, returning lateMediaUrl', { mediaUrl: mediaUrl.substring(0, 100) });
      return NextResponse.json({ lateMediaUrl: mediaUrl });
    } catch (uploadError) {
      if (uploadError instanceof LateUploadError) {
        return NextResponse.json(
          { error: uploadError.message, details: uploadError.details },
          { status: uploadError.status }
        );
      }
      throw uploadError;
    }

  } catch (error) {
    console.error('🔴 [upload-media] CATCH BLOCK ERROR:', error);
    console.error('🔴 [upload-media] Error message:', error instanceof Error ? error.message : String(error));
    console.error('🔴 [upload-media] Error stack:', error instanceof Error ? error.stack : 'no stack');

    logger.error('Upload error:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json({
      error: 'Failed to upload media',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
