import { createHash } from 'node:crypto'
import { registerHooks } from 'node:module'
import fixture from '../src/lib/seo/fixtures/production-seo-2026-08-22.json' with { type: 'json' }
import postDelta from '../src/lib/seo/fixtures/production-post-delta-custom-puffy-stickers-guide-2026-08-21.json' with { type: 'json' }
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

check(fixture.schemaVersion === 1, 'production fixture schema version changed')
check(fixture.source === 'production-crawl-2026-08-22', 'production fixture source changed')
check(fixture.routeCount === 123, `expected 123 captured production pages, found ${fixture.routeCount}`)
check(fixture.endpointCount === 9, `expected 9 captured production endpoints, found ${fixture.endpointCount}`)
check(Object.keys(fixture.pages).length === fixture.routeCount, 'fixture routeCount disagrees with page keys')
check(Object.keys(fixture.endpoints).length === fixture.endpointCount, 'fixture endpointCount disagrees with endpoint keys')

const productionRoutes = [
  ...PRIMARY_ROUTE_CONTRACTS.filter((route) => route.productionSignals.scope === 'production'),
  ...CANONICALIZING_ALIAS_CONTRACTS,
]
check(productionRoutes.length === fixture.routeCount, 'contracted production pages disagree with fixture coverage')
check(PHASE_2_SEO_EVIDENCE_READY, 'Phase 2 SEO evidence gate still has uncaptured blockers')

for (const route of productionRoutes) {
  const page = fixture.pages[route.path]
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
check(PRODUCTION_ROBOTS_TXT === fixture.endpoints['/robots.txt'].body, 'robots builder is not exact fixture body')
check(compatibilitySitemapIndexXml() === fixture.endpoints['/sitemap.xml'].body, 'compatibility sitemap index is not exact fixture body')
check(sitemapIndexXml() === fixture.endpoints['/sitemap_index.xml'].body, 'sitemap index is not exact fixture body')
check(sitemapGroupXml('post') === fixture.endpoints['/post-sitemap.xml'].body, 'post sitemap is not exact fixture body')
check(sitemapGroupXml('page') === fixture.endpoints['/page-sitemap.xml'].body, 'page sitemap is not exact fixture body')
check(sitemapGroupXml('product') === fixture.endpoints['/product-sitemap.xml'].body, 'product sitemap is not exact fixture body')
check(sitemapGroupXml('product-category') === fixture.endpoints['/product_cat-sitemap.xml'].body, 'product category sitemap is not exact fixture body')
check(localSitemapXml() === fixture.endpoints['/local-sitemap.xml'].body, 'local sitemap is not exact fixture body')
check(locationsKml() === fixture.endpoints['/locations.kml'].body, 'locations KML is not exact fixture body')

check(SITEMAP_ENTRIES.length === 43, `expected 43 sitemap rows, found ${SITEMAP_ENTRIES.length}`)
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
  endpointBodies: Object.keys(fixture.endpoints).length,
  sitemapImages: SITEMAP_ENTRIES.reduce((sum, entry) => sum + (entry.images.state === 'captured' ? entry.images.value.length : 0), 0),
  postBaselineDelta: postDelta.post.link,
  shopCanonicalRedirect: shopCanonical.redirectChain,
  evidenceReady: PHASE_2_SEO_EVIDENCE_READY,
}, null, 2))
