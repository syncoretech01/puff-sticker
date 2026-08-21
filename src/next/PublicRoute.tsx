import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import {
  exactSocialMetaTags,
  resolveSeoRoute,
  toNextMetadata,
  type PageRouteContract,
} from '../lib/seo'
import ClientApp from './ClientApp'

export function coreRouteMetadata(pathname: string): Metadata {
  const route = resolveSeoRoute(pathname)
  if (route.disposition === 'not-found') {
    return {
      title: 'Page Not Found | PuffSticker.com',
      robots: route.robots,
    }
  }

  const metadata = toNextMetadata(route)
  return {
    title: metadata.title,
    ...(metadata.description === undefined ? {} : { description: metadata.description }),
    alternates: metadata.alternates,
    robots: metadata.robots,
  }
}

function RouteSeoSignals({ route }: { route: PageRouteContract }) {
  const socialTags = exactSocialMetaTags(route)
  return (
    <>
      {socialTags.map((tag, index) => tag.attribute === 'property'
        ? <meta property={tag.key} content={tag.content} key={`property:${tag.key}:${index}`} />
        : <meta name={tag.key} content={tag.content} key={`name:${tag.key}:${index}`} />)}
      {route.structuredData.map((graph, index) => (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(graph).replaceAll('<', '\\u003c') }}
          key={`json-ld:${index}`}
        />
      ))}
    </>
  )
}

export function PublicRoute({ pathname }: { pathname: string }) {
  const route = resolveSeoRoute(pathname)
  if (route.disposition === 'not-found') notFound()

  return (
    <>
      <RouteSeoSignals route={route} />
      <ClientApp
        initialPathname={route.path}
        renderPathname={route.renderPath}
        nextMode
      />
    </>
  )
}
