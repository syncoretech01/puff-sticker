import { CANONICAL_SITEMAP_ROUTES, SITE_ORIGIN } from './route-contract'
import { capturedSignal, type SeoSignal } from './evidence'
import { productionEndpointEvidence, productionEndpointEvidenceCapture } from './production-evidence-fixture'

export type SitemapGroup = 'post' | 'page' | 'product' | 'product-category'

export type SitemapEntryContract = {
  path: string
  url: string
  lastModified?: string
  group: SitemapGroup
  images: SeoSignal<readonly SitemapImageContract[]>
}

export type SitemapImageContract = {
  location: string
  title?: string
  caption?: string
}

export const LEGACY_SITEMAP_PATHS = {
  compatibilityIndex: '/sitemap.xml',
  index: '/sitemap_index.xml',
  post: '/post-sitemap.xml',
  page: '/page-sitemap.xml',
  product: '/product-sitemap.xml',
  productCategory: '/product_cat-sitemap.xml',
  local: '/local-sitemap.xml',
  locations: '/locations.kml',
} as const

const SITEMAP_PATH_BY_GROUP: Readonly<Record<SitemapGroup, string>> = {
  post: LEGACY_SITEMAP_PATHS.post,
  page: LEGACY_SITEMAP_PATHS.page,
  product: LEGACY_SITEMAP_PATHS.product,
  'product-category': LEGACY_SITEMAP_PATHS.productCategory,
}

const decodeXml = (value: string) => value
  .replaceAll('&amp;', '&')
  .replaceAll('&lt;', '<')
  .replaceAll('&gt;', '>')
  .replaceAll('&quot;', '"')
  .replaceAll('&apos;', "'")

function elementText(xml: string, name: string): string | undefined {
  const value = xml.match(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`))?.[1]
  return value === undefined ? undefined : decodeXml(value.trim())
}

type ObservedSitemapRow = {
  url: string
  lastModified?: string
  images: readonly SitemapImageContract[]
}

function observedRows(): readonly ObservedSitemapRow[] {
  const endpoint = productionEndpointEvidence(LEGACY_SITEMAP_PATHS.compatibilityIndex)
  return [...endpoint.body.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((match) => {
    const row = match[1]
    const url = elementText(row, 'loc')
    const lastModified = elementText(row, 'lastmod')
    if (!url) throw new Error(`${LEGACY_SITEMAP_PATHS.compatibilityIndex} contains an incomplete URL row`)
    const images = [...row.matchAll(/<image:image>([\s\S]*?)<\/image:image>/g)].map((imageMatch) => {
      const location = elementText(imageMatch[1], 'image:loc')
      if (!location) throw new Error(`${url} has an image row without image:loc`)
      const title = elementText(imageMatch[1], 'image:title')
      const caption = elementText(imageMatch[1], 'image:caption')
      return { location, ...(title ? { title } : {}), ...(caption ? { caption } : {}) }
    })
    return { url, ...(lastModified ? { lastModified } : {}), images }
  })
}

function groupFor(path: string): SitemapGroup {
  if (path === '/blog' || path.startsWith('/blog/')) return 'post'
  if (path === '/puffy-labels-stickers' || path === '/flat-labels-stickers' || path === '/promotional-items' || path === '/cbd-packaging-boxes') return 'product-category'
  if (path.split('/').filter(Boolean).length === 2 && !path.startsWith('/blog/')) return 'product'
  return 'page'
}

const flatRows = observedRows()
const OBSERVED_ROWS = Object.fromEntries(
  (Object.keys(SITEMAP_PATH_BY_GROUP) as SitemapGroup[]).map((group) => [
    group,
    flatRows.filter((row) => groupFor(new URL(row.url).pathname.replace(/\/$/, '') || '/') === group),
  ]),
) as unknown as Readonly<Record<SitemapGroup, readonly ObservedSitemapRow[]>>

const canonicalRouteByUrl = new Map(
  CANONICAL_SITEMAP_ROUTES.map((route) => [`${SITE_ORIGIN}${route.publicPath}`, route]),
)

export const SITEMAP_ENTRIES: readonly SitemapEntryContract[] = (
  ['post', 'page', 'product', 'product-category'] as const
).flatMap((group) => OBSERVED_ROWS[group].map((observed) => {
  const route = canonicalRouteByUrl.get(observed.url)
  if (!route) throw new Error(`Captured sitemap URL has no canonical route contract: ${observed.url}`)
  if (groupFor(route.path) !== group) throw new Error(`${route.path} is in the wrong production sitemap group`)
  const capture = productionEndpointEvidenceCapture(LEGACY_SITEMAP_PATHS.compatibilityIndex)
  return {
    path: route.path,
    url: observed.url,
    ...(observed.lastModified ? { lastModified: observed.lastModified } : {}),
    group,
    images: capturedSignal(observed.images, capture.source, capture.capturedOn),
  }
}))

export const SITEMAP_GROUPS: Readonly<Record<SitemapGroup, readonly SitemapEntryContract[]>> = {
  post: SITEMAP_ENTRIES.filter((entry) => entry.group === 'post'),
  page: SITEMAP_ENTRIES.filter((entry) => entry.group === 'page'),
  product: SITEMAP_ENTRIES.filter((entry) => entry.group === 'product'),
  'product-category': SITEMAP_ENTRIES.filter((entry) => entry.group === 'product-category'),
}

export const SITEMAP_IMAGE_EVIDENCE_BLOCKERS: readonly [] = []

function capturedEndpoint(path: string, details: Record<string, unknown>) {
  const endpoint = productionEndpointEvidence(path)
  const capture = productionEndpointEvidenceCapture(path)
  const requestedResponse = endpoint.redirectChain?.[0]
  return capturedSignal({
    ...details,
    status: requestedResponse?.status ?? endpoint.status,
    contentType: requestedResponse?.contentType ?? endpoint.contentType,
    normalizedBodyHash: requestedResponse?.normalizedBodyHash ?? endpoint.normalizedBodyHash,
    ...(requestedResponse?.location ? { location: requestedResponse.location } : {}),
    redirectCount: Math.max(0, (endpoint.redirectChain?.length ?? 1) - 1),
  }, capture.source, capture.capturedOn)
}

export const SITEMAP_ENDPOINT_EVIDENCE = {
  compatibilityIndex: capturedEndpoint(LEGACY_SITEMAP_PATHS.compatibilityIndex, { urlCount: flatRows.length }),
  index: capturedEndpoint(LEGACY_SITEMAP_PATHS.index, { redirectsTo: LEGACY_SITEMAP_PATHS.compatibilityIndex }),
  post: capturedEndpoint(LEGACY_SITEMAP_PATHS.post, {
    urlCount: OBSERVED_ROWS.post.length,
    imageCount: OBSERVED_ROWS.post.reduce((sum, row) => sum + row.images.length, 0),
  }),
  page: capturedEndpoint(LEGACY_SITEMAP_PATHS.page, {
    urlCount: OBSERVED_ROWS.page.length,
    imageCount: OBSERVED_ROWS.page.reduce((sum, row) => sum + row.images.length, 0),
  }),
  product: capturedEndpoint(LEGACY_SITEMAP_PATHS.product, {
    urlCount: OBSERVED_ROWS.product.length,
    imageCount: OBSERVED_ROWS.product.reduce((sum, row) => sum + row.images.length, 0),
  }),
  productCategory: capturedEndpoint(LEGACY_SITEMAP_PATHS.productCategory, {
    urlCount: OBSERVED_ROWS['product-category'].length,
    imageCount: OBSERVED_ROWS['product-category'].reduce((sum, row) => sum + row.images.length, 0),
  }),
  local: capturedEndpoint(LEGACY_SITEMAP_PATHS.local, { redirectsTo: LEGACY_SITEMAP_PATHS.compatibilityIndex }),
  locations: capturedEndpoint(LEGACY_SITEMAP_PATHS.locations, { notFound: true }),
} as const
