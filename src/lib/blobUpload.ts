import logger from '@/lib/logger';

// Size threshold for using client-side upload
// For images > 5MB, use client-side upload to bypass API route and avoid compression
// Videos ALWAYS use client-side upload regardless of size
const CLIENT_UPLOAD_THRESHOLD = 5 * 1024 * 1024; // 5MB

// Helper function to compress/resize image if it's too large (same as in contentStore)
async function compressImageIfNeeded(
  imageData: string,
  maxSizeBytes: number = 2.5 * 1024 * 1024, // 2.5MB default - conservative to stay under 3MB threshold
  maxRequestSizeBytes: number = 3 * 1024 * 1024 // 3MB total request body limit
): Promise<string> {
  if (!imageData.startsWith('data:')) {
    return imageData;
  }

  // NEVER try to compress videos
  if (imageData.startsWith('data:video/')) {
    throw new Error('Cannot compress video files - they should use client-side upload');
  }

  const base64Data = imageData.split(',')[1] || imageData;
  const padding = (base64Data.match(/=/g) || []).length;
  const actualSize = Math.floor((base64Data.length * 3) / 4) - padding;

  if (actualSize <= maxSizeBytes) {
    return imageData;
  }

  try {
    const img = new Image();
    const imgLoadPromise = new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
    });
    img.src = imageData;
    await imgLoadPromise;

    const originalWidth = img.width;
    const originalHeight = img.height;
    const mimeType = imageData.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
    
    const compressionAttempts = [
      { maxDimension: 1920, quality: 0.75 },
      { maxDimension: 1600, quality: 0.65 },
      { maxDimension: 1280, quality: 0.55 },
      { maxDimension: 1024, quality: 0.45 },
    ];

    for (const attempt of compressionAttempts) {
      let targetWidth = originalWidth;
      let targetHeight = originalHeight;

      if (originalWidth > attempt.maxDimension || originalHeight > attempt.maxDimension) {
        if (originalWidth > originalHeight) {
          targetWidth = attempt.maxDimension;
          targetHeight = Math.round((originalHeight / originalWidth) * attempt.maxDimension);
        } else {
          targetHeight = attempt.maxDimension;
          targetWidth = Math.round((originalWidth / originalHeight) * attempt.maxDimension);
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return imageData;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      const compressedDataUrl = canvas.toDataURL(mimeType, attempt.quality);
      const compressedBase64 = compressedDataUrl.split(',')[1] || compressedDataUrl;
      const compressedPadding = (compressedBase64.match(/=/g) || []).length;
      const compressedSize = Math.floor((compressedBase64.length * 3) / 4) - compressedPadding;

      if (compressedSize <= maxSizeBytes) {
        return compressedDataUrl;
      }

      if (attempt === compressionAttempts[compressionAttempts.length - 1]) {
        return compressedDataUrl;
      }
    }

    return imageData;
  } catch (error) {
    logger.error('Error compressing image for upload:', error);
    return imageData;
  }
}

const MAX_UPLOAD_RETRIES = 5;
const RETRY_BACKOFF_MS = 600;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function retryWithBackoff<T>(
  action: () => Promise<T>,
  description: string
): Promise<T> {
  let attempt = 0;

  while (true) {
    try {
      return await action();
    } catch (error) {
      const status = (error as any)?.status || (error as any)?.response?.status;
      const message = error instanceof Error ? error.message : String(error);
      const isRateLimit = status === 429 || message.toLowerCase().includes('too many requests');

      if (!isRateLimit || attempt >= MAX_UPLOAD_RETRIES - 1) {
        throw error;
      }

      const delay = RETRY_BACKOFF_MS * Math.pow(2, attempt);
      logger.warn(`Retrying ${description} after rate limit`, {
        attempt: attempt + 1,
        delay,
        status,
        message,
      });

      await sleep(delay);
      attempt += 1;
    }
  }
}

const MAX_IMAGE_DIMENSION = 2048;
const IMAGE_QUALITY = 0.82;
const COMPRESS_THRESHOLD = 500 * 1024; // only compress if > 500KB

async function compressImageFile(file: File | Blob): Promise<Blob> {
  // Skip videos, GIFs (animation), and small files
  if (
    !file.type.startsWith('image/') ||
    file.type === 'image/gif' ||
    file.size <= COMPRESS_THRESHOLD
  ) {
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
        if (width > height) {
          height = Math.round((height / width) * MAX_IMAGE_DIMENSION);
          width = MAX_IMAGE_DIMENSION;
        } else {
          width = Math.round((width / height) * MAX_IMAGE_DIMENSION);
          height = MAX_IMAGE_DIMENSION;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      canvas.toBlob(
        (compressed) => resolve(compressed && compressed.size < file.size ? compressed : file),
        outputType,
        outputType === 'image/jpeg' ? IMAGE_QUALITY : undefined
      );
    };

    img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
    img.src = objectUrl;
  });
}

// Upload media (images or videos) to Supabase Storage via signed URL
export async function uploadMediaToBlob(
  mediaFile: File | Blob,
  filename: string,
  accessToken?: string
): Promise<{ url: string; mediaType: 'image' | 'video'; mimeType: string }> {
  const isVideo = mediaFile.type.startsWith('video/');
  const mediaType = isVideo ? 'video' : 'image';
  const fileToUpload = isVideo ? mediaFile : await compressImageFile(mediaFile);

  try {
    // Step 1: Get a Supabase signed upload URL from our server
    const params = new URLSearchParams({
      fileName: filename,
      fileType: fileToUpload.type || (isVideo ? 'video/mp4' : 'image/jpeg'),
      fileSize: String(fileToUpload.size),
    });

    const urlRes = await retryWithBackoff(async () => {
      const res = await fetch(`/api/upload-presigned-url?${params}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to get upload URL (${res.status})`);
      }
      return res.json();
    }, 'get signed upload URL');

    const { signedUrl, publicUrl } = urlRes;

    // Step 2: PUT the file directly to Supabase Storage (bypasses Vercel function limits)
    await retryWithBackoff(async () => {
      const res = await fetch(signedUrl, {
        method: 'PUT',
        body: fileToUpload,
        headers: { 'Content-Type': fileToUpload.type },
      });
      if (!res.ok) throw new Error(`Storage upload failed (${res.status})`);
    }, 'Supabase direct upload');

    logger.info('✅ Upload successful', {
      url: publicUrl,
      size: `${(fileToUpload.size / (1024 * 1024)).toFixed(2)}MB`,
      mediaType,
    });

    return { url: publicUrl, mediaType, mimeType: mediaFile.type };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('❌ Upload failed:', { message: msg, mediaType, fileName: filename });
    throw new Error(`Upload failed: ${msg}`);
  }
}

// Legacy function for backward compatibility
export async function uploadImageToBlob(
  imageFile: File | Blob,
  filename: string,
  accessToken?: string
): Promise<string> {
  const result = await uploadMediaToBlob(imageFile, filename, accessToken);
  return result.url;
}

export function base64ToBlob(base64String: string, mimeType: string = 'image/png'): Blob {
  // Remove data URL prefix if present (support both image and video)
  const base64Data = base64String.replace(/^data:(image|video)\/[a-z0-9+-]+;base64,/, '');
  
  // Convert base64 to bytes
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

// Helper function to validate blob URLs
export function isValidBlobUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }
  
  // Check if it's a local blob URL (for development)
  if (url.startsWith('blob:http://localhost') || url.startsWith('blob:http://127.0.0.1')) {
    return true;
  }
  
  // Check if it's a valid HTTPS URL (OpenAI Vision API accepts any publicly accessible HTTPS URL)
  if (url.startsWith('https://')) {
    // Basic URL format validation
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
  
  return false;
}

// Helper function to validate media data (supports both blob URLs and base64, for images and videos)
export function isValidMediaData(mediaData: string): { 
  isValid: boolean; 
  type: 'blob' | 'base64' | 'invalid';
  mediaType: 'image' | 'video' | 'unknown';
} {
  if (!mediaData || typeof mediaData !== 'string') {
    return { isValid: false, type: 'invalid', mediaType: 'unknown' };
  }
  
  // Check if it's base64 data URL
  if (mediaData.startsWith('data:image/')) {
    return { isValid: true, type: 'base64', mediaType: 'image' };
  }
  
  if (mediaData.startsWith('data:video/')) {
    return { isValid: true, type: 'base64', mediaType: 'video' };
  }
  
  // Check if it's a blob URL
  if (isValidBlobUrl(mediaData)) {
    // Try to determine media type from URL or assume it could be either
    return { isValid: true, type: 'blob', mediaType: 'unknown' };
  }
  
  return { isValid: false, type: 'invalid', mediaType: 'unknown' };
}

// Helper function to validate image data (backward compatibility)
export function isValidImageData(imageData: string): { isValid: boolean; type: 'blob' | 'base64' | 'invalid' } {
  const result = isValidMediaData(imageData);
  return {
    isValid: result.isValid && (result.mediaType === 'image' || result.mediaType === 'unknown'),
    type: result.type
  };
}

// Helper to detect if a file is a video
export function isVideoFile(file: File | Blob): boolean {
  return file.type.startsWith('video/');
}

// Helper to get media type from file
export function getMediaType(file: File | Blob): 'image' | 'video' | 'unknown' {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  return 'unknown';
}
