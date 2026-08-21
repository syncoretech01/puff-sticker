import type { Metadata } from 'next'

import {
  CANONICALIZING_ALIAS_CONTRACTS,
  PRIMARY_ROUTE_CONTRACTS,
} from '../../lib/seo'
import {
  coreRouteMetadata,
  PublicRoute,
} from '../../next/PublicRoute'

type RouteParams = { slug: string[] }

type PageProps = {
  params: Promise<RouteParams>
}

function pathname(slug: readonly string[]): string {
  return `/${slug.join('/')}`
}

// Every supported public and canonicalizing-alias path is enumerated below.
// Rejecting unlisted params at the static boundary keeps unknown prefixes a
// true 404 and lets Next serve the fully rendered not-found document instead
// of a client-hydrated dynamic error shell.
export const dynamicParams = false

export function generateStaticParams(): RouteParams[] {
  return [...PRIMARY_ROUTE_CONTRACTS, ...CANONICALIZING_ALIAS_CONTRACTS]
    .filter((route) => route.path !== '/')
    .map((route) => ({ slug: route.path.split('/').filter(Boolean) }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return coreRouteMetadata(pathname((await params).slug))
}

export default async function CatchAllPage({ params }: PageProps) {
  const routePath = pathname((await params).slug)
  return <PublicRoute pathname={routePath} />
}
