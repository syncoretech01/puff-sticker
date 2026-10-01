import fixtureJson from './fixtures/production-seo-2026-08-22.json' with { type: 'json' }
import currentDeltaFixtureRaw from './fixtures/production-seo-current-delta-2026-09-01'
import currentSitemapIndexFixture from './fixtures/production-sitemap-index-delta-2026-09-02'
import type { ProductionEndpointEvidence, ProductionSeoFixture } from './production-evidence-fixture'

export const FROZEN_PRODUCTION_SEO_BASELINE_FIXTURE = fixtureJson as unknown as ProductionSeoFixture
export const FROZEN_PRODUCTION_SEO_DELTA_FIXTURE = currentDeltaFixtureRaw as ProductionSeoFixture

const currentIndex = currentSitemapIndexFixture.endpoint as ProductionEndpointEvidence
const compatibilityBaseline = FROZEN_PRODUCTION_SEO_BASELINE_FIXTURE.endpoints['/sitemap.xml']
const compatibilityRedirect = compatibilityBaseline.redirectChain?.[0]

if (!compatibilityRedirect) {
  throw new Error('The frozen production /sitemap.xml compatibility redirect evidence is missing')
}

const frozenCompatibilityEndpoint: ProductionEndpointEvidence = {
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

const pages = {
  ...FROZEN_PRODUCTION_SEO_BASELINE_FIXTURE.pages,
  ...FROZEN_PRODUCTION_SEO_DELTA_FIXTURE.pages,
}

const endpoints = {
  ...FROZEN_PRODUCTION_SEO_BASELINE_FIXTURE.endpoints,
  ...FROZEN_PRODUCTION_SEO_DELTA_FIXTURE.endpoints,
  '/sitemap_index.xml': currentIndex,
  '/sitemap.xml': frozenCompatibilityEndpoint,
}

export const FROZEN_PRODUCTION_SEO_FIXTURE: ProductionSeoFixture = {
  ...FROZEN_PRODUCTION_SEO_BASELINE_FIXTURE,
  source: 'production-crawl-2026-08-22-plus-current-deltas',
  capturedOn: '2026-09-02',
  routeCount: Object.keys(pages).length,
  endpointCount: Object.keys(endpoints).length,
  pages,
  endpoints,
}

const deltaPaths = new Set(Object.keys(FROZEN_PRODUCTION_SEO_DELTA_FIXTURE.pages))

export function frozenProductionPageEvidenceCapture(path: string) {
  return deltaPaths.has(path)
    ? { source: 'production-crawl-2026-09-01', capturedOn: '2026-09-01' } as const
    : { source: 'production-crawl-2026-08-22', capturedOn: '2026-08-22' } as const
}
