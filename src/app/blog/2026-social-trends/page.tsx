import type { Metadata } from 'next'
import Script from 'next/script'
import PageContent from './PageContent'

export const metadata: Metadata = {
  title: 'Social Media Trends Reshaping 2026: An AI Strategy Guide',
  description: 'The key social media trends for 2026 — interest-led discovery, social search, the authenticity premium, and AI content disclosure. Learn how to use AI to stay ahead while keeping a human brand voice.',
  keywords: '2026 social media trends, AI social media strategy, social search, authenticity premium, AI content marketing, social media marketing 2026',
  alternates: {
    canonical: 'https://content-manager.io/blog/2026-social-trends',
  },
  openGraph: {
    title: 'Social Media Trends Reshaping 2026: An AI Strategy Guide',
    description: 'The key social media trends for 2026 — interest-led discovery, social search, the authenticity premium, and AI content disclosure.',
    url: 'https://content-manager.io/blog/2026-social-trends',
    siteName: 'Content Manager',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Social Media Trends Reshaping 2026: An AI Strategy Guide',
    description: 'The key social media trends for 2026 — interest-led discovery, social search, the authenticity premium, and AI content disclosure.',
  },
}

const schemaMarkup = {
  '@context': 'https://schema.org',
  '@type': 'BlogPosting',
  headline: 'Social Media Trends Reshaping 2026: An AI-Powered Strategy Guide',
  description: 'Comprehensive guide to social media trends in 2026, focusing on interest-led discovery, social search and the authenticity premium.',
  author: { '@type': 'Organization', name: 'Content Manager', url: 'https://content-manager.io' },
  publisher: { '@type': 'Organization', name: 'Content Manager', url: 'https://content-manager.io' },
  datePublished: '2026-01-10',
  url: 'https://content-manager.io/blog/2026-social-trends',
  keywords: '2026 social media trends, AI social media strategy, social search, authenticity premium',
}

export default function Page() {
  return (
    <>
      <Script
        id="blog-schema-2026-social-trends"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaMarkup) }}
      />
      <PageContent />
    </>
  )
}
