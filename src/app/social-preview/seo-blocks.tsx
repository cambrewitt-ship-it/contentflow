/**
 * Server-rendered SEO/GEO content blocks shared by /social-preview and its
 * platform-specific landing pages. Passed into <SocialPreviewTool> as children.
 */
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import type { Faq, Spec, Section } from './platforms'

/** Breadcrumb trail rendered above the h1 (pairs with BreadcrumbList JSON-LD). */
export function Breadcrumb({ current }: { current: string }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-3">
      <ol className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <li><Link href="/" className="hover:text-foreground transition-colors">Home</Link></li>
        <li aria-hidden="true">/</li>
        <li><Link href="/social-preview" className="hover:text-foreground transition-colors">Social Preview Tool</Link></li>
        <li aria-hidden="true">/</li>
        <li className="text-foreground font-medium" aria-current="page">{current}</li>
      </ol>
    </nav>
  )
}

/**
 * The short, direct answer block. Answer-first phrasing is what AI assistants
 * and featured snippets extract, so keep it to 40–60 words.
 */
export function AnswerBox({ question, answer }: { question: string; answer: string }) {
  return (
    <section className="rounded-xl border border-primary/20 bg-primary/5 p-6">
      <h2 className="text-lg font-semibold text-foreground mb-2">{question}</h2>
      <p className="text-base text-muted-foreground leading-relaxed">{answer}</p>
    </section>
  )
}

/** Scannable spec table — the most citation-friendly format for AI answers. */
export function SpecTable({ heading, specs }: { heading: string; specs: Spec[] }) {
  return (
    <section>
      <h2 className="text-2xl font-bold tracking-tight text-foreground mb-4">{heading}</h2>
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <tbody>
            {specs.map((s, i) => (
              <tr key={s.label} className={i % 2 ? 'bg-muted/30' : ''}>
                <th scope="row" className="text-left font-medium text-foreground px-4 py-3 w-1/2 align-top">{s.label}</th>
                <td className="px-4 py-3 text-muted-foreground align-top">{s.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export function ContentSection({ section }: { section: Section }) {
  return (
    <section>
      <h2 className="text-2xl font-bold tracking-tight text-foreground mb-4">{section.h2}</h2>
      {section.body && (
        <p className="text-base text-muted-foreground leading-relaxed">{section.body}</p>
      )}
      {section.bullets && (
        <ul className="space-y-2 text-base text-muted-foreground mt-4">
          {section.bullets.map((b) => (
            <li key={b.t}><strong className="text-foreground">{b.t}</strong> — {b.d}</li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** Visible FAQ copy. Mirrors the FAQPage JSON-LD on the same page. */
export function FaqSection({ faqs }: { faqs: Faq[] }) {
  return (
    <section>
      <h2 className="text-2xl font-bold tracking-tight text-foreground mb-4">Frequently asked questions</h2>
      <div className="space-y-6">
        {faqs.map((f) => (
          <div key={f.q}>
            <h3 className="text-base font-semibold text-foreground mb-1.5">{f.q}</h3>
            <p className="text-base text-muted-foreground leading-relaxed">{f.a}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

/** Internal links across the preview cluster — spreads the hub's authority. */
export function RelatedTools({
  links,
  heading = 'Preview your post on other platforms',
}: {
  links: { href: string; label: string }[]
  heading?: string
}) {
  return (
    <section>
      <h2 className="text-2xl font-bold tracking-tight text-foreground mb-4">{heading}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="block rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium text-foreground hover:border-primary/50 hover:bg-muted/50 transition-colors"
          >
            {l.label}
          </Link>
        ))}
      </div>
    </section>
  )
}

export function ProductCta() {
  return (
    <section>
      <h2 className="text-2xl font-bold tracking-tight text-foreground mb-4">Want to generate and schedule content too?</h2>
      <p className="text-base text-muted-foreground leading-relaxed mb-6">
        This preview tool is a free standalone feature of <strong className="text-foreground">Content Manager</strong> — an AI-powered platform built for marketing agencies. With a full account you can generate brand-trained captions using AI, schedule posts across every platform, manage multiple clients from a shared workspace, and get content approved through a built-in client portal. No more copy-pasting between tools.
      </p>
      <Link href="/auth/signup">
        <Button size="lg">Start Your Free 14-Day Trial</Button>
      </Link>
    </section>
  )
}

/** Shared page shell for the copy below the tool. */
export function SeoContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-t border-border/40 bg-muted/20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 max-w-4xl">
        <div className="space-y-12">{children}</div>
      </div>
    </div>
  )
}
