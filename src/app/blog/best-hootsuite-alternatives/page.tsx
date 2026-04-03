import type { Metadata } from 'next'
import Script from 'next/script'
import PageContent from './PageContent'

export const metadata: Metadata = {
  title: 'Best Hootsuite Alternatives for Agencies in 2026',
  description: 'The best Hootsuite alternatives for marketing agencies in 2026 — AI-native tools with flat-rate pricing, unlimited client profiles, and brand voice training. Stop paying the per-user tax.',
  keywords: 'hootsuite alternatives, hootsuite alternative for agencies, best hootsuite alternative 2026, social media management alternatives, AI social media tool, agency social media software',
  alternates: {
    canonical: 'https://content-manager.io/blog/best-hootsuite-alternatives',
  },
  openGraph: {
    title: 'Best Hootsuite Alternatives for Agencies in 2026',
    description: 'The best Hootsuite alternatives for marketing agencies — AI-native tools with flat-rate pricing and unlimited client profiles.',
    url: 'https://content-manager.io/blog/best-hootsuite-alternatives',
    siteName: 'Content Manager',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Best Hootsuite Alternatives for Agencies in 2026',
    description: 'The best Hootsuite alternatives for marketing agencies — AI-native tools with flat-rate pricing and unlimited client profiles.',
  },
}

const schemaMarkup = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What is the best Hootsuite alternative for agencies in 2026?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Content-Manager.io is the top Hootsuite alternative for agencies due to its flat-rate $199/month Agency plan with unlimited client profiles and brand-trained AI capabilities — avoiding the per-user pricing that makes Hootsuite expensive to scale.',
      },
    },
    {
      '@type': 'Question',
      name: 'Why are agencies switching away from Hootsuite?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Agencies are leaving Hootsuite because of variable per-user costs that increase with every new client or team member, and because legacy tools treat AI as an afterthought. Modern alternatives like Content-Manager.io are AI-native, generating brand-aligned content from the start.',
      },
    },
  ],
}

export default function Page() {
  return (
    <>
      <Script
        id="blog-schema-hootsuite-alternatives"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaMarkup) }}
      />
      <PageContent />
    </>
  )
}
