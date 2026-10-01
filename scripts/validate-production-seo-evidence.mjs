import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { registerHooks } from 'node:module'

import contentFixture from '../src/content/fixtures/production-content-2026-09-30.json' with { type: 'json' }
import checkoutContentFixture from '../src/content/fixtures/production-content-2026-10-01-checkout.json' with { type: 'json' }
import diffReport from '../docs/migration/evidence/production-seo-diff-2026-10-01.json' with { type: 'json' }

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context)
    } catch (error) {
      if (
        error?.code === 'ERR_MODULE_NOT_FOUND'
        && (specifier.startsWith('./') || specifier.startsWith('../'))
        && !/\.[cm]?[jt]sx?$/.test(specifier)
      ) return nextResolve(`${specifier}.ts`, context)
      throw error
    }
  },
})

const {
  CANONICALIZING_ALIAS_CONTRACTS,
  CANONICAL_SITEMAP_ROUTES,
  PHASE_2_SEO_EVIDENCE_READY,
  PRIMARY_ROUTE_CONTRACTS,
  PRODUCTION_ROBOTS_TXT,
  SITEMAP_ENTRIES,
  SITEMAP_GROUPS,
  exactSeoEndpointResponse,
} = await import('../src/lib/seo/index.ts')
const {
  CURRENT_PRODUCTION_ACTIVE_PATHS,
  CURRENT_PRODUCTION_SEO_FIXTURE,
  FROZEN_PRODUCTION_SEO_FIXTURE,
  LEGACY_PRESERVED_PATHS,
  PRODUCTION_SEO_FIXTURE,
  productionEndpointEvidence,
} = await import('../src/lib/seo/production-evidence-fixture.ts')

const failures = []
const check = (condition, message) => { if (!condition) failures.push(message) }
const hash = (value) => createHash('sha256').update(value).digest('hex')
const stableValue = (value) => {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]))
  return value
}
const stableJson = (value) => JSON.stringify(stableValue(value))
const same = (left, right) => stableJson(left) === stableJson(right)
const pathsWithStatus = (fixture, status) => Object.entries(fixture.pages).filter(([, page]) => page.status === status).map(([path]) => path).sort()

const expectedAddedPaths = [
  '/blog/cbd-box-styles-tuck-end-sleeve-rigid',
  '/blog/cbd-packaging-on-a-dispensary-shelf',
  '/blog/child-resistant-cbd-boxes-how-they-work',
  '/blog/custom-mylar-bags-guide',
  '/blog/custom-puffy-stickers-christmas',
  '/blog/kraft-look-packaging',
  '/blog/recyclable-compostable-biodegradable',
  '/blog/reflex-to-touch-raised-surface',
  '/blog/sticker-stops-feeling-flat',
  '/blog/sticker-thickness-personality',
  '/blog/why-paper-is-better-isnt-a-complete-packaging-argument',
  '/cbd-packaging-boxes',
  '/cbd-packaging-boxes/cbd-bottle-boxes',
  '/cbd-packaging-boxes/cbd-display-boxes',
  '/cbd-packaging-boxes/cbd-gummy-boxes',
  '/cbd-packaging-boxes/cbd-kraft-boxes',
  '/cbd-packaging-boxes/cbd-oil-packaging',
  '/cbd-packaging-boxes/cbd-sleeve-tray-boxes',
  '/cbd-packaging-boxes/cbd-tincture-boxes',
  '/cbd-packaging-boxes/child-resistant-boxes',
  '/cbd-packaging-boxes/custom-cbd-boxes',
  '/cbd-packaging-boxes/custom-hemp-boxes',
  '/checkout',
  '/industries',
  '/payment-terms',
  '/shipping-policy',
].sort()

check(FROZEN_PRODUCTION_SEO_FIXTURE.capturedOn === '2026-09-02', 'frozen evidence date changed')
check(FROZEN_PRODUCTION_SEO_FIXTURE.routeCount === 128, `expected 128 frozen pages, found ${FROZEN_PRODUCTION_SEO_FIXTURE.routeCount}`)
check(FROZEN_PRODUCTION_SEO_FIXTURE.endpointCount === 9, `expected 9 frozen endpoints, found ${FROZEN_PRODUCTION_SEO_FIXTURE.endpointCount}`)

check(CURRENT_PRODUCTION_SEO_FIXTURE.schemaVersion === 1, 'current production fixture schema version changed')
check(CURRENT_PRODUCTION_SEO_FIXTURE.source === 'production-crawl-2026-09-30-with-checkout-supplement-2026-10-01', 'current production fixture source changed')
check(CURRENT_PRODUCTION_SEO_FIXTURE.capturedOn === '2026-10-01', 'current production fixture date changed')
check(CURRENT_PRODUCTION_SEO_FIXTURE.routeCount === 154, `expected 154 current observations, found ${CURRENT_PRODUCTION_SEO_FIXTURE.routeCount}`)
check(CURRENT_PRODUCTION_SEO_FIXTURE.endpointCount === 9, `expected 9 current endpoints, found ${CURRENT_PRODUCTION_SEO_FIXTURE.endpointCount}`)
check(CURRENT_PRODUCTION_ACTIVE_PATHS.length === 128, `expected 128 current 200 routes, found ${CURRENT_PRODUCTION_ACTIVE_PATHS.length}`)
check(LEGACY_PRESERVED_PATHS.length === 26, `expected 26 frozen legacy routes, found ${LEGACY_PRESERVED_PATHS.length}`)
check(same(pathsWithStatus(CURRENT_PRODUCTION_SEO_FIXTURE, 404), LEGACY_PRESERVED_PATHS), 'legacy preserved set disagrees with current production 404 observations')

const frozenPaths = new Set(Object.keys(FROZEN_PRODUCTION_SEO_FIXTURE.pages))
const currentPaths = Object.keys(CURRENT_PRODUCTION_SEO_FIXTURE.pages)
check(same(currentPaths.filter((path) => !frozenPaths.has(path)).sort(), expectedAddedPaths), 'current-vs-frozen added route set changed')
check([...frozenPaths].every((path) => currentPaths.includes(path)), 'a frozen SEO route disappeared from current coverage')

for (const [path, page] of Object.entries(CURRENT_PRODUCTION_SEO_FIXTURE.pages)) {
  check(page.status === 200 || page.status === 404, `${path}: unexpected current status ${page.status}`)
  check(hash(page.content.meaningfulText) === page.content.meaningfulTextHash, `${path}: meaningful-text hash mismatch`)
  check(hash(stableJson(page.content.headings)) === page.content.headingsHash, `${path}: headings hash mismatch`)
  check(hash(stableJson(page.content.images)) === page.content.imagesHash, `${path}: image/alt hash mismatch`)
  check(hash(stableJson(page.content.internalLinkDetails)) === page.content.internalLinksHash, `${path}: internal-link hash mismatch`)
  check(page.structuredData.normalizedGraphs.every((graph, index) => hash(stableJson(graph)) === page.structuredData.normalizedGraphHashes[index]), `${path}: schema hash mismatch`)
}

check(PRODUCTION_SEO_FIXTURE.routeCount === 154, 'effective contract route count changed')
check(Object.values(PRODUCTION_SEO_FIXTURE.pages).every((page) => page.status === 200), 'effective contract contains a non-200 page')
for (const path of LEGACY_PRESERVED_PATHS) check(PRODUCTION_SEO_FIXTURE.pages[path] === FROZEN_PRODUCTION_SEO_FIXTURE.pages[path], `${path}: legacy route is not sourced from frozen evidence`)

const productionRoutes = [
  ...PRIMARY_ROUTE_CONTRACTS.filter((route) => route.productionSignals.scope === 'production'),
  ...CANONICALIZING_ALIAS_CONTRACTS,
]
check(productionRoutes.length === PRODUCTION_SEO_FIXTURE.routeCount, 'production route contract does not cover the full effective fixture')
check(PHASE_2_SEO_EVIDENCE_READY, 'SEO evidence gate still has uncaptured blockers')
for (const route of productionRoutes) {
  const page = PRODUCTION_SEO_FIXTURE.pages[route.path]
  check(Boolean(page), `${route.path}: missing effective page evidence`)
  if (!page) continue
  check(same(route.productionSignals.coreMetadata.value, page.coreMetadata), `${route.path}: core metadata drifted`)
  check(same(route.productionSignals.openGraph.value, page.openGraph), `${route.path}: Open Graph drifted`)
  check(same(route.productionSignals.twitter.value, page.twitter), `${route.path}: Twitter metadata drifted`)
  check(same(route.metadata.openGraph.all, page.openGraph.all), `${route.path}: Open Graph inventory drifted`)
  check(same(route.metadata.twitter.all, page.twitter.all), `${route.path}: Twitter inventory drifted`)
  check(same(route.structuredData, page.structuredData.normalizedGraphs), `${route.path}: JSON-LD drifted`)
  check(same(route.expectedSchemaTypes, page.structuredData.types), `${route.path}: schema type inventory drifted`)
}

for (const [path, endpoint] of Object.entries(CURRENT_PRODUCTION_SEO_FIXTURE.endpoints)) {
  check(hash(endpoint.body) === endpoint.normalizedBodyHash, `${path}: current endpoint body hash mismatch`)
  const response = exactSeoEndpointResponse(path)
  const firstHop = endpoint.redirectChain?.[0]
  const expectedStatus = firstHop?.status ?? endpoint.status
  check(response.status === expectedStatus, `${path}: target status ${response.status} differs from current ${expectedStatus}`)
  check(response.headers.get('location') === (firstHop?.location ?? null), `${path}: target redirect location drifted`)
  check(response.headers.get('content-type') === (firstHop?.contentType ?? endpoint.contentType), `${path}: target MIME type drifted`)
  check(await response.text() === (firstHop ? '' : endpoint.body), `${path}: target response body drifted`)
}

const sitemap = productionEndpointEvidence('/sitemap.xml')
check(sitemap.status === 200 && !sitemap.redirectChain, '/sitemap.xml must preserve the current direct 200 response')
for (const path of ['/sitemap_index.xml', '/post-sitemap.xml', '/page-sitemap.xml', '/product-sitemap.xml', '/product_cat-sitemap.xml', '/local-sitemap.xml']) {
  const endpoint = productionEndpointEvidence(path)
  check(endpoint.redirectChain?.length === 2, `${path}: expected one redirect plus terminal response`)
  check(endpoint.redirectChain?.[0]?.status === 301, `${path}: requested response is not 301`)
  check(endpoint.redirectChain?.[0]?.location === 'https://puffsticker.com/sitemap.xml', `${path}: redirect target changed`)
  check(endpoint.redirectChain?.[1]?.status === 200, `${path}: redirect terminal response is not 200`)
}
check(productionEndpointEvidence('/locations.kml').status === 404, '/locations.kml must preserve the current 404')
check(PRODUCTION_ROBOTS_TXT === productionEndpointEvidence('/robots.txt').body, 'robots.txt does not match current evidence')

check(SITEMAP_ENTRIES.length === 72, `expected 72 current sitemap rows, found ${SITEMAP_ENTRIES.length}`)
check(CANONICAL_SITEMAP_ROUTES.length === 72, `expected 72 canonical sitemap routes, found ${CANONICAL_SITEMAP_ROUTES.length}`)
check(new Set(SITEMAP_ENTRIES.map((entry) => entry.path)).size === 72, 'duplicate current sitemap rows')
check(same([...CANONICAL_SITEMAP_ROUTES.map((route) => route.path)].sort(), [...SITEMAP_ENTRIES.map((entry) => entry.path)].sort()), 'sitemap rows disagree with canonical route contracts')
check(SITEMAP_GROUPS.post.length === 25, 'current post sitemap grouping changed')
check(SITEMAP_GROUPS.page.length === 12, 'current page sitemap grouping changed')
check(SITEMAP_GROUPS.product.length === 31, 'current product sitemap grouping changed')
check(SITEMAP_GROUPS['product-category'].length === 4, 'current product-category sitemap grouping changed')
check(SITEMAP_ENTRIES.every((entry) => entry.lastModified === undefined && entry.images.state === 'captured' && entry.images.value.length === 0), 'current flat sitemap unexpectedly contains lastmod or image rows')

check(contentFixture.schemaVersion === 1, 'current content fixture schema changed')
check(contentFixture.source === 'production-content-crawl-2026-09-30', 'current content fixture source changed')
check(contentFixture.routeCount === 72 && Object.keys(contentFixture.pages).length === 72, 'current content fixture must cover all 72 sitemap routes')
check(contentFixture.assetCount === 230 && Object.keys(contentFixture.assets).length === 230, 'current content fixture asset inventory changed')
check(same(Object.keys(contentFixture.pages).sort(), SITEMAP_ENTRIES.map((entry) => entry.path).sort()), 'current content fixture route set disagrees with sitemap')
for (const [path, page] of Object.entries(contentFixture.pages)) {
  check(hash(page.semanticHtml) === page.semanticHtmlHash, `${path}: semantic HTML hash mismatch`)
  check(page.meaningfulTextHash === CURRENT_PRODUCTION_SEO_FIXTURE.pages[path].content.meaningfulTextHash, `${path}: semantic content text hash disagrees with current SEO evidence`)
  check(!/https:\/\/puffsticker\.com\/assets\//.test(page.semanticHtml), `${path}: semantic content still depends on a live production asset`)
}
for (const asset of Object.values(contentFixture.assets)) {
  const bytes = await readFile(resolve('public', asset.localPath.replace(/^\//, '')))
  check(bytes.length === asset.byteLength, `${asset.localPath}: byte length changed`)
  check(hash(bytes) === asset.sha256, `${asset.localPath}: asset hash changed`)
}

check(checkoutContentFixture.schemaVersion === 1, 'checkout content fixture schema changed')
check(checkoutContentFixture.source === 'production-content-crawl-2026-10-01', 'checkout content fixture source changed')
check(checkoutContentFixture.routeCount === 1 && Object.keys(checkoutContentFixture.pages).length === 1, 'checkout content fixture must contain one route')
check(checkoutContentFixture.assetCount === 0 && Object.keys(checkoutContentFixture.assets).length === 0, 'checkout content fixture unexpectedly captured assets')
check(Object.keys(checkoutContentFixture.pages)[0] === '/checkout', 'checkout content fixture path changed')
const checkoutContent = checkoutContentFixture.pages['/checkout']
check(hash(checkoutContent.semanticHtml) === checkoutContent.semanticHtmlHash, '/checkout: semantic HTML hash mismatch')
check(checkoutContent.meaningfulTextHash === CURRENT_PRODUCTION_SEO_FIXTURE.pages['/checkout'].content.meaningfulTextHash, '/checkout: semantic content text hash disagrees with current SEO evidence')
check(!/https:\/\/puffsticker\.com\/assets\//.test(checkoutContent.semanticHtml), '/checkout: semantic content depends on a live production asset')

check(diffReport.schemaVersion === 1 && diffReport.generatedOn === '2026-10-01', 'dated production diff provenance changed')
check(diffReport.source.frozen.capturedOn === '2026-09-02' && diffReport.source.frozen.routeCount === 128, 'dated diff no longer references the frozen contract')
check(diffReport.source.current.capturedOn === '2026-10-01' && diffReport.source.current.routeCount === 154, 'dated diff no longer references the current capture')
check(diffReport.summary.classifications['added-current'] === 26, 'dated diff added-route count changed')
check(diffReport.summary.classifications['current-404-preserve-frozen'] === 26, 'dated diff legacy-preservation count changed')
check(diffReport.summary.sitemap.frozen === 44 && diffReport.summary.sitemap.current === 72, 'dated diff sitemap counts changed')
check(diffReport.summary.sitemap.removed.length === 0, 'dated diff reports lost legacy sitemap URLs')

if (failures.length) throw new Error(`Production SEO evidence validation failed:\n${failures.join('\n')}`)

console.log(JSON.stringify({
  frozenEvidence: { capturedOn: FROZEN_PRODUCTION_SEO_FIXTURE.capturedOn, routes: FROZEN_PRODUCTION_SEO_FIXTURE.routeCount },
  currentEvidence: { capturedOn: CURRENT_PRODUCTION_SEO_FIXTURE.capturedOn, observations: CURRENT_PRODUCTION_SEO_FIXTURE.routeCount, active: CURRENT_PRODUCTION_ACTIVE_PATHS.length, current404: LEGACY_PRESERVED_PATHS.length },
  effectiveRoutes: productionRoutes.length,
  canonicalSitemapRoutes: SITEMAP_ENTRIES.length,
  endpointCount: CURRENT_PRODUCTION_SEO_FIXTURE.endpointCount,
  contentRoutes: contentFixture.routeCount + checkoutContentFixture.routeCount,
  localizedAssets: contentFixture.assetCount + checkoutContentFixture.assetCount,
  evidenceReady: PHASE_2_SEO_EVIDENCE_READY,
}, null, 2))
