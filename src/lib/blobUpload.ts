import { put } from '@vercel/blob';

export async function uploadImageToBlob(
  imageFile: File | Blob,
  filename: string
): Promise<string> {
  try {
    // Check if BLOB_READ_WRITE_TOKEN is available
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.warn('⚠️ BLOB_READ_WRITE_TOKEN not configured, falling back to base64');
      // Fallback: convert to base64 data URL
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          resolve(reader.result as string);
        };
        reader.readAsDataURL(imageFile);
      });
    }

    const blob = await put(filename, imageFile, {
      access: 'public',
    });
    
    console.log('📁 Image uploaded to blob:', blob.url);
    return blob.url;
  } catch (error) {
    console.error('❌ Error uploading to blob:', error);
    
    // Fallback: convert to base64 data URL
    console.log('🔄 Falling back to base64 conversion...');
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(reader.result as string);
      };
      reader.onerror = () => {
        reject(new Error('Failed to convert image to base64'));
      };
      reader.readAsDataURL(imageFile);
    });
  }
}

export function base64ToBlob(base64String: string, mimeType: string = 'image/png'): Blob {
  // Remove data URL prefix if present
  const base64Data = base64String.replace(/^data:image\/[a-z]+;base64,/, '');
  
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

// Helper function to validate image data (supports both blob URLs and base64)
export function isValidImageData(imageData: string): { isValid: boolean; type: 'blob' | 'base64' | 'invalid' } {
  if (!imageData || typeof imageData !== 'string') {
    return { isValid: false, type: 'invalid' };
  }
  
  // Check if it's base64 data URL (preferred for OpenAI API)
  if (imageData.startsWith('data:image/')) {
    return { isValid: true, type: 'base64' };
  }
  
  // Check if it's a blob URL (will need conversion for OpenAI API)
  if (isValidBlobUrl(imageData)) {
    return { isValid: true, type: 'blob' };
  }
  
  return { isValid: false, type: 'invalid' };
}
