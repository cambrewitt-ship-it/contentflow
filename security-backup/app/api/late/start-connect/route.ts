import { NextResponse } from 'next/server';
import logger from '@/lib/logger';

const LATE_API_KEY = process.env.LATE_API_KEY!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!; // set in .env.local

export async function POST(req: Request) {
  try {
    // 2. Validate required environment variables
    if (!process.env.LATE_API_KEY) {
      logger.error('Missing LATE_API_KEY environment variable');
      return NextResponse.json({ error: 'Missing LATE_API_KEY' }, { status: 500 });
    }
    
    if (!process.env.NEXT_PUBLIC_APP_URL) {
      logger.error('Missing NEXT_PUBLIC_APP_URL environment variable');
      return NextResponse.json({ error: 'Missing NEXT_PUBLIC_APP_URL' }, { status: 500 });
    }
    
    // 3. Parse request body
    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      logger.error('Failed to parse request body:', parseError);
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    
    const { platform, profileId, clientId } = body;
    if (!platform) {
      logger.error('Missing platform in request body');
      return NextResponse.json({ error: 'Missing platform' }, { status: 400 });
    }
    
    if (!profileId) {
      logger.error('Missing profileId in request body');
      return NextResponse.json({ error: 'Missing profileId' }, { status: 400 });
    }

    // 7. Build connect URL
    const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://contentflow-v2.vercel.app'}/api/late/oauth-callback`;
    const connectUrl = `https://getlate.dev/api/v1/connect/${platform}?profileId=${profileId}&redirect_url=${encodeURIComponent(redirectUrl)}`;

    return NextResponse.json({ connectUrl });
    
  } catch (error: unknown) {
    logger.error('LATE API start-connect error:', {
      type: typeof error,
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : 'Unknown'
    });
    
    return NextResponse.json({ 
      error: 'Internal server error in LATE API integration',
      details: error instanceof Error ? error.message : String(error),
      step: 'unhandled_exception',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
