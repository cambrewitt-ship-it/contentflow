import type { Metadata } from 'next'
import Script from 'next/script'
import SocialPreviewTool from './SocialPreviewTool'

export const metadata: Metadata = {
  title: 'Free Social Media Post Preview Tool — Facebook, Instagram, TikTok & More | Content Manager',
  description: 'See exactly how your post will look on Facebook, Instagram, TikTok, Twitter/X, and Stories — as an organic post or paid ad. Free, no account needed.',
  openGraph: {
    title: 'Free Social Media Post Preview Tool | Content Manager',
    description: 'Preview how your posts will appear on Facebook, Instagram, TikTok, Twitter/X and more — organic or as a paid ad. Free, no account needed.',
    url: 'https://content-manager.io/social-preview',
    siteName: 'Content Manager',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free Social Media Post Preview Tool | Content Manager',
    description: 'See exactly how your post will look on every major platform before you publish. Free, no account needed.',
  },
  alternates: {
    canonical: 'https://content-manager.io/social-preview',
  },
}

const schemaMarkup = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Free Social Media Post Preview Tool',
  applicationCategory: 'UtilitiesApplication',
  operatingSystem: 'Web',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  description:
    'Preview how social media posts look on Facebook, Instagram, TikTok, Twitter/X, Facebook Stories, and Instagram Stories before publishing — as an organic post or paid ad.',
  url: 'https://content-manager.io/social-preview',
  author: {
    '@type': 'Organization',
    name: 'Content Manager',
    url: 'https://content-manager.io',
  },
}

export default function SocialPreviewPage() {
  return (
    <>
      <Script
        id="social-preview-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaMarkup) }}
      />
      <SocialPreviewTool />
    </>
  )
}
