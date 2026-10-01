import { LEGACY_SITEMAP_PATHS, type SitemapEntryContract, type SitemapGroup } from './sitemap-contract'
import { productionEndpointEvidence } from './production-evidence-fixture'

const xmlEscape = (value: string) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;')

export function sitemapIndexXml() {
  return productionEndpointEvidence(LEGACY_SITEMAP_PATHS.index).body
}

export function compatibilitySitemapIndexXml() {
  return productionEndpointEvidence(LEGACY_SITEMAP_PATHS.compatibilityIndex).body
}

export function urlSetXml(entries: readonly SitemapEntryContract[]) {
  const missingImageEvidence = entries.filter((entry) => entry.images.state === 'not-captured')
  if (missingImageEvidence.length) {
    throw new Error(`Production sitemap image evidence is incomplete for: ${missingImageEvidence.map((entry) => entry.path).join(', ')}`)
  }
  const rows = entries.map((entry) => {
    const images = entry.images.state === 'captured'
      ? entry.images.value.map((image) => [
        '<image:image>',
        `<image:loc>${xmlEscape(image.location)}</image:loc>`,
        ...(image.title ? [`<image:title>${xmlEscape(image.title)}</image:title>`] : []),
        ...(image.caption ? [`<image:caption>${xmlEscape(image.caption)}</image:caption>`] : []),
        '</image:image>',
      ].join('')).join('')
      : ''
    return `<url><loc>${xmlEscape(entry.url)}</loc>${entry.lastModified ? `<lastmod>${entry.lastModified}</lastmod>` : ''}${images}</url>`
  }).join('')
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${rows}</urlset>`
}

export function sitemapGroupXml(group: SitemapGroup) {
  const path = {
    post: LEGACY_SITEMAP_PATHS.post,
    page: LEGACY_SITEMAP_PATHS.page,
    product: LEGACY_SITEMAP_PATHS.product,
    'product-category': LEGACY_SITEMAP_PATHS.productCategory,
  }[group]
  return productionEndpointEvidence(path).body
}

export function localSitemapXml() {
  return productionEndpointEvidence(LEGACY_SITEMAP_PATHS.local).body
}

export function locationsKml() {
  return productionEndpointEvidence(LEGACY_SITEMAP_PATHS.locations).body
}

export function xmlResponse(body: string, contentType = 'application/xml; charset=utf-8') {
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': contentType,
      'cache-control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
