import { NextResponse } from 'next/server';
import { isValidMediaData, base64ToBlob } from '../../../../lib/blobUpload';
import logger from '@/lib/logger';

// Configure route to accept larger payloads for video uploads
export const runtime = 'nodejs';
export const maxDuration = 60; // Allow up to 60 seconds for video processing

// Maximum size for LATE API uploads (3.5MB to have some buffer)
const MAX_LATE_SIZE = 3.5 * 1024 * 1024;

/**
 * Compress an image buffer by reducing quality progressively
 * Uses a simple approach: convert to JPEG with reduced quality
 */
async function compressImageBuffer(
  buffer: Buffer,
  mimeType: string,
  targetSize: number = MAX_LATE_SIZE
): Promise<{ buffer: Buffer; mimeType: string }> {
  // If already small enough, return as-is
  if (buffer.length <= targetSize) {
    return { buffer, mimeType };
  }

  const originalSize = buffer.length;
  logger.info('Compressing oversized image', {
    originalSize: `${(originalSize / (1024 * 1024)).toFixed(2)}MB`,
    targetSize: `${(targetSize / (1024 * 1024)).toFixed(2)}MB`
  });

  // Try to dynamically import sharp for best compression
  try {
    const sharp = (await import('sharp')).default;

    // Calculate target quality based on how much we need to compress
    const ratio = targetSize / originalSize;
    let quality = Math.max(30, Math.min(85, Math.floor(ratio * 100)));

    // Get image metadata
    const metadata = await sharp(buffer).metadata();
    const originalWidth = metadata.width || 1920;
    const originalHeight = metadata.height || 1080;

    // If image is very large, also resize it
    let maxDimension = Math.max(originalWidth, originalHeight);
    if (originalSize > 8 * 1024 * 1024) {
      maxDimension = 1200; // Very large images: resize to 1200px max
      quality = Math.max(60, quality);
    } else if (originalSize > 5 * 1024 * 1024) {
      maxDimension = 1600; // Large images: resize to 1600px max
      quality = Math.max(70, quality);
    } else {
      maxDimension = 1920; // Keep reasonable size
    }

    // Progressive compression attempts
    const attempts = [
      { maxDim: maxDimension, quality: quality },
      { maxDim: 1400, quality: 70 },
      { maxDim: 1200, quality: 60 },
      { maxDim: 1000, quality: 50 },
      { maxDim: 800, quality: 40 },
    ];

    for (const attempt of attempts) {
      const compressed = await sharp(buffer)
        .resize(attempt.maxDim, attempt.maxDim, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: attempt.quality, progressive: true })
        .toBuffer();

      logger.info('Compression attempt', {
        maxDim: attempt.maxDim,
        quality: attempt.quality,
        resultSize: `${(compressed.length / (1024 * 1024)).toFixed(2)}MB`
      });

      if (compressed.length <= targetSize) {
        logger.info('Image compressed successfully', {
          originalSize: `${(originalSize / (1024 * 1024)).toFixed(2)}MB`,
          compressedSize: `${(compressed.length / (1024 * 1024)).toFixed(2)}MB`,
          reduction: `${((1 - compressed.length / originalSize) * 100).toFixed(1)}%`
        });
        return { buffer: compressed, mimeType: 'image/jpeg' };
      }
    }

    // Return the smallest we could get
    const finalCompressed = await sharp(buffer)
      .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 35, progressive: true })
      .toBuffer();

    logger.warn('Could not compress to target size, using best effort', {
      finalSize: `${(finalCompressed.length / (1024 * 1024)).toFixed(2)}MB`
    });

    return { buffer: finalCompressed, mimeType: 'image/jpeg' };

  } catch (sharpError) {
    // Sharp not available - try basic compression by just returning the buffer
    // The LATE API might still accept it or we'll get a proper error
    logger.warn('Sharp not available for compression, proceeding with original image', {
      error: sharpError instanceof Error ? sharpError.message : String(sharpError)
    });
    return { buffer, mimeType };
  }
}

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
    let mimeType = detectedMimeType || (isVideo ? 'video/mp4' : 'image/jpeg');

    // For images over the LATE API limit, compress them
    const bufferSizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
    console.log(`🟡 [upload-media] Buffer size: ${bufferSizeMB}MB, MAX_LATE_SIZE: ${(MAX_LATE_SIZE / (1024 * 1024)).toFixed(2)}MB, isVideo: ${isVideo}`);

    if (!isVideo && buffer.length > MAX_LATE_SIZE) {
      const actualSizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
      console.log(`🟠 [upload-media] Image exceeds limit! Compressing from ${actualSizeMB}MB...`);
      logger.info(`Image exceeds LATE API limit (${actualSizeMB}MB), compressing...`);

      const compressed = await compressImageBuffer(buffer, mimeType, MAX_LATE_SIZE);
      buffer = compressed.buffer;
      mimeType = compressed.mimeType;

      const compressedSizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
      console.log(`🟢 [upload-media] Compression complete! New size: ${compressedSizeMB}MB`);
      logger.info(`Image compressed from ${actualSizeMB}MB to ${compressedSizeMB}MB`);
    } else {
      console.log(`🟢 [upload-media] Image size OK, no compression needed`);
    }

    const extension = isVideo ? (mimeType.split('/')[1] || 'mp4') : (mimeType.split('/')[1] || 'jpg');
    const filename = isVideo ? `video.${extension}` : `image.${extension}`;

    logger.info('Preparing upload to LATE', { mimeType, extension, filename, bufferSize: buffer.length });

    // Create FormData
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
    formData.append('files', blob, filename);

    // Upload to LATE
    const response = await fetch('https://getlate.dev/api/v1/media', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.LATE_API_KEY}`
      },
      body: formData
    });

    logger.info('LATE API response status', {
      status: response.status,
      ok: response.ok
    });

    if (!response.ok) {
      let errorText = '';
      try {
        errorText = await response.text();
      } catch (textError) {
        errorText = `Failed to read error response: ${textError}`;
      }

      logger.error('LATE upload error:', errorText);

      // Check for payload too large error
      if (response.status === 413 || errorText.includes('Too Large') || errorText.includes('PAYLOAD_TOO_LARGE')) {
        return NextResponse.json({
          error: 'Image upload failed',
          details: 'The image could not be uploaded even after compression. Please try with a different image.'
        }, { status: 413 });
      }

      return NextResponse.json({
        error: 'LATE upload failed',
        details: errorText || 'Unknown error from LATE API'
      }, { status: 502 });
    }

    const data = await response.json();
    logger.info('LATE API response data', {
      dataKeys: Object.keys(data),
      hasFiles: !!data.files,
      hasUrl: !!data.url,
      hasMediaUrl: !!data.mediaUrl,
      hasMedia: !!data.media,
      rawData: JSON.stringify(data).substring(0, 500)
    });

    // Handle different possible response structures from LATE API
    let mediaUrl;
    if (data.files && data.files[0] && data.files[0].url) {
      mediaUrl = data.files[0].url;
    } else if (data.url) {
      mediaUrl = data.url;
    } else if (data.mediaUrl) {
      mediaUrl = data.mediaUrl;
    } else if (data.media && data.media.url) {
      mediaUrl = data.media.url;
    } else {
      logger.error('Unexpected LATE API response structure', { data });
      return NextResponse.json({
        error: 'Unexpected response structure from LATE API',
        receivedKeys: Object.keys(data),
        rawData: JSON.stringify(data).substring(0, 200)
      }, { status: 502 });
    }

    logger.info('Upload successful, returning lateMediaUrl', { mediaUrl: mediaUrl?.substring(0, 100) });
    return NextResponse.json({ lateMediaUrl: mediaUrl });

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
