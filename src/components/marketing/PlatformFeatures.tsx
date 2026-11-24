/**
 * Marketing: "everything Content Manager does", shared by the home page, /features and every
 * /social-preview page (cold traffic). Plain markup (no hooks), so it renders on the server for
 * crawlers. Visuals are hand-built mockups of the real app screens (no screenshots exist yet for
 * the newer features); swap a pillar's `visual` for a real screenshot when one is available.
 *
 * Keep the claims true to what the app does — see CLAUDE.md for each feature.
 */
import type { ReactNode } from 'react'
import {
  BarChart3,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  EyeOff,
  FileText,
  Heart,
  LayoutGrid,
  MessageCircle,
  Palette,
  Send,
  ShieldCheck,
  Sparkles,
  Type,
  Users,
  Wand2,
} from 'lucide-react'
import {
  FacebookIcon,
  InstagramIcon,
  LinkedInIcon,
  ThreadsIcon,
  TikTokIcon,
  TwitterIcon,
  YouTubeIcon,
} from '@/components/social-icons'

// ── "Replaces" strip ─────────────────────────────────────────────────────────

const REPLACES = [
  { instead: 'Canva', with: 'Design Studio', note: 'Branded graphics with your logos, colours and fonts', Icon: Palette },
  { instead: 'ChatGPT', with: 'Brand-trained AI', note: 'Captions, ideas and a whole week planned in your voice', Icon: Sparkles },
  { instead: 'Meta Business Suite', with: 'Scheduling + inbox', note: 'Publish everywhere and answer every comment', Icon: Send },
  { instead: 'Email chains & spreadsheets', with: 'Client portal', note: 'Approvals, feedback and alerts in one place', Icon: CheckCircle2 },
  { instead: 'Reporting tools', with: 'Analytics & reports', note: 'Results, audience insights and monthly client reports', Icon: BarChart3 },
]

export function AllInOneStrip() {
  return (
    <section aria-labelledby="all-in-one-heading" className="mx-auto max-w-6xl">
      <div className="text-center max-w-3xl mx-auto">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">The all-in-one social media platform</p>
        <h2 id="all-in-one-heading" className="mt-3 text-3xl sm:text-5xl font-bold tracking-tight text-foreground">
          One tool instead of five
        </h2>
        <p className="mt-4 text-lg sm:text-xl text-muted-foreground leading-relaxed">
          Create, design, approve, publish, reply and report — for every client, from one login. Stop paying for (and
          switching between) a stack of apps.
        </p>
      </div>
      <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {REPLACES.map(({ instead, with: replacement, note, Icon }) => (
          <li key={replacement} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground">
              Instead of <span className="line-through decoration-gray-400">{instead}</span>
            </p>
            <div className="mt-3 flex items-center gap-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Icon className="h-5 w-5" />
              </span>
              <p className="font-semibold text-foreground leading-tight">{replacement}</p>
            </div>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{note}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}

// ── Mockup building blocks ───────────────────────────────────────────────────

function Frame({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className="relative">
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-sky-400/20 rounded-3xl blur-3xl" aria-hidden="true" />
      <div className={`relative rounded-2xl border border-border bg-white p-4 sm:p-5 shadow-xl ${className}`}>{children}</div>
    </div>
  )
}

function Chip({ children, tone = 'blue' }: { children: ReactNode; tone?: 'blue' | 'green' | 'amber' | 'red' | 'gray' | 'sky' }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-700',
    sky: 'bg-sky-50 text-sky-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    gray: 'bg-gray-100 text-gray-600',
  }
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${tones[tone]}`}>{children}</span>
}

function Avatar({ label, className = 'bg-blue-600' }: { label: string; className?: string }) {
  return (
    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${className}`}>{label}</span>
  )
}

// ── Pillar visuals ───────────────────────────────────────────────────────────

function CreateVisual() {
  return (
    <Frame>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900">Content Agent</p>
        <Chip tone="blue"><Sparkles className="h-3 w-3" /> Planned in your brand voice</Chip>
      </div>
      <p className="mt-1 text-xs text-gray-500">Next week · 5 posts from your photo library</p>
      <ul className="mt-3 space-y-2">
        {[
          { day: 'Mon', time: '9:00am', text: 'Fresh beans just landed ☕ Our new Ethiopian single origin is bright, floral and…', tag: 'Product', img: 'from-amber-200 to-orange-300' },
          { day: 'Wed', time: '12:30pm', text: 'Meet Jess, the hands behind every flat white this week 👋', tag: 'Behind the scenes', img: 'from-sky-200 to-blue-300' },
          { day: 'Fri', time: '7:00am', text: 'Long weekend hours: we’re open Saturday 8–2. Grab a pastry before…', tag: 'Holiday', img: 'from-emerald-200 to-teal-300' },
        ].map((p) => (
          <li key={p.day} className="flex gap-3 rounded-xl border border-gray-100 p-2.5">
            <span className={`h-12 w-12 shrink-0 rounded-lg bg-gradient-to-br ${p.img}`} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[11px] text-gray-500">
                <span className="font-semibold text-gray-800">{p.day}</span>
                <Clock className="h-3 w-3" /> {p.time} <span className="text-blue-600">· best time</span>
              </div>
              <p className="mt-0.5 truncate text-xs text-gray-700">{p.text}</p>
              <div className="mt-1"><Chip tone="gray">{p.tag}</Chip></div>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-3 rounded-xl bg-blue-50/70 px-3 py-2 text-xs text-blue-800">
        <span className="font-semibold">#coffee #flatwhite #harbourcoffee</span> · @harbourroasters tagged from your caption library
      </div>
    </Frame>
  )
}

function DesignVisual() {
  return (
    <Frame>
      <div className="flex items-center gap-1.5 border-b border-gray-100 pb-3">
        {[Type, Palette, LayoutGrid, Wand2].map((Icon, i) => (
          <span key={i} className={`flex h-8 w-8 items-center justify-center rounded-lg ${i === 1 ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-600'}`}>
            <Icon className="h-4 w-4" />
          </span>
        ))}
        <span className="ml-auto text-xs font-semibold text-gray-900">Design Studio</span>
      </div>
      <div className="mt-4 grid grid-cols-5 gap-4">
        <div className="col-span-3">
          <div className="relative aspect-square overflow-hidden rounded-xl bg-gradient-to-br from-blue-900 via-blue-700 to-sky-500 p-4 text-white shadow-inner">
            <span className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10" aria-hidden="true" />
            <span className="absolute bottom-3 right-3 rounded-md bg-white px-2 py-1 text-[10px] font-black text-blue-900">LOGO</span>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-sky-200">New in store</p>
            <p className="mt-1 text-xl font-black leading-tight sm:text-2xl">Ethiopian<br />Single Origin</p>
            <p className="mt-2 inline-block rounded-full bg-orange-400 px-2 py-0.5 text-[10px] font-bold text-blue-950">Try it this week</p>
          </div>
        </div>
        <div className="col-span-2 space-y-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Brand Kit</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {['bg-blue-900', 'bg-blue-600', 'bg-sky-400', 'bg-orange-400', 'bg-gray-100'].map((c) => (
                <span key={c} className={`h-6 w-6 rounded-full border border-white shadow ${c}`} aria-hidden="true" />
              ))}
            </div>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Fonts</p>
            <p className="mt-1 text-sm font-black text-gray-900">Heading Aa</p>
            <p className="text-xs text-gray-600">Body text Aa</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Logos</p>
            <div className="mt-1.5 flex gap-1.5">
              <span className="h-8 w-8 rounded-lg bg-blue-900" aria-hidden="true" />
              <span className="h-8 w-8 rounded-lg border border-gray-200 bg-white" aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>
    </Frame>
  )
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function PublishVisual() {
  const posts: Record<number, { c: string; p: string }[]> = {
    0: [{ c: 'bg-emerald-100 text-emerald-800', p: 'Approved' }],
    2: [{ c: 'bg-amber-100 text-amber-800', p: 'Improve' }, { c: 'bg-blue-100 text-blue-800', p: 'Scheduled' }],
    3: [{ c: 'bg-sky-100 text-sky-800', p: 'Holiday' }],
    4: [{ c: 'bg-blue-100 text-blue-800', p: 'Scheduled' }],
    5: [{ c: 'bg-emerald-100 text-emerald-800', p: 'Approved' }],
  }
  const platforms = [
    { Icon: FacebookIcon, bg: 'bg-blue-600' },
    { Icon: InstagramIcon, bg: 'bg-gradient-to-br from-purple-500 to-pink-500' },
    { Icon: LinkedInIcon, bg: 'bg-blue-700' },
    { Icon: TwitterIcon, bg: 'bg-black' },
    { Icon: TikTokIcon, bg: 'bg-black' },
    { Icon: YouTubeIcon, bg: 'bg-red-600' },
    { Icon: ThreadsIcon, bg: 'bg-black' },
  ]
  return (
    <Frame>
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900"><CalendarDays className="h-4 w-4 text-blue-600" /> Content calendar</p>
        <Chip tone="green"><Check className="h-3 w-3" /> Calendar filled for next week</Chip>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1.5">
        {DAYS.map((d, i) => (
          <div key={d} className="min-h-[92px] min-w-0 rounded-lg border border-gray-100 bg-gray-50/60 p-1 sm:p-1.5">
            <p className="text-[10px] font-semibold text-gray-500">{d}</p>
            <div className="mt-1 space-y-1">
              {(posts[i] ?? []).map((p, j) => (
                <div key={j} className="rounded-md bg-white p-1 shadow-sm">
                  <span className="block h-6 rounded bg-gradient-to-br from-sky-100 to-blue-200" aria-hidden="true" />
                  <span className={`mt-1 block truncate rounded px-1 text-[8px] font-semibold ${p.c}`}>{p.p}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-gray-500">Publishes to</span>
        {platforms.map(({ Icon, bg }, i) => (
          <span key={i} className={`flex h-7 w-7 items-center justify-center rounded-full ${bg}`}>
            <Icon size={14} className="text-white" />
          </span>
        ))}
      </div>
    </Frame>
  )
}

function ApproveVisual() {
  return (
    <div className="relative">
      <Frame>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-900">Client portal</p>
          <Chip tone="sky">Step 2 of 2 · Marketing manager</Chip>
        </div>
        <div className="mt-3 flex gap-3">
          <span className="h-24 w-24 shrink-0 rounded-xl bg-gradient-to-br from-amber-200 to-orange-300" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-gray-700 leading-relaxed">Fresh beans just landed ☕ Our new Ethiopian single origin is bright, floral and perfect for a slow Sunday pour-over.</p>
            <p className="mt-1 text-[11px] text-gray-500">Instagram · Harbour Coffee (@harbourcoffee) · Fri 9:00am</p>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <span className="flex-1 rounded-lg bg-emerald-600 py-2 text-center text-xs font-semibold text-white">Approve</span>
          <span className="flex-1 rounded-lg border border-amber-300 bg-amber-50 py-2 text-center text-xs font-semibold text-amber-800">Improve</span>
          <span className="rounded-lg border border-gray-200 px-3 py-2 text-center text-xs font-semibold text-gray-600">Reject</span>
        </div>
        <div className="mt-3 flex gap-2 rounded-xl bg-gray-50 p-2.5">
          <Avatar label="SJ" className="bg-sky-600" />
          <div className="text-xs text-gray-700">
            <span className="font-semibold text-gray-900">Sarah</span> <span className="font-medium text-blue-600">@Cam</span> love this — can we use the photo with the new cups?
          </div>
        </div>
      </Frame>
      <div className="relative mx-auto -mt-4 w-[88%] rounded-xl border border-border bg-white p-3 shadow-2xl sm:absolute sm:-bottom-8 sm:-right-4 sm:mt-0 sm:w-64">
        <div className="flex items-start gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white"><Bell className="h-3.5 w-3.5" /></span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-900">Email: Sarah approved a post</p>
            <p className="text-[11px] text-gray-500">Harbour Coffee · just now</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function EngageVisual() {
  const comments = [
    { who: 'Mia R.', text: 'Do you have oat milk? 🙏', tone: 'blue' as const, tag: 'Question', reply: 'We do! Oat, almond and soy — no extra charge 🌱' },
    { who: 'Tom K.', text: 'Best flat white in town, every time ❤️', tone: 'green' as const, tag: 'Positive', liked: true },
    { who: 'crypto_win88', text: 'DM me to 10x your money 🚀', tone: 'red' as const, tag: 'Spam', hidden: true },
  ]
  return (
    <Frame>
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900"><MessageCircle className="h-4 w-4 text-blue-600" /> Comments inbox</p>
        <div className="flex gap-1">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600"><FacebookIcon size={12} className="text-white" /></span>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500"><InstagramIcon size={12} className="text-white" /></span>
        </div>
      </div>
      <ul className="mt-3 space-y-2">
        {comments.map((c) => (
          <li key={c.who} className={`rounded-xl border border-gray-100 p-2.5 ${c.hidden ? 'opacity-60' : ''}`}>
            <div className="flex items-center gap-2">
              <Avatar label={c.who.slice(0, 1).toUpperCase()} className={c.hidden ? 'bg-gray-400' : 'bg-sky-600'} />
              <p className="min-w-0 flex-1 truncate text-xs text-gray-700"><span className="font-semibold text-gray-900">{c.who}</span> {c.text}</p>
              <Chip tone={c.tone}>{c.tag}</Chip>
            </div>
            {c.reply && (
              <div className="mt-2 rounded-lg bg-blue-50/70 p-2 text-xs text-blue-900">
                <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-blue-600"><Sparkles className="h-3 w-3" /> AI reply in your voice</p>
                <p className="mt-0.5">{c.reply}</p>
              </div>
            )}
            {c.liked && <p className="mt-1.5 flex items-center gap-1 text-[11px] text-emerald-700"><Heart className="h-3 w-3 fill-current" /> Liked automatically</p>}
            {c.hidden && <p className="mt-1.5 flex items-center gap-1 text-[11px] text-gray-600"><EyeOff className="h-3 w-3" /> Hidden by Feed Checker</p>}
          </li>
        ))}
      </ul>
      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-gray-500"><Send className="h-3 w-3" /> Comment “MENU” → menu sent by DM automatically</p>
    </Frame>
  )
}

// Engagement by weekday × time of day for the heatmap (illustrative)
const HEAT = [
  [1, 2, 4, 2, 1, 3],
  [1, 3, 4, 2, 2, 3],
  [2, 3, 5, 3, 2, 4],
  [1, 2, 4, 3, 2, 3],
  [2, 4, 5, 3, 3, 5],
  [3, 4, 3, 2, 4, 5],
  [2, 3, 2, 2, 3, 4],
]
const HEAT_COLORS = ['bg-blue-50', 'bg-blue-100', 'bg-blue-200', 'bg-blue-400', 'bg-blue-600']

function MeasureVisual() {
  return (
    <Frame>
      <div className="grid grid-cols-3 gap-2">
        {[
          { k: 'Reach', v: '48.2k', d: '+18%' },
          { k: 'Engagement', v: '3,914', d: '+24%' },
          { k: 'Followers', v: '+312', d: '+9%' },
        ].map((s) => (
          <div key={s.k} className="rounded-xl border border-gray-100 p-2.5">
            <p className="text-[11px] text-gray-500">{s.k}</p>
            <p className="text-lg font-bold text-gray-900">{s.v}</p>
            <svg viewBox="0 0 60 16" className="mt-1 h-4 w-full text-blue-500" aria-hidden="true">
              <polyline fill="none" stroke="currentColor" strokeWidth="2" points="0,13 10,11 20,12 30,8 40,9 50,4 60,2" />
            </svg>
            <p className="text-[10px] font-semibold text-emerald-600">{s.d} vs last month</p>
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-5 gap-3">
        <div className="col-span-3 rounded-xl border border-gray-100 p-2.5">
          <p className="text-[11px] font-semibold text-gray-700">Best times to post</p>
          <div className="mt-2 space-y-1">
            {HEAT.map((row, r) => (
              <div key={r} className="flex items-center gap-1">
                <span className="w-6 text-[9px] text-gray-400">{DAYS[r]}</span>
                {row.map((v, c) => (
                  <span key={c} className={`h-3 flex-1 rounded-sm ${HEAT_COLORS[v - 1]}`} aria-hidden="true" />
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="col-span-2 rounded-xl bg-gradient-to-br from-blue-700 to-sky-500 p-2.5 text-white">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-100">Your most engaged fan</p>
          <p className="mt-1 text-base font-bold">Meet Sarah, 34</p>
          <p className="mt-1 text-[11px] leading-snug text-sky-50">Local, loves weekend brunch, engages most with reels on Fri mornings.</p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-xl bg-orange-50 px-3 py-2 text-xs text-orange-900">
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-orange-500" />
        Reels get 2.1× the engagement of photos — your next captions are written with this in mind.
      </div>
    </Frame>
  )
}

function AgencyVisual() {
  const clients = [
    { n: 'Harbour Coffee', s: 'On track', t: 'green' as const, i: 'HC', bg: 'bg-blue-700' },
    { n: 'Peak Physio', s: '3 posts awaiting approval', t: 'amber' as const, i: 'PP', bg: 'bg-sky-600' },
    { n: 'Kiwi Kitchens', s: 'Nothing scheduled next 7 days', t: 'red' as const, i: 'KK', bg: 'bg-blue-500' },
    { n: 'Nova Studio', s: '4 new comments', t: 'blue' as const, i: 'NS', bg: 'bg-cyan-600' },
  ]
  return (
    <div className="relative">
      <Frame>
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900"><Users className="h-4 w-4 text-blue-600" /> All clients</p>
          <Chip tone="amber">Needs attention</Chip>
        </div>
        <ul className="mt-3 divide-y divide-gray-100 rounded-xl border border-gray-100">
          {clients.map((c) => (
            <li key={c.n} className="flex items-center gap-3 px-3 py-2.5">
              <Avatar label={c.i} className={c.bg} />
              <p className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">{c.n}</p>
              <Chip tone={c.t}>{c.s}</Chip>
            </li>
          ))}
        </ul>
      </Frame>
      <div className="relative mx-auto -mt-4 w-[88%] rounded-xl border border-border bg-white p-3 shadow-2xl sm:-mt-6 sm:ml-auto sm:mr-6 sm:w-80">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-900"><FileText className="h-3.5 w-3.5 text-blue-600" /> October report · Harbour Coffee</p>
        <p className="mt-1 text-[11px] leading-snug text-gray-600">Reach grew 18% on last month, led by Friday reels. Your top post was the new-season beans launch…</p>
        <p className="mt-1.5 text-[11px] font-semibold text-blue-600">Share link · Download PDF</p>
      </div>
    </div>
  )
}

// ── Pillars ──────────────────────────────────────────────────────────────────

type Pillar = {
  id: string
  eyebrow: string
  title: string
  body: string
  points: string[]
  visual: ReactNode
  Icon: typeof Sparkles
}

const PILLARS: Pillar[] = [
  {
    id: 'create',
    eyebrow: 'Create with AI',
    title: 'Like ChatGPT, but it already knows your brand',
    body: 'Add each client’s tone of voice, audience and key messages once. Every caption, idea and plan is written to sound like them — and gets sharper as it learns what performs.',
    points: [
      'AI captions from a photo and a few notes, ready for every platform',
      'Content Agent plans a full week of posts from your photo library',
      'Content ideas matched to the season, holidays and local events',
      'Saved @accounts and #hashtag sets, plus AI hashtag suggestions',
      'Ad copy variants for your paid campaigns',
    ],
    visual: <CreateVisual />,
    Icon: Sparkles,
  },
  {
    id: 'design',
    eyebrow: 'Design Studio',
    title: 'Like Canva, built into your workflow',
    body: 'Turn any photo into an on-brand graphic without leaving the post you’re writing. Each client’s Brand Kit keeps logos, colours and fonts one click away.',
    points: [
      'Drag-and-drop editor with text, shapes and your photos',
      'Brand Kits per client: logos, colour palettes, heading and body fonts',
      'Upload your own brand fonts',
      'Design straight from the calendar, a new post or the AI caption writer',
    ],
    visual: <DesignVisual />,
    Icon: Palette,
  },
  {
    id: 'publish',
    eyebrow: 'Plan & publish',
    title: 'Like Meta Business Suite, for every platform and every client',
    body: 'Plan in a drag-and-drop calendar and publish to seven networks in one click — at the times your audience is actually online.',
    points: [
      'Schedule to Facebook, Instagram, LinkedIn, X, TikTok, YouTube and Threads',
      'Best-time suggestions from each account’s real results',
      'Keep the calendar filled: the AI tops up any week that’s short of posts',
      'Photos, videos and carousels, with first comments',
      'Preview exactly how a post looks on each platform, plus your Instagram grid',
      'Holidays and events on the calendar; export the plan to PDF',
    ],
    visual: <PublishVisual />,
    Icon: CalendarDays,
  },
  {
    id: 'approve',
    eyebrow: 'Client approvals',
    title: 'Approvals without the email chains',
    body: 'Give each client a live portal to review, comment and approve — on desktop or swiping through on their phone. You hear about it the moment they do.',
    points: [
      'Approve, Improve or Reject with feedback on each post',
      'Comment threads with @mentions and replies',
      'Multi-step approval (e.g. marketing manager, then owner)',
      'Shareable approval links — no login needed',
      'Instant email alerts when a post is approved, commented on or moved',
      'Clients can upload their own photos and notes',
    ],
    visual: <ApproveVisual />,
    Icon: CheckCircle2,
  },
  {
    id: 'engage',
    eyebrow: 'Comments & community',
    title: 'Every comment answered, every spam comment gone',
    body: 'All your Facebook and Instagram comments in one inbox, sorted by AI, with replies drafted in your brand voice. The Feed Checker watches your pages around the clock.',
    points: [
      'One inbox for comments across every client’s pages',
      'AI sorts questions, complaints and praise, and drafts replies',
      'Reply publicly or by private message',
      'Keyword auto-DMs (e.g. comment “MENU” to get the menu)',
      'Comments on ads and boosted posts included',
      'Feed Checker hides spam, likes positive comments and catches typos before you post',
    ],
    visual: <EngageVisual />,
    Icon: MessageCircle,
  },
  {
    id: 'measure',
    eyebrow: 'Analytics & reporting',
    title: 'Know what works — and let the AI use it',
    body: 'See results across every platform, learn who your audience really is, and send clients a polished report every month without building one.',
    points: [
      'Reach, engagement and follower growth, with your top posts',
      'Best-time heatmaps and what formats, lengths and hashtags work',
      'Audience demographics and an AI persona of your most engaged fan',
      'Weekly AI recommendations, one click to act on',
      'Monthly client reports in plain English — share a link or save as PDF',
      'Your results feed back into every caption the AI writes',
    ],
    visual: <MeasureVisual />,
    Icon: BarChart3,
  },
  {
    id: 'agency',
    eyebrow: 'Built for agencies',
    title: 'Run more clients without hiring more staff',
    body: 'One overview shows which clients need you today — posts awaiting approval, gaps in the calendar, new comments, a dip in engagement — so nothing slips.',
    points: [
      'A dashboard per client: upcoming posts, approvals, activity and brand details',
      'Agency overview with “needs attention” across every client',
      'Connect several accounts per platform, clearly named',
      'Each client’s brand voice, Brand Kit and caption library kept separate',
    ],
    visual: <AgencyVisual />,
    Icon: ShieldCheck,
  },
]

/** All feature names, for structured data (schema.org featureList). */
export const PLATFORM_FEATURE_LIST: string[] = [
  'Brand voice AI captions',
  'AI Content Agent that plans a week of posts',
  'AI content ideas',
  'Design Studio graphic editor with Brand Kits',
  'Content calendar',
  'Scheduling to Facebook, Instagram, LinkedIn, X, TikTok, YouTube and Threads',
  'Best time to post suggestions',
  'Client approval portal with email alerts',
  'Comments inbox with AI replies and auto-DMs',
  'Feed Checker comment moderation',
  'Social media analytics and audience insights',
  'Monthly client reports',
  'Agency multi-client dashboard',
]

export function PlatformFeatures({
  showStrip = true,
  showCta = true,
  className = '',
  ctaHref = '/auth/signup',
}: {
  showStrip?: boolean
  /** Off where the page has its own call to action straight after */
  showCta?: boolean
  className?: string
  ctaHref?: string
}) {
  return (
    <div className={className}>
      {showStrip && <AllInOneStrip />}

      {/* Jump links */}
      <nav aria-label="Features" className="mx-auto mt-12 flex max-w-4xl flex-wrap justify-center gap-2">
        {PILLARS.map(({ id, eyebrow, Icon }) => (
          <a
            key={id}
            href={`#feature-${id}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50"
          >
            <Icon className="h-4 w-4 text-blue-600" />
            {eyebrow}
          </a>
        ))}
      </nav>

      <div className="mx-auto mt-14 max-w-6xl space-y-20 sm:space-y-28">
        {PILLARS.map((p, i) => (
          <article key={p.id} id={`feature-${p.id}`} className="grid scroll-mt-24 grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-14">
            <div className={`min-w-0 ${i % 2 ? 'lg:order-2' : ''}`}>
              <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-blue-600">
                <p.Icon className="h-4 w-4" /> {p.eyebrow}
              </p>
              <h3 className="mt-3 text-2xl sm:text-4xl font-bold tracking-tight text-foreground">{p.title}</h3>
              <p className="mt-4 text-base sm:text-lg text-muted-foreground leading-relaxed">{p.body}</p>
              <ul className="mt-5 space-y-2.5">
                {p.points.map((pt) => (
                  <li key={pt} className="flex items-start gap-2.5 text-[15px] text-foreground">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
                      <Check className="h-3 w-3" />
                    </span>
                    {pt}
                  </li>
                ))}
              </ul>
            </div>
            <div className={`min-w-0 sm:pb-10 ${i % 2 ? 'lg:order-1' : ''}`}>{p.visual}</div>
          </article>
        ))}
      </div>

      {showCta && (
      <div className="mx-auto mt-20 max-w-4xl rounded-2xl bg-gradient-to-br from-blue-700 to-sky-500 px-6 py-10 text-center text-white shadow-xl sm:px-12">
        <h3 className="text-2xl sm:text-3xl font-bold">Everything your social media needs. One login.</h3>
        <p className="mx-auto mt-3 max-w-2xl text-base sm:text-lg text-white/85">
          AI writing, design, scheduling, approvals, comments and reporting — for every client.
        </p>
        <a
          href={ctaHref}
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-white px-6 py-3 text-base font-semibold text-blue-700 shadow hover:bg-white/90"
        >
          Start your free trial
        </a>
      </div>
      )}
    </div>
  )
}
