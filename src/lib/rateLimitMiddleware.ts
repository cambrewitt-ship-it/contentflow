import { NextRequest, NextResponse } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { 
  getRateLimitTier, 
  getClientIdentifier, 
  checkRateLimit, 
  createRateLimitResponse,
  validateRateLimitConfig 
} from './rateLimit';

// Rate limiting middleware for API routes
export async function rateLimitMiddleware(request: NextRequest): Promise<NextResponse | null> {
  // Skip rate limiting if Redis is not configured
  if (!validateRateLimitConfig()) {
    console.warn('Rate limiting disabled: Redis configuration missing');
    return null;
  }

  const pathname = request.nextUrl.pathname;
  
  // Only apply rate limiting to API routes
  if (!pathname.startsWith('/api/')) {
    return null;
  }

  try {
    // Determine rate limit tier
    const tier = getRateLimitTier(pathname);
    
    // Get client identifier
    let identifier = getClientIdentifier(request);
    
    // For authenticated routes, try to get actual user ID
    if (tier === 'authenticated' || tier === 'ai') {
      try {
        const res = NextResponse.next();
        const supabase = createMiddlewareClient({ req: request, res });
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user?.id) {
          identifier = `user_${session.user.id}`;
        }
      } catch (error) {
        console.warn('Failed to get user session for rate limiting:', error);
        // Continue with original identifier
      }
    }
    
    // Check rate limit
    const rateLimitResult = await checkRateLimit(request, tier, identifier);
    
    if (!rateLimitResult.success) {
      console.warn(`Rate limit exceeded for ${tier} tier:`, {
        identifier,
        pathname,
        limit: rateLimitResult.limit,
        remaining: rateLimitResult.remaining,
      });
      
      return createRateLimitResponse(
        rateLimitResult.limit,
        rateLimitResult.remaining,
        rateLimitResult.reset
      );
    }
    
    // Log rate limit status for monitoring
    if (rateLimitResult.remaining < 10) {
      console.warn(`Rate limit warning for ${tier} tier:`, {
        identifier,
        pathname,
        remaining: rateLimitResult.remaining,
        limit: rateLimitResult.limit,
      });
    }
    
    // Create response with rate limit headers
    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Limit', rateLimitResult.limit.toString());
    response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
    response.headers.set('X-RateLimit-Reset', rateLimitResult.reset.toISOString());
    
    return response;
    
  } catch (error) {
    console.error('Rate limiting middleware error:', error);
    // In case of error, allow the request to proceed
    return null;
  }
}

// Helper function to apply rate limiting to individual API route handlers
export function withApiRateLimit<T extends any[]>(
  handler: (...args: T) => Promise<NextResponse>
) {
  return async (...args: T): Promise<NextResponse> => {
    const request = args[0] as NextRequest;
    
    // Apply rate limiting
    const rateLimitResponse = await rateLimitMiddleware(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }
    
    // Call the original handler
    return handler(...args);
  };
}

// Rate limiting configuration for different route types
export const rateLimitConfig = {
  // AI endpoints - most restrictive
  ai: {
    requests: 20,
    window: '1 hour',
    description: 'AI endpoints (OpenAI calls) - 20 requests per hour',
  },
  
  // Authenticated users
  authenticated: {
    requests: 100,
    window: '15 minutes',
    description: 'Authenticated API routes - 100 requests per 15 minutes',
  },
  
  // Public/unauthenticated routes
  public: {
    requests: 10,
    window: '15 minutes',
    description: 'Public API routes - 10 requests per 15 minutes',
  },
  
  // Portal routes
  portal: {
    requests: 50,
    window: '15 minutes',
    description: 'Portal API routes - 50 requests per 15 minutes',
  },
  
  // Authentication routes
  auth: {
    requests: 20,
    window: '15 minutes',
    description: 'Authentication routes - 20 requests per 15 minutes',
  },
};

// Export configuration for documentation
export function getRateLimitInfo() {
  return {
    tiers: Object.entries(rateLimitConfig).map(([tier, config]) => ({
      tier,
      ...config,
    })),
    routes: {
      ai: ['/api/ai', '/api/analyze-website-temp'],
      auth: ['/api/auth/*', '/auth/login', '/auth/signup', '/auth/callback'],
      portal: ['/api/portal/*', '/portal/*'],
      authenticated: ['/api/clients/*', '/api/posts/*', '/api/projects/*'],
      public: ['All other /api/* routes'],
    },
  };
}
