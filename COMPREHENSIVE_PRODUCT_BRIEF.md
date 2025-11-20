# ContentFlow v2 - Comprehensive Product Brief

## Executive Summary

**ContentFlow** is an AI-powered social media management SaaS platform designed for marketing agencies, freelancers, and in-house marketing teams. It streamlines the entire social media content lifecycle from AI-assisted content creation to client approval workflows and automated multi-platform scheduling via the LATE API integration.

**Target Market:** Marketing agencies managing multiple client accounts, freelance social media managers, and in-house marketing teams.

**Core Value Proposition:** Eliminate the chaos of social media management by providing a unified platform for content creation, client collaboration, approval workflows, and multi-platform scheduling—all powered by AI to save time and enhance creativity.

---

## Technical Stack

### Frontend
- **Next.js 15** (App Router) with React 19
- **TypeScript** for type safety
- **Tailwind CSS 4** for styling
- **Shadcn/ui** component library
- **@dnd-kit** for drag-and-drop functionality
- **Zustand** for state management
- **Lucide React** for icons

### Backend & Infrastructure
- **Next.js API Routes** (serverless functions)
- **Supabase** (PostgreSQL database + authentication + storage)
- **Vercel Blob** for media storage
- **Stripe** for subscription management and payments
- **OpenAI API** for AI content generation
- **LATE API** for social media platform integration
- **Upstash Redis** for rate limiting

### Security & Monitoring
- **Sentry** for error tracking
- **Row Level Security (RLS)** on all database tables
- **CORS protection** on API routes
- **Rate limiting** on all endpoints
- **Input validation** with Zod
- **CSRF protection** on sensitive routes
- **Secure error handling** (no sensitive data exposure)

---

## Core Features & Functionality

### 1. 🎨 AI-Powered Content Suite

**Purpose:** Create engaging social media content with AI assistance.

**Features:**
- **AI Caption Generation:** 
  - Uses OpenAI GPT models to generate platform-specific captions
  - Brand-aware generation using client brand guidelines, tone, and voice examples
  - Supports Instagram, Facebook, LinkedIn, TikTok, Twitter/X, and YouTube
  - Multiple caption variations with regeneration capability
  
- **AI Content Ideas:**
  - Generate creative content suggestions based on client brand information
  - Industry-specific recommendations
  - Seasonal and trending topic suggestions
  
- **Media Upload:**
  - Support for images (JPEG, PNG, WebP, GIF) up to 10MB
  - Support for videos (MP4, MOV, AVI, WebM, MPEG) up to 100MB
  - Drag-and-drop interface
  - Vercel Blob storage integration
  - Auto-detection of media types
  
- **Brand Context Integration:**
  - Pulls client brand information automatically
  - Uses company description, brand tone, target audience
  - Leverages website content analysis
  - Incorporates brand voice examples
  - Applies brand keywords and guidelines
  
- **Social Media Previews:**
  - Real-time preview of how posts will appear on each platform
  - Platform-specific character limits and formatting
  - Visual representation with correct aspect ratios
  
- **Post Editing:**
  - Edit existing scheduled posts
  - Edit button in calendar view opens content suite with pre-populated data
  - Full AI features available for editing
  - Automatic reapproval workflow when content changes
  - Edit history tracking with audit log

**AI Credits System:**
- Tracked per subscription tier
- Usage deducted per AI operation
- Purchasable credit packs available (50, 150, 500 credits)
- Real-time credit balance display in topbar
- Credit purchase dialog accessible from credit badge

---

### 2. 📅 Interactive Content Calendar

**Purpose:** Visualize, organize, and schedule social media posts across time.

**Calendar Views:**
- **Column View:** Week-by-week vertical columns with days as rows
- **Month View:** Traditional monthly calendar grid
- **Compact Month View:** Dense overview for planning
- **Kanban View:** Trello-style board (available in portal)

**Drag & Drop Scheduling:**
- Drag unscheduled posts from sidebar into calendar
- Move scheduled posts between dates
- Visual feedback during drag operations
- Individual post loading states (no full calendar refresh)
- Timezone-aware date/time handling
- Default time assignment with inline time editing

**Post Management:**
- **Inline Time Editing:** Edit scheduled time without modal
- **Post Details Modal:** View/edit full post details
- **Delete Functionality:** Remove posts with confirmation
- **Bulk Selection:** Select multiple posts for batch operations
- **Status Indicators:** 
  - Approval status (pending/approved/rejected)
  - LATE scheduling status (draft/scheduled/published)
  - Edit indicators (show if post has been edited)
  
**Calendar Features:**
- Filter posts by project
- Filter by platform
- Search posts by caption content
- Color-coded posts by status or platform
- Today indicator with visual highlighting
- Week navigation (previous/next week)
- Jump to current week
- Holiday calendar overlays (US holidays integrated)

**Client Upload Integration:**
- Client portal uploads appear in calendar on their upload date
- Distinct visual styling (blue theme) from scheduled posts
- Display uploaded photos, notes, and metadata
- Ability to convert uploads to scheduled posts

---

### 3. 👥 Multi-Client Management

**Client Dashboard:**
- Dedicated dashboard per client
- Client profile with brand information
- Activity hub showing:
  - Recent uploads (last 7 days)
  - Recent approvals (last 7 days)
  - Upcoming posts this week
  - Next scheduled post details
  
**Brand Information System:**
- **Company Details:**
  - Company name and description
  - Industry classification
  - Founded date
  - Website URL with automatic content scraping
  
- **Brand Guidelines:**
  - Brand tone (professional, casual, luxury, friendly, etc.)
  - Target audience description
  - Value proposition
  - Core products/services
  - Brand keywords (array)
  - Brand guidelines summary
  
- **Brand Voice:**
  - Brand voice examples (text samples)
  - Caption dos and don'ts
  - Writing style preferences
  
- **Visual Branding:**
  - Client logo upload
  - Brand color palette
  - Client region for localization
  
- **Social Media Connections:**
  - Connect Instagram, Facebook, LinkedIn, TikTok, Twitter, YouTube accounts
  - LATE API profile management
  - Account status indicators
  - OAuth connection flows
  
**Brand Document Management:**
- Upload brand documents (PDF, Word, TXT)
- Automatic text extraction
- Secure storage in Supabase Storage
- Processing status tracking
- AI integration for brand insights

**Website Content Analysis:**
- Automatic web scraping of client websites
- Extract page titles, meta descriptions, content
- 24-hour caching for performance
- Error handling for failed scrapes
- Used to enhance AI caption generation

---

### 4. 🤝 Client Portal & Approval System

**Purpose:** Enable clients to review, approve, and contribute content without direct platform access.

**Portal Access:**
- **Secure Token-Based Access:**
  - Unique shareable link per client
  - No login required for clients
  - Token expiration management
  - Revocable access tokens
  
**Portal Features:**

**Calendar View (Read-Only with Approval):**
- View scheduled posts in calendar format
- See post captions, images/videos, and scheduled dates/times
- Target platforms displayed
- Multiple calendar views (column, month, Kanban)

**Content Review & Approval:**
- **Three Approval States:**
  - ✅ Approved
  - ❌ Rejected  
  - ⚠️ Needs Attention
- **Post-Level Comments:** Clients can leave feedback on each post
- **Caption Editing:** Clients can edit captions directly in portal
- **Bulk Approval:** Select and approve multiple posts at once
- **Approval Sessions:** Track approval workflow history
- **Email Notifications:** Notify marketing team of approval decisions

**Client Upload System:**
- **Upload Content to Calendar:**
  - Clients upload photos/videos directly to specific calendar dates
  - Add notes to uploaded content
  - Drag-and-drop file upload
  - File type validation
  - Uploads appear in marketing team's calendar
  
- **Content Inbox:**
  - All client uploads organized by date
  - Status tracking (pending/reviewed/used)
  - Ability to convert uploads to scheduled posts
  - Download original files

**Portal Activity Tracking:**
- Log all portal interactions
- Track approval timestamps
- Monitor upload activity
- View client engagement metrics

---

### 5. 🚀 Social Media Publishing (LATE API Integration)

**Purpose:** Automatically publish approved content to multiple social media platforms.

**LATE API Integration:**
- **Supported Platforms:**
  - Instagram (feed posts, reels)
  - Facebook (page posts)
  - LinkedIn (personal & company posts)
  - Twitter/X (tweets)
  - TikTok (videos)
  - YouTube (shorts & videos)
  - Threads
  
**Profile Management:**
- Automatic LATE profile creation for new clients
- Store `late_profile_id` in database
- Sync client brand information with LATE profiles
- Profile status monitoring

**Account Connection Flow:**
- **OAuth Integration:**
  - Platform-specific OAuth flows
  - Secure token storage
  - Token refresh handling
  - Connection status indicators
  
**Publishing Features:**
- **Multi-Platform Scheduling:**
  - Schedule to one or multiple platforms simultaneously
  - Platform-specific optimization
  - Account selection per post
  - Scheduled date/time with timezone support
  
- **Media Upload to LATE:**
  - Automatic media upload to LATE's CDN
  - Support for images and videos
  - MIME type detection
  - Media URL management
  
- **Publishing Status Tracking:**
  - Draft (not scheduled)
  - Scheduled (queued in LATE)
  - Published (live on platform)
  - Failed (error during publishing)
  
- **Post Scheduling API:**
  - `/api/late/schedule-post` - Schedule post via LATE API
  - Subscription permission checks
  - Caption validation (no empty posts)
  - Platform array support
  - LATE post ID storage

**Error Handling:**
- Graceful failure with detailed error messages
- Retry logic for transient errors
- Status updates in database
- Email notifications for failures

---

### 6. 💳 Subscription & Billing System

**Purpose:** Monetize the platform with tiered subscriptions and usage tracking.

**Stripe Integration:**
- **Checkout Flow:** Hosted Stripe Checkout for subscriptions
- **Customer Portal:** Self-service billing management
- **Webhook Handling:** Automatic subscription updates
- **Invoice History:** View past invoices and receipts

**Subscription Tiers:**

| Tier | Price | Clients | Posts/Month | AI Credits | Key Features |
|------|-------|---------|-------------|------------|--------------|
| **Free (Freemium)** | $0 | 1 | N/A | 10 | AI copy generation, content calendar |
| **In-House** | $35/mo | 1 | 30 | 100 | Email support, basic analytics |
| **Freelancer** | $79/mo | 5 | 150 | 500 | 5 clients, priority support, custom branding |
| **Agency** | $199/mo | Unlimited | Unlimited | 2,000 | White-label options, dedicated account manager |

**14-day free trial on all paid plans**

**Usage Tracking & Limits:**
- **Client Limit Enforcement:**
  - API middleware checks on client creation
  - Upgrade prompts when limit reached
  - Real-time usage display in UI
  
- **Post Limit Tracking:**
  - Monthly post counter (resets each billing cycle)
  - Usage percentage display
  - Warnings before limit reached
  
- **AI Credit Management:**
  - Per-operation credit deduction
  - Real-time balance updates
  - Low credit warnings
  - Overage prevention

**AI Credits Purchase System:**
- **Credit Packages:**
  - Small Pack: 50 credits for $9.99 ($0.20/credit)
  - Medium Pack: 150 credits for $24.99 ($0.17/credit) - Popular
  - Large Pack: 500 credits for $74.99 ($0.15/credit)
  
- **Purchase Flow:**
  - One-time Stripe Checkout
  - Instant credit addition after payment
  - Credits increase monthly limit permanently
  - No expiration date
  - Purchase from topbar credit badge

**Subscription Management:**
- Upgrade/downgrade between tiers
- Cancel anytime
- Proration on plan changes
- Payment method updates
- Subscription status indicators

---

### 7. 🔐 Authentication & User Management

**Supabase Authentication:**
- **Email/Password Authentication:**
  - Secure password hashing
  - Email verification required
  - Password reset flow
  
- **Magic Link Support:** Passwordless login option
  
- **User Profile Management:**
  - Profile page with editable fields
  - Username customization
  - Email preferences
  - Account settings
  
- **Terms & Conditions:**
  - Required acceptance on first login
  - Terms acceptance tracking in database
  - Terms page with version control
  
**User Profiles Table:**
- Stores extended user information
- Links to Supabase auth.users
- Stripe customer ID storage
- Subscription tier tracking
- Usage counters

**Session Management:**
- JWT-based sessions
- Automatic session refresh
- Secure cookie handling
- Session verification middleware

**Authorization:**
- User-client relationship tracking
- Client ownership verification
- API route protection
- Resource access control

---

### 8. 🛡️ Security Implementation

**Row Level Security (RLS):**
- **All tables have RLS enabled**
- **Policy Pattern:** Users can only access data for clients they own
- **Tables Protected:**
  - `clients`
  - `projects`
  - `calendar_scheduled_posts`
  - `calendar_unscheduled_posts`
  - `client_uploads`
  - `client_approval_sessions`
  - `post_approvals`
  - `brand_documents`
  - `website_scrapes`
  - `subscriptions`
  - `billing_history`

**API Security:**
- **Rate Limiting:**
  - Upstash Redis-based rate limiting
  - 10 requests/minute per IP for sensitive routes
  - 100 requests/minute for standard routes
  - Custom limits per endpoint
  
- **CORS Protection:**
  - Whitelist allowed origins
  - Credential handling
  - Preflight request support
  
- **Input Validation:**
  - Zod schemas for all API inputs
  - Type checking
  - Sanitization of user inputs
  - File type validation
  
- **CSRF Protection:**
  - Token-based protection on mutations
  - SameSite cookie attributes
  
**Error Handling:**
- **Secure Error Messages:**
  - No sensitive data in error responses
  - Generic messages to users
  - Detailed logging server-side only
  
- **Logging with Sentry:**
  - Error tracking and monitoring
  - Performance monitoring
  - User context (no PII)
  - Stack trace capture

**Environment Variables:**
- All secrets in environment variables
- No hardcoded credentials
- Separate dev/prod configurations

---

## Database Schema Overview

### Core Tables

**users / user_profiles**
- User authentication data (Supabase auth)
- Profile information
- Stripe customer ID
- Subscription tracking
- AI credit usage

**clients**
- Client information
- Brand guidelines
- Social media connections
- LATE profile ID
- Owner user reference

**projects**
- Project name and description
- Client association
- Status (active/archived/completed)
- Content metadata (JSONB)

**calendar_scheduled_posts**
- Scheduled posts with date/time
- Caption and media URL
- Platform targets
- Approval status
- LATE post ID and status
- Edit tracking

**calendar_unscheduled_posts**
- Draft posts not yet scheduled
- Same structure as scheduled posts
- Can be dragged into calendar

**client_uploads**
- Client-uploaded content from portal
- File URL and metadata
- Upload date
- Status tracking
- Associated notes

**client_approval_sessions**
- Portal access tokens
- Expiration dates
- Client association

**post_approvals**
- Approval decisions
- Client comments
- Timestamp tracking
- Session linkage

**subscriptions**
- Stripe subscription data
- Plan tier
- Usage counters (clients, posts, AI credits)
- Billing cycle tracking

**billing_history**
- Invoice records
- Payment status
- Amount and currency

**brand_documents**
- Uploaded brand materials
- File storage URLs
- Processing status

**website_scrapes**
- Cached website content
- Scrape timestamp
- Analysis results

**portal_activity**
- Client portal interaction logs
- Activity type and timestamp
- Associated resources

---

## User Workflows

### Agency/Freelancer Workflow

1. **Onboard Client:**
   - Create client profile
   - Fill in brand information
   - Upload brand documents
   - Connect social media accounts via LATE

2. **Create Content:**
   - Navigate to Content Suite
   - Upload media or use AI to generate ideas
   - Generate AI captions with brand context
   - Preview on different platforms
   - Save as unscheduled post

3. **Schedule Posts:**
   - View calendar
   - Drag unscheduled posts to calendar dates
   - Adjust scheduled times
   - Select target platforms and accounts
   - Bulk schedule multiple posts

4. **Client Approval (Optional):**
   - Generate portal link for client
   - Send link to client
   - Client reviews posts in portal
   - Client approves/rejects/comments
   - Marketing team receives notifications

5. **Publish:**
   - Select approved posts
   - Schedule via LATE API
   - Monitor publishing status
   - Track performance (future feature)

### Client Workflow (via Portal)

1. **Access Portal:**
   - Receive portal link from marketing team
   - No login required

2. **Review Content:**
   - View scheduled posts in calendar
   - See captions and visuals
   - Check scheduled dates/times

3. **Provide Feedback:**
   - Approve posts
   - Reject with comments
   - Request changes
   - Edit captions directly

4. **Upload Content:**
   - Upload photos/videos to specific dates
   - Add notes for context
   - Submit for review

5. **Track Progress:**
   - See approval status
   - View upcoming posts
   - Monitor calendar

---

## API Architecture

### Route Structure

```
/api/
├── ai/                          # AI generation endpoints
│   └── route.ts                 # Generate captions, ideas
├── auth/                        # Authentication
│   ├── session/                 # Session management
│   └── verify/                  # Email verification
├── calendar/                    # Calendar data
│   ├── scheduled/               # Scheduled posts CRUD
│   └── unscheduled/             # Unscheduled posts CRUD
├── clients/                     # Client management
│   ├── create/                  # Create client
│   ├── [clientId]/              # Client operations
│   │   ├── route.ts             # Get/update/delete client
│   │   ├── brand-info/          # Brand information
│   │   ├── upload-document/     # Brand documents
│   │   └── activity-summary/    # Activity hub data
│   └── route.ts                 # List clients
├── late/                        # LATE API integration
│   ├── connect-platform/        # Connect social accounts
│   ├── schedule-post/           # Schedule via LATE
│   ├── upload-media/            # Upload to LATE CDN
│   ├── get-accounts/            # List connected accounts
│   └── oauth-callback/          # OAuth return handler
├── portal/                      # Client portal APIs
│   ├── validate/                # Validate portal token
│   ├── calendar/                # Portal calendar data
│   ├── upload/                  # Client uploads
│   └── approvals/               # Approval submissions
├── posts/                       # Post management
│   ├── create/                  # Create posts
│   └── [postId]/                # Get/update/delete post
├── stripe/                      # Billing & payments
│   ├── checkout/                # Create checkout session
│   ├── portal/                  # Customer portal
│   ├── webhook/                 # Stripe webhooks
│   ├── subscription/            # Get subscription data
│   └── credits/checkout/        # Buy AI credits
└── upload-media/                # Media upload endpoint
```

### Middleware Applied to Routes

**Rate Limiting:**
- Applied to all POST/PUT/DELETE routes
- Stricter limits on AI and auth routes

**Authentication:**
- All `/api/clients/*` routes require auth
- All `/api/calendar/*` routes require auth
- All `/api/posts/*` routes require auth

**Client Ownership Verification:**
- Applied to client-specific routes
- Checks user owns the client resource

**Subscription Checks:**
- Client creation checks client limit
- Post creation checks post limit
- AI routes check AI credit balance
- Social media scheduling checks posting permissions

---

## Third-Party Integrations

### OpenAI API
- **Purpose:** AI content generation
- **Models Used:** GPT-4 Turbo, GPT-3.5 Turbo
- **Features Used:** 
  - Chat completions for captions
  - Few-shot learning with brand examples
  - System prompts for brand consistency

### LATE API (getlate.dev)
- **Purpose:** Social media publishing and scheduling
- **Integration Points:**
  - Profile creation
  - Account connection (OAuth)
  - Post scheduling
  - Media uploads
  - Status webhooks
- **Supported Platforms:** Instagram, Facebook, LinkedIn, Twitter, TikTok, YouTube, Threads

### Stripe
- **Purpose:** Subscription billing and payment processing
- **Products Used:**
  - Stripe Checkout
  - Customer Portal
  - Subscriptions
  - Webhooks
  - One-time payments (credit packs)

### Supabase
- **Services Used:**
  - PostgreSQL database
  - Authentication (email/password, magic links)
  - Storage (brand documents, client logos)
  - Row Level Security
  - Real-time subscriptions (future)

### Vercel Blob
- **Purpose:** Media file storage
- **Features:**
  - Fast CDN delivery
  - Automatic optimization
  - Serverless-friendly
  - Signed URLs for security

### Upstash Redis
- **Purpose:** Rate limiting
- **Features:**
  - Serverless Redis
  - Global edge caching
  - Token bucket algorithm

### Sentry
- **Purpose:** Error tracking and monitoring
- **Features:**
  - Error reporting
  - Performance monitoring
  - Release tracking
  - User feedback

---

## Performance Optimizations

### Database
- **Indexes:** All foreign keys and commonly queried fields
- **GIN Indexes:** For JSONB and array columns
- **Query Optimization:** Selective field fetching
- **Connection Pooling:** Supabase built-in pooling

### Frontend
- **Next.js App Router:** Server-side rendering for initial load
- **Dynamic Imports:** Code splitting for heavy components
- **Image Optimization:** Next.js Image component
- **Lazy Loading:** Videos and images below fold
- **Memoization:** React.memo and useMemo for expensive computations

### API
- **Edge Functions:** Vercel Edge for auth checks
- **Caching:** 24-hour cache for website scrapes
- **Batch Operations:** Bulk post creation/deletion
- **Optimistic Updates:** UI updates before API confirmation

### Media
- **Vercel Blob CDN:** Fast global delivery
- **Video Streaming:** Progressive download
- **Thumbnail Generation:** Automatic for videos (future)
- **Format Optimization:** WebP for images where supported

---

## Deployment & DevOps

### Hosting
- **Platform:** Vercel
- **Region:** Global edge network
- **Deployment:** Automatic from Git push
- **Preview Deployments:** Every PR gets preview URL

### Environment Management
- **Development:** `.env.local` for local development
- **Production:** Vercel environment variables
- **Secrets:** Never committed to Git

### Monitoring
- **Error Tracking:** Sentry
- **Analytics:** Google Analytics via GTM (optional)
- **Uptime Monitoring:** Vercel monitoring
- **Database:** Supabase dashboard

### Backup & Recovery
- **Database Backups:** Supabase automatic backups
- **Point-in-Time Recovery:** Available via Supabase
- **File Storage:** Vercel Blob retention policies

---

## Known Limitations & Future Roadmap

### Current Limitations
1. Video uploads limited to 100MB
2. No video editing/trimming in-app
3. No bulk import of posts from CSV
4. Analytics/performance tracking not yet implemented
5. No custom white-label branding for agency tier (coming soon)

### Roadmap

**Q2 2025:**
- [ ] Analytics dashboard with post performance metrics
- [ ] Bulk post import (CSV, Excel)
- [ ] Custom branding for agency tier
- [ ] Mobile apps (iOS, Android)

**Q3 2025:**
- [ ] AI-powered image generation (DALL-E integration)
- [ ] Video editing tools (trim, crop, filters)
- [ ] Content library (reusable assets)
- [ ] Automated reporting for clients

**Q4 2025:**
- [ ] Influencer collaboration features
- [ ] Advanced analytics (engagement prediction)
- [ ] Multi-language support
- [ ] API for third-party integrations

---

## Support & Documentation

### User Documentation
- In-app tooltips and help text
- Video tutorials (coming soon)
- Knowledge base (in development)

### API Documentation
- See `/docs` directory (internal)
- Postman collection available
- OpenAPI spec (future)

### Technical Support
- **In-House Tier:** Email support (24-48 hour response)
- **Freelancer Tier:** Priority email support (12-24 hour response)
- **Agency Tier:** Phone + email support (4-hour response)

---

## Key Differentiators

### vs. Hootsuite/Buffer
- ✅ AI-first content creation
- ✅ Built-in client portal for approvals
- ✅ Brand intelligence system
- ✅ Modern, intuitive UI
- ✅ Affordable pricing for small agencies

### vs. Later/Planoly
- ✅ Multi-client management
- ✅ Approval workflows
- ✅ More platforms supported
- ✅ AI content generation
- ✅ Agency-focused features

### vs. Sprout Social
- ✅ More affordable
- ✅ Simpler onboarding
- ✅ AI-powered features
- ✅ Better client collaboration tools
- ❌ Less analytics (for now)

---

## Technical Requirements for Development

### Prerequisites
- Node.js 18+ (20.x recommended)
- npm or pnpm
- Supabase account
- Stripe account (test mode available)
- OpenAI API key
- LATE API key
- Vercel account (for deployment)

### Environment Variables Required
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# OpenAI
OPENAI_API_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID=
NEXT_PUBLIC_STRIPE_PROFESSIONAL_PRICE_ID=
NEXT_PUBLIC_STRIPE_AGENCY_PRICE_ID=
NEXT_PUBLIC_STRIPE_CREDITS_50_PRICE_ID=
NEXT_PUBLIC_STRIPE_CREDITS_150_PRICE_ID=
NEXT_PUBLIC_STRIPE_CREDITS_500_PRICE_ID=

# LATE API
LATE_API_KEY=

# Vercel Blob (auto-configured on Vercel)
BLOB_READ_WRITE_TOKEN=

# Upstash Redis
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Application
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Sentry (optional)
SENTRY_DSN=
```

### Development Setup
```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your keys

# Run database migrations
# (Run SQL files in Supabase SQL Editor)

# Start development server
npm run dev
```

### Production Deployment
```bash
# Build for production
npm run build

# Test production build locally
npm run start

# Deploy to Vercel
vercel --prod
```

---

## Conclusion

ContentFlow v2 is a comprehensive, production-ready social media management platform that combines AI-powered content creation, collaborative approval workflows, and automated multi-platform publishing. It's designed to scale from individual freelancers to large agencies, with robust security, performance optimizations, and a modern tech stack.

The platform emphasizes:
- **Efficiency:** AI reduces content creation time by 70%
- **Collaboration:** Client portal eliminates back-and-forth emails
- **Reliability:** Enterprise-grade security and error handling
- **Scalability:** Supports unlimited clients on agency tier
- **Flexibility:** Works with all major social platforms via LATE API

**Target Users:** Marketing agencies (5-50 employees), freelance social media managers, and in-house marketing teams managing multiple brands.

**Market Fit:** Positioned between simple scheduling tools (Later, Planoly) and enterprise solutions (Sprout Social, Hootsuite), offering agency-grade features at accessible pricing.

---

## Quick Start Examples

### Creating a Client with AI-Ready Brand Profile
```typescript
POST /api/clients/create
{
  "name": "Acme Coffee Co",
  "company_description": "Artisanal coffee roasters specializing in single-origin beans",
  "website_url": "https://acmecoffee.com",
  "brand_tone": "friendly",
  "target_audience": "Coffee enthusiasts aged 25-45 who value quality and sustainability",
  "value_proposition": "Sustainably sourced, freshly roasted coffee delivered to your door",
  "brand_voice_examples": "We're passionate about great coffee. Every bean tells a story. #CoffeeLove"
}
```

### Generating AI Caption
```typescript
POST /api/ai
{
  "action": "generateCaption",
  "clientId": "abc123",
  "platform": "instagram",
  "context": "New seasonal blend launching"
}

Response:
{
  "caption": "☕️ Introducing our Fall Harvest Blend! Rich notes of caramel and hazelnut with a smooth finish. Sustainably sourced from Colombian highlands. Available now – link in bio! #AcmeCoffee #FallBlend #CraftCoffee"
}
```

### Scheduling Post via LATE
```typescript
POST /api/late/schedule-post
{
  "postId": "post123",
  "caption": "Check out our new blend!",
  "lateMediaUrl": "https://blob.vercel-storage.com/image.jpg",
  "scheduledDateTime": "2025-11-25T09:00:00Z",
  "selectedAccounts": [
    { "platform": "instagram", "accountId": "ig_account_123" },
    { "platform": "facebook", "accountId": "fb_page_456" }
  ],
  "clientId": "abc123"
}
```

---

**Document Version:** 1.0  
**Last Updated:** November 20, 2025  
**Status:** Production Ready

