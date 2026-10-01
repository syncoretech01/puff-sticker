import currentCaptureJson from './fixtures/production-seo-capture-2026-09-30.json' with { type: 'json' }
import checkoutCaptureJson from './fixtures/production-seo-capture-2026-10-01-checkout.json' with { type: 'json' }
import {
  FROZEN_PRODUCTION_SEO_BASELINE_FIXTURE,
  FROZEN_PRODUCTION_SEO_DELTA_FIXTURE,
  FROZEN_PRODUCTION_SEO_FIXTURE,
  frozenProductionPageEvidenceCapture,
} from './frozen-production-evidence-fixture'

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
  status: number
  responseHeaders: { contentType: string | null; xRobotsTag: string | null }
  coreMetadata: {
    title: string
    description: string | null
    canonical: string
    robots: string | null
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
  status: number
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

export const PRODUCTION_SEO_BASELINE_FIXTURE = FROZEN_PRODUCTION_SEO_BASELINE_FIXTURE
export const PRODUCTION_SEO_CURRENT_DELTA_FIXTURE = FROZEN_PRODUCTION_SEO_DELTA_FIXTURE
export { FROZEN_PRODUCTION_SEO_FIXTURE }

const currentCapture = currentCaptureJson as unknown as ProductionSeoFixture
const checkoutCapture = checkoutCaptureJson as unknown as ProductionSeoFixture

export const CURRENT_PRODUCTION_SEO_FIXTURE: ProductionSeoFixture = {
  ...currentCapture,
  source: 'production-crawl-2026-09-30-with-checkout-supplement-2026-10-01',
  capturedOn: '2026-10-01',
  routeCount: Object.keys({ ...currentCapture.pages, ...checkoutCapture.pages }).length,
  pages: { ...currentCapture.pages, ...checkoutCapture.pages },
}

const legacyPreservedPaths = new Set(
  Object.entries(CURRENT_PRODUCTION_SEO_FIXTURE.pages)
    .filter(([, page]) => page.status === 404 && FROZEN_PRODUCTION_SEO_FIXTURE.pages[pagePathFor(page)])
    .map(([path]) => path),
)

function pagePathFor(page: ProductionPageEvidence): string {
  const pathname = new URL(page.requestedUrl).pathname
  return pathname === '/' ? '/' : `/${pathname.split('/').filter(Boolean).join('/')}`
}

const effectivePages = Object.fromEntries(
  Object.entries(CURRENT_PRODUCTION_SEO_FIXTURE.pages).map(([path, page]) => [
    path,
    legacyPreservedPaths.has(path) ? FROZEN_PRODUCTION_SEO_FIXTURE.pages[path] : page,
  ]),
)

export const PRODUCTION_SEO_FIXTURE: ProductionSeoFixture = {
  ...CURRENT_PRODUCTION_SEO_FIXTURE,
  source: 'production-crawl-2026-09-30-with-frozen-legacy-coverage',
  routeCount: Object.keys(effectivePages).length,
  pages: effectivePages,
}

export const CURRENT_PRODUCTION_ACTIVE_PATHS = Object.freeze(
  Object.entries(CURRENT_PRODUCTION_SEO_FIXTURE.pages)
    .filter(([, page]) => page.status === 200)
    .map(([path]) => path)
    .sort(),
)

export const LEGACY_PRESERVED_PATHS = Object.freeze([...legacyPreservedPaths].sort())

export function productionPageEvidenceCapture(path: string) {
  if (path === '/checkout') return { source: 'production-crawl-2026-10-01', capturedOn: '2026-10-01' } as const
  return legacyPreservedPaths.has(path)
    ? frozenProductionPageEvidenceCapture(path)
    : { source: 'production-crawl-2026-09-30', capturedOn: '2026-09-30' } as const
}

export function productionEndpointEvidenceCapture(_path: string) {
  return { source: 'production-crawl-2026-09-30', capturedOn: '2026-09-30' } as const
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
