import type { Metadata } from 'next'
import Script from 'next/script'
import PageContent from './PageContent'

export const metadata: Metadata = {
  title: 'The Agency Blueprint: Scaling Client Approvals and AI Workflows',
  description: 'How marketing agencies scale to 50+ clients without hiring: AI workflows, shared client approval portals, and brand-trained content automation. The complete agency blueprint.',
  keywords: 'marketing agency workflow, client approval portal, AI social media agency, agency scaling, social media management agency, content approval workflow',
  alternates: {
    canonical: 'https://content-manager.io/blog/agency-blueprint',
  },
  openGraph: {
    title: 'The Agency Blueprint: Scaling Client Approvals and AI Workflows',
    description: 'How marketing agencies scale to 50+ clients without hiring: AI workflows, shared client approval portals, and brand-trained content automation.',
    url: 'https://content-manager.io/blog/agency-blueprint',
    siteName: 'Content Manager',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Agency Blueprint: Scaling Client Approvals and AI Workflows',
    description: 'How marketing agencies scale to 50+ clients without hiring: AI workflows, shared client approval portals, and brand-trained content automation.',
  },
}

const schemaMarkup = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'The Agency Blueprint: Scaling Client Approvals and AI Workflows',
  description: 'How marketing agencies scale to 50+ clients without hiring using AI workflows and shared client portals.',
  author: { '@type': 'Organization', name: 'Content Manager', url: 'https://content-manager.io' },
  publisher: { '@type': 'Organization', name: 'Content Manager', url: 'https://content-manager.io' },
  datePublished: '2026-01-20',
  url: 'https://content-manager.io/blog/agency-blueprint',
}

export default function Page() {
  return (
    <>
      <Script
        id="blog-schema-agency-blueprint"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaMarkup) }}
      />
      <PageContent />
    </>
  )
}
