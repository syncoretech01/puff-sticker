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

export type ExactSeoEndpointPath = (typeof EXACT_SEO_ENDPOINT_PATHS)[number]

/**
 * Return the reviewed production body byte-for-byte with its captured MIME
 * type. Route handlers delegate to this fixture-backed boundary so the public
 * SEO discovery surface cannot drift endpoint by endpoint.
 */
export function exactSeoEndpointResponse(path: ExactSeoEndpointPath): Response {
  const endpoint = productionEndpointEvidence(path)
  if (endpoint.status !== 200 || !endpoint.contentType) {
    throw new Error(`${path}: captured endpoint is missing an exact 200 response contract`)
  }
  return new Response(endpoint.body, {
    status: endpoint.status,
    headers: {
      'content-type': endpoint.contentType,
      'cache-control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
      'x-content-type-options': 'nosniff',
    },
  })
}
