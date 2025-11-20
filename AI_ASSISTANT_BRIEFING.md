# ContentFlow v2 - AI Assistant Briefing

> **Use this document to quickly brief Claude or other AI assistants about the ContentFlow application.**

---

## What is ContentFlow?

ContentFlow is an AI-powered social media management SaaS platform for marketing agencies, freelancers, and in-house teams. It's a Next.js 15 web application that helps users create, schedule, and publish social media content across multiple platforms while collaborating with clients through approval workflows.

---

## Core Technology

- **Framework:** Next.js 15 (App Router) + React 19 + TypeScript
- **Styling:** Tailwind CSS 4 + Shadcn/ui components
- **Database:** Supabase (PostgreSQL) with Row Level Security
- **Storage:** Vercel Blob for images/videos
- **AI:** OpenAI GPT-4 for content generation
- **Publishing:** LATE API (getlate.dev) for social media scheduling
- **Payments:** Stripe for subscriptions and credit purchases
- **Hosting:** Vercel (serverless)
- **State:** Zustand + React Context
- **Security:** Rate limiting (Upstash Redis), CORS, Zod validation

---

## Main Features

### 1. AI Content Suite (`/dashboard/client/[clientId]/content-suite`)
- Upload images/videos (10MB images, 100MB videos)
- AI-generated captions using OpenAI (brand-aware)
- Platform-specific previews (Instagram, Facebook, LinkedIn, TikTok, Twitter, YouTube)
- Edit existing posts with full AI access
- Drag-and-drop media upload

### 2. Calendar (`/dashboard/client/[clientId]/calendar`)
- Interactive drag-and-drop scheduling
- Multiple views: column, month, Kanban
- Scheduled and unscheduled posts
- Client uploads displayed alongside posts
- Inline time editing
- Bulk operations

### 3. Client Management (`/dashboard/clients`)
- Multi-client dashboard
- Comprehensive brand information storage
- Brand document uploads (PDF, Word)
- Website content scraping
- Social media account connections via LATE API
- Activity tracking (uploads, approvals, upcoming posts)

### 4. Client Portal (`/portal/[token]`)
- Token-based access (no login required)
- Review scheduled posts in calendar
- Approve/reject posts with comments
- Edit captions directly
- Upload photos/videos to specific calendar dates
- Activity logging

### 5. Social Media Publishing
- LATE API integration for 7+ platforms
- OAuth account connections
- Multi-platform scheduling
- Media upload to LATE CDN
- Status tracking (draft → scheduled → published)

### 6. Subscription & Billing
- 4 tiers: Free, In-House ($35), Freelancer ($79), Agency ($199)
- Usage tracking: clients, posts, AI credits
- Stripe Checkout and Customer Portal
- Purchasable AI credit packs (50/150/500 credits)
- Webhook handling for subscription updates

---

## Key Database Tables

```
user_profiles              - User accounts, Stripe customer ID, subscription data
clients                    - Client profiles, brand info, LATE profile ID
projects                   - Optional project organization
calendar_scheduled_posts   - Posts with date/time, platforms, approval status
calendar_unscheduled_posts - Draft posts (drag into calendar)
client_uploads             - Client-uploaded content from portal
client_approval_sessions   - Portal access tokens
post_approvals             - Approval decisions and comments
brand_documents            - Uploaded brand materials
website_scrapes            - Cached website content
subscriptions              - Stripe subscription data with usage counters
billing_history            - Invoice records
```

All tables have Row Level Security (RLS) enabled.

---

## Important API Routes

```
/api/ai                        - Generate captions, content ideas (OpenAI)
/api/clients/create            - Create client with LATE profile
/api/clients/[clientId]/*      - Client CRUD, brand info, documents
/api/calendar/scheduled        - Get/update scheduled posts
/api/calendar/unscheduled      - Get/update draft posts
/api/posts/create              - Create posts (single or bulk)
/api/posts/[postId]            - Edit/delete post
/api/late/schedule-post        - Publish via LATE API
/api/late/connect-platform     - Connect social accounts (OAuth)
/api/late/upload-media         - Upload media to LATE CDN
/api/portal/validate           - Validate portal token
/api/portal/approvals          - Submit approval decisions
/api/portal/upload             - Client uploads
/api/stripe/checkout           - Create subscription checkout
/api/stripe/webhook            - Handle Stripe events
/api/stripe/credits/checkout   - Purchase AI credits
/api/upload-media              - Upload to Vercel Blob
```

---

## Security Implementation

- ✅ Row Level Security on all tables
- ✅ Rate limiting on all routes (10-100 req/min)
- ✅ CORS with origin whitelisting
- ✅ Zod input validation
- ✅ Authentication middleware
- ✅ Client ownership verification
- ✅ Subscription limit checks
- ✅ Secure error handling (no sensitive data leaks)
- ✅ CSRF protection on mutations
- ✅ Environment variables for secrets

---

## File Structure (Key Locations)

```
src/
├── app/
│   ├── api/                      # All API routes
│   ├── dashboard/
│   │   ├── client/[clientId]/
│   │   │   ├── content-suite/    # AI content creation
│   │   │   ├── calendar/         # Scheduling interface
│   │   │   └── page.tsx          # Client dashboard
│   │   ├── clients/              # Client list
│   │   └── page.tsx              # Main dashboard
│   ├── portal/[token]/           # Client portal
│   ├── pricing/                  # Pricing page
│   └── page.tsx                  # Landing page
├── components/
│   ├── ui/                       # Shadcn components
│   ├── ColumnViewCalendar.tsx    # Main calendar component
│   ├── PortalKanbanCalendar.tsx  # Portal calendar
│   └── BuyCreditsDialog.tsx      # Credit purchase UI
├── lib/
│   ├── supabaseClient.ts         # Database client
│   ├── contentStore.tsx          # Content state (Zustand)
│   ├── subscriptionMiddleware.ts # Usage limit checks
│   ├── authHelpers.ts            # Auth utilities
│   ├── ai-utils.ts               # OpenAI integration
│   └── stripe.ts                 # Stripe helpers
└── middleware.ts                 # Route protection

Database:
├── database-setup.sql                    # Main schema
├── complete-client-dashboard-schema.sql  # Client tables
├── client_approval_system.sql            # Approvals
└── create-subscriptions-table.sql        # Billing
```

---

## Common Workflows

### Create & Schedule Content
1. User selects client → Content Suite
2. Upload image/video
3. Generate AI caption (uses client brand info)
4. Save as unscheduled post
5. Drag from sidebar to calendar date
6. Select social accounts and time
7. Post scheduled via LATE API

### Client Approval
1. Agency creates posts in calendar
2. Generate portal link for client
3. Client opens link (no login)
4. Client approves/rejects with comments
5. Agency receives notification
6. Approved posts auto-schedule

### Brand Intelligence
1. Create client profile
2. Add brand info (tone, audience, values)
3. Upload brand documents
4. System scrapes website content
5. AI uses all context for caption generation

---

## Subscription Limits

| Tier | Clients | Posts/Month | AI Credits/Month |
|------|---------|-------------|------------------|
| Free | 1 | N/A | 10 |
| In-House | 1 | 30 | 100 |
| Freelancer | 5 | 150 | 500 |
| Agency | Unlimited | Unlimited | 2,000 |

Enforced via middleware on:
- `/api/clients/create` - checks client limit
- `/api/posts/create` - checks post limit
- `/api/ai` - checks AI credit balance
- `/api/late/schedule-post` - checks posting permissions

---

## Environment Variables (Critical)

```bash
# Required for basic functionality
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
LATE_API_KEY=
BLOB_READ_WRITE_TOKEN=

# Required for payments
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID=
NEXT_PUBLIC_STRIPE_PROFESSIONAL_PRICE_ID=
NEXT_PUBLIC_STRIPE_AGENCY_PRICE_ID=
NEXT_PUBLIC_STRIPE_CREDITS_50_PRICE_ID=
NEXT_PUBLIC_STRIPE_CREDITS_150_PRICE_ID=
NEXT_PUBLIC_STRIPE_CREDITS_500_PRICE_ID=

# Required for rate limiting
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Optional
SENTRY_DSN=
NEXT_PUBLIC_BASE_URL=
```

---

## Integration Details

### OpenAI Integration
- **Location:** `src/lib/ai-utils.ts` and `/api/ai/route.ts`
- **Models:** GPT-4 Turbo, GPT-3.5 Turbo
- **Features:** Caption generation, content ideas
- **Context:** Pulls client brand info, website content, brand documents
- **Credits:** 1 credit per API call

### LATE API Integration
- **Location:** `/api/late/*` routes
- **Features:** Profile creation, OAuth connections, post scheduling, media uploads
- **Platforms:** Instagram, Facebook, LinkedIn, Twitter, TikTok, YouTube, Threads
- **Profile Creation:** Auto-creates LATE profile when client is created
- **OAuth:** Handles platform-specific connection flows

### Stripe Integration
- **Location:** `/api/stripe/*` routes
- **Products:** 3 subscription tiers + 3 credit packs
- **Webhook Events:** `checkout.session.completed`, `customer.subscription.*`, `invoice.*`
- **Customer Portal:** Enabled for self-service management

---

## Known Patterns in Codebase

### API Route Pattern
```typescript
// 1. Rate limiting check
// 2. Authentication check
// 3. Input validation (Zod)
// 4. Client ownership verification (if applicable)
// 5. Subscription limit check (if applicable)
// 6. Business logic
// 7. Database operation
// 8. Success response
// 9. Error handling (secure, no sensitive data)
```

### RLS Policy Pattern
```sql
-- All tables follow this pattern:
CREATE POLICY "Users can view X for accessible clients" ON table_name
  FOR SELECT USING (
    client_id IN (
      SELECT id FROM clients 
      WHERE id = table_name.client_id
    )
  );
```

### Component Pattern
- Server components by default
- Client components marked with `'use client'`
- Zustand store for content state
- React Context for auth and credits
- Shadcn components for UI

---

## Common Tasks & Where to Look

**Add new AI feature:** `src/lib/ai-utils.ts` + `/api/ai/route.ts`  
**Modify calendar:** `src/components/ColumnViewCalendar.tsx`  
**Change subscription logic:** `src/lib/subscriptionMiddleware.ts`  
**Add portal feature:** `src/app/portal/[token]/page.tsx`  
**Update client dashboard:** `src/app/dashboard/client/[clientId]/page.tsx`  
**Modify post creation:** `/api/posts/create/route.ts`  
**Add database table:** Create `.sql` file, add RLS policies  
**Change rate limits:** `src/lib/rateLimit.ts`  

---

## Quick Context Dump

When asking AI for help with ContentFlow, provide:

1. **What feature/area:** Calendar? Content Suite? API? Portal?
2. **User role:** Agency user or client accessing portal?
3. **Relevant files:** See "File Structure" above
4. **Database tables involved:** See "Key Database Tables" above
5. **Error messages:** Full error with stack trace
6. **Expected behavior:** What should happen?
7. **Current behavior:** What's actually happening?

**Example prompt:**
> "I'm working on the ContentFlow calendar feature. When a user drags an unscheduled post to a calendar date, it should schedule the post without refreshing the entire calendar. The drag-and-drop logic is in `src/app/dashboard/client/[clientId]/calendar/page.tsx` and uses the `/api/calendar/scheduled` route. Currently, the entire calendar reloads. How can I update just the local state?"

---

## Current Status

- ✅ Production ready
- ✅ Deployed on Vercel
- ✅ All core features implemented
- ✅ Security hardened (RLS, rate limiting, validation)
- ✅ Stripe integration complete
- ✅ LATE API integration complete
- ✅ AI content generation working
- ⏳ Analytics/reporting (roadmap)
- ⏳ White-label branding (roadmap)
- ⏳ Mobile apps (roadmap)

---

## For Detailed Information

- **Full Technical Brief:** `COMPREHENSIVE_PRODUCT_BRIEF.md` (15+ pages)
- **Quick Overview:** `QUICK_PRODUCT_BRIEF.md` (5 pages)
- **Setup Guide:** `README.md`
- **Security Details:** `SECURITY_IMPLEMENTATION_SUMMARY.md`
- **Stripe Setup:** `STRIPE_INTEGRATION_GUIDE.md`
- **Feature Docs:** See individual `*_IMPLEMENTATION.md` files

---

**Last Updated:** November 20, 2025  
**Version:** 2.0  
**Status:** Production Ready

