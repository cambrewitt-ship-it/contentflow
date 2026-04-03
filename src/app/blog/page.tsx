import type { Metadata } from 'next'
import BlogContent from './BlogContent'

export const metadata: Metadata = {
  title: 'Social Media Marketing Blog — AI Tools, Agency Tips & Trends | Content Manager',
  description: 'Guides, comparisons, and strategies for marketing agencies using AI social media tools. Learn how to scale client management, train brand voice AI, and grow organic reach.',
  keywords: 'social media marketing blog, AI social media tools, marketing agency tips, social media management guides, brand voice AI, content scheduling tips',
  alternates: {
    canonical: 'https://content-manager.io/blog',
  },
  openGraph: {
    title: 'Social Media Marketing Blog — AI Tools, Agency Tips & Trends | Content Manager',
    description: 'Guides, comparisons, and strategies for marketing agencies using AI social media tools.',
    url: 'https://content-manager.io/blog',
    siteName: 'Content Manager',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Social Media Marketing Blog — AI Tools, Agency Tips & Trends | Content Manager',
    description: 'Guides, comparisons, and strategies for marketing agencies using AI social media tools.',
  },
}

export default function BlogPage() {
  return <BlogContent />
}
