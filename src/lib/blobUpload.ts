import logger from '@/lib/logger';

const MAX_UPLOAD_RETRIES = 5;
const RETRY_BACKOFF_MS = 600;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function retryWithBackoff<T>(action: () => Promise<T>, description: string): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await action();
    } catch (error) {
      const status = (error as any)?.status;
      const message = error instanceof Error ? error.message : String(error);
      const isRateLimit = status === 429 || message.toLowerCase().includes('too many requests');

      if (!isRateLimit || attempt >= MAX_UPLOAD_RETRIES - 1) throw error;

      const delay = RETRY_BACKOFF_MS * Math.pow(2, attempt);
      logger.warn(`Retrying ${description} after rate limit`, { attempt: attempt + 1, delay });
      await sleep(delay);
      attempt += 1;
    }
  }
}

export async function uploadMediaToBlob(
  mediaFile: File | Blob,
  filename: string,
  accessToken?: string
): Promise<{ url: string; mediaType: 'image' | 'video'; mimeType: string }> {
  const mediaType = mediaFile.type.startsWith('video/') ? 'video' : 'image';

  // Get a signed upload URL from Supabase Storage
  const { signedUrl, publicUrl } = await retryWithBackoff(async () => {
    const res = await fetch('/api/upload-signed-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ filename, type: mediaFile.type, size: mediaFile.size }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw Object.assign(new Error(err.error || 'Failed to get upload URL'), { status: res.status });
    }
    return res.json();
  }, 'get signed upload URL');

  // Upload directly to Supabase Storage (client → storage, no proxy)
  await retryWithBackoff(async () => {
    const res = await fetch(signedUrl, {
      method: 'PUT',
      body: mediaFile,
      headers: { 'Content-Type': mediaFile.type },
    });
    if (!res.ok) {
      throw Object.assign(new Error(`Storage upload failed: ${res.statusText}`), { status: res.status });
    }
  }, 'upload to Supabase Storage');

  return { url: publicUrl, mediaType, mimeType: mediaFile.type };
}

// Kept for backward compatibility
export async function uploadImageToBlob(
  imageFile: File | Blob,
  filename: string,
  accessToken?: string
): Promise<string> {
  const result = await uploadMediaToBlob(imageFile, filename, accessToken);
  return result.url;
}

export function base64ToBlob(base64String: string, mimeType: string = 'image/png'): Blob {
  const base64Data = base64String.replace(/^data:(image|video)\/[a-z0-9+-]+;base64,/, '');
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  return new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
}

export function isValidBlobUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  if (url.startsWith('blob:http://localhost') || url.startsWith('blob:http://127.0.0.1')) return true;
  if (url.startsWith('https://')) {
    try { new URL(url); return true; } catch { return false; }
  }
  return false;
}

export function isValidMediaData(mediaData: string): {
  isValid: boolean;
  type: 'blob' | 'base64' | 'invalid';
  mediaType: 'image' | 'video' | 'unknown';
} {
  if (!mediaData || typeof mediaData !== 'string') return { isValid: false, type: 'invalid', mediaType: 'unknown' };
  if (mediaData.startsWith('data:image/')) return { isValid: true, type: 'base64', mediaType: 'image' };
  if (mediaData.startsWith('data:video/')) return { isValid: true, type: 'base64', mediaType: 'video' };
  if (isValidBlobUrl(mediaData)) return { isValid: true, type: 'blob', mediaType: 'unknown' };
  return { isValid: false, type: 'invalid', mediaType: 'unknown' };
}

export function isValidImageData(imageData: string): { isValid: boolean; type: 'blob' | 'base64' | 'invalid' } {
  const result = isValidMediaData(imageData);
  return { isValid: result.isValid && (result.mediaType === 'image' || result.mediaType === 'unknown'), type: result.type };
}

export function isVideoFile(file: File | Blob): boolean {
  return file.type.startsWith('video/');
}

export function getMediaType(file: File | Blob): 'image' | 'video' | 'unknown' {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  return 'unknown';
}
