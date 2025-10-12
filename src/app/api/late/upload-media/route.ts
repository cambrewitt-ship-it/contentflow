import { NextResponse } from 'next/server';
import { isValidMediaData, base64ToBlob } from '../../../../lib/blobUpload';

export async function POST(request: Request) {
  try {
    const { imageBlob } = await request.json();
    console.log('Media data type:', typeof imageBlob);
    console.log('Media data preview:', imageBlob?.substring(0, 50));
    console.log('Media data length:', imageBlob?.length);
    console.log('Media data starts with data:', imageBlob?.startsWith('data:'));
    
    // Validate media data (supports both blob URLs and base64, images and videos)
    const validation = isValidMediaData(imageBlob);
    console.log('Media validation result:', validation);
    if (!validation.isValid) {
      console.error('❌ Media validation failed:', validation);
      throw new Error('Invalid media data - must be blob URL or base64 (image or video)');
    }
    
    console.log('Media data type detected:', validation.type, 'Media type:', validation.mediaType);
    
    let buffer: Buffer;
    
    if (validation.type === 'blob') {
      // Fetch media from blob URL
      console.log('Fetching media from blob URL...');
      const response = await fetch(imageBlob);
      if (!response.ok) {
        throw new Error('Failed to fetch media from blob URL');
      }
      const arrayBuffer = await response.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else {
      // Handle base64 (supports both images and videos)
      console.log(`Processing base64 ${validation.mediaType}...`);
      const base64Data = imageBlob.replace(/^data:(image|video)\/[^;]+;base64,/, '');
      buffer = Buffer.from(base64Data, 'base64');
    }
    
    console.log('Buffer size:', buffer.length);
    
    // Determine appropriate content type and filename extension
    const isVideo = validation.mediaType === 'video';
    const sizeLimitMB = isVideo ? 100 : 4;
    const sizeLimitBytes = sizeLimitMB * 1024 * 1024;
    
    // Check size limits (more lenient for videos)
    if (buffer.length > sizeLimitBytes) {
      console.error(`${isVideo ? 'Video' : 'Image'} too large:`, buffer.length, 'bytes');
      console.warn(`⚠️ ${isVideo ? 'Video' : 'Image'} exceeds ${sizeLimitMB}MB limit, but attempting upload...`);
    }
    
    // Extract MIME type from the data URL or use default
    const mimeType = imageBlob.match(/data:([^;]+)/)?.[1] || (isVideo ? 'video/mp4' : 'image/jpeg');
    const extension = isVideo ? (mimeType.split('/')[1] || 'mp4') : 'jpg';
    const filename = isVideo ? `video.${extension}` : `image.${extension}`;
    
    console.log('Media details:', { mimeType, extension, filename, isVideo });
    
    // Create FormData
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
    formData.append('files', blob, filename);
    
    // Upload to LATE
    console.log(`Uploading ${isVideo ? 'video' : 'image'} to LATE...`);
    const response = await fetch('https://getlate.dev/api/v1/media', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.LATE_API_KEY}`
      },
      body: formData
    });
    
    console.log('LATE response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('LATE error:', errorText);
      throw new Error('LATE upload failed: ' + errorText);
    }
    
    const data = await response.json();
    console.log('LATE response - success:', !data.error, 'mediaId:', data.mediaId);
    console.log('LATE response full data:', JSON.stringify(data, null, 2));
    
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
      console.error('Unexpected LATE API response structure:', data);
      throw new Error('Unexpected response structure from LATE API');
    }
    
    console.log('Extracted media URL:', mediaUrl);
    return NextResponse.json({ lateMediaUrl: mediaUrl });
    
  } catch (error) {
    console.error('Upload error details:', error);
    return NextResponse.json({ error: 'Failed to upload media' }, { status: 500 });
  }
}
