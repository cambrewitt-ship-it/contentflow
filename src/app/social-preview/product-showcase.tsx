/**
 * Server-rendered product pitch for Content Manager, shown under the free
 * preview tool. Reuses the home and features page video, screenshots and
 * social proof. Everything here is plain HTML for crawlers; only the demo
 * video is a client component, and it loads lazily.
 */
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PlatformFeatures } from '@/components/marketing/PlatformFeatures'
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

export function ProductShowcase() {
  return (
    <section aria-labelledby="product-showcase-heading" className="border-t border-border/40 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 max-w-5xl">
        {/* Intro */}
        <div className="text-center max-w-3xl mx-auto">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">From the makers of this free tool</p>
          <h2 id="product-showcase-heading" className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            Run all of your social media from one place with Content Manager
          </h2>
          <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
            This preview tool is part of Content Manager, the all-in-one social media platform for marketing agencies, freelancers and in-house teams. Write posts with AI that knows your brand, design them in Design Studio, get client approval, publish to every network, answer every comment and report on the results, all in one place.
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
            <div className="absolute inset-0 bg-gradient-to-r from-sky-400/20 to-blue-500/20 rounded-2xl blur-3xl" aria-hidden="true" />
            <div className="relative">
              <DemoVideo title={DEMO_VIDEO.name} />
            </div>
          </div>
          <figcaption className="mt-4 text-center text-base text-muted-foreground">
            <strong className="text-foreground">Canva + ChatGPT + Meta Business Suite, in one tool:</strong> AI writing, design, scheduling, approvals, comments and reporting.
          </figcaption>
        </figure>

        {/* Everything the platform does */}
        <div className="mt-20">
          <PlatformFeatures showCta={false} />
        </div>

        {/* CTA */}
        <div className="mt-16 rounded-2xl bg-gradient-to-br from-blue-700 to-sky-500 px-6 py-10 sm:px-12 text-center text-white shadow-xl">
          <h3 className="text-2xl sm:text-3xl font-bold">Everything your social media needs. One login.</h3>
          <p className="mt-3 text-base sm:text-lg text-white/85 max-w-2xl mx-auto">
            Write, design, approve, publish, reply and report for every client, all in one place.
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
