import fixtureJson from './fixtures/production-seo-2026-08-22.json' with { type: 'json' }
import currentDeltaFixtureRaw from './fixtures/production-seo-current-delta-2026-09-01'
import currentSitemapIndexFixture from './fixtures/production-sitemap-index-delta-2026-09-02'

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
  redirectChainSource?: string
  redirectChainCapturedOn?: string
  /**
   * Present when the requested endpoint redirected before the captured final
   * body. Every hop retains the manual response status, Location, MIME type,
   * and body fingerprint so a redirect-following client cannot flatten the
   * public HTTP contract into a false 200 observation.
   */
  redirectChain?: readonly {
    url: string
    status: number
    location: string | null
    contentType: string | null
    bodyLength: number
    normalizedBodyHash: string
  }[]
}

export type ProductionSeoFixture = {
  schemaVersion: 1
  source: string
  capturedOn: string
  origin: 'https://puffsticker.com'
  routeCount: number
  endpointCount: number
  pages: Readonly<Record<string, ProductionPageEvidence>>
  endpoints: Readonly<Record<string, ProductionEndpointEvidence>>
}

export const PRODUCTION_SEO_BASELINE_FIXTURE = fixtureJson as unknown as ProductionSeoFixture
export const PRODUCTION_SEO_CURRENT_DELTA_FIXTURE = currentDeltaFixtureRaw as ProductionSeoFixture

const currentIndex = currentSitemapIndexFixture.endpoint as ProductionEndpointEvidence
const compatibilityBaseline = PRODUCTION_SEO_BASELINE_FIXTURE.endpoints['/sitemap.xml']
const compatibilityRedirect = compatibilityBaseline.redirectChain?.[0]

if (!compatibilityRedirect) {
  throw new Error('The production /sitemap.xml compatibility redirect evidence is missing')
}

const currentCompatibilityEndpoint: ProductionEndpointEvidence = {
  ...compatibilityBaseline,
  finalUrl: currentIndex.finalUrl,
  status: currentIndex.status,
  contentType: currentIndex.contentType,
  normalizedBodyHash: currentIndex.normalizedBodyHash,
  body: currentIndex.body,
  redirectChain: [
    compatibilityRedirect,
    {
      url: currentIndex.requestedUrl,
      status: currentIndex.status,
      location: null,
      contentType: currentIndex.contentType,
      bodyLength: new TextEncoder().encode(currentIndex.body).byteLength,
      normalizedBodyHash: currentIndex.normalizedBodyHash,
    },
  ],
}

const mergedPages = {
  ...PRODUCTION_SEO_BASELINE_FIXTURE.pages,
  ...PRODUCTION_SEO_CURRENT_DELTA_FIXTURE.pages,
}

const mergedEndpoints = {
  ...PRODUCTION_SEO_BASELINE_FIXTURE.endpoints,
  ...PRODUCTION_SEO_CURRENT_DELTA_FIXTURE.endpoints,
  '/sitemap_index.xml': currentIndex,
  '/sitemap.xml': currentCompatibilityEndpoint,
}

export const PRODUCTION_SEO_FIXTURE: ProductionSeoFixture = {
  ...PRODUCTION_SEO_BASELINE_FIXTURE,
  source: 'production-crawl-2026-08-22-plus-current-deltas',
  capturedOn: '2026-09-02',
  routeCount: Object.keys(mergedPages).length,
  endpointCount: Object.keys(mergedEndpoints).length,
  pages: mergedPages,
  endpoints: mergedEndpoints,
}

const currentPagePaths = new Set(Object.keys(PRODUCTION_SEO_CURRENT_DELTA_FIXTURE.pages))

export function productionPageEvidenceCapture(path: string) {
  return currentPagePaths.has(path)
    ? { source: 'production-crawl-2026-09-01', capturedOn: '2026-09-01' } as const
    : { source: 'production-crawl-2026-08-22', capturedOn: '2026-08-22' } as const
}

export function productionEndpointEvidenceCapture(path: string) {
  if (path === '/sitemap.xml') {
    return { source: 'production-http-capture-2026-08-31', capturedOn: '2026-08-31' } as const
  }
  if (path === '/sitemap_index.xml') {
    return { source: 'production-http-capture-2026-09-02', capturedOn: '2026-09-02' } as const
  }
  if (path === '/post-sitemap.xml') {
    return { source: 'production-crawl-2026-09-01', capturedOn: '2026-09-01' } as const
  }
  return { source: 'production-crawl-2026-08-22', capturedOn: '2026-08-22' } as const
}

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
