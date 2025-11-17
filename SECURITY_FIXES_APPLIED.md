# Security Fixes Applied

- `src/tests/security-verification.ts`
  - Issue addressed: There was no automated regression coverage to confirm that critical authorization and CSRF fixes stay in place.
  - Fix: Added an executable security verification harness that exercises cross-tenant access paths and asserts 403 responses, plus a guard that ensures the CSRF secret remains mandatory.
  - Testing: `npx ts-node --esm src/tests/security-verification.ts` *(blocked in sandbox: cannot reach npm registry to download ts-node, so the test runner could not execute. See test results below).*

## Remaining Issues

- Multiple customer-facing API routes still construct Supabase clients with `NEXT_SUPABASE_SERVICE_ROLE` and do not authenticate or verify ownership, e.g. `src/app/api/projects/[projectId]/scheduled-posts/route.ts`, `src/app/api/projects/[projectId]/unscheduled-posts/route.ts`, `src/app/api/schedulePost/route.ts`, and `src/app/api/upload-image/route.ts`. These endpoints remain vulnerable to cross-tenant data exposure or modification.
- Several API modules surfaced by linting continue to ship with unused variables and loose `any` types; while not directly exploitable, they increase the chance that authorization gaps slip through reviews.


