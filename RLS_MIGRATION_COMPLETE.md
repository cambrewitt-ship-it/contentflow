## RLS Migration Summary

### Updated Routes (now using `requireAuth` helpers and user-scoped Supabase clients)
- `src/app/api/clients/[clientId]/route.ts`
- `src/app/api/clients/[clientId]/data/route.ts`
- `src/app/api/clients/[clientId]/brand-documents/route.ts`
- `src/app/api/posts-by-id/[postId]/route.ts`
- `src/app/api/projects/[projectId]/scheduled-posts/[postId]/move/route.ts`
- `src/app/api/projects/[projectId]/scheduled-posts/[postId]/confirm/route.ts`
- `src/app/api/stripe/checkout/route.ts`
- `src/app/api/stripe/portal/route.ts`
- `src/app/api/stripe/credits/checkout/route.ts`
- `src/app/api/stripe/subscription/route.ts`
- `src/app/api/subscription/freemium/route.ts`

### Routes Still Using Service-Role Keys (with justification)
- `src/app/api/stripe/webhook/route.ts` — Stripe webhook requires elevated privileges to manage subscriptions asynchronously.
- `src/app/api/migrate-base64-to-blob/route.ts` and `src/app/api/migrate-images/route.ts` — Migration utilities run as admin-only operations.
- `src/app/api/portal/*` (`approvals`, `calendar`, `upload`, `validate`, `verify`) — Portal endpoints rely on email/share tokens rather than Supabase user sessions; RLS policies do not currently cover these access patterns.
- `src/app/api/approval-sessions/[sessionId]/posts/route.ts` — Supports token-based public approval sessions; service role is only used when no authenticated user context is available.

### RLS Enforcement Status
All customer-facing routes that require a logged-in Supabase user now authenticate with `requireAuth` (or the specific ownership helpers) and execute queries through user-scoped Supabase clients. Runtime RLS policies will therefore enforce ownership constraints for every authenticated request. Service-role keys remain only where automated or token-based flows demand elevated access.

