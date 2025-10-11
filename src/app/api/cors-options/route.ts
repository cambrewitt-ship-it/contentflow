import { NextRequest, NextResponse } from 'next/server';
import { handleCorsPreflight } from '@/lib/corsMiddleware';

export async function OPTIONS(request: NextRequest) {
  // Handle CORS preflight requests
  const preflightResponse = handleCorsPreflight(request);
  if (preflightResponse) {
    return preflightResponse;
  }

  // Default response if no specific CORS handling needed
  return new NextResponse(null, { status: 200 });
}
