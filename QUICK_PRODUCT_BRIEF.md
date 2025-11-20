# ContentFlow v2 - Quick Product Brief

**TL;DR:** ContentFlow is an AI-powered social media management SaaS for marketing agencies. It combines AI content creation, client collaboration portals, approval workflows, and automated multi-platform scheduling—all in one modern web app.

---

## What It Does

### For Marketing Agencies & Freelancers:
1. **Create content faster** with AI-generated captions that understand each client's brand voice
2. **Manage multiple clients** from one dashboard with unlimited brand profiles (agency tier)
3. **Schedule posts** across Instagram, Facebook, LinkedIn, TikTok, Twitter, and YouTube
4. **Collaborate with clients** via secure portal links (no login required for clients)
5. **Track usage** with subscription-based billing and AI credit system

### For Clients (via Portal):
1. **Review scheduled posts** in an easy calendar view
2. **Approve or reject** content with comments
3. **Upload their own content** (photos/videos) to contribute
4. **Edit captions** directly if needed
5. **No account needed** – just click a secure link

---

## Core Tech Stack

- **Frontend:** Next.js 15 + React 19 + TypeScript + Tailwind CSS
- **Backend:** Next.js API Routes (serverless)
- **Database:** Supabase (PostgreSQL with Row Level Security)
- **Storage:** Vercel Blob (images/videos)
- **AI:** OpenAI GPT-4 for caption generation
- **Publishing:** LATE API for social media scheduling
- **Payments:** Stripe for subscriptions + one-time credit purchases
- **Security:** Rate limiting (Upstash Redis), CORS, input validation, RLS on all tables

---

## Key Features Explained

### 1. AI Content Suite
- Upload images/videos (supports up to 100MB videos)
- Generate platform-specific captions with AI
- AI pulls from client's brand guidelines automatically
- Get content ideas and suggestions
- Edit existing posts with full AI features
- Real-time social media previews

### 2. Interactive Calendar
- Drag-and-drop scheduling
- Multiple views (column, month, Kanban)
- Inline time editing
- Color-coded by status/platform
- Shows client uploads alongside scheduled posts
- Bulk operations (delete, reschedule)

### 3. Brand Intelligence
- Store comprehensive brand info per client
- Upload brand documents (PDFs, Word docs)
- Automatic website content scraping
- Brand voice examples for AI consistency
- Caption dos and don'ts
- Brand keywords and tone settings

### 4. Client Portal
- Shareable link per client (token-based, no login)
- Calendar view of scheduled posts
- Approve/reject with comments
- Upload photos/videos to specific dates
- Edit captions directly
- Activity tracking

### 5. Social Media Publishing
- Integrates with LATE API
- Connect Instagram, Facebook, LinkedIn, TikTok, Twitter, YouTube accounts
- OAuth flows for account connection
- Schedule to multiple platforms at once
- Track publishing status (draft → scheduled → published)
- Automatic media uploads to LATE's CDN

### 6. Subscription System
- **Free:** 1 client, 10 AI credits/month
- **In-House ($35/mo):** 1 client, 30 posts/month, 100 AI credits
- **Freelancer ($79/mo):** 5 clients, 150 posts/month, 500 AI credits
- **Agency ($199/mo):** Unlimited clients & posts, 2,000 AI credits

Plus: Buy additional AI credit packs anytime (50, 150, or 500 credits)

---

## Database Tables (Simplified)

**Users & Clients:**
- `user_profiles` - User accounts with Stripe customer ID
- `clients` - Client profiles with brand info and LATE profile ID
- `projects` - Optional project organization per client

**Content:**
- `calendar_scheduled_posts` - Posts with date/time/platforms
- `calendar_unscheduled_posts` - Draft posts (drag into calendar)
- `client_uploads` - Content uploaded by clients in portal

**Approvals:**
- `client_approval_sessions` - Portal access tokens
- `post_approvals` - Approval decisions and comments

**Brand:**
- `brand_documents` - Uploaded brand materials
- `website_scrapes` - Cached website content

**Billing:**
- `subscriptions` - Stripe subscription data with usage counters
- `billing_history` - Invoice records

---

## User Journey Example

### Agency Creates Content for Client:

1. **Add Client**
   - Create client profile: "Acme Coffee Co"
   - Fill brand info: friendly tone, coffee enthusiasts audience
   - Upload logo and brand guidelines PDF
   - Connect their Instagram and Facebook accounts

2. **Create Posts**
   - Open Content Suite
   - Upload coffee product photo
   - Click "Generate Caption" 
   - AI creates: "☕️ Introducing our Fall Harvest Blend! Rich notes of caramel..."
   - Preview how it looks on Instagram vs Facebook
   - Save as unscheduled post

3. **Schedule in Calendar**
   - View calendar
   - Drag post from sidebar to November 25th
   - Set time to 9:00 AM
   - Select Instagram + Facebook accounts

4. **Send for Approval**
   - Generate portal link
   - Email link to client
   - Client opens link (no login)
   - Client approves with comment: "Love it!"

5. **Publish**
   - Post auto-schedules via LATE API
   - Goes live on Instagram and Facebook at 9 AM on Nov 25
   - Status tracked: scheduled → published

---

## API Architecture (High-Level)

```
/api/
  ├── ai/              - Generate captions, content ideas
  ├── clients/         - CRUD for clients, brand info
  ├── calendar/        - Scheduled/unscheduled posts
  ├── posts/           - Create, edit, delete posts
  ├── late/            - Social media publishing (LATE API)
  ├── portal/          - Client portal operations
  ├── stripe/          - Subscriptions, payments, webhooks
  └── upload-media/    - Image/video uploads
```

**All routes protected with:**
- Authentication checks
- Rate limiting
- Input validation (Zod)
- Client ownership verification
- Subscription limit checks

---

## Security Highlights

✅ **Row Level Security (RLS)** on all database tables  
✅ **Rate limiting** (10-100 req/min depending on route)  
✅ **CORS protection** with origin whitelisting  
✅ **Input validation** with Zod schemas  
✅ **No sensitive data** in error messages  
✅ **Secure token-based** portal access  
✅ **Stripe webhooks** with signature verification  
✅ **Environment variables** for all secrets  
✅ **Sentry monitoring** for errors  

---

## Third-Party Services

| Service | Purpose | Why |
|---------|---------|-----|
| **OpenAI** | AI caption generation | Industry-leading LLM quality |
| **LATE API** | Social media publishing | Supports 7+ platforms, handles OAuth |
| **Stripe** | Billing & payments | Industry standard, great dev experience |
| **Supabase** | Database + Auth + Storage | Fast, PostgreSQL-based, RLS built-in |
| **Vercel** | Hosting | Optimized for Next.js, edge functions |
| **Vercel Blob** | Media storage | Fast CDN, serverless-friendly |
| **Upstash Redis** | Rate limiting | Serverless Redis, global edge |
| **Sentry** | Error tracking | Best-in-class error monitoring |

---

## Competitive Advantages

### vs. Hootsuite/Buffer:
- ✅ **AI-first approach** to content creation
- ✅ **Built-in client portal** (they require separate tools)
- ✅ **Better UX** - modern, intuitive interface
- ✅ **More affordable** for small agencies
- ✅ **Brand intelligence** system

### vs. Later/Planoly:
- ✅ **Multi-client management** (they're single-user focused)
- ✅ **Approval workflows** built-in
- ✅ **More platforms** supported (7 vs 4)
- ✅ **AI content generation**

### vs. Sprout Social:
- ✅ **10x cheaper** for agencies
- ✅ **Simpler setup** (minutes vs hours)
- ✅ **Modern tech stack** (faster, more reliable)
- ❌ Less analytics (roadmap item)

---

## Current State

**Status:** ✅ Production Ready  
**Version:** 2.0  
**Deployed:** Vercel (contentflow-v2.vercel.app)  
**Lines of Code:** ~35,000+ (TypeScript + SQL)  
**Database Tables:** 20+ with full RLS  
**API Routes:** 50+ endpoints  
**Test Coverage:** Critical paths covered  

---

## What's Next (Roadmap)

**Q2 2025:**
- Analytics dashboard (post performance metrics)
- Bulk CSV import
- White-label branding for agencies
- Mobile apps

**Q3 2025:**
- AI image generation (DALL-E)
- Video editing tools
- Content library (reusable assets)
- Automated client reports

**Q4 2025:**
- Influencer collaboration
- Engagement prediction (AI)
- Multi-language support
- Public API for integrations

---

## Key Files to Know

**Frontend:**
- `src/app/dashboard/client/[clientId]/content-suite/page.tsx` - AI content creation
- `src/app/dashboard/client/[clientId]/calendar/page.tsx` - Main calendar
- `src/app/portal/[token]/page.tsx` - Client portal
- `src/components/` - Reusable UI components

**Backend:**
- `src/app/api/ai/route.ts` - OpenAI integration
- `src/app/api/late/schedule-post/route.ts` - Publish to social media
- `src/app/api/stripe/webhook/route.ts` - Handle Stripe events
- `src/lib/subscriptionMiddleware.ts` - Usage limit checks

**Database:**
- `database-setup.sql` - Main schema
- `complete-client-dashboard-schema.sql` - Client tables
- `client_approval_system.sql` - Approval workflow
- `create-subscriptions-table.sql` - Billing

**Config:**
- `next.config.ts` - Next.js config
- `middleware.ts` - Auth and rate limiting
- `lib/supabaseClient.ts` - Database client

---

## Environment Setup (Quick)

```bash
# 1. Clone and install
git clone [repo]
npm install

# 2. Copy environment template
cp .env.example .env.local

# 3. Add keys (required):
# - Supabase URL + keys
# - OpenAI API key
# - Stripe keys + price IDs
# - LATE API key
# - Vercel Blob token
# - Upstash Redis URL + token

# 4. Run database migrations
# (Copy .sql files to Supabase SQL Editor and run)

# 5. Start dev server
npm run dev
```

Visit `http://localhost:3000`

---

## Common Questions

**Q: Can clients access the main dashboard?**  
A: No, clients only access a limited portal via unique link. They can't see your dashboard or other clients.

**Q: What if a client rejects a post?**  
A: You get notified, can see their comments, edit the post, and resubmit for approval.

**Q: Do I need separate accounts with Facebook, Instagram, etc?**  
A: No, LATE API handles all OAuth connections. You connect once per client through the app.

**Q: Can I white-label this for my agency?**  
A: Not yet, but it's coming in Q2 2025 for Agency tier.

**Q: What happens if I hit my post limit?**  
A: The UI warns you at 80% usage, and blocks new posts at 100%. You can upgrade or wait for next billing cycle.

**Q: Do AI credits roll over?**  
A: No, monthly credits reset. But purchased credit packs add to your limit permanently.

**Q: Is there an API for custom integrations?**  
A: Not yet, but it's on the roadmap for Q4 2025.

---

## Support

**In-House Tier:** Email support (24-48h)  
**Freelancer Tier:** Priority email (12-24h)  
**Agency Tier:** Phone + email (4h response)  

**Email:** support@contentflow.com  
**Docs:** docs.contentflow.com (coming soon)  

---

**For a more detailed technical breakdown, see `COMPREHENSIVE_PRODUCT_BRIEF.md`**

