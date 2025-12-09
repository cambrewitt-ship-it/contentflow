import logger from '@/lib/logger';

// Helper function to compress/resize image if it's too large (same as in contentStore)
async function compressImageIfNeeded(
  imageData: string,
  maxSizeBytes: number = 3 * 1024 * 1024, // 3MB default
  maxRequestSizeBytes: number = 4.5 * 1024 * 1024 // 4.5MB total request body limit
): Promise<string> {
  if (!imageData.startsWith('data:')) {
    return imageData;
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

// Upload media (images or videos) to blob storage
export async function uploadMediaToBlob(
  mediaFile: File | Blob,
  filename: string
): Promise<{ url: string; mediaType: 'image' | 'video'; mimeType: string }> {
  try {
    const isVideo = mediaFile.type.startsWith('video/');
    
    // Convert file to base64 first
    let base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read media file'));
      reader.readAsDataURL(mediaFile);
    });

    // For images, compress before uploading to avoid 4.5MB request body limit
    if (!isVideo && base64Data.startsWith('data:image/')) {
      const originalSize = (base64Data.length * 3) / 4;
      if (originalSize > 3 * 1024 * 1024) {
        logger.info('🖼️ Compressing image before upload to avoid size limits...', {
          originalSize: `${(originalSize / (1024 * 1024)).toFixed(2)}MB`
        });
        base64Data = await compressImageIfNeeded(base64Data, 3 * 1024 * 1024, 4.5 * 1024 * 1024);
        const compressedSize = (base64Data.length * 3) / 4;
        logger.info('✅ Image compressed for upload', {
          compressedSize: `${(compressedSize / (1024 * 1024)).toFixed(2)}MB`
        });
      }
    }

    const mediaType = mediaFile.type.startsWith('video/') ? 'video' : 'image';

    // Upload via server API route (this keeps the blob token secure)
    const response = await fetch('/api/upload-media', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        mediaData: base64Data,
        filename,
        mediaType,
      }),
    });

    if (!response.ok) {
      let errorData: any;
      try {
        errorData = await response.json();
      } catch {
        const text = await response.text().catch(() => 'No error details');
        errorData = { error: `Upload failed with status ${response.status}`, details: text };
      }
      
      const error = new Error(errorData.error || `Upload failed with status ${response.status}`);
      (error as any).status = response.status;
      (error as any).data = errorData;
      throw error;
    }

    const data = await response.json();
    
    if (!data.url) {
      throw new Error('No URL returned from upload');
    }

    return {
      url: data.url,
      mediaType: data.mediaType || mediaType,
      mimeType: data.mimeType || mediaFile.type
    };
    
  } catch (error) {
    // Log detailed error information
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStatus = (error as any)?.status || (error as any)?.response?.status;
    const errorData = (error as any)?.response?.data || (error as any)?.data;
    
    logger.error('❌ Error uploading to blob:', {
      message: errorMessage,
      status: errorStatus,
      data: errorData,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : error
    });
    
    // Fallback: convert to base64 data URL
    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          resolve(reader.result as string);
        };
        reader.onerror = () => {
          reject(new Error('Failed to convert media to base64'));
        };
        reader.readAsDataURL(mediaFile);
      });
      
      return {
        url: base64Data,
        mediaType: mediaFile.type.startsWith('video/') ? 'video' : 'image',
        mimeType: mediaFile.type
      };
    } catch (fallbackError) {
      logger.error('❌ Fallback base64 conversion also failed:', fallbackError);
      throw new Error(`Upload failed: ${errorMessage}. Fallback also failed.`);
    }
  }
}

// Legacy function for backward compatibility
export async function uploadImageToBlob(
  imageFile: File | Blob,
  filename: string
): Promise<string> {
  const result = await uploadMediaToBlob(imageFile, filename);
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
