import type { Metadata } from 'next'
import SocialPreviewTool from './SocialPreviewTool'
import { PLATFORM_PAGES } from './platforms'
import {
  AnswerBox,
  ContentSection,
  FaqSection,
  ProductCta,
  RelatedTools,
  SeoContent,
} from './seo-blocks'

const BASE_URL = 'https://content-manager.io'
const PAGE_URL = `${BASE_URL}/social-preview`

export const metadata: Metadata = {
  title: 'Free Social Media Post Preview Tool — Facebook, Instagram, TikTok & More | Content Manager',
  description:
    'See exactly how your post will look on Facebook, Instagram, TikTok, LinkedIn, Twitter/X and Stories — as an organic post or paid ad. Free, no account needed.',
  openGraph: {
    title: 'Free Social Media Post Preview Tool | Content Manager',
    description:
      'Preview how your posts will appear on Facebook, Instagram, TikTok, LinkedIn, Twitter/X and more — organic or as a paid ad. Free, no account needed.',
    url: PAGE_URL,
    siteName: 'Content Manager',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free Social Media Post Preview Tool | Content Manager',
    description: 'See exactly how your post will look on every major platform before you publish. Free, no account needed.',
  },
  alternates: { canonical: PAGE_URL },
}

const FAQS = [
  {
    q: 'What is a social media post preview tool?',
    a: 'A social media post preview tool renders your image and caption inside a mock version of each platform’s feed, so you can see the image crop, where the caption truncates and how your profile name and logo appear before you publish. It catches layout problems that a scheduling tool will not show you.',
  },
  {
    q: 'Which platforms can I preview?',
    a: 'Facebook, Instagram, LinkedIn, Twitter/X and TikTok feeds, plus Facebook Stories and Instagram Stories. Each can be previewed as an organic post or as a paid ad with a headline, Sponsored label and call-to-action button.',
  },
  {
    q: 'Is the social media preview tool free?',
    a: 'Yes. It is completely free with no account, no credit card and no sign-up. Content Manager is the paid social media management platform behind it, but the preview tool works entirely on its own.',
  },
  {
    q: 'Do I need to connect my social media accounts?',
    a: 'No. The preview is generated in your browser from the image and caption you provide. Nothing is connected, posted or published to any social network.',
  },
  {
    q: 'Can I share a preview with a client?',
    a: 'Yes. Click Share and the tool creates a private link to the mockup that you can send to a client or colleague. They can open it in a browser without creating an account.',
  },
  {
    q: 'Can I preview a paid ad as well as an organic post?',
    a: 'Yes. Switch the Post Type toggle to Advert to add a headline and a call-to-action button and render the post with the Sponsored or Promoted label — useful for presenting ad concepts before building anything in Ads Manager.',
  },
]

const SECTIONS = [
  {
    h2: 'How to preview your social media posts',
    body:
      'Enter your business name and upload your logo in the left column. Upload your post image and write your caption in the middle column. Pick a platform tab on the right and the preview renders live — profile picture, caption layout, image cropping and engagement buttons included. Toggle between Organic and Advert to check both formats, then click Share to send a client a link to the mockup.',
  },
  {
    h2: 'Preview organic posts and paid social media ads',
    body:
      'Most social media preview tools only show organic posts. Ours lets you toggle between organic and paid ad formats so you can check how your ad creative will render — including the Sponsored label, headline text, call-to-action button and destination URL. This is especially useful for agencies and media buyers who need to present realistic ad mockups to clients before spending any budget.',
  },
  {
    h2: 'Supported platforms — Facebook, Instagram, LinkedIn, TikTok, Twitter/X and Stories',
    bullets: [
      { t: 'Facebook Feed', d: 'See your post as it appears in the news feed, including the engagement bar and share options.' },
      { t: 'Instagram Feed', d: 'Preview square and 4:5 crops, caption placement and like counts as they appear on Instagram.' },
      { t: 'LinkedIn Feed and Ads', d: 'Preview organic company page posts and sponsored single-image ads, including the Promoted label and headline card.' },
      { t: 'Twitter / X Feed', d: 'Check how your post renders with an attached image, handle and engagement row.' },
      { t: 'TikTok Feed', d: 'Visualise your content in the full-screen vertical format with the overlaid caption and action buttons.' },
      { t: 'Facebook Stories', d: 'Preview the full-screen story format with progress bars and reply bar.' },
      { t: 'Instagram Stories', d: 'See your story with the Instagram gradient header and the reply bar in place.' },
    ],
  },
]

const schema = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebApplication',
      '@id': `${PAGE_URL}#app`,
      name: 'Free Social Media Post Preview Tool',
      url: PAGE_URL,
      applicationCategory: 'UtilitiesApplication',
      operatingSystem: 'Web',
      browserRequirements: 'Requires JavaScript. Works in any modern browser.',
      description:
        'Preview how social media posts look on Facebook, Instagram, LinkedIn, TikTok, Twitter/X, Facebook Stories and Instagram Stories before publishing — as an organic post or paid ad.',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      isAccessibleForFree: true,
      featureList: [
        'Facebook post preview',
        'Instagram post preview',
        'LinkedIn post preview',
        'Twitter / X post preview',
        'TikTok post preview',
        'Facebook and Instagram Story preview',
        'Paid ad preview with headline and call-to-action button',
        'Shareable client preview links',
      ],
      author: { '@type': 'Organization', name: 'Content Manager', url: BASE_URL },
    },
    {
      '@type': 'FAQPage',
      '@id': `${PAGE_URL}#faq`,
      mainEntity: FAQS.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
    {
      '@type': 'HowTo',
      '@id': `${PAGE_URL}#howto`,
      name: 'How to preview a social media post before publishing',
      totalTime: 'PT1M',
      step: [
        { '@type': 'HowToStep', position: 1, name: 'Add your business profile', text: 'Enter your business name and upload your logo so the preview shows your real page identity.' },
        { '@type': 'HowToStep', position: 2, name: 'Upload your post image', text: 'Drag in the image you plan to publish, or click to upload a PNG, JPG or WEBP file.' },
        { '@type': 'HowToStep', position: 3, name: 'Write your caption', text: 'Paste or type your caption and watch the live character count.' },
        { '@type': 'HowToStep', position: 4, name: 'Choose a platform', text: 'Select Facebook, Instagram, LinkedIn, Twitter/X, TikTok, Facebook Stories or Instagram Stories to see the post rendered in that layout.' },
        { '@type': 'HowToStep', position: 5, name: 'Check the ad format', text: 'Toggle Post Type to Advert to add a headline and call-to-action button and preview the post as a paid ad.' },
        { '@type': 'HowToStep', position: 6, name: 'Share for approval', text: 'Click Share to create a private link to the mockup and send it to a client or colleague.' },
      ],
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${PAGE_URL}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
        { '@type': 'ListItem', position: 2, name: 'Social Preview Tool', item: PAGE_URL },
      ],
    },
  ],
}

export default function SocialPreviewPage() {
  return (
    <>
      <script
        id="social-preview-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
        <SocialPreviewTool>
          <SeoContent>
            <AnswerBox question="What is a social media post preview tool?" answer={FAQS[0].a} />
            {SECTIONS.map((s) => (
              <ContentSection key={s.h2} section={s} />
            ))}
            <RelatedTools
              heading="Platform-specific preview tools"
              links={PLATFORM_PAGES.map((p) => ({
                href: `/social-preview/${p.slug}`,
                label: `${p.shortName} preview`,
              }))}
            />
            <FaqSection faqs={FAQS} />
            <ProductCta />
          </SeoContent>
        </SocialPreviewTool>
    </>
  )
}
