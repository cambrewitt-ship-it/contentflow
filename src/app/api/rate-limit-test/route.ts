import { NextRequest, NextResponse } from 'next/server';

// Example API route - rate limiting is applied automatically by middleware
export const GET = async (request: NextRequest) => {
  return NextResponse.json({
    success: true,
    message: 'Rate limited API endpoint working correctly',
    timestamp: new Date().toISOString(),
    pathname: request.nextUrl.pathname,
  });
};

export const POST = async (request: NextRequest) => {
  const body = await request.json();
  
  return NextResponse.json({
    success: true,
    message: 'POST request to rate limited endpoint',
    receivedData: body,
    timestamp: new Date().toISOString(),
  });
};

// Example of a route without rate limiting (for comparison)
export const PUT = async (request: NextRequest) => {
  return NextResponse.json({
    success: true,
    message: 'This endpoint has no rate limiting applied',
    timestamp: new Date().toISOString(),
  });
};
