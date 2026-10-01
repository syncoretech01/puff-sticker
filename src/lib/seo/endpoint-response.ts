import { productionEndpointEvidence } from './production-evidence-fixture'
import { LEGACY_SITEMAP_PATHS } from './sitemap-contract'

export const EXACT_SEO_ENDPOINT_PATHS = [
  '/robots.txt',
  LEGACY_SITEMAP_PATHS.compatibilityIndex,
  LEGACY_SITEMAP_PATHS.index,
  LEGACY_SITEMAP_PATHS.post,
  LEGACY_SITEMAP_PATHS.page,
  LEGACY_SITEMAP_PATHS.product,
  LEGACY_SITEMAP_PATHS.productCategory,
  LEGACY_SITEMAP_PATHS.local,
  LEGACY_SITEMAP_PATHS.locations,
] as const

export const EXACT_SEO_BODY_ENDPOINT_PATHS = [
  '/robots.txt',
  LEGACY_SITEMAP_PATHS.compatibilityIndex,
  LEGACY_SITEMAP_PATHS.index,
  LEGACY_SITEMAP_PATHS.post,
  LEGACY_SITEMAP_PATHS.page,
  LEGACY_SITEMAP_PATHS.product,
  LEGACY_SITEMAP_PATHS.productCategory,
  LEGACY_SITEMAP_PATHS.local,
  LEGACY_SITEMAP_PATHS.locations,
] as const

export type ExactSeoEndpointPath = (typeof EXACT_SEO_BODY_ENDPOINT_PATHS)[number]

/**
 * Return the reviewed requested response exactly. Redirecting legacy sitemap
 * paths use the first manually captured hop; terminal endpoints retain their
 * exact status, body and MIME type, including the current locations 404.
 */
export function exactSeoEndpointResponse(path: ExactSeoEndpointPath): Response {
  const endpoint = productionEndpointEvidence(path)
  const requested = endpoint.redirectChain?.[0]
  const status = requested?.status ?? endpoint.status
  const contentType = requested?.contentType ?? endpoint.contentType
  const location = requested?.location
  const body = requested ? null : endpoint.body
  return new Response(body, {
    status,
    headers: {
      ...(contentType ? { 'content-type': contentType } : {}),
      ...(location ? { location } : {}),
      'cache-control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
      'x-content-type-options': 'nosniff',
    },
  })
}
