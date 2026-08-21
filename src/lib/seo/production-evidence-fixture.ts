import fixtureJson from './fixtures/production-seo-2026-08-22.json' with { type: 'json' }

export type ProductionOpenGraphEvidence = {
  title: string | null
  description: string | null
  url: string | null
  image: string | null
  imageAlt: string | null
  type: 'website' | 'article' | 'product' | null
  all: Readonly<Record<string, readonly string[]>>
  tags: readonly { key: string; content: string }[]
}

export type ProductionTwitterEvidence = {
  card: 'summary' | 'summary_large_image' | null
  title: string | null
  description: string | null
  image: string | null
  imageAlt: string | null
  site: string | null
  creator: string | null
  all: Readonly<Record<string, readonly string[]>>
  tags: readonly { key: string; content: string }[]
}

export type ProductionPageEvidence = {
  requestedUrl: string
  finalUrl: string
  status: 200
  responseHeaders: { contentType: string | null; xRobotsTag: string | null }
  coreMetadata: {
    title: string
    description: string | null
    canonical: string
    robots: string
  }
  openGraph: ProductionOpenGraphEvidence
  twitter: ProductionTwitterEvidence
  structuredData: {
    normalizedGraphs: readonly Record<string, unknown>[]
    normalizedGraphHashes: readonly string[]
    types: readonly string[]
  }
  content: {
    contentRootSelector: string
    meaningfulText: string
    meaningfulTextHash: string
    meaningfulWordCount: number
    headings: readonly { level: 1 | 2 | 3 | 4 | 5 | 6; text: string }[]
    headingsHash: string
    images: readonly { src: string; alt: string }[]
    imagesHash: string
    internalLinks: readonly string[]
    internalLinkDetails: readonly { href: string; text: string; rel: string }[]
    internalLinksHash: string
  }
}

export type ProductionEndpointEvidence = {
  requestedUrl: string
  finalUrl: string
  status: 200
  contentType: string | null
  normalizedBodyHash: string
  body: string
}

export type ProductionSeoFixture = {
  schemaVersion: 1
  source: 'production-crawl-2026-08-22'
  capturedOn: '2026-08-22'
  origin: 'https://puffsticker.com'
  routeCount: number
  endpointCount: number
  pages: Readonly<Record<string, ProductionPageEvidence>>
  endpoints: Readonly<Record<string, ProductionEndpointEvidence>>
}

export const PRODUCTION_SEO_FIXTURE = fixtureJson as unknown as ProductionSeoFixture

export function productionPageEvidence(path: string): ProductionPageEvidence {
  const page = PRODUCTION_SEO_FIXTURE.pages[path]
  if (!page) throw new Error(`Missing captured production SEO evidence for ${path}`)
  return page
}

export function productionEndpointEvidence(path: string): ProductionEndpointEvidence {
  const endpoint = PRODUCTION_SEO_FIXTURE.endpoints[path]
  if (!endpoint) throw new Error(`Missing captured production endpoint evidence for ${path}`)
  return endpoint
}
