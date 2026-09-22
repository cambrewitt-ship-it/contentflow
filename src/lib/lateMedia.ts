import logger from '@/lib/logger';

// Maximum size for LATE API uploads (3.5MB to have some buffer)
export const MAX_LATE_SIZE = 3.5 * 1024 * 1024;

/**
 * Compress an image buffer by reducing quality progressively
 * Uses a simple approach: convert to JPEG with reduced quality
 */
export async function compressImageBuffer(
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

export class LateUploadError extends Error {
  constructor(message: string, public status: number, public details?: string) {
    super(message);
    this.name = 'LateUploadError';
  }
}

// Compresses oversized images, uploads to LATE's media endpoint and returns the hosted URL
export async function uploadBufferToLate(
  input: Buffer,
  inputMimeType: string,
  isVideo: boolean
): Promise<string> {
  let buffer = input;
  let mimeType = inputMimeType;

  if (!isVideo && buffer.length > MAX_LATE_SIZE) {
    const actualSizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
    logger.info(`Image exceeds LATE API limit (${actualSizeMB}MB), compressing...`);
    const compressed = await compressImageBuffer(buffer, mimeType, MAX_LATE_SIZE);
    buffer = compressed.buffer;
    mimeType = compressed.mimeType;
    logger.info(`Image compressed from ${actualSizeMB}MB to ${(buffer.length / (1024 * 1024)).toFixed(2)}MB`);
  }

  const extension = mimeType.split('/')[1] || (isVideo ? 'mp4' : 'jpg');
  const filename = isVideo ? `video.${extension}` : `image.${extension}`;

  logger.info('Preparing upload to LATE', { mimeType, extension, filename, bufferSize: buffer.length });

  const formData = new FormData();
  formData.append('files', new Blob([new Uint8Array(buffer)], { type: mimeType }), filename);

  const response = await fetch('https://getlate.dev/api/v1/media', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.LATE_API_KEY}` },
    body: formData,
  });

  logger.info('LATE API response status', { status: response.status, ok: response.ok });

  if (!response.ok) {
    let errorText = '';
    try {
      errorText = await response.text();
    } catch (textError) {
      errorText = `Failed to read error response: ${textError}`;
    }
    logger.error('LATE upload error:', errorText);

    if (response.status === 413 || errorText.includes('Too Large') || errorText.includes('PAYLOAD_TOO_LARGE')) {
      throw new LateUploadError(
        'Image upload failed',
        413,
        'The image could not be uploaded even after compression. Please try with a different image.'
      );
    }
    throw new LateUploadError('LATE upload failed', 502, errorText || 'Unknown error from LATE API');
  }

  const data = await response.json();
  logger.info('LATE API response data', {
    dataKeys: Object.keys(data),
    rawData: JSON.stringify(data).substring(0, 500),
  });

  const mediaUrl: string | undefined =
    data.files?.[0]?.url ?? data.url ?? data.mediaUrl ?? data.media?.url;
  if (!mediaUrl) {
    logger.error('Unexpected LATE API response structure', { data });
    throw new LateUploadError(
      'Unexpected response structure from LATE API',
      502,
      JSON.stringify(data).substring(0, 200)
    );
  }
  return mediaUrl;
}

// Only fetch server-side from our own storage hosts; anything else is handed to LATE by URL
function isTrustedMediaHost(url: URL): boolean {
  const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : null;
  return (
    url.protocol === 'https:' &&
    (url.hostname === supabaseHost || url.hostname.endsWith('.public.blob.vercel-storage.com'))
  );
}

// Turns a stored media URL into a LATE media item, re-hosting it on LATE when it lives in our storage
export async function toLateMediaItem(mediaUrl: string): Promise<{ type: 'image' | 'video'; url: string }> {
  const parsed = new URL(mediaUrl);
  const looksLikeVideo = /\.(mp4|mov|webm|m4v|avi)$/i.test(parsed.pathname);

  if (parsed.hostname.endsWith('getlate.dev') || !isTrustedMediaHost(parsed)) {
    return { type: looksLikeVideo ? 'video' : 'image', url: mediaUrl };
  }

  const response = await fetch(mediaUrl);
  if (!response.ok) {
    throw new LateUploadError('Failed to fetch media from URL', 400, `${response.status} ${response.statusText}`);
  }
  const contentType = response.headers.get('content-type') || '';
  const isVideo = contentType.startsWith('video/') || looksLikeVideo;
  const buffer = Buffer.from(await response.arrayBuffer());
  const url = await uploadBufferToLate(buffer, contentType || (isVideo ? 'video/mp4' : 'image/jpeg'), isVideo);
  return { type: isVideo ? 'video' : 'image', url };
}
