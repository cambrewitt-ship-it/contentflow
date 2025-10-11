import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory rate limiting as fallback
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Simple rate limit configurations
const rateLimits = {
  ai: { requests: 20, windowMs: 60 * 60 * 1000 }, // 20 per hour
  authenticated: { requests: 100, windowMs: 15 * 60 * 1000 }, // 100 per 15 min
  public: { requests: 10, windowMs: 15 * 60 * 1000 }, // 10 per 15 min
  portal: { requests: 50, windowMs: 15 * 60 * 1000 }, // 50 per 15 min
  auth: { requests: 20, windowMs: 15 * 60 * 1000 }, // 20 per 15 min
};

export type RateLimitTier = keyof typeof rateLimits;

// Route patterns
const routePatterns: Record<string, RateLimitTier> = {
  '/api/ai': 'ai',
  '/api/analyze-website-temp': 'ai',
  '/api/auth': 'auth',
  '/auth/login': 'auth',
  '/auth/signup': 'auth',
  '/auth/callback': 'auth',
  '/api/portal': 'portal',
  '/portal': 'portal',
  '/api/clients': 'authenticated',
  '/api': 'public',
};

export function getRateLimitTier(pathname: string): RateLimitTier {
  for (const [pattern, tier] of Object.entries(routePatterns)) {
    if (pathname.startsWith(pattern)) {
      return tier;
    }
  }
  return 'public';
}

export function getClientIdentifier(request: NextRequest): string {
  // Try to get user ID from authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return 'auth_user'; // Will be replaced with actual user ID in middleware
  }
  
  // For portal requests, try to get token from query params
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (token) {
    return `portal_${token}`;
  }
  
  // Fall back to IP address
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : request.ip || 'unknown';
  return `ip_${ip}`;
}

export function checkSimpleRateLimit(
  request: NextRequest,
  tier: RateLimitTier,
  identifier: string
): { success: boolean; limit: number; remaining: number; reset: Date } {
  const config = rateLimits[tier];
  const now = Date.now();
  const key = `${tier}:${identifier}`;
  
  // Clean up expired entries
  for (const [k, v] of rateLimitStore.entries()) {
    if (v.resetTime < now) {
      rateLimitStore.delete(k);
    }
  }
  
  const entry = rateLimitStore.get(key);
  
  if (!entry) {
    // First request
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    
    return {
      success: true,
      limit: config.requests,
      remaining: config.requests - 1,
      reset: new Date(now + config.windowMs),
    };
  }
  
  if (entry.resetTime < now) {
    // Window expired, reset
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    
    return {
      success: true,
      limit: config.requests,
      remaining: config.requests - 1,
      reset: new Date(now + config.windowMs),
    };
  }
  
  if (entry.count >= config.requests) {
    // Rate limit exceeded
    return {
      success: false,
      limit: config.requests,
      remaining: 0,
      reset: new Date(entry.resetTime),
    };
  }
  
  // Increment count
  entry.count++;
  rateLimitStore.set(key, entry);
  
  return {
    success: true,
    limit: config.requests,
    remaining: config.requests - entry.count,
    reset: new Date(entry.resetTime),
  };
}

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

// Simple rate limiting middleware
export async function simpleRateLimitMiddleware(request: NextRequest): Promise<NextResponse | null> {
  const pathname = request.nextUrl.pathname;
  
  console.log('🔍 Rate limiting middleware called for:', pathname);
  
  // Only apply to API routes
  if (!pathname.startsWith('/api/')) {
    console.log('⏭️  Skipping rate limiting for non-API route:', pathname);
    return null;
  }

  try {
    const tier = getRateLimitTier(pathname);
    let identifier = getClientIdentifier(request);
    
    console.log('📊 Rate limit tier:', tier, 'Identifier:', identifier);
    
    // For authenticated routes, try to get actual user ID
    if (tier === 'authenticated' || tier === 'ai') {
      try {
        const res = NextResponse.next();
        const { createMiddlewareClient } = await import('@supabase/auth-helpers-nextjs');
        const supabase = createMiddlewareClient({ req: request, res });
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user?.id) {
          identifier = `user_${session.user.id}`;
          console.log('👤 Using user ID for rate limiting:', identifier);
        }
      } catch (error) {
        console.log('⚠️  Could not get user session:', error);
        // Continue with original identifier
      }
    }
    
    const result = checkSimpleRateLimit(request, tier, identifier);
    console.log('📈 Rate limit result:', result);
    
    if (!result.success) {
      console.warn(`🚫 Rate limit exceeded for ${tier} tier:`, {
        identifier,
        pathname,
        limit: result.limit,
        remaining: result.remaining,
      });
      
      return createRateLimitResponse(
        result.limit,
        result.remaining,
        result.reset
      );
    }
    
    // Create response with rate limit headers
    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Limit', result.limit.toString());
    response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
    response.headers.set('X-RateLimit-Reset', result.reset.toISOString());
    
    console.log('✅ Rate limit headers set:', {
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset.toISOString()
    });
    
    return response;
    
  } catch (error) {
    console.error('Simple rate limiting middleware error:', error);
    return null;
  }
}
