import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: 'Simple test endpoint',
    timestamp: new Date().toISOString(),
    pathname: request.nextUrl.pathname,

}
