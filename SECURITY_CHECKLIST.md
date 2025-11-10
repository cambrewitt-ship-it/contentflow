# Security Verification Checklist
Generated: 2025-11-10

Use this list to confirm that every security task is complete before launch. Mark each box once verified in the target environment (local, staging, production).

---

## Environment & Secrets
- [ ] `CSRF_SECRET_KEY` set to a strong random value in **all** environments (no defaults).  
- [ ] Supabase, Stripe, OpenAI, and LATE keys stored only in environment variables (no client exposure).  
- [ ] `.env*` remains untracked in git and Vercel environment variables are reviewed for least privilege.  
- [ ] Database backups enabled and retention confirmed in Supabase dashboard.

## Authorization & RLS
- [ ] Every customer-facing API route uses a user-scoped Supabase client (no direct service-role usage).  
- [ ] GET/PATCH/POST/DELETE routes under `/api/projects`, `/api/posts`, and `/api/calendar` require bearer tokens.  
- [ ] Authorization checks confirm that `client_id`, `project_id`, and `post_id` belong to the authenticated user before returning data.  
- [ ] Manual penetration test: authenticated user from Tenant A cannot access B’s data (receives 403).  
- [ ] RLS policies audited for each table (clients, projects, posts, calendar tables, uploads) and enabled in Supabase.

## Input Validation & CSRF
- [ ] Calendar and project POST/PATCH bodies validated with shared zod schemas.  
- [ ] `extractCSRFToken` updated to await `request.formData()` (or limited to JSON paths) and tested with form submissions.  
- [ ] CSRF middleware denies requests with missing/invalid tokens and logs without leaking secrets.

## Rate Limiting & Abuse Protections
- [ ] Rate limiter backed by a durable store (Redis/KV) and tested across multiple instances.  
- [ ] Additional limits applied to expensive endpoints (AI generation, uploads).  
- [ ] Brute-force protections verified on auth endpoints (lockout or exponential backoff).

## Security Headers & CSP
- [ ] Content-Security-Policy reviewed; plan to replace `'unsafe-inline'/'unsafe-eval'` with nonce/hash strategy.  
- [ ] HSTS, X-Frame-Options, X-Content-Type-Options confirmed in production responses.  
- [ ] CORS rules audited—only necessary origins/methods enabled.

## Third-Party Integrations
- [ ] Stripe webhook secret validated; test invalid signatures.  
- [ ] LATE API operations audited; ensure any webhook endpoints verify signatures or tokens.  
- [ ] OpenAI requests verified to never expose API keys client-side.

## Logging & Monitoring
- [ ] Logger reviewed to avoid sensitive data leakage; stack traces sanitized in production responses.  
- [ ] Error monitoring (Sentry) tested with sanitized payloads.  
- [ ] Alerts configured for unusual rate limit breaches and failed auth attempts.

## Dependencies
- [ ] `npm audit --production` executed with network access; actionable vulnerabilities patched.  
- [ ] Dependency updates reviewed for breaking changes and retested.

## Final Regression
- [ ] Run automated tests / smoke tests covering all secured endpoints.  
- [ ] Perform manual checks: create/read/update/delete flows, calendar moves, portal uploads.  
- [ ] Document remaining low-risk items with remediation timeline.  
- [ ] Obtain final sign-off from security owner before public launch.

