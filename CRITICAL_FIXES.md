# Critical Fixes Before Launch
Generated: 2025-11-10

Resolve these items **before allowing external users**. Each issue maps to the findings in `SECURITY_AUDIT_REPORT.md`.

---

## 1. Enforce tenant checks on every project API
- **Severity:** Critical  
- **Affected files:**  
  - `src/app/api/projects/[projectId]/route.ts`  
  - `src/app/api/projects/[projectId]/unscheduled-posts/route.ts`  
  - `src/app/api/projects/[projectId]/scheduled-posts/route.ts`  
  - `src/app/api/projects/[projectId]/scheduled-posts/[postId]/move/route.ts`  
  - `src/app/api/projects/[projectId]/scheduled-posts/[postId]/confirm/route.ts`  
  - `src/app/api/projects/add-post/route.ts`
- **Problem:** Service-role Supabase clients run without verifying that the caller owns `projectId`, allowing any logged-in tenant to read or mutate other customers’ projects and calendars.
- **Fix:**  
  1. Require `Authorization: Bearer <access_token>` on every handler.  
  2. Use `createSupabaseWithToken(token)` (or `createMiddlewareClient`) so queries execute under RLS.  
  3. Fetch the authenticated user ID and confirm ownership (`project.client.user_id === user.id`) before returning or mutating data.  
  4. Remove service-role usage unless performing server-side batch maintenance.
- **Acceptance test:** A user should receive HTTP 403 when requesting or editing a project they do not own.

---

## 2. Lock down client posts API
- **Severity:** Critical  
- **Affected file:** `src/app/api/posts/[clientId]/route.ts`
- **Problem:** GET/DELETE endpoints run with the service role and do not confirm that `clientId` belongs to the caller, enabling cross-tenant data theft or deletion.
- **Fix:**  
  1. Require bearer tokens (`validateApiRequest` with `checkAuth: true`).  
  2. Instantiate Supabase with the token (`createSupabaseWithToken`).  
  3. Verify ownership via a join on `clients.user_id`.  
  4. Return 403 on mismatch.
- **Acceptance test:** Attempting to fetch another tenant’s posts must return 403.

---

## 3. Require auth on post-by-id editor
- **Severity:** Critical  
- **Affected file:** `src/app/api/posts-by-id/[postId]/route.ts`
- **Problem:** PUT handler omits `checkAuth` and executes updates with the service-role key, letting any authenticated user modify arbitrary posts.
- **Fix:**  
  1. Call `validateApiRequest` with `checkAuth: true`.  
  2. Swap to `createSupabaseWithToken`.  
  3. Load the post via an RLS-bound query scoped to the caller; bail if not found or owned.  
  4. Keep service-role usage only for system automation outside user-triggered flows.
- **Acceptance test:** Editing a post owned by another tenant must fail with 403.

---

## 4. Harden calendar board APIs
- **Severity:** Critical  
- **Affected files:**  
  - `src/app/api/calendar/scheduled/route.ts`  
  - `src/app/api/calendar/unscheduled/route.ts`
- **Problem:** Calendar read/write routes accept only `clientId` query parameters and run with service-role privileges, exposing every tenant’s pipeline.
- **Fix:**  
  1. Require bearer authentication on all verbs.  
  2. Execute queries with user-context Supabase clients.  
  3. Validate `client_id` belongs to the requester before returning data.  
  4. Implement schema validation for POST bodies (zod) to prevent injection.
- **Acceptance test:** Fetching/updating another tenant’s calendar returns 403.

---

## 5. Make CSRF secret mandatory
- **Severity:** High  
- **Affected file:** `src/lib/csrfProtection.ts`
- **Problem:** Middleware defaults to a publicly known secret if `CSRF_SECRET_KEY` is missing, making CSRF protection worthless in misconfigured environments.
- **Fix:**  
  1. Throw during app bootstrap if `CSRF_SECRET_KEY` is absent.  
  2. Generate a random 256-bit value and configure it in every environment (Vercel, local, staging).  
  3. Rotate legacy deployments to the new secret.  
- **Acceptance test:** Deploy without `CSRF_SECRET_KEY` should crash immediately; with the secret set, token verification must pass only for properly signed tokens.

---

## 6. Restrict service-role usage
- **Severity:** High  
- **Affected areas:** Any handler invoking `createClient(supabaseUrl, supabaseServiceRoleKey)`
- **Problem:** Service-role keys bypass RLS and should be reserved for trusted backend jobs. Current usage in customer APIs magnifies impact of any bug.
- **Fix:** Audit every service-role usage after completing fixes above; refactor to user-scoped clients except where absolutely necessary (e.g., webhooks, admin automation).
- **Acceptance test:** Grep for `supabaseServiceRoleKey` in `/src/app/api` should show only admin-only endpoints when done.







