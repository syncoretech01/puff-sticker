import { catalogProducts } from '../../content/catalog'
import { liveSeo } from '../../content/liveSeo'
import {
  capturedSignal,
  notApplicable,
  type ExactCoreMetadata,
  type PageProductionSignals,
} from './evidence'
import { productionPageEvidence } from './production-evidence-fixture'
import { SHOP_CANONICAL_TARGET_EVIDENCE, type ShopCanonicalTargetEvidence } from './shop-canonical-evidence'

export const SITE_ORIGIN = 'https://puffsticker.com' as const

const INDEX_ROBOTS = 'follow, index, max-snippet:-1, max-video-preview:-1, max-image-preview:large'
const TAXONOMY_ROBOTS = 'index, follow, max-snippet:-1, max-video-preview:-1, max-image-preview:large'
const NOINDEX_ROBOTS = 'noindex, follow'

const EXTERNAL_EVIDENCE_UNAVAILABLE = {
  searchConsole: 'not-provided',
  backlinks: 'not-provided',
  accessLogs: 'not-provided',
  capturedOn: '2026-08-14',
} as const

function observedPageEvidence(
  inSitemap: boolean,
  capturedOn: EvidenceProvenance['capturedOn'] = '2026-08-14',
): EvidenceProvenance {
  return {
    crawl: 'observed-live',
    sitemap: inSitemap ? 'listed-live' : 'confirmed-off-sitemap',
    liveStatus: 200,
    targetStatus: 200,
    ...EXTERNAL_EVIDENCE_UNAVAILABLE,
    capturedOn,
  }
}

function approvedLocalPageEvidence(): EvidenceProvenance {
  return {
    crawl: 'approved-target-override',
    sitemap: 'confirmed-off-sitemap',
    liveStatus: 404,
    targetStatus: 200,
    ...EXTERNAL_EVIDENCE_UNAVAILABLE,
  }
}

function productionSignals(path: string): PageProductionSignals {
  const page = productionPageEvidence(path)
  return {
    scope: 'production',
    coreMetadata: capturedSignal(page.coreMetadata, 'production-crawl-2026-08-22', '2026-08-22'),
    openGraph: capturedSignal(page.openGraph, 'production-crawl-2026-08-22', '2026-08-22'),
    twitter: capturedSignal(page.twitter, 'production-crawl-2026-08-22', '2026-08-22'),
    structuredData: capturedSignal(page.structuredData, 'production-crawl-2026-08-22', '2026-08-22'),
    content: capturedSignal(page.content, 'production-crawl-2026-08-22', '2026-08-22'),
  }
}

function approvedTargetSignals(
  coreMetadata: ExactCoreMetadata,
  openGraph: {
    title: string
    description: string
    url: string
    image: null
    imageAlt: null
    type: 'website'
  },
): PageProductionSignals {
  return {
    scope: 'approved-target',
    coreMetadata: capturedSignal(coreMetadata, 'approved-target-contract', '2026-08-14'),
    openGraph: capturedSignal(openGraph, 'approved-target-contract', '2026-08-14'),
    twitter: capturedSignal({
      card: 'summary',
      title: openGraph.title,
      description: openGraph.description,
      image: null,
      imageAlt: null,
      site: null,
      creator: null,
    }, 'approved-target-contract', '2026-08-14'),
    structuredData: notApplicable('The approved noindex target does not require production structured-data parity.'),
    content: notApplicable('The approved noindex target has no production page because both live URL forms returned 404.'),
  }
}

function pageAudit(
  structuredDataEvidence: StructuredDataEvidence,
  minimumMeaningfulWordCount = 25,
): SeoAuditExpectations {
  return {
    minimumH1Count: 1,
    minimumMeaningfulWordCount,
    requireAltOnContentImages: true,
    requireResolvableInternalLinks: true,
    structuredDataEvidence,
  }
}

export type PrimaryRouteKind =
  | 'home'
  | 'page'
  | 'blog-index'
  | 'blog-article'
  | 'product-category'
  | 'product'
  | 'blog-category'
  | 'blog-tag'
  | 'product-tag'
  | 'pagination'
  | 'local-page'

export type ContentParity = 'migrated' | 'legacy-static-required'

export type CrawlEvidence =
  | 'observed-live'
  | 'derived-from-observed-policy'
  | 'synthetic-negative'
  | 'approved-target-override'
export type SitemapEvidence = 'listed-live' | 'confirmed-off-sitemap' | 'not-applicable'
export type ExternalEvidenceAvailability = 'not-provided'
export type EvidenceHttpStatus = 200 | 301 | 404 | 'not-individually-verified'

/**
 * Records which evidence channels were actually available for the baseline.
 * Search Console, backlink exports and access logs were not supplied for this
 * phase, so the contract never implies coverage from those sources.
 */
export type EvidenceProvenance = {
  crawl: CrawlEvidence
  sitemap: SitemapEvidence
  liveStatus: EvidenceHttpStatus
  targetStatus: 200 | 301 | 404
  searchConsole: ExternalEvidenceAvailability
  backlinks: ExternalEvidenceAvailability
  accessLogs: ExternalEvidenceAvailability
  capturedOn: '2026-08-14' | '2026-08-22'
}

export type StructuredDataEvidence =
  | 'not-captured-production-fixture'
  | 'observed-production-types-exact-graph-pending'
  | 'captured-production-fixture'
  | 'not-applicable'

export type SeoAuditExpectations = {
  minimumH1Count: 1
  minimumMeaningfulWordCount: number
  requireAltOnContentImages: true
  requireResolvableInternalLinks: true
  structuredDataEvidence: StructuredDataEvidence
}

export type SeoMetadataContract = {
  title: string
  description: string | null
  canonical: string
  robots: string
  openGraph: {
    title: string | null
    description: string | null
    url: string | null
    image: string | null
    imageAlt: string | null
    type: 'website' | 'article' | 'product' | null
    all?: Readonly<Record<string, readonly string[]>>
    tags?: readonly { key: string; content: string }[]
  }
  twitter: {
    card: 'summary' | 'summary_large_image' | null
    title: string | null
    description: string | null
    image: string | null
    imageAlt: string | null
    site: string | null
    creator: string | null
    all?: Readonly<Record<string, readonly string[]>>
    tags?: readonly { key: string; content: string }[]
  }
}

export type PageRouteContract = {
  disposition: 'page'
  path: string
  publicPath: string
  status: 200
  kind: PrimaryRouteKind
  renderPath: string
  canonicalPath: string
  indexable: boolean
  inSitemap: boolean
  contentParity: ContentParity
  metadata: SeoMetadataContract
  structuredData: readonly Record<string, unknown>[]
  expectedSchemaTypes: readonly string[]
  audit: SeoAuditExpectations
  evidence: EvidenceProvenance
  productionSignals: PageProductionSignals
  canonicalTargetEvidence?: ShopCanonicalTargetEvidence
}

export type RedirectRouteContract = {
  disposition: 'redirect'
  path: string
  status: 301
  destination: string
  evidence: EvidenceProvenance
}

export type NotFoundRouteContract = {
  disposition: 'not-found'
  path: string
  status: 404
  indexable: false
  robots: 'noindex, follow'
  evidence: EvidenceProvenance
}

export type SeoRequestContract = PageRouteContract | RedirectRouteContract | NotFoundRouteContract

type ArchiveDefinition = {
  path: string
  title: string
  description?: string
  kind: 'blog-tag' | 'product-tag' | 'pagination'
  expectedSchemaTypes: readonly string[]
}

const LIVE_SITEMAP_PATHS = new Set([
  '/',
  '/about-us',
  '/blog',
  '/blog/custom-puffy-stickers-guide',
  '/contact-us',
  '/faqs',
  '/privacy-policy',
  '/reprint-policy',
  '/request-a-quote',
  '/terms-of-service',
  '/puffy-labels-stickers',
  '/flat-labels-stickers',
  '/promotional-items',
  '/puffy-labels-stickers/puffy-stickers',
  '/puffy-labels-stickers/puffy-sticker-sheets',
  '/puffy-labels-stickers/3d-labels',
  '/puffy-labels-stickers/dome-decals',
  '/puffy-labels-stickers/epoxy-stickers',
  '/puffy-labels-stickers/foam-stickers',
  '/puffy-labels-stickers/pu-embossed-stickers',
  '/flat-labels-stickers/custom-stickers',
  '/flat-labels-stickers/clear-vinyl-labels',
  '/flat-labels-stickers/bottle-labels',
  '/flat-labels-stickers/holographic-stickers',
  '/flat-labels-stickers/metallic-foil-stickers',
  '/flat-labels-stickers/bumper-stickers',
  '/flat-labels-stickers/cheap-stickers',
  '/promotional-items/eco-friendly-kraft-mylar-bags',
  '/promotional-items/jute-bag',
  '/promotional-items/non-woven-bag',
  '/promotional-items/nylon-bag',
  '/promotional-items/paper-bag',
  '/promotional-items/washable-paper-bags',
  '/promotional-items/woven-bags',
  '/blog/when-3d-stickers-become-collectibles',
  '/blog/why-sticker-books-never-really-disappeared',
  '/blog/why-we-save-stickers-we-never-use',
  '/blog/matte-vs-gloss-psychology',
  '/blog/soft-depth-vs-smooth-depth',
  '/blog/why-foil-stickers-feel-valuable',
  '/blog/holographic-stickers-color-perception',
  '/blog/sound-of-packaging-mylar-bags',
  '/blog/custom-jute-tote-bags-the-perfect-blend-of-sustainability',
])

const BLOG_TAG_TITLES = {
  '3d-holographic': '3D holographic',
  'childhood-keepsakes': 'childhood keepsakes',
  'collectible-stickers': 'collectible stickers',
  'collecting-psychology': 'collecting psychology',
  'custom-epoxy-stickers': 'custom epoxy stickers',
  'custom-foil-stickers': 'custom foil stickers',
  'custom-jute-tote-bags': 'custom jute tote bags',
  'custom-mylar-bag': 'custom mylar bag',
  'custom-puffy-sheets': 'custom puffy sheets',
  'custom-puffy-stickers': 'custom puffy stickers',
  'foil-stickers-printing': 'foil stickers printing',
  'foil-stickers': 'Foil Stickers',
  'holographic-materials': 'holographic materials',
  journaling: 'journaling',
  'matte-vs-gloss': 'Matte vs Gloss',
  'memory-and-collecting': 'memory and collecting',
  'mylar-bag': 'mylar bag',
  'mylar-packaging': 'mylar packaging',
  'mylar-pouch': 'mylar pouch',
  nostalgia: 'nostalgia',
  'packaging-psychology': 'Packaging Psychology',
  'personal-archives': 'personal archives',
  'puffy-sheets': 'puffy sheets',
  'soft-touch-mylar': 'soft touch mylar',
  'soft-touch-packaging': 'Soft Touch Packaging',
  'sticker-books': 'sticker books',
  'sticker-nostalgia': 'sticker nostalgia',
  'sticker-psychology': 'Sticker Psychology',
  'stickers-psychology': 'stickers psychology',
  'texture-psychology': 'Texture Psychology',
  'tote-bags': 'tote bags',
  'vintage-sticker-collecting': 'vintage sticker collecting',
  'why-we-keep-stickers': 'why we keep stickers',
} as const

const BLOG_ARCHIVE_SCHEMA = [
  'BreadcrumbList',
  'CollectionPage',
  'ImageObject',
  'ListItem',
  'Organization',
  'WebSite',
] as const

const PRODUCT_TAG_SCHEMA = [
  'BreadcrumbList',
  'CollectionPage',
  'ListItem',
  'Organization',
  'WebSite',
] as const

const ARCHIVE_DEFINITIONS: readonly ArchiveDefinition[] = [
  {
    path: '/blog/page/2',
    title: 'Blogs & News Articles | Trends, Tips & Custom Puffy Stickers',
    description: 'Read the PuffSticker blog for the latest trends, creative uses, and expert tips on custom puffy stickers, labels, and promotional items solutions.',
    kind: 'pagination',
    expectedSchemaTypes: BLOG_ARCHIVE_SCHEMA,
  },
  ...Object.entries(BLOG_TAG_TITLES).map(([slug, label]) => ({
    path: `/blog/tag/${slug}`,
    title: `${label} Archives - puffsticker.com`,
    kind: 'blog-tag' as const,
    expectedSchemaTypes: BLOG_ARCHIVE_SCHEMA,
  })),
  {
    path: '/product-tag/embossed-stickers',
    title: 'embossed stickers Archives - puffsticker.com',
    kind: 'product-tag',
    expectedSchemaTypes: PRODUCT_TAG_SCHEMA,
  },
  {
    path: '/product-tag/pu-labels',
    title: 'pu labels Archives - puffsticker.com',
    kind: 'product-tag',
    expectedSchemaTypes: PRODUCT_TAG_SCHEMA,
  },
]

const BLOG_ARTICLE_SLUGS = new Set([
  'custom-puffy-stickers-guide',
  'when-3d-stickers-become-collectibles',
  'why-sticker-books-never-really-disappeared',
  'why-we-save-stickers-we-never-use',
  'matte-vs-gloss-psychology',
  'soft-depth-vs-smooth-depth',
  'why-foil-stickers-feel-valuable',
  'holographic-stickers-color-perception',
  'sound-of-packaging-mylar-bags',
  'custom-puffy-stickers-became-the-new-therapy',
  'custom-jute-tote-bags-the-perfect-blend-of-sustainability',
  'puffy-stickers-are-trending-2025',
])

const PRODUCT_PATHS = new Map(
  catalogProducts.map((product) => [
    `/${product.category}/${product.slug}`,
    { slug: product.slug, category: product.category },
  ]),
)

function normalizePath(value: string): string {
  const pathname = value.split(/[?#]/, 1)[0] || '/'
  const segments = pathname.split('/').filter(Boolean)
  return segments.length ? `/${segments.join('/')}` : '/'
}

function publicPath(path: string): string {
  return path === '/' ? '/' : `${path}/`
}

function canonicalPath(value: string): string {
  return normalizePath(new URL(value, SITE_ORIGIN).pathname)
}

function routeKind(path: string): PrimaryRouteKind {
  if (path === '/') return 'home'
  if (path === '/blog') return 'blog-index'
  if (path === '/puffy-labels-stickers' || path === '/flat-labels-stickers' || path === '/promotional-items') return 'product-category'
  if (PRODUCT_PATHS.has(path)) return 'product'
  if (path.startsWith('/blog/category/')) return 'blog-category'
  if (path.startsWith('/blog/') && BLOG_ARTICLE_SLUGS.has(path.split('/')[2] ?? '')) return 'blog-article'
  return 'page'
}

function capturedRouteMetadata(path: string): SeoMetadataContract {
  const page = productionPageEvidence(path)
  return {
    ...page.coreMetadata,
    openGraph: {
      title: page.openGraph.title,
      description: page.openGraph.description,
      url: page.openGraph.url,
      image: page.openGraph.image,
      imageAlt: page.openGraph.imageAlt,
      type: page.openGraph.type,
      all: page.openGraph.all,
      tags: page.openGraph.tags,
    },
    twitter: {
      card: page.twitter.card,
      title: page.twitter.title,
      description: page.twitter.description,
      image: page.twitter.image,
      imageAlt: page.twitter.imageAlt,
      site: page.twitter.site,
      creator: page.twitter.creator,
      all: page.twitter.all,
      tags: page.twitter.tags,
    },
  }
}

function makeExactRoute(
  path: string,
  contentParity: ContentParity = 'migrated',
  evidenceCapturedOn: EvidenceProvenance['capturedOn'] = '2026-08-14',
): PageRouteContract {
  const page = productionPageEvidence(path)
  const metadata = capturedRouteMetadata(path)
  const kind = routeKind(path)
  const minimumMeaningfulWordCount = kind === 'product' || kind === 'blog-article' ? 100 : 25
  return {
    disposition: 'page',
    path,
    publicPath: publicPath(path),
    status: 200,
    kind,
    renderPath: path,
    canonicalPath: canonicalPath(metadata.canonical),
    indexable: true,
    inSitemap: LIVE_SITEMAP_PATHS.has(path),
    contentParity,
    metadata,
    structuredData: page.structuredData.normalizedGraphs,
    expectedSchemaTypes: page.structuredData.types,
    audit: pageAudit('captured-production-fixture', minimumMeaningfulWordCount),
    evidence: observedPageEvidence(LIVE_SITEMAP_PATHS.has(path), evidenceCapturedOn),
    productionSignals: productionSignals(path),
  }
}

function makeArchiveRoute(definition: ArchiveDefinition): PageRouteContract {
  const page = productionPageEvidence(definition.path)
  const metadata = capturedRouteMetadata(definition.path)
  const expectedRobots = definition.kind === 'pagination' ? INDEX_ROBOTS : TAXONOMY_ROBOTS
  if (metadata.title !== definition.title || metadata.description !== (definition.description ?? null)) {
    throw new Error(`${definition.path}: captured archive core metadata drifted from the reviewed route definition`)
  }
  if (metadata.robots !== expectedRobots) {
    throw new Error(`${definition.path}: captured archive robots directives drifted from the reviewed route definition`)
  }
  for (const expectedType of definition.expectedSchemaTypes) {
    if (!page.structuredData.types.includes(expectedType)) {
      throw new Error(`${definition.path}: captured archive JSON-LD is missing ${expectedType}`)
    }
  }
  return {
    disposition: 'page',
    path: definition.path,
    publicPath: publicPath(definition.path),
    status: 200,
    kind: definition.kind,
    renderPath: definition.path,
    canonicalPath: definition.path,
    indexable: true,
    inSitemap: false,
    contentParity: 'legacy-static-required',
    metadata,
    structuredData: page.structuredData.normalizedGraphs,
    expectedSchemaTypes: page.structuredData.types,
    audit: pageAudit('captured-production-fixture', 25),
    evidence: observedPageEvidence(false),
    productionSignals: productionSignals(definition.path),
  }
}

function makeLocalRoute(
  path: '/resources' | '/shipping-delivery',
  title: string,
  description: string,
): PageRouteContract {
  const canonical = `${SITE_ORIGIN}${publicPath(path)}`
  const coreMetadata = { title, description, canonical, robots: NOINDEX_ROBOTS }
  const targetOpenGraph = {
    title,
    description,
    url: canonical,
    image: null,
    imageAlt: null,
    type: 'website' as const,
  }
  return {
    disposition: 'page',
    path,
    publicPath: publicPath(path),
    status: 200,
    kind: 'local-page',
    renderPath: path,
    canonicalPath: path,
    indexable: false,
    inSitemap: false,
    contentParity: 'migrated',
    metadata: {
      ...coreMetadata,
      openGraph: { title, description, url: canonical, image: null, imageAlt: null, type: 'website' },
      twitter: {
        card: 'summary',
        title,
        description,
        image: null,
        imageAlt: null,
        site: null,
        creator: null,
      },
    },
    structuredData: [],
    expectedSchemaTypes: [],
    audit: pageAudit('not-applicable', 25),
    evidence: approvedLocalPageEvidence(),
    productionSignals: approvedTargetSignals(coreMetadata, targetOpenGraph),
  }
}

const exactRoutes = Object.keys(liveSeo)
  .filter((path) => path !== '/shop')
  .map((path) => makeExactRoute(path))

// Published after the protected Vite baseline and therefore preserved as a
// production delta. Its public REST content is fixture-backed separately; it
// must not be represented as already migrated visual content.
const productionDeltaRoutes = [
  makeExactRoute('/blog/custom-puffy-stickers-guide', 'legacy-static-required', '2026-08-22'),
]

const shopPage = productionPageEvidence('/shop')
const shopMetadata = capturedRouteMetadata('/shop')
const shopRoute: PageRouteContract = {
  disposition: 'page',
  path: '/shop',
  publicPath: '/shop/',
  status: 200,
  kind: 'local-page',
  renderPath: '/shop',
  canonicalPath: '/',
  indexable: true,
  inSitemap: false,
  contentParity: 'migrated',
  metadata: shopMetadata,
  structuredData: shopPage.structuredData.normalizedGraphs,
  expectedSchemaTypes: shopPage.structuredData.types,
  audit: pageAudit('captured-production-fixture', 25),
  evidence: observedPageEvidence(false),
  productionSignals: productionSignals('/shop'),
  canonicalTargetEvidence: SHOP_CANONICAL_TARGET_EVIDENCE,
}

export const PRIMARY_ROUTE_CONTRACTS: readonly PageRouteContract[] = [
  ...exactRoutes,
  ...productionDeltaRoutes,
  ...ARCHIVE_DEFINITIONS.map(makeArchiveRoute),
  shopRoute,
  makeLocalRoute(
    '/resources',
    'Custom Printing Resources | PuffSticker.com',
    'Artwork, material, production, delivery and policy guidance for custom PuffSticker orders.',
  ),
  makeLocalRoute(
    '/shipping-delivery',
    'Shipping & Delivery | PuffSticker.com',
    'Planning guidance for PuffSticker custom-production windows, tracked delivery and international shipping.',
  ),
]

const productBySlug = new Map(catalogProducts.map((product) => [product.slug, product]))
const primaryByPath = new Map(PRIMARY_ROUTE_CONTRACTS.map((route) => [route.path, route]))

function makeCanonicalizingAlias(path: string, target: string): PageRouteContract {
  const canonical = primaryByPath.get(target)
  if (!canonical) throw new Error(`Missing canonical route ${target} for alias ${path}`)
  const page = productionPageEvidence(path)
  const metadata = capturedRouteMetadata(path)
  return {
    ...canonical,
    path,
    publicPath: publicPath(path),
    renderPath: target,
    canonicalPath: target,
    inSitemap: false,
    metadata,
    structuredData: page.structuredData.normalizedGraphs,
    expectedSchemaTypes: page.structuredData.types,
    audit: pageAudit('captured-production-fixture', canonical.audit.minimumMeaningfulWordCount),
    evidence: observedPageEvidence(false),
    productionSignals: productionSignals(path),
  }
}

const productAliases = catalogProducts.map((product) =>
  makeCanonicalizingAlias(`/product/${product.slug}`, `/${product.category}/${product.slug}`),
)

const misspelledProductAliases = catalogProducts
  .filter((product) => product.category === 'puffy-labels-stickers')
  .map((product) => makeCanonicalizingAlias(`/puff-labels-stickers/${product.slug}`, `/${product.category}/${product.slug}`))

const canonicalizingTagAliases = [
  makeCanonicalizingAlias('/blog/tag/custom-stickers', '/flat-labels-stickers/custom-stickers'),
  makeCanonicalizingAlias('/blog/tag/holographic-stickers', '/flat-labels-stickers/holographic-stickers'),
  makeCanonicalizingAlias('/blog/tag/puffy-stickers', '/puffy-labels-stickers/puffy-stickers'),
]

const productCategoryAliases = [
  makeCanonicalizingAlias('/product-category/puffy-labels-stickers', '/puffy-labels-stickers'),
  makeCanonicalizingAlias('/product-category/flat-labels-stickers', '/flat-labels-stickers'),
  makeCanonicalizingAlias('/product-category/promotional-items', '/promotional-items'),
]

export const CANONICALIZING_ALIAS_CONTRACTS: readonly PageRouteContract[] = [
  ...productAliases,
  ...misspelledProductAliases,
  ...canonicalizingTagAliases,
  ...productCategoryAliases,
]

const pageByPath = new Map(
  [...PRIMARY_ROUTE_CONTRACTS, ...CANONICALIZING_ALIAS_CONTRACTS].map((route) => [route.path, route]),
)

export const TRAILING_SLASH_REDIRECTS: readonly RedirectRouteContract[] = [
  ...PRIMARY_ROUTE_CONTRACTS,
  ...CANONICALIZING_ALIAS_CONTRACTS,
]
  .filter((route) => route.path !== '/')
  .map((route) => ({
    disposition: 'redirect',
    path: route.path,
    status: 301,
    destination: route.publicPath,
    evidence: {
      crawl: route.evidence.crawl === 'approved-target-override'
        ? 'approved-target-override'
        : 'derived-from-observed-policy',
      sitemap: 'not-applicable',
      liveStatus: route.evidence.crawl === 'approved-target-override'
        ? 404
        : 'not-individually-verified',
      targetStatus: 301,
      ...EXTERNAL_EVIDENCE_UNAVAILABLE,
    },
  }))

const redirectByPath = new Map(TRAILING_SLASH_REDIRECTS.map((route) => [route.path, route]))

export const EXPLICIT_NOT_FOUND_PATHS = [
  '/about',
  '/faq',
  '/contact',
  '/quote',
  '/category/puffy-labels-stickers',
  '/category/flat-labels-stickers',
  '/category/promotional-items',
  '/puff-labels-stickers',
] as const

const explicitNotFoundPaths = new Set<string>(EXPLICIT_NOT_FOUND_PATHS)

export const EXPLICIT_NOT_FOUND_CONTRACTS: readonly NotFoundRouteContract[] = EXPLICIT_NOT_FOUND_PATHS.map((path) => ({
  disposition: 'not-found',
  path,
  status: 404,
  indexable: false,
  robots: NOINDEX_ROBOTS,
  evidence: {
    crawl: 'observed-live',
    sitemap: 'confirmed-off-sitemap',
    liveStatus: 404,
    targetStatus: 404,
    ...EXTERNAL_EVIDENCE_UNAVAILABLE,
  },
}))

/**
 * Page-level resolver for Next's catch-all route. It deliberately normalizes
 * trailing slashes because App Router params do not retain that distinction.
 * Use resolveSeoRequest when the raw HTTP pathname is available.
 */
export function resolveSeoRoute(pathname: string): PageRouteContract | NotFoundRouteContract {
  const path = normalizePath(pathname)
  const page = pageByPath.get(path)
  if (page) return page
  return {
    disposition: 'not-found',
    path,
    status: 404,
    indexable: false,
    robots: NOINDEX_ROBOTS,
    evidence: {
      crawl: explicitNotFoundPaths.has(path) ? 'observed-live' : 'synthetic-negative',
      sitemap: explicitNotFoundPaths.has(path) ? 'confirmed-off-sitemap' : 'not-applicable',
      liveStatus: explicitNotFoundPaths.has(path) ? 404 : 'not-individually-verified',
      targetStatus: 404,
      ...EXTERNAL_EVIDENCE_UNAVAILABLE,
    },
  }
}

/** Strict request resolver that preserves the live one-hop 301 slash policy. */
export function resolveSeoRequest(pathname: string): SeoRequestContract {
  const withoutQuery = pathname.split(/[?#]/, 1)[0] || '/'
  const normalized = normalizePath(withoutQuery)
  if (withoutQuery !== '/' && !withoutQuery.endsWith('/')) {
    const redirect = redirectByPath.get(normalized)
    if (redirect) return redirect
  }
  return resolveSeoRoute(normalized)
}

export function getProductCanonicalPath(slug: string): string | null {
  const product = productBySlug.get(slug)
  return product ? `/${product.category}/${product.slug}` : null
}

export const INDEXABLE_ROUTES = PRIMARY_ROUTE_CONTRACTS.filter((route) => route.indexable)
export const CANONICAL_SITEMAP_ROUTES = PRIMARY_ROUTE_CONTRACTS.filter((route) => route.inSitemap)
