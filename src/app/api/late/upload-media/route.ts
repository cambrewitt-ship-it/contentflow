import { NextResponse } from 'next/server';
import { isValidImageData, base64ToBlob } from '../../../../lib/blobUpload';

export async function POST(request: Request) {
  try {
    const { imageBlob } = await request.json();
    console.log('Image data type:', typeof imageBlob);
    console.log('Image data preview:', imageBlob?.substring(0, 50));
    
    // Validate image data (supports both blob URLs and base64)
    const validation = isValidImageData(imageBlob);
    if (!validation.isValid) {
      throw new Error('Invalid image data - must be blob URL or base64');
    }
    
    console.log('Image data type detected:', validation.type);
    
    let buffer: Buffer;
    
    if (validation.type === 'blob') {
      // Fetch image from blob URL
      console.log('Fetching image from blob URL...');
      const response = await fetch(imageBlob);
      if (!response.ok) {
        throw new Error('Failed to fetch image from blob URL');
      }
      const arrayBuffer = await response.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else {
      // Handle base64 (backward compatibility)
      console.log('Processing base64 image...');
      const base64Data = imageBlob.replace(/^data:image\/\w+;base64,/, '');
      buffer = Buffer.from(base64Data, 'base64');
    }
    
    console.log('Buffer size:', buffer.length);
    
    // If buffer is over 4MB, it might be too large
    if (buffer.length > 4 * 1024 * 1024) {
      console.error('Image too large:', buffer.length, 'bytes');
    }
    
    // Create FormData
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(buffer)], { type: 'image/jpeg' });
    formData.append('files', blob, 'image.jpg');
    
    // Upload to LATE
    console.log('Uploading to LATE...');
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
    
    return NextResponse.json({ lateMediaUrl: data.files[0].url });
    
  } catch (error) {
    console.error('Upload error details:', error);
    return NextResponse.json({ error: 'Failed to upload media' }, { status: 500 });
  }
}
