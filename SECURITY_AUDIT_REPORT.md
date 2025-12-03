# Security Audit Report
Generated: 2025-11-10  
Auditor: GPT-5 Codex (automated)

---

## Executive Summary
- **Status:** Unsafe for launch. Four critical access-control gaps allow any authenticated tenant to read or mutate other customers' data.
- **Scope:** Full repository review (Next.js + Supabase) covering API handlers, shared libraries, middleware, configuration, and auxiliary scripts.
- **Deliverables:** This report (comprehensive findings), `CRITICAL_FIXES.md` (blocking issues), and `SECURITY_CHECKLIST.md` (verification plan).

### Risk Snapshot
- Critical: 4 (must resolve before launch)
- High: 2
- Medium: 4
- Low/Informational: 3

Customer data isolation and CSRF robustness are the primary concerns. Secondary work is required on configuration hardening and rate limiting.

---

## Methodology
1. **Static analysis:** Searched for secrets, env usage, authorization checks, and direct Supabase access.
2. **Manual code review:** Walked every API handler under `src/app/api`, core libraries under `src/lib`, middleware, and Next.js config.
3. **Configuration review:** Inspected `.gitignore`, Supabase helpers, CSP setup, and rate limiting middleware.
4. **Dependency scan:** Attempted `npm audit --json` (blocked by sandbox networking; see “Constraints”).

---

## Top Findings

### Critical Severity (Must Fix Before Launch)

1. **Project APIs bypass tenant authorization**  
   - **Files:** `src/app/api/projects/[projectId]/route.ts`, `/scheduled-posts`, `/unscheduled-posts`, `/scheduled-posts/[postId]/{move,confirm}`, `projects/add-post`.  
   - **Issue:** All project CRUD endpoints instantiate a Supabase _service role_ client and trust `projectId` from the URL without validating that the caller owns the project. Any logged-in user can enumerate or mutate another tenant’s projects.  
   - **Evidence:**  

```16:22:src/app/api/projects/[projectId]/route.ts
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const { data, error } = await supabase
  .from('projects')
  .select('*')
  .eq('id', projectId)
  .single();
```

```16:70:src/app/api/projects/[projectId]/unscheduled-posts/route.ts
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const { data, error } = await supabase
  .from('calendar_unscheduled_posts')
  .select('*')
  .eq('project_id', projectId);
```

```16:83:src/app/api/projects/[projectId]/scheduled-posts/route.ts
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const { data, error } = await supabase
  .from('calendar_scheduled_posts')
  .select('*')
  .eq('project_id', projectId);
```

```18:79:src/app/api/projects/add-post/route.ts
const supabase = createClient(supabaseUrl, supabaseKey);
...
const { data, error } = await supabase
  .from('calendar_unscheduled_posts')
  .insert(insertData);
```

   - **Risk (non-technical):** Any paying customer could pull another agency’s calendars, drafts, uploads, and delete or edit them. This is a total data isolation failure.  
   - **Remediation:** Replace service-role access with the per-session helper (`createSupabaseWithToken`) or Next.js server helpers so every query runs with RLS enforced. Explicitly fetch the authenticated user ID from Supabase and assert ownership before querying or mutating.  
   - **Priority:** Blocker—patch _before_ launch. Applies to every project/calendar route.

2. **Client posts API exposes cross-tenant reads & deletes**  
   - **File:** `src/app/api/posts/[clientId]/route.ts` (both GET and DELETE).  
   - **Issue:** Uses service-role Supabase without verifying that the caller owns `clientId`. There is no auth header requirement on the GET path, so any user session can download or delete another tenant’s posts.  
   - **Evidence:**  

```16:75:src/app/api/posts/[clientId]/route.ts
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const { data, error } = await supabase
  .from('posts')
  .select(`
    *,
    last_edited_by:clients!posts_last_edited_by_fkey(id, name, email)
  `)
  .eq('client_id', clientId);
```

   - **Risk:** Competitors can access all unpublished content for any client by guessing an ID. Delete endpoint lets them wipe data.  
   - **Remediation:** Require `Authorization: Bearer` headers, call `createSupabaseWithToken(token)`, and enforce that the post belongs to the authenticated user before querying/deleting.  
   - **Priority:** Blocker—fix prior to launch.

3. **Post-by-ID editor runs with admin privileges and no authentication**  
   - **File:** `src/app/api/posts-by-id/[postId]/route.ts` (PUT handler).  
   - **Issue:** Validation wrapper omits `checkAuth`, so any session—including unrelated tenants—can update arbitrary rows using a service-role client. Supabase queries ignore RLS once the service key is used.  
   - **Evidence:**  

```19:90:src/app/api/posts-by-id/[postId]/route.ts
const validation = await validateApiRequest(request, {
  body: updatePostSchema,
  params: postIdParamSchema,
  paramsObject: params,
  maxBodySize: 10 * 1024 * 1024,
});
...
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
```

   - **Risk:** An attacker can overwrite captions, approvals, scheduling data, etc., for any post ID they discover.  
   - **Remediation:** Require auth (`checkAuth: true`), fetch the user via `createSupabaseWithToken`, look up the post through RLS, and refuse if it is not owned by the requester.  
   - **Priority:** Blocker—fix before launch.

4. **Calendar board APIs leak every client’s workflow**  
   - **Files:** `src/app/api/calendar/scheduled/route.ts`, `calendar/unscheduled/route.ts`.  
   - **Issue:** Both APIs are globally instantiated with the service role key, accept only a `clientId` query parameter, and never verify ownership. Any authenticated tenant can read or mutate another customer’s calendar via crafted fetches.  
   - **Evidence:**  

```5:63:src/app/api/calendar/scheduled/route.ts
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_SUPABASE_SERVICE_ROLE!
);
...
const { data, error } = await query
  .order('scheduled_date', { ascending: true })
  .limit(limit);
```

```5:115:src/app/api/calendar/unscheduled/route.ts
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_SUPABASE_SERVICE_ROLE!
);
...
const { data, error } = await query
  .order('created_at', { ascending: false })
  .limit(20);
```

   - **Risk:** Another tenant can download the entire content pipeline (scheduled posts, drafts, uploads) and delete or inject posts.  
   - **Remediation:** Server-side, require bearer tokens, run through RLS-bound clients, and confirm the `client_id` belongs to the authenticated user before returning or mutating records.  
   - **Priority:** Blocker—fix prior to launch.

### High Severity

5. **CSRF protection falls back to a public secret**  
   - **File:** `src/lib/csrfProtection.ts`.  
   - **Issue:** If `CSRF_SECRET_KEY` is missing, middleware uses a published default string, allowing attackers to forge tokens.  
   - **Evidence:**  

```6:12:src/lib/csrfProtection.ts
const CSRF_CONFIG = {
  TOKEN_LENGTH: 32,
  COOKIE_NAME: 'csrf-token',
  HEADER_NAME: 'x-csrf-token',
  MAX_AGE: 60 * 60 * 1000,
  SECRET_KEY: process.env.CSRF_SECRET_KEY || 'default-csrf-secret-change-in-production',
} as const;
```

   - **Risk:** If the real secret is not configured in every deployment environment, CSRF tokens are predictable and any third-party site can trigger state-changing requests.  
   - **Remediation:** Make `CSRF_SECRET_KEY` mandatory (throw on startup if missing) and rotate a strong random value in every environment.  
   - **Priority:** High—resolve before public traffic.

6. **Supabase service-role key instantiated globally**  
   - **Files:** Multiple API modules (see issues above).  
   - **Issue:** Several handlers import and instantiate the service-role client at module scope. In Next.js edge/serverless environments this can leak the key through serialization bugs and makes it harder to rotate.  
   - **Remediation:** Encapsulate service-role usage in server-side utilities that are only called on the server, and restrict to vetted admin operations. Once the critical authorization fixes are applied, most routes should no longer need service-role access at all.  
   - **Priority:** High—address while rewriting the affected handlers.

### Medium Severity

7. **CSRF middleware attempts to read form data synchronously**  
   - **File:** `src/lib/csrfProtection.ts` (`extractCSRFToken`). Uses `request.formData()` without `await`, which will throw or silently fail for multipart forms, skipping token checks. Fix by awaiting and guarding against body re-use.  
8. **Content-Security-Policy allows `unsafe-inline` and `unsafe-eval` in production**  
   - **File:** `next.config.ts`. Consider migrating to nonces/hashes post-launch to reduce XSS surface.  

```32:35:next.config.ts
isDevelopment
  ? "script-src 'self' 'unsafe-eval' 'unsafe-inline' blob:"
  : "script-src 'self' 'unsafe-eval' 'unsafe-inline' blob:",
```

9. **Rate limiting is in-memory only**  
   - **File:** `src/lib/simpleRateLimit.ts`. Map-based counters reset on deploy and do not cover multi-region scale or background jobs, limiting DDoS protection.  

```10:36:src/lib/simpleRateLimit.ts
const rateLimitStore = new Map<string, RateLimitEntry>();
...
const routePatterns: Record<string, RateLimitTier> = {
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
  '/api': 'public',
};
```

10. **Limited input validation coverage on lower-usage endpoints**  
    - Several endpoints (e.g., calendar POST routes) accept JSON directly without schema validation. Introduce shared zod schemas to prevent injection attacks and malformed data.

### Low / Informational
- `.env*` is correctly in `.gitignore`; no secrets found in repo.
- Logger automatically redacts sensitive keys before emitting.
- Sentry + security headers are enabled, though CSP should be tightened after launch.

---

## Category Review

### 1. API Keys & Secrets Management
- No hardcoded production secrets detected; `.env*` ignored by git.
- All Supabase/Stripe/OpenAI/LATE keys referenced via `process.env`.
- **Action:** Double-check Vercel dashboard to ensure _every_ deployment has `CSRF_SECRET_KEY`, Supabase keys, Stripe keys, and third-party tokens configured. Rotate any test keys before launch.

### 2. Database Security (Supabase)
- RLS effectiveness is undermined by widespread service-role usage in customer-facing APIs. RLS must be paired with per-user clients.
- Could not confirm RLS coverage for each table without database access—review every policy before launch.
- Confirm that automated backups are enabled in Supabase dashboard (not visible in code).

### 3. Authentication & Authorization
- Middleware enforces “logged-in” but not tenant ownership. Critical issues 1–4 must be addressed.
- Ensure JWT/session expiry aligns with Supabase defaults; no custom override observed.
- Confirm OAuth redirect URIs are locked down in Supabase settings.

### 4. Input Validation & Injection
- Good validation utilities exist (`src/lib/validators.ts`), but many APIs bypass them.
- No raw SQL strings detected; Supabase client handles queries, reducing SQL injection risk once RLS is enforced.
- Add server-side validation for calendar/project payloads and sanitize any user-supplied rich text before storage.

### 5. API Route Security
- Lack of per-request authorization is the largest gap.
- Rate limiting exists but is memory-bound and should be backed by Redis or Vercel Edge Config for production-grade protection.
- Review CORS helper (`src/lib/cors.ts`) if exposing public endpoints; current global headers allow broad methods.

### 6. Third-Party API Security
- OpenAI, LATE, and Stripe keys are only used server-side.
- Webhooks (`src/app/api/stripe/webhook/route.ts`) validate signatures correctly.
- Ensure LATE webhook (if any) performs signature verification—none found in repo.

### 7. Security Headers & CSP
- Strong baseline headers shipped via `next.config.ts`.
- CSP needs post-launch tightening (remove `unsafe-inline`/`unsafe-eval`, add explicit asset domains).
- HSTS sent in production; ensure custom domains preload after verifying readiness.

### 8. Logging & Error Handling
- Logger redacts sensitive keys, but raw Supabase errors (including table names) are sometimes returned to clients. Wrap with user-friendly messages and log details server-side only.
- Audit hosted logging/monitoring permissions to prevent unauthorized access to logs.

### 9. Dependencies & Packages
- `npm audit` could not complete because network access is blocked in this environment. Run `npm audit --production` locally or in CI, then `npm audit fix` where safe.
- Ensure `node`/`npm` versions in production receive LTS security updates.

### 10. Rate Limiting & DDoS
- Current in-memory limiter is vulnerable to horizontal scaling bypass. Introduce a hosted store (Redis, Upstash, Vercel KV) and stricter limits on expensive endpoints (AI, uploads).
- Implement account lockout or exponential backoff on authentication routes to mitigate brute force.

---

## Recommended Next Steps
1. **Blocker fixes:** Ship tenant-ownership checks and switch to token-bound Supabase clients for every customer-facing API handler.
2. **Secrets:** Enforce presence of `CSRF_SECRET_KEY`; rotate to a cryptographically strong value.
3. **Validation:** Introduce shared zod schemas for calendar/project payloads and enforce them in handlers.
4. **Rate limiting:** Move counters to a durable store and tighten AI/upload quotas.
5. **CSP hardening:** Plan to migrate to nonce-based scripts and remove `unsafe-*` directives after the immediate launch crunch.
6. **Dependency scan:** Re-run `npm audit` with network access and apply patches.

---

## Constraints & Follow-up Items
- `npm audit --json` failed (`ENOTFOUND registry.npmjs.org`) because outbound networking is blocked in this workspace. Run the command locally or in CI and capture the report.
- Database RLS settings, backup status, and Vercel environment variable configuration cannot be verified from code alone—perform manual checks in those dashboards.
- After applying fixes, regression-test the portal, calendar UI, and integrations (LATE, Stripe) with least-privilege accounts to ensure no functionality regressed.

---

## Appendix
- `CRITICAL_FIXES.md` enumerates only the blockers for engineering focus.
- `SECURITY_CHECKLIST.md` gives a step-by-step QA list for final verification.







