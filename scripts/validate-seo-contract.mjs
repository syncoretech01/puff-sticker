import { registerHooks } from 'node:module'

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
  EXPLICIT_NOT_FOUND_CONTRACTS,
  EXPLICIT_NOT_FOUND_PATHS,
  PRIMARY_ROUTE_CONTRACTS,
  SITEMAP_ENTRIES,
  SITEMAP_GROUPS,
  SITE_ORIGIN,
  TRAILING_SLASH_REDIRECTS,
  resolveSeoRequest,
  resolveSeoRoute,
  validateSeoManifest,
} = await import('../src/lib/seo/index.ts')

const failures = []
const check = (condition, message) => {
  if (!condition) failures.push(message)
}

const duplicates = (values) => [...new Set(values.filter((value, index) => values.indexOf(value) !== index))]
const schemaTypes = (value) => {
  const types = new Set()
  const visit = (item) => {
    if (!item || typeof item !== 'object') return
    if (Array.isArray(item)) return item.forEach(visit)
    const type = item['@type']
    if (typeof type === 'string') types.add(type)
    else if (Array.isArray(type)) type.forEach((entry) => typeof entry === 'string' && types.add(entry))
    Object.values(item).forEach(visit)
  }
  visit(value)
  return types
}

check(PRIMARY_ROUTE_CONTRACTS.length === 96, `expected 96 primary routes, found ${PRIMARY_ROUTE_CONTRACTS.length}`)
check(CANONICAL_SITEMAP_ROUTES.length === 44, `expected 44 HTML sitemap routes, found ${CANONICAL_SITEMAP_ROUTES.length}`)
check(CANONICALIZING_ALIAS_CONTRACTS.length === 34, `expected 34 explicit canonicalizing aliases, found ${CANONICALIZING_ALIAS_CONTRACTS.length}`)
check(duplicates(PRIMARY_ROUTE_CONTRACTS.map((route) => route.path)).length === 0, 'duplicate primary route paths')
check(duplicates(CANONICALIZING_ALIAS_CONTRACTS.map((route) => route.path)).length === 0, 'duplicate alias route paths')
check(duplicates(SITEMAP_ENTRIES.map((entry) => entry.path)).length === 0, 'duplicate sitemap paths')

const sitemapCounts = {
  post: SITEMAP_GROUPS.post.length,
  page: SITEMAP_GROUPS.page.length,
  product: SITEMAP_GROUPS.product.length,
  productCategory: SITEMAP_GROUPS['product-category'].length,
}
check(sitemapCounts.post === 12, `expected 12 post sitemap routes, found ${sitemapCounts.post}`)
check(sitemapCounts.page === 8, `expected 8 page sitemap routes, found ${sitemapCounts.page}`)
check(sitemapCounts.product === 21, `expected 21 product sitemap routes, found ${sitemapCounts.product}`)
check(sitemapCounts.productCategory === 3, `expected 3 product-category sitemap routes, found ${sitemapCounts.productCategory}`)

for (const route of PRIMARY_ROUTE_CONTRACTS) {
  check(route.status === 200, `${route.path}: primary status is not 200`)
  check(Boolean(route.metadata.title), `${route.path}: title missing`)
  check(Boolean(route.metadata.canonical), `${route.path}: canonical missing`)
  check(route.metadata.canonical.startsWith(SITE_ORIGIN), `${route.path}: canonical is not first-party`)
  check(route.indexable !== route.metadata.robots.toLowerCase().includes('noindex'), `${route.path}: indexability and robots disagree`)
  check(route.inSitemap ? route.indexable : true, `${route.path}: noindex route entered sitemap`)
  const approvedTargetOverride = route.path === '/resources' || route.path === '/shipping-delivery'
  check(
    route.evidence.crawl === (approvedTargetOverride ? 'approved-target-override' : 'observed-live'),
    `${route.path}: primary route crawl provenance is incorrect`,
  )
  check(
    route.evidence.liveStatus === (approvedTargetOverride ? 404 : 200),
    `${route.path}: live status provenance is incorrect`,
  )
  check(route.evidence.targetStatus === 200, `${route.path}: target status provenance is incorrect`)
  check(route.evidence.sitemap === (route.inSitemap ? 'listed-live' : 'confirmed-off-sitemap'), `${route.path}: sitemap provenance disagrees`)
  check(route.evidence.searchConsole === 'not-provided', `${route.path}: Search Console availability is misstated`)
  check(route.evidence.backlinks === 'not-provided', `${route.path}: backlink-data availability is misstated`)
  check(route.evidence.accessLogs === 'not-provided', `${route.path}: access-log availability is misstated`)
  check(resolveSeoRoute(route.publicPath).disposition === 'page', `${route.path}: public path does not resolve as a page`)
  if (route.productionSignals.scope === 'production') {
    const actualTypes = schemaTypes(route.structuredData)
    for (const expected of route.expectedSchemaTypes) {
      check(actualTypes.has(expected), `${route.path}: migrated schema type ${expected} missing`)
    }
  }
}

for (const route of CANONICALIZING_ALIAS_CONTRACTS) {
  check(route.status === 200 && route.indexable, `${route.path}: live alias must remain 200/index`)
  check(!route.inSitemap, `${route.path}: alias must remain off sitemap`)
  check(route.path !== route.renderPath, `${route.path}: alias render target is not canonical content`)
  check(route.metadata.canonical.includes(route.renderPath), `${route.path}: alias canonical does not target render path`)
  check(route.evidence.crawl === 'observed-live' && route.evidence.sitemap === 'confirmed-off-sitemap', `${route.path}: alias evidence provenance changed`)
  check(route.evidence.liveStatus === 200 && route.evidence.targetStatus === 200, `${route.path}: alias status provenance changed`)
}

for (const redirect of TRAILING_SLASH_REDIRECTS) {
  const resolved = resolveSeoRequest(redirect.path)
  check(resolved.disposition === 'redirect', `${redirect.path}: slashless request does not redirect`)
  check(resolved.disposition !== 'redirect' || resolved.status === 301, `${redirect.path}: slash redirect is not 301`)
  check(resolved.disposition !== 'redirect' || resolved.destination === `${redirect.path}/`, `${redirect.path}: slash redirect is not one hop`)
  const approvedTargetOverride = redirect.path === '/resources' || redirect.path === '/shipping-delivery'
  check(
    redirect.evidence.crawl === (approvedTargetOverride ? 'approved-target-override' : 'derived-from-observed-policy'),
    `${redirect.path}: slash redirect provenance is incorrect`,
  )
  check(
    redirect.evidence.liveStatus === (approvedTargetOverride ? 404 : 'not-individually-verified'),
    `${redirect.path}: slash redirect live status provenance is incorrect`,
  )
  check(redirect.evidence.targetStatus === 301, `${redirect.path}: slash redirect target status provenance is incorrect`)
}

for (const path of EXPLICIT_NOT_FOUND_PATHS) {
  const route = resolveSeoRoute(path)
  check(route.disposition === 'not-found' && route.status === 404, `${path}: production 404 alias unexpectedly resolves`)
  check(route.evidence.liveStatus === 404 && route.evidence.targetStatus === 404, `${path}: explicit 404 status provenance changed`)
}
check(EXPLICIT_NOT_FOUND_CONTRACTS.length === EXPLICIT_NOT_FOUND_PATHS.length, 'explicit 404 contract coverage mismatch')

for (const path of ['/random/puffy-stickers/', '/arbitrary/custom-stickers/', '/product/not-a-product/', '/blog/tag/not-a-tag/']) {
  const route = resolveSeoRoute(path)
  check(route.disposition === 'not-found' && route.status === 404, `${path}: unknown wildcard-like route unexpectedly resolves`)
}

const shop = resolveSeoRoute('/shop/')
check(shop.disposition === 'page', '/shop: missing')
if (shop.disposition === 'page') {
  check(shop.status === 200 && shop.indexable, '/shop: must preserve 200/index')
  check(shop.metadata.title === 'Shop - puffsticker.com', '/shop: production title changed')
  check(shop.metadata.description === 'Products Archive - puffsticker.com', '/shop: production description changed')
  check(shop.metadata.canonical === 'https://puffsticker.com/?page_id=9', '/shop: production canonical changed')
  check(!shop.inSitemap, '/shop: must remain off sitemap')
  check(shop.canonicalTargetEvidence?.redirectChain.length === 2, '/shop: canonical target redirect chain fixture missing')
  check(shop.canonicalTargetEvidence?.redirectChain[0]?.status === 301, '/shop: canonical query target must preserve observed 301')
  check(shop.canonicalTargetEvidence?.finalUrl === 'https://puffsticker.com/puffy-labels-stickers/puffy-stickers/', '/shop: canonical query target destination changed')
}

for (const path of ['/resources/', '/shipping-delivery/']) {
  const route = resolveSeoRoute(path)
  check(route.disposition === 'page', `${path}: missing`)
  if (route.disposition === 'page') {
    check(route.status === 200 && !route.indexable, `${path}: must be 200/noindex`)
    check(!route.inSitemap, `${path}: must remain off sitemap`)
  }
}

const legacyArchives = PRIMARY_ROUTE_CONTRACTS.filter((route) => route.contentParity === 'legacy-static-required')
check(legacyArchives.length === 0, `all audited production routes must render complete migrated content; unresolved routes: ${legacyArchives.map((route) => route.path).join(', ')}`)

for (const expectedDelta of [
  { path: '/blog/custom-puffy-stickers-guide', capturedOn: '2026-08-22' },
  { path: '/blog/why-custom-stickers-feel-like-objects', capturedOn: '2026-09-01' },
]) {
  const productionDelta = PRIMARY_ROUTE_CONTRACTS.find((route) => route.path === expectedDelta.path)
  check(Boolean(productionDelta), `${expectedDelta.path}: post-baseline production article is missing`)
  if (!productionDelta) continue
  check(productionDelta.contentParity === 'migrated', `${expectedDelta.path}: article must render its complete audited production content`)
  check(productionDelta.inSitemap, `${expectedDelta.path}: article is missing from the live sitemap contract`)
  check(productionDelta.evidence.capturedOn === expectedDelta.capturedOn, `${expectedDelta.path}: evidence date is incorrect`)
}

check(TRAILING_SLASH_REDIRECTS.length === 129, `expected 129 slash redirects, found ${TRAILING_SLASH_REDIRECTS.length}`)

for (const entry of SITEMAP_ENTRIES) {
  check(!Number.isNaN(Date.parse(entry.lastModified)), `${entry.path}: invalid last-modified timestamp`)
  const route = resolveSeoRoute(entry.path)
  check(route.disposition === 'page' && route.inSitemap, `${entry.path}: sitemap entry has no matching route contract`)
}

for (const failure of validateSeoManifest()) failures.push(failure)

if (failures.length) {
  throw new Error(`SEO contract validation failed:\n${failures.join('\n')}`)
}

console.log(JSON.stringify({
  primaryRoutes: PRIMARY_ROUTE_CONTRACTS.length,
  indexablePrimaryRoutes: PRIMARY_ROUTE_CONTRACTS.filter((route) => route.indexable).length,
  canonicalSitemapRoutes: CANONICAL_SITEMAP_ROUTES.length,
  canonicalizingAliases: CANONICALIZING_ALIAS_CONTRACTS.length,
  slashRedirects: TRAILING_SLASH_REDIRECTS.length,
  explicitNegativeRoutes: EXPLICIT_NOT_FOUND_PATHS.length + 4,
  legacyArchives,
  sitemapCounts,
}, (_key, value) => Array.isArray(value) && value[0]?.disposition === 'page' ? value.length : value, 2))
