import { readFileSync } from 'node:fs'

import { regressionEnvironment } from './environment'

export type CanonicalRoute = {
  path: string
  canonical: string
}

function normalizePath(pathname: string) {
  return pathname === '/' ? '/' : `/${pathname.split('/').filter(Boolean).join('/')}/`
}

const sitemapXml = readFileSync(new URL('../../public/sitemap.xml', import.meta.url), 'utf8')

export const canonicalRoutes: readonly CanonicalRoute[] = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => {
  const url = new URL(match[1])
  if (url.origin !== regressionEnvironment.canonicalOrigin) {
    throw new Error(`Unexpected sitemap origin for ${url.href}`)
  }
  const path = normalizePath(url.pathname)
  const protectedCanonical = path === '/blog/custom-puffy-stickers-became-the-new-therapy/'
    || path === '/blog/puffy-stickers-are-trending-2025/'
    ? `${url.origin}${url.pathname.replace(/\/$/, '')}`
    : url.href
  return { path, canonical: protectedCanonical }
})

if (canonicalRoutes.length !== 51) {
  throw new Error(`Expected 51 canonical routes, found ${canonicalRoutes.length}`)
}

export const localExtensionContracts = [
  {
    path: '/shop/',
    vite: { canonical: `${regressionEnvironment.canonicalOrigin}/shop/`, indexable: true },
    next: { canonical: `${regressionEnvironment.canonicalOrigin}/?page_id=9`, indexable: true },
  },
  {
    path: '/resources/',
    vite: { canonical: `${regressionEnvironment.canonicalOrigin}/resources/`, indexable: true },
    next: { canonical: `${regressionEnvironment.canonicalOrigin}/resources/`, indexable: false },
  },
  {
    path: '/shipping-delivery/',
    vite: { canonical: `${regressionEnvironment.canonicalOrigin}/shipping-delivery/`, indexable: true },
    next: { canonical: `${regressionEnvironment.canonicalOrigin}/shipping-delivery/`, indexable: false },
  },
] as const

export const allLocalRoutes = [
  ...canonicalRoutes.map((route) => route.path),
  ...localExtensionContracts.map((route) => route.path),
] as const

if (new Set(allLocalRoutes).size !== 54) {
  throw new Error(`Expected 54 unique local routes, found ${new Set(allLocalRoutes).size}`)
}
