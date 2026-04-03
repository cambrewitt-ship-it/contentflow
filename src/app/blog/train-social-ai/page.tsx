import type { Metadata } from 'next'
import Script from 'next/script'
import PageContent from './PageContent'

export const metadata: Metadata = {
  title: 'How to Train Your Social Media AI for Brand Voice Consistency',
  description: 'Learn how to move beyond basic prompts and train your AI on brand voice, tone and style guides. The key to consistent, on-brand social media content at scale.',
  keywords: 'train AI brand voice, social media AI, brand voice consistency, AI content generation, brand-trained AI, social media management',
  alternates: {
    canonical: 'https://content-manager.io/blog/train-social-ai',
  },
  openGraph: {
    title: 'How to Train Your Social Media AI for Brand Voice Consistency',
    description: 'Learn how to move beyond basic prompts and train your AI on brand voice, tone and style guides for consistent on-brand social content.',
    url: 'https://content-manager.io/blog/train-social-ai',
    siteName: 'Content Manager',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'How to Train Your Social Media AI for Brand Voice Consistency',
    description: 'Learn how to move beyond basic prompts and train your AI on brand voice, tone and style guides for consistent on-brand social content.',
  },
}

const schemaMarkup = {
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: 'How to Train Your AI for Brand Voice Consistency',
  description: 'A step-by-step guide to training social media AI on your brand voice for consistent, on-brand content generation.',
  step: [
    { '@type': 'HowToStep', text: 'Upload brand guidelines and historical high-performing content.' },
    { '@type': 'HowToStep', text: 'Configure the AI model to prioritize specific tone and style anchors.' },
    { '@type': 'HowToStep', text: 'Run A/B tests to verify the AI matches the human brand voice.' },
  ],
  author: { '@type': 'Organization', name: 'Content Manager', url: 'https://content-manager.io' },
  datePublished: '2026-01-15',
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
