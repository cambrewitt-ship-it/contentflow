// src/app/api/publishToMeta/route.ts
import { NextResponse } from 'next/server';

// Meta API configuration from environment variables
const META_APP_ID = process.env.META_APP_ID;
const META_APP_SECRET = process.env.META_APP_SECRET;
const META_PAGE_ID = process.env.META_PAGE_ID;
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;

// Facebook Graph API base URL
const FACEBOOK_GRAPH_API_BASE = 'https://graph.facebook.com/v19.0';

// Validate required environment variables
if (!META_APP_ID || !META_APP_SECRET || !META_PAGE_ID || !META_ACCESS_TOKEN) {
  console.error('Missing Meta API environment variables. Ensure META_APP_ID, META_APP_SECRET, META_PAGE_ID, and META_ACCESS_TOKEN are set.');
}

export async function POST(req: Request) {
  try {
    console.log('🔄 Meta API publish request received');
    
    const body = await req.json();
    const { postId, platform, caption, imageUrl, scheduledTime } = body ?? {};

    // Validate required fields
    if (!postId || !platform || !caption || !imageUrl || !scheduledTime) {
      console.error('❌ Missing required fields:', { postId, platform, caption, imageUrl, scheduledTime });
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required fields: postId, platform, caption, imageUrl, scheduledTime' 
      }, { status: 400 });
    }

    console.log('📝 Publishing post to Meta:', { postId, platform, scheduledTime });

    // Handle different platforms
    let result;
    if (platform === 'instagram') {
      result = await scheduleInstagramPost(caption, imageUrl, scheduledTime);
    } else if (platform === 'facebook') {
      result = await scheduleFacebookPost(caption, imageUrl, scheduledTime);
    } else if (platform === 'both') {
      // Schedule to both platforms
      const [instagramResult, facebookResult] = await Promise.all([
        scheduleInstagramPost(caption, imageUrl, scheduledTime),
        scheduleFacebookPost(caption, imageUrl, scheduledTime)
      ]);
      
      result = {
        success: instagramResult.success && facebookResult.success,
        instagram: instagramResult,
        facebook: facebookResult
      };
    } else {
      return NextResponse.json({ 
        success: false, 
        error: `Unsupported platform: ${platform}` 
      }, { status: 400 });
    }

    if (result.success) {
      console.log('✅ Meta API publish successful:', result);
      return NextResponse.json({ 
        success: true, 
        result,
        message: `Post scheduled successfully to ${platform}` 
      });
    } else {
      console.error('❌ Meta API publish failed:', result);
      return NextResponse.json({ 
        success: false, 
        error: result.error || 'Failed to schedule post to Meta' 
      }, { status: 500 });
    }

  } catch (err: any) {
    console.error('❌ Unexpected error in publishToMeta route:', err);
    return NextResponse.json({ 
      success: false, 
      error: err?.message || 'Unknown error occurred' 
    }, { status: 500 });
  }
}

async function scheduleInstagramPost(caption: string, imageUrl: string, scheduledTime: string): Promise<any> {
  try {
    console.log('📸 Scheduling Instagram post:', { scheduledTime });
    
    // First, create a media container
    const mediaContainerResponse = await fetch(`${FACEBOOK_GRAPH_API_BASE}/${META_PAGE_ID}/media`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_url: imageUrl,
        caption: caption,
        access_token: META_ACCESS_TOKEN,
      }),
    });

    const mediaContainerData = await mediaContainerResponse.json();
    
    if (!mediaContainerData.id) {
      throw new Error(`Failed to create media container: ${JSON.stringify(mediaContainerData)}`);
    }

    console.log('📦 Instagram media container created:', mediaContainerData.id);

    // Schedule the post
    const publishResponse = await fetch(`${FACEBOOK_GRAPH_API_BASE}/${META_PAGE_ID}/media_publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        creation_id: mediaContainerData.id,
        scheduled_publish_time: Math.floor(new Date(scheduledTime).getTime() / 1000),
        access_token: META_ACCESS_TOKEN,
      }),
    });

    const publishData = await publishResponse.json();
    
    if (!publishData.id) {
      throw new Error(`Failed to schedule Instagram post: ${JSON.stringify(publishData)}`);
    }

    console.log('✅ Instagram post scheduled successfully:', publishData.id);
    return { success: true, postId: publishData.id, platform: 'instagram' };

  } catch (error: any) {
    console.error('❌ Instagram scheduling error:', error);
    return { success: false, error: error.message, platform: 'instagram' };
  }
}

async function scheduleFacebookPost(caption: string, imageUrl: string, scheduledTime: string): Promise<any> {
  try {
    console.log('📘 Scheduling Facebook post:', { scheduledTime });
    
    // Schedule the post directly to Facebook
    const response = await fetch(`${FACEBOOK_GRAPH_API_BASE}/${META_PAGE_ID}/feed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: caption,
        link: imageUrl,
        scheduled_publish_time: Math.floor(new Date(scheduledTime).getTime() / 1000),
        access_token: META_ACCESS_TOKEN,
      }),
    });

    const data = await response.json();
    
    if (!data.id) {
      throw new Error(`Failed to schedule Facebook post: ${JSON.stringify(data)}`);
    }

    console.log('✅ Facebook post scheduled successfully:', data.id);
    return { success: true, postId: data.id, platform: 'facebook' };

  } catch (error: any) {
    console.error('❌ Facebook scheduling error:', error);
    return { success: false, error: error.message, platform: 'facebook' };
  }
}
