import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { imageBlob } = await request.json();
    console.log('Image blob size:', imageBlob?.length);
    console.log('Image blob type:', imageBlob?.substring(0, 50));
    
    // Check if it's base64
    if (!imageBlob || !imageBlob.startsWith('data:image')) {
      throw new Error('Invalid image data');
    }
    
    // Extract base64 and convert to buffer
    const base64Data = imageBlob.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    console.log('Buffer size:', buffer.length);
    
    // If buffer is over 4MB, it might be too large
    if (buffer.length > 4 * 1024 * 1024) {
      console.error('Image too large:', buffer.length, 'bytes');
    }
    
    // Create FormData
    const formData = new FormData();
    const blob = new Blob([buffer], { type: 'image/jpeg' });
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
    console.log('LATE response:', data);
    
    return NextResponse.json({ lateMediaUrl: data.files[0].url });
    
  } catch (error) {
    console.error('Upload error details:', error);
    return NextResponse.json({ error: 'Failed to upload media' }, { status: 500 });
  }
}
