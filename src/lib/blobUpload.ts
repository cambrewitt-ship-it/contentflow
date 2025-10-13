import logger from '@/lib/logger';

// Upload media (images or videos) to blob storage
export async function uploadMediaToBlob(
  mediaFile: File | Blob,
  filename: string
): Promise<{ url: string; mediaType: 'image' | 'video'; mimeType: string }> {
  try {
    // Convert file to base64 first
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read media file'));
      reader.readAsDataURL(mediaFile);
    });

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
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `Upload failed with status ${response.status}`);
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
    logger.error('❌ Error uploading to blob:', error);
    
    // Fallback: convert to base64 data URL

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
  
  // Check if it's a valid HTTPS URL
  if (!url.startsWith('https://')) {
    return false;
  }
  
  // Check if it's from Vercel Blob storage
  if (!url.includes('blob.vercel-storage.com')) {
    return false;
  }
  
  // Basic URL format validation
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
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
