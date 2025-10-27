import { NextRequest, NextResponse } from 'next/server';
import { withApiRateLimit } from './rateLimitMiddleware';

// Higher-order function to wrap API route handlers with rate limiting
export function withRateLimit<T extends unknown[]>(
  handler: (...args: T) => Promise<NextResponse>
) {
  return withApiRateLimit(handler);
}

// Example usage for API routes:
/*
import { withRateLimit } from '@/lib/apiRateLimit';

export const GET = withRateLimit(async (request: NextRequest) => {
  // Your API logic here
  return NextResponse.json({ success: true });
});

export const POST = withRateLimit(async (request: NextRequest) => {
  // Your API logic here
  return NextResponse.json({ success: true });
});
*/

// Rate limit status checker for debugging
export async function getRateLimitStatus(request: NextRequest) {
  const { getRateLimitTier, getClientIdentifier, checkRateLimit } = await import('./rateLimit');
  
  const pathname = request.nextUrl.pathname;
  const tier = getRateLimitTier(pathname);
  const identifier = getClientIdentifier(request);
  
  try {
    const result = await checkRateLimit(request, tier, identifier);
    return {
      tier,
      identifier,
      ...result,
    };
  } catch (error) {
    return {
      tier,
      identifier,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
