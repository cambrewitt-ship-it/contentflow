import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/apiRateLimit';

// Example API route with rate limiting applied
export const GET = withRateLimit(async (request: NextRequest) => {
  return NextResponse.json({
    success: true,
    message: 'Rate limited API endpoint working correctly',
    timestamp: new Date().toISOString(),
    pathname: request.nextUrl.pathname,
  });
});

export const POST = withRateLimit(async (request: NextRequest) => {
  const body = await request.json();
  
  return NextResponse.json({
    success: true,
    message: 'POST request to rate limited endpoint',
    receivedData: body,
    timestamp: new Date().toISOString(),
  });
});

// Example of a route without rate limiting (for comparison)
export const PUT = async (request: NextRequest) => {
  return NextResponse.json({
    success: true,
    message: 'This endpoint has no rate limiting applied',
    timestamp: new Date().toISOString(),
  });
};
