/**
 * Server-rendered product pitch for Content Manager, shown under the free
 * preview tool. Reuses the home and features page video, screenshots and
 * social proof. Everything here is plain HTML for crawlers; only the demo
 * video is a client component, and it loads lazily.
 */
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  FacebookIcon,
  InstagramIcon,
  LinkedInIcon,
  ThreadsIcon,
  TikTokIcon,
  TwitterIcon,
  YouTubeIcon,
} from '@/components/social-icons'
import { DemoVideo } from './DemoVideo'

export const DEMO_VIDEO = {
  name: 'Content Manager product demo',
  description:
    'A walkthrough of Content Manager: upload an image, add context, and generate on-brand social media captions with AI, then remix, schedule and share them for client approval.',
  contentUrl: '/Content-manager-demo.mp4',
  thumbnailUrl: '/content-manager-demo-poster.webp',
  uploadDate: '2026-05-18',
  duration: 'PT50S',
}

const STATS = [
  { value: '50+', label: 'users' },
  { value: '1,000+', label: 'posts created, approved & scheduled' },
  { value: '300+', label: 'hours saved' },
]

type Feature = {
  title: string
  body: string
  image?: { src: string; alt: string; width: number; height: number }
  platforms?: boolean
}

const FEATURES: Feature[] = [
  {
    title: 'AI that sounds like your brand, not a robot',
    body: 'Enter your brand’s information, tone of voice, key messages and style guide once. The AI is trained on it, so every caption and content idea reads like you wrote it.',
    image: { src: '/brand-info.png', alt: 'Content Manager brand information screen with tone of voice, target audience and caption rules', width: 2702, height: 758 },
  },
  {
    title: 'Branded AI copywriter for social media captions',
    body: 'Upload an image and add a few notes. Content Manager writes platform-ready captions tailored to that image and your brand voice, then lets you remix or edit them before you schedule.',
    image: { src: '/content-suite-sc.png', alt: 'Content Manager Content Suite generating a social media caption from an uploaded image', width: 2466, height: 1396 },
  },
  {
    title: 'Never stare at a blank content calendar again',
    body: 'Stuck on what to post? Generate post ideas instantly, matched to your business, the season and upcoming events. Writer’s block becomes a thing of the past.',
    image: { src: '/ideas-generator.png', alt: 'Content Manager content ideas generator suggesting social media post ideas', width: 2376, height: 606 },
  },
  {
    title: 'One-click scheduling to every platform',
    body: 'Publish to Facebook, Instagram, LinkedIn, Twitter/X, TikTok, YouTube and Threads from one calendar. Spend less time posting and more time creating.',
    platforms: true,
  },
  {
    title: 'A live, shared content workspace with your clients',
    body: 'The client portal gives you and each client a two-way workspace that updates in real time. Share the content calendar, collect feedback and approvals, and receive the client’s own photo uploads, without losing anything in an email chain.',
    image: { src: '/client-portal-screenshot.png', alt: 'Content Manager client portal showing a content calendar for client approval', width: 1328, height: 1248 },
  },
  {
    title: 'Handle more clients without hiring more staff',
    body: 'Every client gets a dedicated dashboard with upcoming posts, approval status, recent activity and their brand details, so you can manage more accounts with the same team.',
    image: { src: '/client-dashboard.png', alt: 'Content Manager client dashboard with upcoming posts, approvals and activity', width: 1998, height: 1192 },
  },
]

const PLATFORMS = [
  { name: 'Facebook', Icon: FacebookIcon, bg: 'bg-blue-600' },
  { name: 'Instagram', Icon: InstagramIcon, bg: 'bg-gradient-to-br from-purple-500 to-pink-500' },
  { name: 'LinkedIn', Icon: LinkedInIcon, bg: 'bg-blue-700' },
  { name: 'Twitter/X', Icon: TwitterIcon, bg: 'bg-black' },
  { name: 'TikTok', Icon: TikTokIcon, bg: 'bg-black' },
  { name: 'YouTube', Icon: YouTubeIcon, bg: 'bg-red-600' },
  { name: 'Threads', Icon: ThreadsIcon, bg: 'bg-black' },
]

function PlatformGrid() {
  return (
    <ul className="grid grid-cols-4 sm:grid-cols-7 gap-4 justify-items-center" aria-label="Supported social media platforms">
      {PLATFORMS.map(({ name, Icon, bg }) => (
        <li key={name} className="flex flex-col items-center gap-2">
          <span className={`w-12 h-12 rounded-full ${bg} flex items-center justify-center`}>
            <Icon size={24} className="text-white" />
          </span>
          <span className="text-xs font-medium text-foreground">{name}</span>
        </li>
      ))}
    </ul>
  )
}

export function ProductShowcase() {
  return (
    <section aria-labelledby="product-showcase-heading" className="border-t border-border/40 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 max-w-5xl">
        {/* Intro */}
        <div className="text-center max-w-3xl mx-auto">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">From the makers of this free tool</p>
          <h2 id="product-showcase-heading" className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            Create, approve and schedule social media posts with Content Manager
          </h2>
          <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
            This preview tool is part of Content Manager, an AI social media management platform for marketing agencies, freelancers and in-house teams. It combines a brand-trained AI copywriter, a content calendar, a client approval portal and one-click scheduling in one place.
          </p>
        </div>

        {/* Social proof */}
        <dl className="mt-10 grid grid-cols-3 gap-2 sm:gap-4">
          {STATS.map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-card shadow-sm px-2 py-4 sm:px-6 sm:py-5 flex flex-col items-center text-center">
              <dt className="order-2 text-xs sm:text-sm text-muted-foreground mt-0.5">{s.label}</dt>
              <dd className="order-1 text-2xl sm:text-3xl font-extrabold text-foreground">{s.value}</dd>
            </div>
          ))}
        </dl>

        {/* Demo video */}
        <figure className="mt-12">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-2xl blur-3xl" aria-hidden="true" />
            <div className="relative">
              <DemoVideo title={DEMO_VIDEO.name} />
            </div>
          </div>
          <figcaption className="mt-4 text-center text-base text-muted-foreground">
            <strong className="text-foreground">Like ChatGPT for social media:</strong> brand voice AI, a content calendar and a social media scheduler in one tool.
          </figcaption>
        </figure>

        {/* Feature slides */}
        <div className="mt-16 space-y-16 sm:space-y-20">
          {FEATURES.map((f, i) => (
            <article key={f.title} className={`grid gap-6 lg:gap-10 items-center ${f.image ? 'lg:grid-cols-5' : ''}`}>
              <div className={`${f.image ? 'lg:col-span-2' : 'text-center max-w-3xl mx-auto'} ${f.image && i % 2 ? 'lg:order-2' : ''}`}>
                <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{f.title}</h3>
                <p className="mt-3 text-base sm:text-lg text-muted-foreground leading-relaxed">{f.body}</p>
              </div>
              {f.image ? (
                <div className={`relative lg:col-span-3 ${i % 2 ? 'lg:order-1' : ''}`}>
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl blur-3xl" aria-hidden="true" />
                  <div className="relative bg-card border border-border rounded-2xl p-2 sm:p-3 shadow-xl">
                    <Image
                      src={f.image.src}
                      alt={f.image.alt}
                      width={f.image.width}
                      height={f.image.height}
                      sizes="(min-width: 1024px) 600px, 100vw"
                      loading="lazy"
                      className="w-full h-auto rounded-lg"
                    />
                  </div>
                </div>
              ) : (
                f.platforms && <PlatformGrid />
              )}
            </article>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-16 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 px-6 py-10 sm:px-12 text-center text-white shadow-xl">
          <h3 className="text-2xl sm:text-3xl font-bold">Spend less time on social media admin</h3>
          <p className="mt-3 text-base sm:text-lg text-white/85 max-w-2xl mx-auto">
            Generate on-brand content for every client, schedule across every platform and get approvals done, all in one place.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/auth/signup">
              <Button size="lg" className="bg-white text-blue-700 hover:bg-white/90 w-full sm:w-auto">Start 7-Day Free Trial</Button>
            </Link>
            <Link href="/features" className="text-sm font-semibold text-white underline-offset-4 hover:underline">
              See all features
            </Link>
            <Link href="/pricing" className="text-sm font-semibold text-white underline-offset-4 hover:underline">
              View pricing
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
