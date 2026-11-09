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

## Design Studio (image editor) and Brand Kits

- The in-app image editor is called **Design Studio** in the UI (never "Canva" —
  it's our own Fabric.js editor). Code: `src/components/image-editor/`; open it via
  `LazyImageEditor` from `@/components/image-editor`. Entry points: Content Suite
  (Design Studio button, thumbnail "Design" bar, "Design this photo" on the preview),
  Create Post ("Design" button) and the calendar post modal.
- Each client has a **Brand Kit** (logos, colours, heading/body fonts incl. uploaded
  font files, uploads library): table `client_brand_kits` (migrations/031-brand-kits.sql,
  run by hand in Supabase), API `/api/clients/[clientId]/brand-kit` (+ `/font` for
  font files, stored in the `media` bucket under `brand-kits/`). UI:
  `src/components/brand-kit/` — on the client dashboard and in the editor's Brand tab.
- Uploaded fonts are loaded with the FontFace API (CSP `font-src` doesn't allow
  storage URLs). Previews of a font in the DOM need `fontPreview()` from
  `image-editor/fonts.ts`, because globals.css forces Poppins on `*` with `!important`.
