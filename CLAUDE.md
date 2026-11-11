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

## Caption @mentions and #hashtags

- Caption boxes use `CaptionTextarea` (`src/components/caption-library/`), a drop-in for
  `Textarea`/`textarea` (pass `clientId`, `unstyled` for a plain textarea). Typing `@` or `#`
  opens suggestions from the client's **caption library** — accounts to tag and hashtag sets
  (table `client_caption_libraries`, migrations/032-caption-library.sql, run by hand in Supabase;
  API `/api/clients/[clientId]/caption-library`) — plus handles/hashtags found in the client's
  past captions, and optional AI hashtag ideas (`/suggest-hashtags`, 1 AI credit).
- Neither Meta nor Zernio offers user or hashtag search, so there is no live lookup. Captions stay
  plain text: an account inserts `@instagramhandle` (a real tag on Instagram). Facebook can't tag
  via the API, so `withFacebookCaptions` (`src/lib/captionLibraryServer.ts`) sends Facebook a
  `customContent` caption with saved handles swapped for the account's Facebook name. Any new
  code that publishes to Zernio should do the same.
- The library is managed in "Accounts & Hashtags" on the client dashboard, or from the menu's
  "Manage" row. Portal (client-facing) caption boxes aren't wired up — the API is agency-only.
- Handles are saved automatically: every `@handle` in the client's past captions (calendar tables,
  plus posts made directly on Instagram, read from Zernio's `GET /v1/analytics?source=external`
  at most daily, after the GET response) becomes an account. Deleted ones go in `dismissed_handles`
  so they aren't re-added (migrations/033-caption-library-auto-import.sql). Logic lives in
  `src/lib/captionLibraryServer.ts`. Zernio analytics needs the Analytics add-on on legacy plans
  (402 otherwise — shown in the manager, not an error).

## Analytics and the learning loop

- Results come from Zernio's Analytics API (`src/lib/analytics/zernio.ts`: post list with metrics,
  best times, dashboard). Usage-based Zernio plans include it; 402 = no analytics (shown, not an error).
- Each client has a snapshot in `client_analytics` (migrations/034-client-analytics.sql, run by hand):
  a year of published posts with metrics (incl. posts made directly on the platforms), best times,
  computed insights and weekly AI recommendations. `src/lib/analytics/store.ts` refreshes it when
  older than 6h — after the response (`runAfterResponse`), never inline in AI prompts.
- `src/lib/analytics/insights.ts` turns results into "what works" (format, day/time, caption length,
  hashtags, top/weak posts, trend). Findings only claim a difference with 3+ posts per side and a
  15%+ gap. `formatPerformancePrompt` feeds them into caption generation (`/api/ai` via
  `getBrandContext().performance`), the Content Agent (context briefing + best-time `suggested_time`)
  and `regenerateCaption`. New AI writing paths should include `getPerformancePrompt(clientId)`.
- UI: Analytics page (`/dashboard/client/[clientId]/analytics`, `src/components/analytics/`),
  results in the calendar post modal (`PostResults`, by `late_post_id`), and the agency overview on
  `/dashboard` (`/api/analytics/portfolio`: status strip per client + "Needs attention").
  Recommendation buttons open the Content Agent with `?brief=`.
- `/api/cron/weekly-insights` (GitHub Actions, Monday NZ morning) refreshes every connected client,
  writes recommendations and sends an `analytics_insights` notification.

## Keeping calendars filled, and monthly reports

- "Keep the calendar filled" (`autopilot_settings.fill_gaps`, Agent Settings): `/api/cron/fill-gaps`
  (daily, GitHub Actions) checks each opted-in client's next 7 days against
  `posting_preferences.posts_per_week` and, if short, runs the Content Agent for that window with a
  brief built from the analytics (`src/lib/autopilot-gapfill.ts`). Skips clients with a plan waiting
  or run in the last 3 days, or without enough AI credits. The engine's own "plan ready"
  notification/email tells the manager.
- Monthly client reports: `client_reports` (migrations/035-client-reports.sql), built by
  `src/lib/analytics/reports.ts` (month totals from Zernio, the month's posts from the snapshot, an
  AI-written plain-English summary), frozen per month with a `share_token`. Public page
  `/report/[token]` + `/api/reports/[token]` (in the middleware's public lists, noindex), printable
  to PDF. Agency UI: "Monthly reports" card on the Analytics page. `/api/cron/monthly-reports` builds
  last month's for every connected client on the 1st and sends a `monthly_report_ready` notification.

## Comments inbox and the Feed Checker

- Zernio's Comments API (`src/lib/zernio/api.ts`) feeds `client_comments` (migrations/036-comments-and-feed-checker.sql):
  synced per client (`src/lib/comments/sync.ts`, at most every 10 min on view + cron) and pushed in real time
  by the `comment.received` webhook at `/api/late/webhook` (public; HMAC secret derived from `LATE_API_KEY`
  in `src/lib/zernio/webhook.ts`; the app registers the webhook itself — `ensureZernioWebhookOccasionally` after
  dashboard/Comments page loads, and the Feed Checker cron — production only, no user setup).
- `src/lib/comments/store.ts`: AI triage (sentiment, category, reply + private-reply drafts in the brand's voice),
  actions (reply, private DM, hide/unhide, like/unlike, delete, done), `autoModerate` (Feed Checker settings), and the
  audience summary that `getPerformancePrompt` adds to every AI prompt ("questions people keep asking").
  UI: `/dashboard/client/[clientId]/comments` (`src/components/social-comments/`), comments in the calendar post modal,
  keyword auto-DMs (Zernio comment automations), counts in the dashboard "Needs attention".
- Feed Checker (`src/lib/feedChecker/check.ts`, `/dashboard/client/[clientId]/feed-checker`, settings in
  `clients.feed_agent_settings`): checks recent Facebook/Instagram posts and the next 7 days of calendar posts for
  spelling/grammar/tone of voice and "link in comments" with no link; posts pending "first comments"
  (`calendar_scheduled_posts.first_comment`: Zernio's `firstComment` on Facebook at scheduling, the checker on
  Instagram); hides spam/abuse or all negative comments and likes positive ones (❤️ reply fallback where likes
  aren't allowed — Meta's API has no "love" reaction and Instagram comment likes are restricted). Facebook captions
  the app published can be fixed in place (`POST /v1/posts/{id}/edit`); Instagram captions can't be edited.
  `/api/cron/feed-checker` runs 3×/day.
- Ad comments (dark posts, boosted posts) without an ad account connection: `comment.received` carries `comment.ad`,
  so the webhook flags them (`client_comments.is_ad`), records the ad post in `client_ad_posts`
  (migrations/037-ad-comments.sql) and backfills its whole thread with the Page/Instagram connection
  (`syncAdThread`); tracked ad posts re-sync with every comments refresh. Ads can also be added by pasting a
  Facebook post link/ID (`/api/clients/[clientId]/comments/ad-posts`). Zernio's own ad listing (`platform=metaads`,
  `/v1/ads/...`) needs a Meta Ads connection, which the app doesn't have.
- Cron routes are public at the middleware (`/api/cron/`) and guarded by `rejectUnauthorizedCron`
  (`src/lib/cronAuth.ts`): production requires `CRON_SECRET`.
