import type { PageRouteContract } from './route-contract'

export type NextMetadataContract = {
  title: string
  description?: string
  alternates: { canonical: string }
  robots?: string
  openGraph?: {
    title: string
    description?: string
    url: string
    type: 'website' | 'article' | 'product'
    images?: readonly { url: string; alt?: string }[]
  }
  twitter?: {
    card: 'summary' | 'summary_large_image'
    title: string
    description?: string
    images?: readonly { url: string; alt?: string }[]
  }
}

function capturedSocialImages(
  tags: readonly { key: string; content: string }[] | undefined,
  imageKey: string,
  altKey: string,
  fallbackImage: string | undefined,
  fallbackAlt: string | undefined,
): readonly { url: string; alt?: string }[] {
  if (!tags) return fallbackImage ? [{ url: fallbackImage, ...(fallbackAlt ? { alt: fallbackAlt } : {}) }] : []
  const images: { url: string; alt?: string }[] = []
  for (const tag of tags) {
    if (tag.key === imageKey) images.push({ url: tag.content })
    else if (tag.key === altKey && images.length && !images.at(-1)?.alt) images[images.length - 1].alt = tag.content
  }
  return images
}

/** Returns a value structurally compatible with Next.js Metadata. */
export function toNextMetadata(route: PageRouteContract): NextMetadataContract {
  const { metadata } = route
  const hasCapturedOpenGraph = metadata.openGraph.title !== null && metadata.openGraph.type !== null
  const hasCapturedTwitter = metadata.twitter.card !== null && metadata.twitter.title !== null
  const openGraphTitle = metadata.openGraph.title ?? undefined
  const openGraphDescription = metadata.openGraph.description ?? undefined
  const openGraphUrl = metadata.openGraph.url ?? undefined
  const openGraphImage = metadata.openGraph.image ?? undefined
  const twitterTitle = metadata.twitter.title ?? undefined
  const twitterDescription = metadata.twitter.description ?? undefined
  const twitterImage = metadata.twitter.image ?? undefined
  const openGraphImages = capturedSocialImages(
    metadata.openGraph.tags,
    'og:image',
    'og:image:alt',
    openGraphImage,
    metadata.openGraph.imageAlt ?? undefined,
  )
  const twitterImages = capturedSocialImages(
    metadata.twitter.tags,
    'twitter:image',
    'twitter:image:alt',
    twitterImage,
    metadata.twitter.imageAlt ?? undefined,
  )
  return {
    title: metadata.title,
    ...(metadata.description ? { description: metadata.description } : {}),
    alternates: { canonical: metadata.canonical },
    ...(metadata.robots ? { robots: metadata.robots } : {}),
    ...(hasCapturedOpenGraph && openGraphTitle && openGraphUrl && metadata.openGraph.type ? {
      openGraph: {
        title: openGraphTitle,
        ...(openGraphDescription ? { description: openGraphDescription } : {}),
        url: openGraphUrl,
        type: metadata.openGraph.type,
        ...(openGraphImages.length ? { images: openGraphImages } : {}),
      },
    } : {}),
    ...(hasCapturedTwitter && twitterTitle && metadata.twitter.card ? {
      twitter: {
        card: metadata.twitter.card,
        title: twitterTitle,
        ...(twitterDescription ? { description: twitterDescription } : {}),
        ...(twitterImages.length ? { images: twitterImages } : {}),
      },
    } : {}),
  }
}

export type ExactSocialMetaTag = {
  attribute: 'property' | 'name'
  key: string
  content: string
}

/** Exact observed production social tags, with omissions retained as omissions. */
export function exactSocialMetaTags(route: PageRouteContract): readonly ExactSocialMetaTag[] {
  const openGraph = route.metadata.openGraph.tags
    ? route.metadata.openGraph.tags.map(({ key, content }) => ({ attribute: 'property' as const, key, content }))
    : route.metadata.openGraph.all
    ? Object.entries(route.metadata.openGraph.all).flatMap(([key, values]) =>
      values.map((content) => ({ attribute: 'property' as const, key, content })))
    : []
  const twitter = route.metadata.twitter.tags
    ? route.metadata.twitter.tags.map(({ key, content }) => ({ attribute: 'name' as const, key, content }))
    : route.metadata.twitter.all
    ? Object.entries(route.metadata.twitter.all).flatMap(([key, values]) =>
      values.map((content) => ({ attribute: 'name' as const, key, content })))
    : []
  return [...openGraph, ...twitter]
}
