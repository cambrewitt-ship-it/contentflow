# ContentFlow — notes for AI assistants and contributors

## LATE is now Zernio

Our social media posting/connection provider **LATE (getlate.dev) has been renamed
to Zernio**. They are the same service. The codebase still uses the old name
everywhere, and that is intentional for now — don't treat "LATE" and "Zernio" as
two different integrations:

- API routes live under `src/app/api/late/*` (connect, OAuth callbacks, posts, media, accounts).
- The API key env var is `LATE_API_KEY`; `late_profile_id` on `clients` is the Zernio profile id.
- Requests go to `https://getlate.dev/api/v1/...`.
- `late-proxy/` is the proxy for the same API.

When reading Zernio's docs, map them onto these LATE names. Don't rename routes,
env vars or database columns as a side effect of other work; if the API base URL
or env var is ever switched to Zernio's, do it as one deliberate change across
the whole codebase (and Vercel env vars).

## Social account connections (OAuth)

- The connect routes (`connect-platform`, `connect-facebook`) ask Zernio for an
  auth URL with a `redirect_url` pointing at `/api/late/oauth-callback` or
  `/api/late/facebook-callback`.
- Zernio returns to that callback with `connected=<platform>` (plus `profileId`,
  `username` when available) or `error`/`error_description`. Don't require
  other params.
- The callbacks never redirect straight to an auth-protected page: every outcome
  goes through the public `/oauth/complete` page (`oauthCompleteUrl` in
  `src/lib/returnPath.ts`). It forwards signed-in users to the dashboard and
  shows the result to browsers without a session (e.g. the Instagram/Facebook
  in-app browser), so connecting an account never ends on the login screen.
  Keep it that way for any new platform callback, and keep both callbacks and
  `/oauth/complete` in the middleware's public lists.
