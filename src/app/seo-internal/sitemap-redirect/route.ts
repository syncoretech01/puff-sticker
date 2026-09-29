const PRODUCTION_SITEMAP_INDEX_URL = 'https://puffsticker.com/sitemap_index.xml'

/**
 * This handler is reached through the finite beforeFiles rewrite in
 * `next.config.ts`. Direct internal requests are always rejected by the proxy.
 * A route handler is required because Next 16 serializes middleware redirects
 * with the destination URL as their body instead of preserving an empty body.
 */
export function GET() {
  return new Response(null, {
    status: 301,
    headers: {
      'content-type': 'text/html; charset=UTF-8',
      location: PRODUCTION_SITEMAP_INDEX_URL,
    },
  })
}

export const dynamic = 'force-dynamic'
