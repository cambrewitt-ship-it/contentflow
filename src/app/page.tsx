import type { Metadata } from 'next'
import Script from 'next/script'
import HomeContent from './HomeContent'

export const metadata: Metadata = {
  title: 'AI Social Media Management for Marketing Agencies | Content Manager',
  description: 'Content Manager helps marketing agencies manage social media 3x faster. Generate on-brand AI content, schedule across every platform, and streamline client approvals — all in one place. Start free.',
  keywords: 'social media management software, AI social media tool, marketing agency software, content scheduling, social media scheduler, AI content generation, brand voice AI, social media management for agencies',
  alternates: {
    canonical: 'https://content-manager.io',
  },
  openGraph: {
    title: 'AI Social Media Management for Marketing Agencies | Content Manager',
    description: 'Manage social media 3x faster. Generate on-brand AI content, schedule across every platform, and streamline client approvals — all in one place.',
    url: 'https://content-manager.io',
    siteName: 'Content Manager',
    type: 'website',
    images: [
      {
        url: '/cm-logo.png',
        width: 1200,
        height: 630,
        alt: 'Content Manager — AI Social Media Management for Marketing Agencies',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Social Media Management for Marketing Agencies | Content Manager',
    description: 'Manage social media 3x faster with Brand Voice AI, content calendar, and social scheduling — built for agencies.',
    images: ['/cm-logo.png'],
  },
}

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Content Manager',
  url: 'https://content-manager.io',
  logo: 'https://content-manager.io/cm-logo.png',
  description: 'AI social media management platform for marketing agencies. Generate on-brand content, schedule posts, and manage client approvals.',
  sameAs: [
    'https://www.facebook.com/profile.php?id=61574924115662',
    'https://nz.linkedin.com/company/oneonethreedigital',
  ],
}

const softwareSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Content Manager',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  offers: [
    {
      '@type': 'Offer',
      name: 'In-House',
      price: '50',
      priceCurrency: 'USD',
      description: 'For marketing managers — 1 business profile, AI content generation, content calendar.',
    },
    {
      '@type': 'Offer',
      name: 'Freelancer',
      price: '89',
      priceCurrency: 'USD',
      description: 'For freelancers and agencies — 5 business profiles, 150 scheduled posts/month.',
    },
    {
      '@type': 'Offer',
      name: 'Agency',
      price: '199',
      priceCurrency: 'USD',
      description: 'For larger agencies — unlimited client profiles, unlimited scheduled posts, white-label branding.',
    },
  ],
  description: 'AI-powered social media management platform. Train the AI on your brand voice, generate on-brand content, schedule across Facebook, Instagram, TikTok, LinkedIn, Twitter, YouTube and Threads, and manage client approvals in one shared workspace.',
  url: 'https://content-manager.io',
  author: {
    '@type': 'Organization',
    name: 'OneOneThree Digital',
    url: 'https://www.oneonethree.co.nz',
  },
}

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What is Content Manager?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Content Manager is an AI-powered social media management platform built for marketing agencies. It lets you train AI on your brand voice, generate on-brand content, schedule posts across all major platforms, and manage client approvals from one shared workspace.',
      },
    },
    {
      '@type': 'Question',
      name: 'Which social media platforms does Content Manager support?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Content Manager supports scheduling and publishing to Facebook, Instagram, Twitter/X, LinkedIn, TikTok, YouTube, and Threads.',
      },
    },
    {
      '@type': 'Question',
      name: 'How much does Content Manager cost?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Content Manager offers three plans: In-House at $50/month (1 business profile), Freelancer at $89/month (5 profiles), and Agency at $199/month (unlimited client profiles). All plans include a 14-day free trial.',
      },
    },
    {
      '@type': 'Question',
      name: 'Is there a free trial?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes, all plans include a 14-day free trial with no credit card required.',
      },
    },
    {
      '@type': 'Question',
      name: 'What makes Content Manager different from Hootsuite or Buffer?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Content Manager is built specifically for agencies with Brand Voice AI training (so generated content sounds like your client, not a robot), a flat-rate Agency plan with unlimited client profiles, and a shared client workspace for content approvals — features not available in traditional scheduling tools.',
      },
    },
  ],
}

export default function Page() {
  return (
    <>
      <Script
        id="organization-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <Script
        id="software-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
      />
      <Script
        id="faq-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <HomeContent />
    </>
  )
}
