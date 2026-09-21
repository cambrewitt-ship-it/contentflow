import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import SocialPreviewTool from '../SocialPreviewTool'
import { PLATFORM_PAGES, getPlatformPage } from '../platforms'
import {
  AnswerBox,
  Breadcrumb,
  ContentSection,
  FaqSection,
  ProductCta,
  RelatedTools,
  SeoContent,
  SpecTable,
} from '../seo-blocks'

const BASE_URL = 'https://content-manager.io'

export const dynamicParams = false

export function generateStaticParams() {
  return PLATFORM_PAGES.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const page = getPlatformPage(slug)
  if (!page) return {}

  const url = `${BASE_URL}/social-preview/${page.slug}`
  return {
    title: page.title,
    description: page.description,
    openGraph: {
      title: page.title,
      description: page.description,
      url,
      siteName: 'Content Manager',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: page.title,
      description: page.description,
    },
    alternates: { canonical: url },
  }
}

export default async function PlatformPreviewPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const page = getPlatformPage(slug)
  if (!page) notFound()

  const url = `${BASE_URL}/social-preview/${page.slug}`
  const howToSection = page.sections.find((s) => s.h2.toLowerCase().startsWith('how to'))

  // One @graph keeps WebApplication, FAQPage, HowTo and BreadcrumbList linked
  // rather than competing as unrelated blobs.
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        '@id': `${url}#app`,
        name: page.h1,
        url,
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'Web',
        browserRequirements: 'Requires JavaScript. Works in any modern browser.',
        description: page.description,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        isAccessibleForFree: true,
        author: { '@type': 'Organization', name: 'Content Manager', url: BASE_URL },
      },
      {
        '@type': 'FAQPage',
        '@id': `${url}#faq`,
        mainEntity: page.faqs.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
      ...(howToSection?.body
        ? [
            {
              '@type': 'HowTo',
              '@id': `${url}#howto`,
              name: howToSection.h2,
              description: howToSection.body,
              totalTime: 'PT1M',
              step: howToSection.body
                .split('. ')
                .filter((s) => s.trim().length > 20)
                .map((s, i) => ({
                  '@type': 'HowToStep',
                  position: i + 1,
                  text: s.trim().replace(/\.$/, '') + '.',
                })),
            },
          ]
        : []),
      {
        '@type': 'BreadcrumbList',
        '@id': `${url}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
          { '@type': 'ListItem', position: 2, name: 'Social Preview Tool', item: `${BASE_URL}/social-preview` },
          { '@type': 'ListItem', position: 3, name: page.shortName, item: url },
        ],
      },
    ],
  }

  const relatedLinks = page.related
    .map((s) => getPlatformPage(s))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map((p) => ({ href: `/social-preview/${p.slug}`, label: `${p.shortName} preview` }))

  return (
    <>
      <script
        id={`schema-${page.slug}`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
        <SocialPreviewTool
          initialPlatform={page.platformId}
          initialIsAdvert={page.isAdvert}
          heading={page.h1}
          subheading={page.intro}
          breadcrumb={<Breadcrumb current={page.shortName} />}
        >
          <SeoContent>
            <AnswerBox question={`What is a ${page.shortName.toLowerCase()} preview tool?`} answer={page.answer} />
            {page.sections.map((s) => (
              <ContentSection key={s.h2} section={s} />
            ))}
            <SpecTable heading={page.specsHeading} specs={page.specs} />
            <FaqSection faqs={page.faqs} />
            <RelatedTools
              links={[
                ...relatedLinks,
                { href: '/social-preview', label: 'All platforms — preview hub' },
              ]}
            />
            <ProductCta />
          </SeoContent>
        </SocialPreviewTool>
    </>
  )
}
