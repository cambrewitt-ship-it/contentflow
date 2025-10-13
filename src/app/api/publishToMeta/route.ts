// src/app/api/publishToMeta/route.ts
import { NextResponse } from 'next/server';
import logger from '@/lib/logger';

// TypeScript interfaces for better type safety
interface SchedulingResult {
  success: boolean;
  postId?: string;
  platform: 'instagram' | 'facebook';
  error?: string;
}

// Meta API configuration from environment variables
const META_APP_ID = process.env.META_APP_ID;
const META_APP_SECRET = process.env.META_APP_SECRET;
const META_PAGE_ID = process.env.META_PAGE_ID;
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;

// Facebook Graph API base URL
const FACEBOOK_GRAPH_API_BASE = 'https://graph.facebook.com/v19.0';

// Validate required environment variables
if (!META_APP_ID || !META_APP_SECRET || !META_PAGE_ID || !META_ACCESS_TOKEN) {
  logger.error('Missing Meta API environment variables. Ensure META_APP_ID, META_APP_SECRET, META_PAGE_ID, and META_ACCESS_TOKEN are set.');
}

export async function POST(req: Request) {
  try {

    const body = await req.json();
    const { postId, platform, caption, imageUrl, scheduledTime } = body ?? {};

    // Validate required fields
    if (!postId || !platform || !caption || !imageUrl || !scheduledTime) {
      logger.error('❌ Missing required fields:', { postId, platform, caption, imageUrl, scheduledTime });
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required fields: postId, platform, caption, imageUrl, scheduledTime' 
      }, { status: 400 });
    }

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

      return NextResponse.json({ 
        success: true, 
        result,
        message: `Post scheduled successfully to ${platform}` 
      });
    } else {
      logger.error('❌ Meta API publish failed:', result);
      return NextResponse.json({ 
        success: false, 
        error: result.error || 'Failed to schedule post to Meta' 
      }, { status: 500 });
    }

  } catch (err: unknown) {
    logger.error('❌ Unexpected error in publishToMeta route:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
    return NextResponse.json({ 
      success: false, 
      error: errorMessage
    }, { status: 500 });
  }
}

async function scheduleInstagramPost(caption: string, image_url: string, scheduledTime: string): Promise<SchedulingResult> {
  try {

    // First, create a media container
    const mediaContainerResponse = await fetch(`${FACEBOOK_GRAPH_API_BASE}/${META_PAGE_ID}/media`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_url: image_url,  // ✅ Fixed: now uses consistent 'image_url' parameter
        caption: caption,
        access_token: META_ACCESS_TOKEN,
      }),
    });

    const mediaContainerData = await mediaContainerResponse.json();
    
    if (!mediaContainerData.id) {
      throw new Error(`Failed to create media container: ${JSON.stringify(mediaContainerData)}`);
    }

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

    return { success: true, postId: publishData.id, platform: 'instagram' };

  } catch (error: unknown) {
    logger.error('❌ Instagram scheduling error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return { success: false, error: errorMessage, platform: 'instagram' };
  }
}

async function scheduleFacebookPost(caption: string, image_url: string, scheduledTime: string): Promise<SchedulingResult> {
  try {

    // Schedule the post directly to Facebook
    const response = await fetch(`${FACEBOOK_GRAPH_API_BASE}/${META_PAGE_ID}/feed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: caption,
        link: image_url,  // ✅ Fixed: now uses consistent 'image_url' parameter
        scheduled_publish_time: Math.floor(new Date(scheduledTime).getTime() / 1000),
        access_token: META_ACCESS_TOKEN,
      }),
    });

    const data = await response.json();
    
    if (!data.id) {
      throw new Error(`Failed to schedule Facebook post: ${JSON.stringify(data)}`);
    }

    return { success: true, postId: data.id, platform: 'facebook' };
  } catch (error: unknown) {
    logger.error('❌ Facebook scheduling error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return { success: false, error: errorMessage, platform: 'facebook' };
  }
}
