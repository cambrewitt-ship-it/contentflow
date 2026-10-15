# Competitor Research — Setup

The **Competitor Research** page (sidebar → Current Profile → Competitor Research) lets you track
competitors and other accounts in your niche on Instagram and TikTok. A research agent then:

1. Pulls each account's last 90 days of posts and engagement numbers.
2. Ranks posts by how far they beat that account's usual engagement.
3. Looks at the top posts' images (GPT-4o vision) along with captions and metrics.
4. Searches the web for trending formats, memes and engagement tactics in your niche (OpenAI web search).
5. Writes a report: what's working visually, caption patterns, engagement tactics, opportunities,
   account benchmarks, and ready-to-post ideas in the client's brand voice. Ideas can be added to the calendar.

"Find accounts in my niche" uses web search plus the saved niche profile (category, location,
keywords) to suggest accounts. Instagram suggestions are checked against Instagram before they're shown.

Costs: a research run is **5 AI credits**, an account search is **1 credit**.

## 1. Run the migrations

Run these in the Supabase SQL editor, in order. Both are safe to run more than once.

1. `migrations/030-competitor-research.sql`
2. `migrations/031-competitor-research-scale.sql` (shared cache, rate-limit queue, 90-day data cleanup)

## 2. Instagram (Business Discovery)

Business Discovery reads public **Business and Creator** accounts (not personal ones) through
*your own* Instagram Business account. Because the account and Meta app are yours, it works on
standard access straight away. Since the results are shown to paying customers, also apply for
**Advanced Access** (App Review) for these permissions, in parallel. That keeps the app on the safe
side of Meta's rules, and the same app handles your publishing.

1. Create or choose ContentFlow's own Instagram **Business** (or Creator) account and link it to a Facebook Page.
2. In your Meta app (the one used for `META_APP_ID`), add the **Instagram Graph API** product.
3. In Meta Business Manager → Business settings → Users → **System users**, create a system user,
   give it access to the Facebook Page and the Meta app, and generate a token with:
   - `instagram_basic`
   - `pages_read_engagement`
   - `pages_show_list`

   Pick "Never" for expiry.
4. Find the Instagram account ID:
   `GET https://graph.facebook.com/v23.0/{page-id}?fields=instagram_business_account&access_token={token}`
5. Set these in Vercel:

| Variable | Value |
|---|---|
| `INSTAGRAM_RESEARCH_ACCOUNT_ID` | the `instagram_business_account.id` from step 4 |
| `INSTAGRAM_RESEARCH_ACCESS_TOKEN` | the system user token |
| `META_GRAPH_API_VERSION` | optional, defaults to `v23.0` |

Rate limits: every client's research shares this one token's limit. Meta calculates that limit
from the querying Instagram account's own activity, so use an account that posts and gets seen
regularly. A quiet account gets a smaller allowance.

How the app protects the shared limit:
- **Shared cache:** each account's posts are fetched at most once a day, however many clients track it.
- **Usage tracking:** Meta reports usage on every response. Above 80%, new runs are **queued**
  instead of failing. They start automatically when the limit resets and aren't charged until they run.
  Account checks and search suggestions are skipped (shown as "unverified") rather than using up the limit.
- If the limit is hit mid-run, the remaining accounts are skipped with a warning and the report
  uses what was collected.

## 3. Trend search (OpenAI)

Uses the existing `OPENAI_API_KEY` and `OPENAI_MODEL` (default `gpt-4o`) with the Responses API
web search tool. Nothing else to set up.

## 4. TikTok (Apify, optional)

TikTok has no official API for reading other accounts, so TikTok data comes from Apify's
TikTok Scraper actor. TikTok accounts are skipped (with a warning on the report) until this is set.

| Variable | Value |
|---|---|
| `APIFY_API_TOKEN` | Apify → Settings → API & Integrations |
| `APIFY_TIKTOK_ACTOR` | optional, defaults to `clockworks~tiktok-scraper` |

Each run fetches 20 recent videos per tracked TikTok account, billed by Apify per result.

## Language

Each client's niche profile has a language. Insights, captions, trend search and account
suggestions use it, with spelling that matches the client's location (e.g. NZ English vs US English).

## Data retention

Competitor captions, image links, post links and hashtags are removed from reports after
**90 days** (`purge_competitor_research_data()`); insights, post ideas and metrics are kept.
The shared cache is cleared after 7 days. Cleanup runs after every research run, and also from the cron below.
Mention competitor research in your privacy policy.

## Background jobs (optional cron)

No cron is required. Queued runs start when anyone opens a Competitor Research page or polls a
queued report, and cleanup runs after each research run. As a backstop for quiet periods, schedule:

- `GET /api/cron/competitor-research` with header `Authorization: Bearer $CRON_SECRET`
- Hourly (`0 * * * *`), or daily on plans that only allow daily crons.

`CRON_SECRET` must be set; in production the route refuses every request without it.

**Heads-up about existing crons:** `src/middleware.ts` redirects any API request without a login
session to the login page, so the existing `/api/cron/check-trial-expiry` and
`/api/cron/generate-autopilot-plans` routes can't run from a scheduler as things stand.
Only the competitor-research cron path was exempted. The others weren't opened up, because they
skip their secret check when `CRON_SECRET` is unset.

## Notes

- Competitor images come straight from Instagram/TikTok CDN links, which expire after a few days,
  so older reports show "Preview unavailable" for images. The analysis text is unaffected.
- Runs continue in the background (`after()`), so users can leave the page. A run still "running"
  10 minutes after it started is marked failed. A run still queued after 24 hours is failed, with no charge.
- Up to 15 tracked accounts per client profile.
