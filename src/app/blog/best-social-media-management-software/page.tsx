import type { Metadata } from 'next'
import Script from 'next/script'
import PageContent from './PageContent'

export const metadata: Metadata = {
  title: 'Best Social Media Management Software for 2026: A Buyer\'s Guide',
  description: 'The best social media management software for 2026 compared — AI content generation, brand voice training, scheduling, and client workspaces. Find the right tool for your agency.',
  keywords: 'best social media management software, social media management tools 2026, AI social media tools, agency social media software, social media scheduler, brand voice AI',
  alternates: {
    canonical: 'https://content-manager.io/blog/best-social-media-management-software',
  },
  openGraph: {
    title: 'Best Social Media Management Software for 2026: A Buyer\'s Guide',
    description: 'The best social media management software for 2026 compared — AI content generation, brand voice training, scheduling, and client workspaces.',
    url: 'https://content-manager.io/blog/best-social-media-management-software',
    siteName: 'Content Manager',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Best Social Media Management Software for 2026: A Buyer\'s Guide',
    description: 'The best social media management software for 2026 compared — AI content generation, brand voice training, scheduling, and client workspaces.',
  },
}

const schemaMarkup = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'The Best Social Media Management Software for 2026: A Strategic Buyer\'s Guide',
  description: 'A comprehensive buyer\'s guide to the best social media management software in 2026 for marketing agencies.',
  author: { '@type': 'Organization', name: 'Content Manager', url: 'https://content-manager.io' },
  publisher: { '@type': 'Organization', name: 'Content Manager', url: 'https://content-manager.io' },
  datePublished: '2026-02-10',
  url: 'https://content-manager.io/blog/best-social-media-management-software',
  keywords: 'best social media management software, social media tools 2026, AI social media, agency tools',
}

export default function Page() {
  return (
    <>
      <Script
        id="blog-schema-best-smm"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaMarkup) }}
      />
      <PageContent />
    </>
  )
}
