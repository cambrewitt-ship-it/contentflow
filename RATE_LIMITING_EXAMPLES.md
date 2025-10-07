# Rate Limiting Examples and Configuration

This document provides comprehensive examples of how to configure and use rate limiting in your ContentFlow application.

## Basic Configuration

### Environment Variables

```bash
# .env.local
UPSTASH_REDIS_REST_URL=https://your-redis-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token
```

### Rate Limit Tiers

```typescript
// src/lib/rateLimit.ts
export const rateLimitConfigs = {
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
};
```

## Route Pattern Configuration

### Automatic Route Classification

```typescript
// src/lib/rateLimit.ts
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
```

### Adding New Route Patterns

```typescript
// Add new patterns to routePatterns
export const routePatterns: Record<string, RateLimitTier> = {
  // ... existing patterns
  
  // New patterns
  '/api/admin': 'authenticated',        // Admin routes
  '/api/webhooks': 'public',           // Webhook endpoints
  '/api/analytics': 'authenticated',   // Analytics endpoints
  '/api/export': 'ai',                 // Export operations (expensive)
};
```

## API Route Examples

### 1. Basic Rate Limited Route

```typescript
// src/app/api/example/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/apiRateLimit';

export const GET = withRateLimit(async (request: NextRequest) => {
  return NextResponse.json({
    success: true,
    message: 'This endpoint is rate limited',
    timestamp: new Date().toISOString(),
  });
});
```

### 2. Different HTTP Methods

```typescript
// src/app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/apiRateLimit';

// All methods are rate limited
export const GET = withRateLimit(async (request: NextRequest) => {
  // Get users logic
  return NextResponse.json({ users: [] });
});

export const POST = withRateLimit(async (request: NextRequest) => {
  // Create user logic
  return NextResponse.json({ success: true });
});

export const PUT = withRateLimit(async (request: NextRequest) => {
  // Update user logic
  return NextResponse.json({ success: true });
});

export const DELETE = withRateLimit(async (request: NextRequest) => {
  // Delete user logic
  return NextResponse.json({ success: true });
});
```

### 3. Custom Rate Limiting

```typescript
// src/app/api/custom-limit/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withApiRateLimit } from '@/lib/rateLimitMiddleware';

// Custom rate limiting with specific tier
export const POST = withApiRateLimit(async (request: NextRequest) => {
  // This will use the route pattern to determine rate limit tier
  return NextResponse.json({ success: true });
});
```

### 4. Route Without Rate Limiting

```typescript
// src/app/api/no-limit/route.ts
import { NextRequest, NextResponse } from 'next/server';

// This route bypasses rate limiting
export const GET = async (request: NextRequest) => {
  return NextResponse.json({
    success: true,
    message: 'This endpoint has no rate limiting',
  });
};
```

## Custom Rate Limit Tiers

### Adding New Tiers

```typescript
// src/lib/rateLimit.ts

// Add new tier to rateLimitConfigs
export const rateLimitConfigs = {
  // ... existing configs
  
  // Premium users - higher limits
  premium: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(500, '15 m'), // 500 requests per 15 minutes
    analytics: true,
    prefix: 'ratelimit:premium',
  }),

  // Free tier - lower limits
  free: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(25, '15 m'), // 25 requests per 15 minutes
    analytics: true,
    prefix: 'ratelimit:free',
  }),
};

// Add new tier type
export type RateLimitTier = 'ai' | 'authenticated' | 'public' | 'portal' | 'auth' | 'premium' | 'free';

// Add route patterns for new tiers
export const routePatterns: Record<string, RateLimitTier> = {
  // ... existing patterns
  
  '/api/premium': 'premium',
  '/api/free': 'free',
};
```

### Dynamic Rate Limiting Based on User Type

```typescript
// src/lib/rateLimitMiddleware.ts

export async function getDynamicRateLimitTier(request: NextRequest, userId?: string): Promise<RateLimitTier> {
  if (!userId) {
    return 'public';
  }

  // Check user subscription/plan
  // This would typically query your database
  const userPlan = await getUserPlan(userId);
  
  switch (userPlan) {
    case 'premium':
      return 'premium';
    case 'free':
      return 'free';
    default:
      return 'authenticated';
  }
}
```

## Advanced Configuration

### Custom Rate Limit Windows

```typescript
// Different time windows for different use cases
export const rateLimitConfigs = {
  // Burst protection - short window
  burst: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 requests per minute
    analytics: true,
    prefix: 'ratelimit:burst',
  }),

  // Daily limits - long window
  daily: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(1000, '24 h'), // 1000 requests per day
    analytics: true,
    prefix: 'ratelimit:daily',
  }),

  // Weekly limits - very long window
  weekly: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5000, '7 d'), // 5000 requests per week
    analytics: true,
    prefix: 'ratelimit:weekly',
  }),
};
```

### Multiple Rate Limits per Route

```typescript
// src/app/api/multi-limit/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, createRateLimitResponse } from '@/lib/rateLimit';

export const POST = async (request: NextRequest) => {
  const identifier = getClientIdentifier(request);
  
  // Check burst limit (short-term)
  const burstResult = await checkRateLimit(request, 'burst', identifier);
  if (!burstResult.success) {
    return createRateLimitResponse(
      burstResult.limit,
      burstResult.remaining,
      burstResult.reset
    );
  }
  
  // Check daily limit (long-term)
  const dailyResult = await checkRateLimit(request, 'daily', identifier);
  if (!dailyResult.success) {
    return createRateLimitResponse(
      dailyResult.limit,
      dailyResult.remaining,
      dailyResult.reset
    );
  }
  
  // Process request
  return NextResponse.json({ success: true });
};
```

## Monitoring and Debugging

### Rate Limit Status Endpoint

```typescript
// src/app/api/rate-limit-status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getRateLimitStatus } from '@/lib/apiRateLimit';

export const GET = async (request: NextRequest) => {
  const status = await getRateLimitStatus(request);
  
  return NextResponse.json({
    rateLimitStatus: status,
    timestamp: new Date().toISOString(),
  });
};
```

### Custom Rate Limit Headers

```typescript
// Add custom headers to responses
export const GET = withRateLimit(async (request: NextRequest) => {
  const response = NextResponse.json({ success: true });
  
  // Add custom rate limit information
  response.headers.set('X-Custom-Rate-Limit', 'enabled');
  response.headers.set('X-Rate-Limit-Tier', 'authenticated');
  
  return response;
});
```

## Testing Rate Limits

### Unit Tests

```typescript
// tests/rate-limit.test.ts
import { checkRateLimit, getRateLimitTier } from '@/lib/rateLimit';

describe('Rate Limiting', () => {
  test('should identify AI tier correctly', () => {
    expect(getRateLimitTier('/api/ai')).toBe('ai');
  });

  test('should identify authenticated tier correctly', () => {
    expect(getRateLimitTier('/api/clients')).toBe('authenticated');
  });

  test('should default to public tier', () => {
    expect(getRateLimitTier('/api/unknown')).toBe('public');
  });
});
```

### Integration Tests

```typescript
// tests/api/rate-limit.integration.test.ts
import { makeRequest } from '../helpers/test-utils';

describe('Rate Limiting Integration', () => {
  test('should rate limit AI endpoints', async () => {
    const requests = Array(25).fill(null).map(() => 
      makeRequest('/api/ai', { method: 'POST', body: { action: 'test' } })
    );
    
    const responses = await Promise.all(requests);
    const rateLimitedResponses = responses.filter(r => r.status === 429);
    
    expect(rateLimitedResponses.length).toBeGreaterThan(0);
  });
});
```

## Error Handling

### Graceful Degradation

```typescript
// src/lib/rateLimit.ts
export async function checkRateLimit(
  request: NextRequest,
  tier: RateLimitTier,
  identifier: string
): Promise<{ success: boolean; limit: number; remaining: number; reset: Date }> {
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
    
    // Graceful degradation - allow request if Redis is down
    return {
      success: true,
      limit: 0,
      remaining: 0,
      reset: new Date(Date.now() + 15 * 60 * 1000),
    };
  }
}
```

### Custom Error Messages

```typescript
// src/lib/rateLimit.ts
export function createRateLimitResponse(limit: number, remaining: number, reset: Date): NextResponse {
  const retryAfter = Math.ceil((reset.getTime() - Date.now()) / 1000);
  
  return NextResponse.json(
    {
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: retryAfter,
      limit: limit,
      remaining: remaining,
      // Custom error details
      details: {
        tier: 'ai',
        window: '1 hour',
        suggestion: 'Consider upgrading your plan for higher limits',
      },
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
```

## Best Practices

1. **Start Conservative**: Begin with lower limits and increase as needed
2. **Monitor Usage**: Use analytics to understand actual usage patterns
3. **Graceful Degradation**: Always allow requests if rate limiting fails
4. **Clear Error Messages**: Provide helpful information when limits are exceeded
5. **Different Tiers**: Use different limits for different user types/endpoints
6. **Test Thoroughly**: Test rate limiting in development and staging
7. **Document Limits**: Make rate limits clear to API consumers
8. **Consider Burst Protection**: Use short windows to prevent abuse
9. **Plan for Growth**: Design rate limits to scale with your application
10. **Regular Review**: Periodically review and adjust rate limits based on usage
