import { NextRequest, NextResponse } from 'next/server'

import {
  EXPLICIT_TRAILING_SLASH_PATH_SET,
  SHOP_CANONICAL_QUERY_REDIRECT,
} from './lib/seo/slash-redirects'

const INTERNAL_ENDPOINT_PREFIX = '/seo-internal/'
const INTERNAL_REWRITE_HEADER = 'x-puff-seo-internal-rewrite'
const INTERNAL_REWRITE_TOKEN = crypto.randomUUID()
const INTERNAL_ENDPOINT_REWRITES: Readonly<Record<string, string>> = {
  '/robots.txt': `${INTERNAL_ENDPOINT_PREFIX}robots.txt`,
}
const INTERNAL_ENDPOINT_TARGETS = new Set(Object.values(INTERNAL_ENDPOINT_REWRITES))

function exactRedirect(request: NextRequest, pathname: string, preserveSearch: boolean) {
  const destination = new URL(request.url)
  destination.pathname = pathname
  if (!preserveSearch) destination.search = ''
  // A literal Location header avoids framework trailing-slash normalization;
  // the finite contract requires a 301 with the slash present in one hop.
  return new NextResponse(null, {
    status: 301,
    headers: { location: destination.toString() },
  })
}

/**
 * Preserve the finite WordPress request surface without introducing wildcard
 * aliases. The two protected Vite public files are shadowed only inside Next
 * via internal rewrites, so the Vite baseline remains independently buildable.
 */
export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  if (
    pathname === SHOP_CANONICAL_QUERY_REDIRECT.pathname
    && request.nextUrl.search === SHOP_CANONICAL_QUERY_REDIRECT.search
  ) {
    return exactRedirect(request, SHOP_CANONICAL_QUERY_REDIRECT.destination, false)
  }

  // Internal route-handler addresses are implementation details and must not
  // become a second crawlable endpoint surface. A per-process capability is
  // added only to finite rewrites; a client-provided marker cannot bypass the
  // guard without the unexposed random value.
  if (pathname.startsWith(INTERNAL_ENDPOINT_PREFIX)) {
    if (
      request.headers.get(INTERNAL_REWRITE_HEADER) === INTERNAL_REWRITE_TOKEN
      && INTERNAL_ENDPOINT_TARGETS.has(pathname)
    ) {
      return NextResponse.next()
    }
    return new NextResponse('Not Found', {
      status: 404,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'x-robots-tag': 'noindex, follow',
      },
    })
  }

  const internalEndpoint = INTERNAL_ENDPOINT_REWRITES[pathname]
  if (internalEndpoint) {
    const destination = request.nextUrl.clone()
    destination.pathname = internalEndpoint
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set(INTERNAL_REWRITE_HEADER, INTERNAL_REWRITE_TOKEN)
    return NextResponse.rewrite(destination, {
      request: { headers: requestHeaders },
    })
  }

  if (EXPLICIT_TRAILING_SLASH_PATH_SET.has(pathname)) {
    return exactRedirect(request, `${pathname}/`, true)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/robots.txt',
    '/sitemap.xml',
    '/seo-internal/:path*',
    // Page requests need the finite 301 policy; immutable assets and all other
    // extension endpoints bypass the request proxy entirely.
    '/((?!_next/static|_next/image|assets|favicon.ico|.*\\.[^/]+$).*)',
  ],
}
