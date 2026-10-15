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

## 1. Run the migration

Run `migrations/030-competitor-research.sql` in the Supabase SQL editor. It's safe to run more than once.

## 2. Instagram (Business Discovery, no App Review needed)

Business Discovery reads public **Business and Creator** accounts (not personal ones) through
*your own* Instagram Business account. Since the account and Meta app are yours, standard access is enough.

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

Limits: about 200 Graph API calls per hour per token. A research run uses one call per tracked
Instagram account; adding an account or a search suggestion uses one call each.

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

## Notes

- Competitor images come straight from Instagram/TikTok CDN links, which expire after a few days,
  so older reports show "Preview unavailable" for images. The analysis text is unaffected.
- Runs continue in the background (`after()`), so users can leave the page. A run still "running"
  after 10 minutes is marked failed.
- Up to 15 tracked accounts per client profile.
