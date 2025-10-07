# Rate Limiting Setup Guide

This guide explains how to set up and configure rate limiting for your ContentFlow application.

## Overview

The rate limiting system uses Upstash Redis to track and limit API requests based on different tiers:

- **AI Endpoints**: 20 requests per hour (most restrictive)
- **Authenticated Users**: 100 requests per 15 minutes
- **Public Routes**: 10 requests per 15 minutes
- **Portal Routes**: 50 requests per 15 minutes
- **Auth Routes**: 20 requests per 15 minutes

## Setup Steps

### 1. Create Upstash Redis Database

1. Go to [Upstash Console](https://console.upstash.com/)
2. Create a new Redis database
3. Copy the `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`

### 2. Environment Variables

Add these environment variables to your `.env.local` file:

```bash
# Rate Limiting Configuration (Upstash Redis)
UPSTASH_REDIS_REST_URL=your_upstash_redis_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_token
```

### 3. Rate Limiting Tiers

The system automatically applies different rate limits based on the route:

#### AI Endpoints (Most Restrictive)
- Routes: `/api/ai`, `/api/analyze-website-temp`
- Limit: 20 requests per hour
- Reason: OpenAI API calls are expensive

#### Authenticated Users
- Routes: `/api/clients/*`, `/api/posts/*`, `/api/projects/*`
- Limit: 100 requests per 15 minutes
- Identifier: User ID from session

#### Portal Routes
- Routes: `/api/portal/*`, `/portal/*`
- Limit: 50 requests per 15 minutes
- Identifier: Portal token

#### Authentication Routes
- Routes: `/api/auth/*`, `/auth/login`, `/auth/signup`, `/auth/callback`
- Limit: 20 requests per 15 minutes
- Identifier: IP address
- Reason: Prevent brute force attacks

#### Public Routes (Default)
- Routes: All other `/api/*` routes
- Limit: 10 requests per 15 minutes
- Identifier: IP address

## Usage

### Automatic Rate Limiting

Rate limiting is automatically applied to all API routes through the middleware. No additional configuration is needed.

### Manual Rate Limiting

For individual API routes that need custom rate limiting:

```typescript
import { withRateLimit } from '@/lib/apiRateLimit';

export const GET = withRateLimit(async (request: NextRequest) => {
  // Your API logic here
  return NextResponse.json({ success: true });
});
```

### Rate Limit Headers

All responses include rate limit headers:

- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: When the rate limit resets (ISO timestamp)

### Rate Limit Exceeded Response

When rate limits are exceeded, the API returns:

```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Please try again later.",
  "retryAfter": 900,
  "limit": 100,
  "remaining": 0
}
```

With HTTP status `429` and `Retry-After` header.

## Monitoring

### Logs

Rate limiting events are logged with the following information:

- Rate limit tier
- Client identifier
- Request pathname
- Remaining requests
- Rate limit status

### Upstash Console

Monitor rate limiting metrics in the Upstash console:

1. Go to your Redis database
2. Check the "Analytics" tab
3. View rate limiting patterns and usage

## Configuration

### Custom Rate Limits

To modify rate limits, edit `src/lib/rateLimit.ts`:

```typescript
export const rateLimitConfigs = {
  ai: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '1 h'), // Modify these values
    analytics: true,
    prefix: 'ratelimit:ai',
  }),
  // ... other configs
};
```

### Route Patterns

To add new route patterns, edit `src/lib/rateLimit.ts`:

```typescript
export const routePatterns: Record<string, RateLimitTier> = {
  '/api/ai': 'ai',
  '/api/analyze-website-temp': 'ai',
  '/api/my-new-endpoint': 'authenticated', // Add new patterns here
  // ... other patterns
};
```

## Troubleshooting

### Rate Limiting Not Working

1. Check that environment variables are set correctly
2. Verify Upstash Redis is accessible
3. Check console logs for rate limiting errors

### Too Restrictive

1. Increase limits in `rateLimitConfigs`
2. Adjust window sizes (e.g., '15 m' to '1 h')
3. Consider different tiers for different user types

### Too Permissive

1. Decrease limits in `rateLimitConfigs`
2. Add more restrictive patterns to `routePatterns`
3. Implement additional validation

## Security Considerations

1. **IP-based limiting**: Public routes use IP addresses, which can be bypassed with VPNs
2. **User-based limiting**: Authenticated routes use user IDs, more secure
3. **Token-based limiting**: Portal routes use tokens, good for client access
4. **Sliding window**: Prevents burst attacks by using sliding time windows

## Performance

- Rate limiting adds minimal overhead (~1-2ms per request)
- Redis operations are fast and cached
- Analytics are enabled for monitoring without performance impact
- Failed Redis connections allow requests to proceed (fail-open)

## Testing

Test rate limiting with curl:

```bash
# Test AI endpoint (should be limited to 20/hour)
for i in {1..25}; do
  curl -X POST http://localhost:3000/api/ai \
    -H "Content-Type: application/json" \
    -d '{"action":"test"}' \
    -w "Status: %{http_code}\n"
done
```

Check the response headers for rate limit information.
