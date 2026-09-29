import { createHash } from 'node:crypto'
import { registerHooks } from 'node:module'
import fixture from '../src/lib/seo/fixtures/production-seo-2026-08-22.json' with { type: 'json' }
import postDelta from '../src/lib/seo/fixtures/production-post-delta-custom-puffy-stickers-guide-2026-08-21.json' with { type: 'json' }
import currentPostDelta from '../src/lib/seo/fixtures/production-post-delta-why-custom-stickers-feel-like-objects-2026-09-01.ts'
import currentSeoDelta from '../src/lib/seo/fixtures/production-seo-current-delta-2026-09-01.ts'
import currentSitemapIndexDelta from '../src/lib/seo/fixtures/production-sitemap-index-delta-2026-09-02.ts'
import shopCanonical from '../src/lib/seo/fixtures/production-shop-canonical-target-2026-08-21.json' with { type: 'json' }

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
  compatibilitySitemapIndexXml,
  localSitemapXml,
  locationsKml,
  sitemapGroupXml,
  sitemapIndexXml,
  toNextMetadata,
} = await import('../src/lib/seo/index.ts')
const {
  PRODUCTION_SEO_FIXTURE,
  productionEndpointEvidence,
} = await import('../src/lib/seo/production-evidence-fixture.ts')

const failures = []
const check = (condition, message) => { if (!condition) failures.push(message) }
const hash = (value) => createHash('sha256').update(value).digest('hex')
const stableValue = (value) => {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]))
  }
  return value
}
const stableJson = (value) => JSON.stringify(stableValue(value))
const same = (left, right) => stableJson(left) === stableJson(right)
const COMPATIBILITY_SITEMAP_REDIRECT_CAPTURE_DATE = '2026-08-31'

check(fixture.schemaVersion === 1, 'production fixture schema version changed')
check(fixture.source === 'production-crawl-2026-08-22', 'production fixture source changed')
check(fixture.routeCount === 123, `expected 123 captured production pages, found ${fixture.routeCount}`)
check(fixture.endpointCount === 9, `expected 9 captured production endpoints, found ${fixture.endpointCount}`)
check(Object.keys(fixture.pages).length === fixture.routeCount, 'fixture routeCount disagrees with page keys')
check(Object.keys(fixture.endpoints).length === fixture.endpointCount, 'fixture endpointCount disagrees with endpoint keys')

const expectedCurrentPagePaths = [
  '/blog/tag/dimensional-stickers',
  '/blog/tag/embossed-stickers',
  '/blog/tag/product-design',
  '/blog/tag/raised-stickers',
  '/blog/why-custom-stickers-feel-like-objects',
]
check(currentSeoDelta.schemaVersion === 1, 'current production delta schema version changed')
check(currentSeoDelta.source === 'production-crawl-2026-09-01', 'current production delta source changed')
check(currentSeoDelta.capturedOn === '2026-09-01', 'current production delta capture date changed')
check(currentSeoDelta.routeCount === 5, `expected 5 current-delta pages, found ${currentSeoDelta.routeCount}`)
check(currentSeoDelta.endpointCount === 1, `expected 1 current-delta endpoint, found ${currentSeoDelta.endpointCount}`)
check(same(Object.keys(currentSeoDelta.pages).sort(), expectedCurrentPagePaths), 'current production delta route set changed')
check(same(Object.keys(currentSeoDelta.endpoints), ['/post-sitemap.xml']), 'current production delta must override only the post sitemap')
check(Object.keys(currentSeoDelta.pages).every((path) => fixture.pages[path] === undefined), 'current production delta unexpectedly overlaps the historical page fixture')
check(PRODUCTION_SEO_FIXTURE.routeCount === 128, `expected 128 merged production pages, found ${PRODUCTION_SEO_FIXTURE.routeCount}`)
check(PRODUCTION_SEO_FIXTURE.endpointCount === 9, `expected 9 merged production endpoints, found ${PRODUCTION_SEO_FIXTURE.endpointCount}`)
check(Object.keys(PRODUCTION_SEO_FIXTURE.pages).length === PRODUCTION_SEO_FIXTURE.routeCount, 'merged routeCount disagrees with page keys')
check(Object.keys(PRODUCTION_SEO_FIXTURE.endpoints).length === PRODUCTION_SEO_FIXTURE.endpointCount, 'merged endpointCount disagrees with endpoint keys')

const productionRoutes = [
  ...PRIMARY_ROUTE_CONTRACTS.filter((route) => route.productionSignals.scope === 'production'),
  ...CANONICALIZING_ALIAS_CONTRACTS,
]
check(productionRoutes.length === PRODUCTION_SEO_FIXTURE.routeCount, 'contracted production pages disagree with merged fixture coverage')
check(PHASE_2_SEO_EVIDENCE_READY, 'Phase 2 SEO evidence gate still has uncaptured blockers')

for (const route of productionRoutes) {
  const page = PRODUCTION_SEO_FIXTURE.pages[route.path]
  check(Boolean(page), `${route.path}: missing page evidence`)
  if (!page) continue
  check(page.status === 200, `${route.path}: captured status is ${page.status}`)
  check(same(route.productionSignals.coreMetadata.value, page.coreMetadata), `${route.path}: core production signal drifted from fixture`)
  check(same(route.productionSignals.openGraph.value, page.openGraph), `${route.path}: Open Graph production signal drifted from fixture`)
  check(same(route.productionSignals.twitter.value, page.twitter), `${route.path}: Twitter production signal drifted from fixture`)
  check(same(route.metadata.openGraph.all, page.openGraph.all), `${route.path}: route Open Graph tag inventory drifted from fixture`)
  check(same(route.metadata.twitter.all, page.twitter.all), `${route.path}: route Twitter tag inventory drifted from fixture`)
  check(same(route.metadata.openGraph.tags, page.openGraph.tags), `${route.path}: DOM-ordered Open Graph tags drifted from fixture`)
  check(same(route.metadata.twitter.tags, page.twitter.tags), `${route.path}: DOM-ordered Twitter tags drifted from fixture`)
  check(same(route.structuredData, page.structuredData.normalizedGraphs), `${route.path}: route JSON-LD drifted from fixture`)
  check(same(route.expectedSchemaTypes, page.structuredData.types), `${route.path}: schema-type inventory drifted from fixture`)
  check(hash(page.content.meaningfulText) === page.content.meaningfulTextHash, `${route.path}: meaningful-text hash mismatch`)
  check(hash(stableJson(page.content.headings)) === page.content.headingsHash, `${route.path}: headings hash mismatch`)
  check(hash(stableJson(page.content.images)) === page.content.imagesHash, `${route.path}: image/alt hash mismatch`)
  check(hash(stableJson(page.content.internalLinkDetails)) === page.content.internalLinksHash, `${route.path}: internal-link hash mismatch`)
  check(page.structuredData.normalizedGraphs.every((graph, index) =>
    hash(stableJson(graph)) === page.structuredData.normalizedGraphHashes[index]), `${route.path}: normalized JSON-LD hash mismatch`)

  const nextMetadata = toNextMetadata(route)
  check(nextMetadata.openGraph?.title === page.openGraph.title, `${route.path}: Next OG title is not fixture-driven`)
  check(nextMetadata.openGraph?.url === page.openGraph.url, `${route.path}: Next OG URL is not fixture-driven`)
  check(nextMetadata.openGraph?.type === page.openGraph.type, `${route.path}: Next OG type is not fixture-driven`)
  check(nextMetadata.twitter?.card === page.twitter.card, `${route.path}: Next Twitter card is not fixture-driven`)
  check(nextMetadata.twitter?.title === page.twitter.title, `${route.path}: Next Twitter title is not fixture-driven`)
  check(same(
    nextMetadata.openGraph?.images?.map((image) => image.url) ?? [],
    page.openGraph.all['og:image'] ?? [],
  ), `${route.path}: Next OG images are not fixture-driven`)
  check(same(
    nextMetadata.openGraph?.images?.flatMap((image) => image.alt ? [image.alt] : []) ?? [],
    page.openGraph.all['og:image:alt'] ?? [],
  ), `${route.path}: Next OG image-alt omissions are not fixture-driven`)
  check(same(
    nextMetadata.twitter?.images?.map((image) => image.url) ?? [],
    page.twitter.all['twitter:image'] ?? [],
  ), `${route.path}: Next Twitter images are not fixture-driven`)
}

for (const [path, endpoint] of Object.entries(fixture.endpoints)) {
  check(endpoint.status === 200, `${path}: endpoint status is ${endpoint.status}`)
  check(hash(endpoint.body) === endpoint.normalizedBodyHash, `${path}: endpoint body hash mismatch`)
}

for (const [path, endpoint] of Object.entries(currentSeoDelta.endpoints)) {
  check(endpoint.status === 200, `${path}: current-delta endpoint status is ${endpoint.status}`)
  check(hash(endpoint.body) === endpoint.normalizedBodyHash, `${path}: current-delta endpoint body hash mismatch`)
}
check(currentSitemapIndexDelta.source === 'production-http-capture-2026-09-02', 'current sitemap-index evidence source changed')
check(currentSitemapIndexDelta.capturedOn === '2026-09-02', 'current sitemap-index capture date changed')
check(currentSitemapIndexDelta.endpoint.status === 200, 'current sitemap index is not 200')
check(hash(currentSitemapIndexDelta.endpoint.body) === currentSitemapIndexDelta.endpoint.normalizedBodyHash, 'current sitemap-index body hash mismatch')

const compatibilitySitemap = productionEndpointEvidence('/sitemap.xml')
const canonicalSitemapIndex = productionEndpointEvidence('/sitemap_index.xml')
const compatibilityRedirectChain = compatibilitySitemap.redirectChain ?? []
check(compatibilitySitemap.redirectChainSource === 'production-http-manual-hop-capture', 'compatibility sitemap redirect evidence source changed')
check(compatibilitySitemap.redirectChainCapturedOn === COMPATIBILITY_SITEMAP_REDIRECT_CAPTURE_DATE, 'compatibility sitemap redirect evidence capture date changed')
check(compatibilitySitemap.requestedUrl === 'https://puffsticker.com/sitemap.xml', 'compatibility sitemap request URL changed')
check(compatibilitySitemap.finalUrl === 'https://puffsticker.com/sitemap_index.xml', 'compatibility sitemap final URL changed')
check(compatibilityRedirectChain.length === 2, 'compatibility sitemap must retain its exact one-hop redirect evidence')
check(compatibilityRedirectChain[0]?.url === compatibilitySitemap.requestedUrl, 'compatibility sitemap redirect source changed')
check(compatibilityRedirectChain[0]?.status === 301, 'compatibility sitemap request is not the observed 301')
check(compatibilityRedirectChain[0]?.location === canonicalSitemapIndex.requestedUrl, 'compatibility sitemap redirect destination changed')
check(compatibilityRedirectChain[0]?.contentType === 'text/html; charset=UTF-8', 'compatibility sitemap redirect MIME type changed')
check(compatibilityRedirectChain[0]?.bodyLength === 0, 'compatibility sitemap redirect must have an empty body')
check(compatibilityRedirectChain[0]?.normalizedBodyHash === hash(''), 'compatibility sitemap redirect empty-body hash changed')
check(compatibilityRedirectChain[1]?.url === canonicalSitemapIndex.requestedUrl, 'compatibility sitemap terminal URL changed')
check(compatibilityRedirectChain[1]?.status === 200, 'compatibility sitemap redirect target is not 200')
check(compatibilityRedirectChain[1]?.location === null, 'compatibility sitemap redirect target unexpectedly redirects again')
check(compatibilityRedirectChain[1]?.contentType === canonicalSitemapIndex.contentType, 'compatibility sitemap target MIME type disagrees with the canonical index')
check(compatibilityRedirectChain[1]?.bodyLength === Buffer.byteLength(canonicalSitemapIndex.body), 'compatibility sitemap target body length disagrees with the canonical index')
check(compatibilityRedirectChain[1]?.normalizedBodyHash === canonicalSitemapIndex.normalizedBodyHash, 'compatibility sitemap target body hash disagrees with the canonical index')

check(PRODUCTION_ROBOTS_TXT === productionEndpointEvidence('/robots.txt').body, 'robots builder is not exact fixture body')
check(compatibilitySitemapIndexXml() === canonicalSitemapIndex.body, 'redirect-followed compatibility sitemap target is not the exact canonical index body')
check(sitemapIndexXml() === productionEndpointEvidence('/sitemap_index.xml').body, 'sitemap index is not exact current fixture body')
check(sitemapGroupXml('post') === productionEndpointEvidence('/post-sitemap.xml').body, 'post sitemap is not exact current fixture body')
check(sitemapGroupXml('page') === productionEndpointEvidence('/page-sitemap.xml').body, 'page sitemap is not exact fixture body')
check(sitemapGroupXml('product') === productionEndpointEvidence('/product-sitemap.xml').body, 'product sitemap is not exact fixture body')
check(sitemapGroupXml('product-category') === productionEndpointEvidence('/product_cat-sitemap.xml').body, 'product category sitemap is not exact fixture body')
check(localSitemapXml() === productionEndpointEvidence('/local-sitemap.xml').body, 'local sitemap is not exact fixture body')
check(locationsKml() === productionEndpointEvidence('/locations.kml').body, 'locations KML is not exact fixture body')

check(SITEMAP_ENTRIES.length === 44, `expected 44 sitemap rows, found ${SITEMAP_ENTRIES.length}`)
check(new Set(SITEMAP_ENTRIES.map((entry) => entry.path)).size === SITEMAP_ENTRIES.length, 'duplicate typed sitemap rows')
check(same(
  [...CANONICAL_SITEMAP_ROUTES.map((route) => route.path)].sort(),
  [...SITEMAP_ENTRIES.map((entry) => entry.path)].sort(),
), 'typed sitemap route set disagrees with canonical route set')
for (const entry of SITEMAP_ENTRIES) {
  check(entry.images.state === 'captured', `${entry.path}: sitemap image rows are not captured`)
}

check(postDelta.request.status === 200 && postDelta.request.total === '1', 'production-delta WP REST observation is incomplete')
check(postDelta.post.slug === 'custom-puffy-stickers-guide', 'production-delta WP REST slug changed')
check(hash(postDelta.post.content.rendered) === postDelta.fingerprints.renderedContentHash, 'production-delta rendered HTML hash mismatch')
check(hash(postDelta.post.excerpt.rendered) === postDelta.fingerprints.renderedExcerptHash, 'production-delta excerpt hash mismatch')
if (postDelta.post.yoastHead !== undefined) {
  check(hash(postDelta.post.yoastHead) === postDelta.fingerprints.yoastHeadHash, 'production-delta Yoast head hash mismatch')
} else {
  check(postDelta.unavailablePublicFields.includes('yoast_head'), 'absent public Yoast head is not recorded as unavailable')
}

check(currentPostDelta.request.status === 200 && currentPostDelta.request.total === '1', 'current production-delta WP REST observation is incomplete')
check(currentPostDelta.post.slug === 'why-custom-stickers-feel-like-objects', 'current production-delta WP REST slug changed')
check(hash(currentPostDelta.post.content.rendered) === currentPostDelta.fingerprints.renderedContentHash, 'current production-delta rendered HTML hash mismatch')
check(hash(currentPostDelta.post.excerpt.rendered) === currentPostDelta.fingerprints.renderedExcerptHash, 'current production-delta excerpt hash mismatch')
check(currentPostDelta.unavailablePublicFields.includes('yoast_head'), 'current production-delta absent Yoast head is not recorded as unavailable')

check(shopCanonical.requestedUrl === 'https://puffsticker.com/?page_id=9', 'shop canonical query target changed')
check(shopCanonical.redirectChain.length === 2, 'shop canonical redirect chain length changed')
check(shopCanonical.redirectChain[0]?.status === 301, 'shop canonical query target is not the observed 301')
check(shopCanonical.redirectChain[0]?.location === 'https://puffsticker.com/puffy-labels-stickers/puffy-stickers/', 'shop canonical redirect destination changed')
check(shopCanonical.redirectChain[1]?.status === 200, 'shop canonical redirect destination is not 200')
check(shopCanonical.finalObservation.canonical === 'https://puffsticker.com/puffy-labels-stickers/puffy-stickers/', 'shop canonical destination self-canonical changed')

if (failures.length) throw new Error(`Production SEO evidence validation failed:\n${failures.join('\n')}`)

console.log(JSON.stringify({
  productionPages: productionRoutes.length,
  canonicalSitemapRoutes: SITEMAP_ENTRIES.length,
  endpointBodies: Object.keys(PRODUCTION_SEO_FIXTURE.endpoints).length,
  sitemapImages: SITEMAP_ENTRIES.reduce((sum, entry) => sum + (entry.images.state === 'captured' ? entry.images.value.length : 0), 0),
  postBaselineDeltas: [postDelta.post.link, currentPostDelta.post.link],
  shopCanonicalRedirect: shopCanonical.redirectChain,
  evidenceReady: PHASE_2_SEO_EVIDENCE_READY,
}, null, 2))
