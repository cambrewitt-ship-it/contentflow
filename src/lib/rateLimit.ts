import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextRequest, NextResponse } from 'next/server';

// Initialize Redis client with fallback
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

// Rate limit configurations for different tiers
export const rateLimitConfigs = redis ? {
  // AI endpoints - most restrictive (expensive operations)
  ai: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '1 h'), // 20 requests per hour
    analytics: true,
    prefix: 'ratelimit:ai',
  }),

  // Authenticated users - standard rate limit
  authenticated: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, '15 m'), // 100 requests per 15 minutes
    analytics: true,
    prefix: 'ratelimit:auth',
  }),

  // Unauthenticated/public routes - more restrictive
  public: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '15 m'), // 10 requests per 15 minutes
    analytics: true,
    prefix: 'ratelimit:public',
  }),

  // Portal routes - moderate rate limit
  portal: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(50, '15 m'), // 50 requests per 15 minutes
    analytics: true,
    prefix: 'ratelimit:portal',
  }),

  // Auth routes - moderate rate limit to prevent brute force
  auth: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '15 m'), // 20 requests per 15 minutes
    analytics: true,
    prefix: 'ratelimit:auth_routes',
  }),
} : null;

// Rate limit tier definitions
export type RateLimitTier = 'ai' | 'authenticated' | 'public' | 'portal' | 'auth';

// Route patterns and their corresponding rate limit tiers
export const routePatterns: Record<string, RateLimitTier> = {
  // AI endpoints - most restrictive
  '/api/ai': 'ai',
  '/api/analyze-website-temp': 'ai',
  
  // Authentication routes
  '/api/auth': 'auth',
  '/auth/login': 'auth',
  '/auth/signup': 'auth',
  '/auth/callback': 'auth',
  
  // Portal routes
  '/api/portal': 'portal',
  '/portal': 'portal',
  
  // Client routes (authenticated)
  '/api/clients': 'authenticated',
  
  // All other API routes default to public
  '/api': 'public',
};

// Helper function to determine rate limit tier based on pathname
export function getRateLimitTier(pathname: string): RateLimitTier {
  // Check for exact matches first
  for (const [pattern, tier] of Object.entries(routePatterns)) {
    if (pathname.startsWith(pattern)) {
      return tier;
    }
  }
  
  // Default to public for unmatched routes
  return 'public';
}

// Helper function to get client identifier for rate limiting
export function getClientIdentifier(request: NextRequest): string {
  // Try to get user ID from authorization header first
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    // For authenticated requests, we'll use a placeholder that will be replaced
    // with actual user ID in the middleware
    return 'auth_user';
  }
  
  // For portal requests, try to get token from query params
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (token) {
    return `portal_${token}`;
  }
  
  // Fall back to IP address for public requests
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : request.ip || 'unknown';
  return `ip_${ip}`;
}

// Main rate limiting function
export async function checkRateLimit(
  request: NextRequest,
  tier: RateLimitTier,
  identifier: string
): Promise<{ success: boolean; limit: number; remaining: number; reset: Date }> {
  // If Redis is not configured, allow all requests
  if (!rateLimitConfigs || !redis) {
    console.warn('Rate limiting disabled: Redis not configured');
    return {
      success: true,
      limit: 0,
      remaining: 0,
      reset: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes from now
    };
  }

  try {
    const { success, limit, remaining, reset } = await rateLimitConfigs[tier].limit(identifier);
    
    return {
      success,
      limit,
      remaining,
      reset: new Date(reset),
    };
  } catch (error) {
    console.error('Rate limit check failed:', error);
    // In case of Redis failure, allow the request but log the error
    return {
      success: true,
      limit: 0,
      remaining: 0,
      reset: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes from now
    };
  }
}

// Create rate limit response
export function createRateLimitResponse(limit: number, remaining: number, reset: Date): NextResponse {
  const retryAfter = Math.ceil((reset.getTime() - Date.now()) / 1000);
  
  return NextResponse.json(
    {
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: retryAfter,
      limit: limit,
      remaining: remaining,
    },
    {
      status: 429,
      headers: {
        'Retry-After': retryAfter.toString(),
        'X-RateLimit-Limit': limit.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': reset.toISOString(),
      },
    }
  );
}

// Rate limiting middleware wrapper
export async function withRateLimit(
  request: NextRequest,
  handler: (request: NextRequest) => Promise<NextResponse>,
  customTier?: RateLimitTier
): Promise<NextResponse> {
  const pathname = request.nextUrl.pathname;
  const tier = customTier || getRateLimitTier(pathname);
  const identifier = getClientIdentifier(request);
  
  // Check rate limit
  const rateLimitResult = await checkRateLimit(request, tier, identifier);
  
  if (!rateLimitResult.success) {
    return createRateLimitResponse(
      rateLimitResult.limit,
      rateLimitResult.remaining,
      rateLimitResult.reset
    );
  }
  
  // Add rate limit headers to successful responses
  const response = await handler(request);
  
  response.headers.set('X-RateLimit-Limit', rateLimitResult.limit.toString());
  response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
  response.headers.set('X-RateLimit-Reset', rateLimitResult.reset.toISOString());
  
  return response;
}

// Environment validation
export function validateRateLimitConfig(): boolean {
  const requiredEnvVars = ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.warn('Rate limiting disabled: Missing environment variables:', missingVars);
    return false;
  }
  
  return true;
}
