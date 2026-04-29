# Autopilot Feature

AI-powered weekly content plan generation, approval, and publishing for Content Manager.

---

## What it does

Autopilot analyses a client's media gallery, brand profile, posting preferences, and upcoming events to generate a full week of social media content using GPT-4o. Posts are created in draft status and presented to the user for review before any content goes live.

**Pipeline:**
1. **Generate** — AI selects photos from the media gallery, writes captions in the client's brand voice, and schedules posts across the week
2. **Review** — The user approves, edits, rejects, or swaps photos on each post
3. **Publish** — Approved posts are uploaded to LATE and scheduled across connected social accounts

---

## Setting up Autopilot for a client

### 1. Upload and analyse media

Navigate to **Media Gallery** → upload photos → click **Analyse** on each photo (or Analyse All). Photos must have `ai_analysis_status = 'complete'` before Autopilot can use them.

### 2. Configure client brand profile

In **Client Settings**, fill in:
- Brand tone, target audience, value proposition
- Caption dos and don'ts
- Brand voice examples

### 3. Configure Autopilot settings

Navigate to **Auto Settings** (Bot icon in sidebar):

| Section | Key settings |
|---|---|
| **Autopilot Control** | Enable Autopilot toggle, generation day, require approval, auto-publish |
| **Operating Hours** | Which days the business is open and what hours |
| **Posting Preferences** | Posts per week, preferred days/times, content mix (promotional/engagement/seasonal/educational) |
| **Business Context** | Business type, hemisphere (affects season detection), key offerings |

### 4. Connect social accounts

Navigate to **Connect** → link Instagram and Facebook accounts via LATE.

---

## How plan generation works

The `generateContentPlan()` function in `src/lib/autopilot-engine.ts` runs 10 steps:

1. **Gather context** (parallel) — brand profile, content events, recent posts, existing posts in range, available gallery items, default project
2. **Determine posts needed** — `posts_per_week` from preferences minus existing scheduled posts
3. **Call OpenAI GPT-4o** — structured JSON response with `plan_summary` and array of posts, each with `scheduled_date`, `scheduled_time`, `media_gallery_id`, `caption`, `post_type`, `reasoning`
4. **Parse & validate** — strip JSON fences, validate dates in range, verify media IDs exist
5. **Update plan record** with AI summary
6. **Insert calendar posts** — flat columns in `calendar_scheduled_posts`, `source='autopilot'`, `autopilot_status='pending_approval'`
7. **Update gallery freshness** — decrement `freshness_score`, increment `times_used`
8. **Mark plan** `pending_approval`
9. **Track AI credits** — 1 base + 1 per post generated
10. **Send email notification** — `sendAutopilotPlanReadyEmail()` via Resend

---

## Approval flow

The review UI lives at `/dashboard/client/[clientId]/autopilot`.

Each post card supports:
- **Approve** — marks `autopilot_status = 'approved'`
- **Edit Caption** — inline textarea → saves as `autopilot_status = 'edited_and_approved'`
- **Swap Photo** — opens gallery picker → calls `POST /api/autopilot/plans/[planId]/swap-photo` → regenerates caption with GPT-4o → updates post
- **Change Time** — inline time picker → PATCH to calendar endpoint
- **Reject** — marks `autopilot_status = 'rejected'`
- **Approve All** — bulk approves all pending posts

Once posts are approved, a **Publish** button appears. Publishing:
1. Uploads each image to LATE CDN
2. Schedules via `POST https://getlate.dev/api/v1/posts` with connected account IDs
3. Updates post with `late_post_id` and `late_status = 'scheduled'`
4. Sends a "Your posts are live!" email notification

---

## Automatic plan generation (cron)

`/api/cron/generate-autopilot-plans` runs every Sunday at 09:00 UTC.

Clients are included if:
- `autopilot_enabled = true`
- `autopilot_settings.auto_generate = true`
- `autopilot_settings.generation_day` matches today (or is unset)
- No non-failed plan already exists for the coming week

The cron is secured with `CRON_SECRET` in production (same pattern as the trial-expiry cron).

---

## API routes

| Method | Path | Description |
|---|---|---|
| POST | `/api/autopilot/generate-plan` | Generate a new plan |
| GET | `/api/autopilot/plans` | List plans for a client |
| GET | `/api/autopilot/plans/[planId]` | Fetch plan + posts |
| PATCH | `/api/autopilot/plans/[planId]` | Update plan status |
| POST | `/api/autopilot/plans/[planId]/approve` | Approve/reject posts |
| POST | `/api/autopilot/plans/[planId]/swap-photo` | Swap photo + regenerate caption |
| POST | `/api/autopilot/plans/[planId]/publish` | Publish to LATE |
| GET | `/api/cron/generate-autopilot-plans` | Cron: auto-generate plans |

---

## Subscription requirements

Autopilot requires the **Freelancer (professional)** tier or above.

- `freemium`, `trial`, `starter` → upgrade prompt shown instead of generate button
- AI credit checks are enforced per action:
  - Plan generation: 1 + posts_per_week credits
  - Photo swap: 1 credit (caption regeneration)

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | ✅ | OpenAI API key |
| `OPENAI_MODEL` | Optional | Defaults to `gpt-4o` |
| `RESEND_API_KEY` | Optional | Email notifications |
| `RESEND_FROM_EMAIL` | Optional | Sender address |
| `LATE_API_KEY` | ✅ (for publishing) | LATE scheduling API |
| `NEXT_PUBLIC_BASE_URL` | Optional | For email deep links |
| `CRON_SECRET` | Optional (prod) | Secures the cron endpoint |

---

## Database tables

| Table | Purpose |
|---|---|
| `autopilot_plans` | One row per generated week-plan |
| `calendar_scheduled_posts` | Individual posts (`source='autopilot'`) |
| `media_gallery` | Photo library with AI analysis |
| `content_events` | Calendar events used for seasonal content |
