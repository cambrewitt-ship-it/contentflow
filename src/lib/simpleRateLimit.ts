import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';

// Simple in-memory rate limiting as fallback
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Simple rate limit configurations
const rateLimits = {
  ai: { requests: 20, windowMs: 60 * 60 * 1000 }, // 20 per hour
  authenticated: { requests: 1000, windowMs: 15 * 60 * 1000 }, // 1000 per 15 min - Increased for normal app usage
  public: { requests: 10, windowMs: 15 * 60 * 1000 }, // 10 per 15 min
  portal: { requests: 20, windowMs: 60 * 60 * 1000 }, // 20 per hour
  portalAuth: { requests: 120, windowMs: 60 * 60 * 1000 }, // 120 per hour (2/min — nav, refresh, strict-mode)
  auth: { requests: 20, windowMs: 15 * 60 * 1000 }, // 20 per 15 min
  webhook: { requests: 1000, windowMs: 60 * 60 * 1000 }, // 1000 per hour - High limit for Stripe webhooks
};

export type RateLimitTier = keyof typeof rateLimits;

// Route patterns
const routePatterns: Record<string, RateLimitTier> = {
  '/api/stripe/webhook': 'webhook', // Stripe webhooks need high limits (must be before /api/stripe)
  '/api/stripe': 'authenticated',   // All other Stripe calls — per-user, high limit
  '/api/ai': 'ai',
  '/api/analyze-website-temp': 'ai',
  '/api/auth': 'auth',
  '/auth/login': 'auth',
  '/auth/signup': 'auth',
  '/auth/callback': 'auth',
  '/api/portal/validate': 'portalAuth',
  '/api/portal': 'portal',
  '/portal': 'portal',
  '/api/clients': 'authenticated',
  '/api/projects': 'authenticated',
  '/api/late': 'authenticated',
  '/api/calendar': 'authenticated',
  '/api/upload-media': 'authenticated',
  '/api/autopilot': 'authenticated',
  // Rest of the logged-in dashboard app — these were previously falling through
  // to the 'public' tier (10 req/15min, shared across all users) which caused
  // spurious 429s during normal use (e.g. tagging posts, loading the calendar).
  '/api/posts-by-id': 'authenticated',
  '/api/posts': 'authenticated',
  '/api/tags': 'authenticated',
  '/api/media-gallery': 'authenticated',
  '/api/events': 'authenticated',
  '/api/workflow-templates': 'authenticated',
  '/api/agency': 'authenticated',
  '/api/notifications': 'authenticated',
  '/api/post-approvals': 'authenticated',
  '/api/onboarding': 'authenticated',
  '/api/schedulePost': 'authenticated',
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

// Decode the `sub` (user id) claim out of a JWT payload without verifying its
// signature — fine here since this is only used to bucket rate-limit counters
// per-user; real auth verification still happens in the route handler.
function decodeJwtUserId(token: string): string | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    let base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) base64 += '=';
    const data = JSON.parse(atob(base64));
    return typeof data?.sub === 'string' ? data.sub : null;
  } catch {
    return null;
  }
}

export function getClientIdentifier(request: NextRequest): string {
  // Try to get user ID from authorization header. Almost all API routes in
  // this app authenticate via a Bearer token (not cookies), so decoding the
  // token locally lets us bucket every tier per-user without a network call.
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const userId = decodeJwtUserId(token);
    return userId ? `user_${userId}` : 'auth_user';
  }

  // For portal requests, try to get token from query params
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (token) {
    return `portal_${token}`;
  }

  // Fall back to IP address
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : 'unknown';
  return `ip_${ip}`;
}

// Function to clear rate limit cache for specific identifier or tier
export function clearRateLimit(identifier?: string, tier?: RateLimitTier) {
  if (!identifier && !tier) {
    // Clear all
    rateLimitStore.clear();
    logger.info('🧹 Cleared all rate limit cache');
    return;
  }
  
  if (identifier && tier) {
    // Clear specific entry
    const key = `${tier}:${identifier}`;
    rateLimitStore.delete(key);
    logger.info(`🧹 Cleared rate limit cache for ${key}`);
  } else if (tier) {
    // Clear all entries for a tier
    for (const [key] of rateLimitStore.entries()) {
      if (key.startsWith(`${tier}:`)) {
        rateLimitStore.delete(key);
      }
    }
    logger.info(`🧹 Cleared rate limit cache for tier ${tier}`);
  } else if (identifier) {
    // Clear all entries for an identifier across all tiers
    for (const [key] of rateLimitStore.entries()) {
      if (key.endsWith(`:${identifier}`)) {
        rateLimitStore.delete(key);
      }
    }
    logger.info(`🧹 Cleared rate limit cache for identifier ${identifier}`);
  }
}

export function checkSimpleRateLimit(
  request: NextRequest,
  tier: RateLimitTier,
  identifier: string
): { success: boolean; limit: number; remaining: number; reset: Date } {
  const config = rateLimits[tier];
  const now = Date.now();
  const key = `${tier}:${identifier}`;
  
  // Clean up expired entries (more aggressive cleanup)
  for (const [k, v] of rateLimitStore.entries()) {
    if (v.resetTime < now) {
      rateLimitStore.delete(k);
    }
  }
  
  // Check if entry exists but config changed (different limit)
  const entry = rateLimitStore.get(key);
  if (entry) {
    // If the stored entry has different window, it's stale - delete it
    const expectedResetTime = Math.floor(entry.resetTime / config.windowMs) * config.windowMs;
    if (Math.abs(expectedResetTime - entry.resetTime) > 60000) { // More than 1 minute difference
      logger.info(`🧹 Clearing stale rate limit entry for ${key} due to config change`);
      rateLimitStore.delete(key);
    }
  }
  
  const currentEntry = rateLimitStore.get(key);
  
  if (!currentEntry) {
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
  
  if (currentEntry.resetTime < now) {
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
  
  if (currentEntry.count >= config.requests) {
    // Rate limit exceeded
    return {
      success: false,
      limit: config.requests,
      remaining: 0,
      reset: new Date(currentEntry.resetTime),
    };
  }
  
  // Increment count
  currentEntry.count++;
  rateLimitStore.set(key, currentEntry);
  
  return {
    success: true,
    limit: config.requests,
    remaining: config.requests - currentEntry.count,
    reset: new Date(currentEntry.resetTime),
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

  // Only apply to API routes
  if (!pathname.startsWith('/api/')) {

    return null;
  }

  try {
    const tier = getRateLimitTier(pathname);
    // Resolves to a per-user identifier from the Bearer token's JWT `sub`
    // claim when present, so every tier gets its own bucket per user.
    const identifier = getClientIdentifier(request);

    const result = checkSimpleRateLimit(request, tier, identifier);

    if (!result.success) {
      logger.warn(`🚫 Rate limit exceeded for ${tier} tier:`, {
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
    
    return response;
    
  } catch (error) {
    logger.error('Simple rate limiting middleware error:', error);
    return null;
  }
}
