import { CANONICAL_SITEMAP_ROUTES, SITE_ORIGIN } from './route-contract'
import { capturedSignal, type SeoSignal } from './evidence'
import { productionEndpointEvidence } from './production-evidence-fixture'

export type SitemapGroup = 'post' | 'page' | 'product' | 'product-category'

export type SitemapEntryContract = {
  path: string
  url: string
  lastModified: string
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
  lastModified: string
  images: readonly SitemapImageContract[]
}

function observedRows(group: SitemapGroup): readonly ObservedSitemapRow[] {
  const endpoint = productionEndpointEvidence(SITEMAP_PATH_BY_GROUP[group])
  return [...endpoint.body.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((match) => {
    const row = match[1]
    const url = elementText(row, 'loc')
    const lastModified = elementText(row, 'lastmod')
    if (!url || !lastModified) throw new Error(`${SITEMAP_PATH_BY_GROUP[group]} contains an incomplete URL row`)
    const images = [...row.matchAll(/<image:image>([\s\S]*?)<\/image:image>/g)].map((imageMatch) => {
      const location = elementText(imageMatch[1], 'image:loc')
      if (!location) throw new Error(`${url} has an image row without image:loc`)
      const title = elementText(imageMatch[1], 'image:title')
      const caption = elementText(imageMatch[1], 'image:caption')
      return { location, ...(title ? { title } : {}), ...(caption ? { caption } : {}) }
    })
    return { url, lastModified, images }
  })
}

const OBSERVED_ROWS = Object.fromEntries(
  (Object.keys(SITEMAP_PATH_BY_GROUP) as SitemapGroup[]).map((group) => [group, observedRows(group)]),
) as Readonly<Record<SitemapGroup, readonly ObservedSitemapRow[]>>

function groupFor(path: string): SitemapGroup {
  if (path === '/blog' || path.startsWith('/blog/')) return 'post'
  if (path === '/puffy-labels-stickers' || path === '/flat-labels-stickers' || path === '/promotional-items') return 'product-category'
  if (path.split('/').filter(Boolean).length === 2 && !path.startsWith('/blog/')) return 'product'
  return 'page'
}

const canonicalRouteByUrl = new Map(
  CANONICAL_SITEMAP_ROUTES.map((route) => [`${SITE_ORIGIN}${route.publicPath}`, route]),
)

export const SITEMAP_ENTRIES: readonly SitemapEntryContract[] = (
  ['post', 'page', 'product', 'product-category'] as const
).flatMap((group) => OBSERVED_ROWS[group].map((observed) => {
  const route = canonicalRouteByUrl.get(observed.url)
  if (!route) throw new Error(`Captured sitemap URL has no canonical route contract: ${observed.url}`)
  if (groupFor(route.path) !== group) throw new Error(`${route.path} is in the wrong production sitemap group`)
  return {
    path: route.path,
    url: observed.url,
    lastModified: observed.lastModified,
    group,
    images: capturedSignal(observed.images, 'production-crawl-2026-08-22', '2026-08-22'),
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
  return capturedSignal({
    ...details,
    status: endpoint.status,
    contentType: endpoint.contentType,
    normalizedBodyHash: endpoint.normalizedBodyHash,
  }, 'production-crawl-2026-08-22', '2026-08-22')
}

export const SITEMAP_ENDPOINT_EVIDENCE = {
  compatibilityIndex: capturedEndpoint(LEGACY_SITEMAP_PATHS.compatibilityIndex, { equivalentTo: LEGACY_SITEMAP_PATHS.index, childCount: 5 }),
  index: capturedEndpoint(LEGACY_SITEMAP_PATHS.index, { childCount: 5 }),
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
  local: capturedEndpoint(LEGACY_SITEMAP_PATHS.local, { urlCount: 1, locationPath: LEGACY_SITEMAP_PATHS.locations }),
  locations: capturedEndpoint(LEGACY_SITEMAP_PATHS.locations, { placemarkCount: 1 }),
} as const
