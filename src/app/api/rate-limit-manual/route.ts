import { NextRequest, NextResponse } from 'next/server';
import { checkSimpleRateLimit, getRateLimitTier, getClientIdentifier, createRateLimitResponse } from '../../../lib/simpleRateLimit';

export async function GET(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const tier = getRateLimitTier(pathname);
  const identifier = getClientIdentifier(request);
  
  console.log('🔍 Manual rate limit check:', { pathname, tier, identifier });
  
  const result = checkSimpleRateLimit(request, tier, identifier);
  console.log('📊 Rate limit result:', result);
  
  if (!result.success) {
    console.log('🚫 Rate limit exceeded!');
    return createRateLimitResponse(result.limit, result.remaining, result.reset);
  }
  
  const response = NextResponse.json({
    success: true,
    message: 'Manual rate limited endpoint',
    timestamp: new Date().toISOString(),
    pathname: request.nextUrl.pathname,
    rateLimitInfo: {
      tier,
      identifier,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset.toISOString(),
    },
  });
  
  // Add rate limit headers
  response.headers.set('X-RateLimit-Limit', result.limit.toString());
  response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
  response.headers.set('X-RateLimit-Reset', result.reset.toISOString());
  
  return response;
}
