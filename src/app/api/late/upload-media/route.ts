import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 LATE media upload endpoint hit');
    
    // Get the LATE API key from environment
    const lateApiKey = process.env.LATE_API_KEY;
    if (!lateApiKey) {
      console.error('❌ LATE_API_KEY not found in environment');
      return NextResponse.json(
        { error: 'LATE API key not configured' },
        { status: 500 }
      );
    }

    // Parse the form data
    const formData = await request.formData();
    const mediaFile = formData.get('media') as File;
    
    if (!mediaFile) {
      console.error('❌ No media file found in request');
      return NextResponse.json(
        { error: 'No media file provided' },
        { status: 400 }
      );
    }

    console.log('📁 Media file received:', {
      name: mediaFile.name,
      type: mediaFile.type,
      size: mediaFile.size
    });

    // Convert File to Buffer for LATE API
    const arrayBuffer = await mediaFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Create form data for LATE API
    const lateFormData = new FormData();
    lateFormData.append('media', new Blob([buffer], { type: mediaFile.type }), mediaFile.name);

    console.log('📤 Uploading to LATE API...');
    
    // Upload to LATE API
    const lateResponse = await fetch('https://getlate.dev/api/v1/media', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lateApiKey}`,
      },
      body: lateFormData,
    });

    if (!lateResponse.ok) {
      const errorText = await lateResponse.text();
      console.error('❌ LATE API upload failed:', {
        status: lateResponse.status,
        statusText: lateResponse.statusText,
        error: errorText
      });
      throw new Error(`LATE API upload failed: ${lateResponse.status} ${lateResponse.statusText}`);
    }

    const lateData = await lateResponse.json();
    console.log('✅ LATE API upload successful:', lateData);

    // Extract the media URL from LATE response
    const mediaUrl = lateData.mediaUrl || lateData.url || lateData.media?.url;
    
    if (!mediaUrl) {
      console.error('❌ No media URL in LATE response:', lateData);
      throw new Error('No media URL received from LATE API');
    }

    console.log('✅ Media URL extracted:', mediaUrl);

    return NextResponse.json({
      success: true,
      mediaUrl: mediaUrl,
      mediaId: lateData.mediaId || lateData.id,
      message: 'Media uploaded successfully to LATE API'
    });

  } catch (error) {
    console.error('❌ Error in LATE media upload:', error);
    return NextResponse.json(
      { 
        error: 'Failed to upload media to LATE API',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
