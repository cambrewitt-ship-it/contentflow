import type { Metadata } from 'next'
import Script from 'next/script'
import PageContent from './PageContent'

export const metadata: Metadata = {
  title: 'Content-Manager.io vs Hootsuite: The Agency Comparison for 2026',
  description: 'Agencies are switching from Hootsuite to Content-Manager.io for flat-rate unlimited client pricing and brand-trained AI. See the full comparison and find out which is right for your agency.',
  keywords: 'content manager vs hootsuite, hootsuite alternative, social media management for agencies, brand voice AI, agency social media tool',
  alternates: {
    canonical: 'https://content-manager.io/blog/hootsuite-vs-content-manager',
  },
  openGraph: {
    title: 'Content-Manager.io vs Hootsuite: The Agency Comparison for 2026',
    description: 'Agencies are switching from Hootsuite to Content-Manager.io for flat-rate unlimited client pricing and brand-trained AI.',
    url: 'https://content-manager.io/blog/hootsuite-vs-content-manager',
    siteName: 'Content Manager',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Content-Manager.io vs Hootsuite: The Agency Comparison for 2026',
    description: 'Agencies are switching from Hootsuite to Content-Manager.io for flat-rate unlimited client pricing and brand-trained AI.',
  },
}

const schemaMarkup = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'How does Content-Manager.io pricing compare to Hootsuite?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Content-Manager.io offers a flat-rate agency tier at $199/month with unlimited client profiles, providing significantly better value than Hootsuite\'s per-user enterprise model which scales in cost as your team and client list grows.',
      },
    },
    {
      '@type': 'Question',
      name: 'Why are agencies switching from Hootsuite to Content-Manager.io?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Agencies are migrating because Content-Manager.io solves the "Complexity Tax" of traditional enterprise tools — offering brand-trained AI that generates on-brand content without heavy editing, unlimited client profiles at a flat rate, and a shared client workspace for approvals.',
      },
    },
  ],
}

export default function Page() {
  return (
    <>
      <Script
        id="blog-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaMarkup) }}
      />
      <PageContent />
    </>
  )
}
