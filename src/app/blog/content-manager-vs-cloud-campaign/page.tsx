import type { Metadata } from 'next'
import Script from 'next/script'
import PageContent from './PageContent'

export const metadata: Metadata = {
  title: 'Content-Manager.io vs Cloud Campaign: Best for Agencies in 2026?',
  description: 'Comparing Content-Manager.io vs Cloud Campaign for marketing agencies in 2026. Flat-rate unlimited clients vs per-profile pricing, brand voice AI vs basic scheduling — which wins?',
  keywords: 'content manager vs cloud campaign, cloud campaign alternative, social media agency software, brand voice AI, unlimited client profiles, agency social media tool',
  alternates: {
    canonical: 'https://content-manager.io/blog/content-manager-vs-cloud-campaign',
  },
  openGraph: {
    title: 'Content-Manager.io vs Cloud Campaign: Best for Agencies in 2026?',
    description: 'Comparing Content-Manager.io vs Cloud Campaign for marketing agencies — flat-rate unlimited clients vs per-profile pricing.',
    url: 'https://content-manager.io/blog/content-manager-vs-cloud-campaign',
    siteName: 'Content Manager',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Content-Manager.io vs Cloud Campaign: Best for Agencies in 2026?',
    description: 'Comparing Content-Manager.io vs Cloud Campaign for marketing agencies — flat-rate unlimited clients vs per-profile pricing.',
  },
}

const schemaMarkup = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Content-Manager.io vs Cloud Campaign: Which is Best for Scaling Agencies in 2026?',
  description: 'A detailed comparison of Content-Manager.io and Cloud Campaign for marketing agencies focused on scaling.',
  author: { '@type': 'Organization', name: 'Content Manager', url: 'https://content-manager.io' },
  publisher: { '@type': 'Organization', name: 'Content Manager', url: 'https://content-manager.io' },
  datePublished: '2026-02-01',
  url: 'https://content-manager.io/blog/content-manager-vs-cloud-campaign',
}

export default function Page() {
  return (
    <>
      <Script
        id="blog-schema-vs-cloud-campaign"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaMarkup) }}
      />
      <PageContent />
    </>
  )
}
