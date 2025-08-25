import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { imageBlob } = await request.json();
    
    console.log('Upload media request received');
    
    if (!imageBlob) {
      throw new Error('No image data provided');
    }
    
    console.log('Processing base64 image blob');
    
    // Convert base64 to blob
    const base64Data = imageBlob.split(',')[1];
    const binaryData = Buffer.from(base64Data, 'base64');
    const blob = new Blob([binaryData], { type: 'image/jpeg' });
    
    // Create form data
    const formData = new FormData();
    formData.append('files', blob, 'image.jpg');
    
    // Upload to LATE API
    const response = await fetch('https://getlate.dev/api/v1/media', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.LATE_API_KEY}`
      },
      body: formData
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('LATE API error:', error);
      throw new Error('Failed to upload to LATE');
    }
    
    const data = await response.json();
    console.log('LATE media upload success:', data);
    
    return NextResponse.json({ 
      success: true, 
      lateMediaUrl: data.files[0].url 
    });
    
  } catch (error) {
    console.error('Error uploading media:', error);
    return NextResponse.json({ error: 'Failed to upload media' }, { status: 500 });
  }
}
