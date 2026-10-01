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
const { CURRENT_PRODUCTION_ACTIVE_PATHS, LEGACY_PRESERVED_PATHS } = await import('../src/lib/seo/production-evidence-fixture.ts')

const failures = []
const check = (condition, message) => { if (!condition) failures.push(message) }
const duplicates = (values) => [...new Set(values.filter((value, index) => values.indexOf(value) !== index))]
const normalizedPath = (value) => {
  const pathname = new URL(value, SITE_ORIGIN).pathname
  return pathname === '/' ? '/' : `/${pathname.split('/').filter(Boolean).join('/')}`
}
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

check(PRIMARY_ROUTE_CONTRACTS.length === 77, `expected 77 primary routes, found ${PRIMARY_ROUTE_CONTRACTS.length}`)
check(CANONICAL_SITEMAP_ROUTES.length === 72, `expected 72 sitemap routes, found ${CANONICAL_SITEMAP_ROUTES.length}`)
check(CANONICALIZING_ALIAS_CONTRACTS.length === 79, `expected 79 canonicalizing aliases, found ${CANONICALIZING_ALIAS_CONTRACTS.length}`)
check(TRAILING_SLASH_REDIRECTS.length === 155, `expected 155 slash redirects, found ${TRAILING_SLASH_REDIRECTS.length}`)
check(duplicates(PRIMARY_ROUTE_CONTRACTS.map((route) => route.path)).length === 0, 'duplicate primary route paths')
check(duplicates(CANONICALIZING_ALIAS_CONTRACTS.map((route) => route.path)).length === 0, 'duplicate alias route paths')
check(duplicates(SITEMAP_ENTRIES.map((entry) => entry.path)).length === 0, 'duplicate sitemap paths')

const sitemapCounts = {
  post: SITEMAP_GROUPS.post.length,
  page: SITEMAP_GROUPS.page.length,
  product: SITEMAP_GROUPS.product.length,
  productCategory: SITEMAP_GROUPS['product-category'].length,
}
check(sitemapCounts.post === 25, `expected 25 post routes, found ${sitemapCounts.post}`)
check(sitemapCounts.page === 12, `expected 12 page routes, found ${sitemapCounts.page}`)
check(sitemapCounts.product === 31, `expected 31 product routes, found ${sitemapCounts.product}`)
check(sitemapCounts.productCategory === 4, `expected 4 product-category routes, found ${sitemapCounts.productCategory}`)

for (const route of PRIMARY_ROUTE_CONTRACTS) {
  check(route.status === 200, `${route.path}: primary status is not 200`)
  check(Boolean(route.metadata.title), `${route.path}: title missing`)
  check(Boolean(route.metadata.canonical), `${route.path}: canonical missing`)
  check(route.metadata.canonical.startsWith(SITE_ORIGIN), `${route.path}: canonical is not first-party`)
  check(route.indexable !== (route.metadata.robots ?? '').toLowerCase().includes('noindex'), `${route.path}: indexability and robots disagree`)
  check(route.inSitemap ? route.indexable : true, `${route.path}: noindex route entered sitemap`)
  const localOverride = route.path === '/resources' || route.path === '/shipping-delivery'
  check(route.evidence.crawl === (localOverride ? 'approved-target-override' : 'observed-live'), `${route.path}: crawl provenance is incorrect`)
  check(route.evidence.liveStatus === (localOverride ? 404 : 200), `${route.path}: live status provenance is incorrect`)
  check(route.evidence.targetStatus === 200, `${route.path}: target status provenance is incorrect`)
  check(route.evidence.sitemap === (route.inSitemap ? 'listed-live' : 'confirmed-off-sitemap'), `${route.path}: sitemap provenance disagrees`)
  check(route.evidence.searchConsole === 'not-provided', `${route.path}: Search Console availability is misstated`)
  check(route.evidence.backlinks === 'not-provided', `${route.path}: backlink availability is misstated`)
  check(route.evidence.accessLogs === 'not-provided', `${route.path}: access-log availability is misstated`)
  check(resolveSeoRoute(route.publicPath).disposition === 'page', `${route.path}: public path does not resolve as a page`)
  if (route.productionSignals.scope === 'production') {
    const actualTypes = schemaTypes(route.structuredData)
    for (const expected of route.expectedSchemaTypes) check(actualTypes.has(expected), `${route.path}: schema type ${expected} missing`)
  }
}

for (const route of CANONICALIZING_ALIAS_CONTRACTS) {
  check(route.status === 200 && route.indexable, `${route.path}: alias must remain 200/index`)
  check(!route.inSitemap, `${route.path}: alias entered the sitemap`)
  check(route.path !== route.renderPath, `${route.path}: alias does not render canonical content`)
  check(normalizedPath(route.metadata.canonical) === route.renderPath, `${route.path}: alias canonical differs from render target`)
  check(route.evidence.crawl === 'observed-live' && route.evidence.sitemap === 'confirmed-off-sitemap', `${route.path}: alias evidence provenance changed`)
  check(route.evidence.liveStatus === 200 && route.evidence.targetStatus === 200, `${route.path}: preserved alias target contract changed`)
}

for (const redirect of TRAILING_SLASH_REDIRECTS) {
  const resolved = resolveSeoRequest(redirect.path)
  check(resolved.disposition === 'redirect', `${redirect.path}: slashless request does not redirect`)
  check(resolved.disposition !== 'redirect' || resolved.status === 301, `${redirect.path}: slash redirect is not 301`)
  check(resolved.disposition !== 'redirect' || resolved.destination === `${redirect.path}/`, `${redirect.path}: slash redirect is not one hop`)
  const localOverride = redirect.path === '/resources' || redirect.path === '/shipping-delivery'
  check(redirect.evidence.crawl === (localOverride ? 'approved-target-override' : 'derived-from-observed-policy'), `${redirect.path}: slash redirect provenance is incorrect`)
  check(redirect.evidence.liveStatus === (localOverride ? 404 : 'not-individually-verified'), `${redirect.path}: slash redirect live status is incorrect`)
  check(redirect.evidence.targetStatus === 301, `${redirect.path}: slash redirect target status is incorrect`)
}

for (const path of EXPLICIT_NOT_FOUND_PATHS) {
  const route = resolveSeoRoute(path)
  check(route.disposition === 'not-found' && route.status === 404, `${path}: explicit production 404 unexpectedly resolves`)
  check(route.evidence.liveStatus === 404 && route.evidence.targetStatus === 404, `${path}: explicit 404 provenance changed`)
}
check(EXPLICIT_NOT_FOUND_CONTRACTS.length === 8, `expected 8 explicit 404 contracts, found ${EXPLICIT_NOT_FOUND_CONTRACTS.length}`)
for (const path of ['/random/puffy-stickers/', '/arbitrary/custom-stickers/', '/product/not-a-product/', '/blog/tag/not-a-tag/', '/cbd-packaging-boxes/not-a-box/']) {
  const route = resolveSeoRoute(path)
  check(route.disposition === 'not-found' && route.status === 404, `${path}: unknown wildcard route unexpectedly resolves`)
}

const shop = resolveSeoRoute('/shop/')
check(shop.disposition === 'page', '/shop: missing')
if (shop.disposition === 'page') {
  check(shop.status === 200 && shop.indexable, '/shop: must preserve current 200/index')
  check(shop.metadata.title === 'All Products | Custom Stickers, Labels, Bags and Boxes | Puff Sticker', '/shop: current title changed')
  check(shop.metadata.description === 'Every product PuffSticker makes: puffy and raised stickers, flat labels and stickers, promotional bags and CBD packaging boxes. Made to order from 250 pieces with a free digital proof.', '/shop: current description changed')
  check(shop.metadata.canonical === 'https://puffsticker.com/shop/', '/shop: current self-canonical changed')
  check(shop.inSitemap, '/shop: missing from current sitemap')
}

for (const path of ['/cbd-packaging-boxes/', '/industries/', '/payment-terms/', '/shipping-policy/']) {
  const route = resolveSeoRoute(path)
  check(route.disposition === 'page' && route.status === 200, `${path}: current production route missing`)
  if (route.disposition === 'page') check(route.inSitemap && route.evidence.capturedOn === '2026-09-30', `${path}: current sitemap/evidence provenance missing`)
}
const checkout = resolveSeoRoute('/checkout/')
check(checkout.disposition === 'page', '/checkout: missing')
if (checkout.disposition === 'page') {
  check(checkout.status === 200 && !checkout.indexable && !checkout.inSitemap, '/checkout: must preserve current 200/noindex/off-sitemap behavior')
  check(checkout.metadata.title === 'Checkout | Puff Sticker', '/checkout: current title changed')
  check(checkout.metadata.canonical === 'https://puffsticker.com/checkout/', '/checkout: current self-canonical changed')
  check(checkout.metadata.robots === 'noindex', '/checkout: current robots directive changed')
  check(checkout.evidence.capturedOn === '2026-10-01', '/checkout: supplemental evidence provenance changed')
}
for (const path of ['/resources/', '/shipping-delivery/']) {
  const route = resolveSeoRoute(path)
  check(route.disposition === 'page' && route.status === 200 && !route.indexable && !route.inSitemap, `${path}: approved local 200/noindex contract changed`)
}

const legacyArchives = PRIMARY_ROUTE_CONTRACTS.filter((route) => route.contentParity === 'legacy-static-required')
check(legacyArchives.length === 0, `unmigrated production content remains: ${legacyArchives.map((route) => route.path).join(', ')}`)
check(CURRENT_PRODUCTION_ACTIVE_PATHS.every((path) => resolveSeoRoute(path).disposition === 'page'), 'a current 200 production route is not implemented')
check(LEGACY_PRESERVED_PATHS.every((path) => resolveSeoRoute(path).disposition === 'page'), 'a frozen legacy route is not preserved')

for (const entry of SITEMAP_ENTRIES) {
  check(entry.lastModified === undefined, `${entry.path}: current flat sitemap unexpectedly has lastmod`)
  const route = resolveSeoRoute(entry.path)
  check(route.disposition === 'page' && route.inSitemap, `${entry.path}: sitemap entry has no canonical route`)
}

for (const failure of validateSeoManifest()) failures.push(failure)
if (failures.length) throw new Error(`SEO contract validation failed:\n${failures.join('\n')}`)

console.log(JSON.stringify({
  primaryRoutes: PRIMARY_ROUTE_CONTRACTS.length,
  indexablePrimaryRoutes: PRIMARY_ROUTE_CONTRACTS.filter((route) => route.indexable).length,
  canonicalSitemapRoutes: CANONICAL_SITEMAP_ROUTES.length,
  canonicalizingAliases: CANONICALIZING_ALIAS_CONTRACTS.length,
  preservedLegacyRoutes: LEGACY_PRESERVED_PATHS.length,
  slashRedirects: TRAILING_SLASH_REDIRECTS.length,
  explicitNegativeRoutes: EXPLICIT_NOT_FOUND_PATHS.length + 5,
  sitemapCounts,
}, null, 2))
