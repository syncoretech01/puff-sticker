export const ARCHIVE_RELATIONSHIP_SOURCE = 'public-wordpress-relationships-2026-09-02' as const

export type ArchiveRenderer = 'published-blog-archive' | 'published-product-tag'
export type ArchiveResultSource =
  | 'live-blog-content-2026-08-12'
  | 'production-delta-blog-content-2026-08-21'
  | 'production-delta-blog-content-2026-09-01'
  | 'live-product-content-2026-08-12'

export type ArchiveArticleRelationship = {
  slug: string
  source: Extract<ArchiveResultSource, 'live-blog-content-2026-08-12' | 'production-delta-blog-content-2026-08-21' | 'production-delta-blog-content-2026-09-01'>
}

export type ArchiveProductRelationship = {
  slug: string
  source: Extract<ArchiveResultSource, 'live-product-content-2026-08-12'>
}

export type ArchiveContent = {
  path: string
  kind: 'pagination' | 'blog-tag' | 'product-tag'
  renderer: ArchiveRenderer
  relationshipSource: typeof ARCHIVE_RELATIONSHIP_SOURCE
  eyebrow: string
  heading: string
  label: string
  articles: readonly ArchiveArticleRelationship[]
  products: readonly ArchiveProductRelationship[]
}

const blogTagArticles = {
  '3d-holographic': ['holographic-stickers-color-perception'],
  'childhood-keepsakes': ['when-3d-stickers-become-collectibles', 'why-sticker-books-never-really-disappeared'],
  'collectible-stickers': ['when-3d-stickers-become-collectibles'],
  'collecting-psychology': ['why-sticker-books-never-really-disappeared'],
  'custom-epoxy-stickers': ['soft-depth-vs-smooth-depth'],
  'custom-foil-stickers': ['custom-puffy-stickers-became-the-new-therapy'],
  'custom-jute-tote-bags': ['custom-jute-tote-bags-the-perfect-blend-of-sustainability'],
  'custom-mylar-bag': ['sound-of-packaging-mylar-bags'],
  'custom-puffy-sheets': ['puffy-stickers-are-trending-2025'],
  'custom-puffy-stickers': ['why-custom-stickers-feel-like-objects', 'custom-puffy-stickers-became-the-new-therapy'],
  'dimensional-stickers': ['why-custom-stickers-feel-like-objects'],
  'embossed-stickers': ['why-custom-stickers-feel-like-objects'],
  'foil-stickers-printing': ['why-foil-stickers-feel-valuable'],
  'foil-stickers': ['matte-vs-gloss-psychology'],
  'holographic-materials': ['holographic-stickers-color-perception'],
  journaling: ['why-sticker-books-never-really-disappeared'],
  'matte-vs-gloss': ['matte-vs-gloss-psychology'],
  'memory-and-collecting': ['why-sticker-books-never-really-disappeared'],
  'mylar-bag': ['sound-of-packaging-mylar-bags'],
  'mylar-packaging': ['sound-of-packaging-mylar-bags'],
  'mylar-pouch': ['sound-of-packaging-mylar-bags'],
  nostalgia: ['why-sticker-books-never-really-disappeared'],
  'packaging-psychology': ['matte-vs-gloss-psychology'],
  'personal-archives': ['why-sticker-books-never-really-disappeared'],
  'product-design': ['why-custom-stickers-feel-like-objects'],
  'puffy-sheets': ['custom-puffy-stickers-became-the-new-therapy'],
  'raised-stickers': ['why-custom-stickers-feel-like-objects'],
  'soft-touch-mylar': ['sound-of-packaging-mylar-bags'],
  'soft-touch-packaging': ['matte-vs-gloss-psychology'],
  'sticker-books': ['why-sticker-books-never-really-disappeared'],
  'sticker-nostalgia': ['custom-puffy-stickers-guide', 'when-3d-stickers-become-collectibles'],
  'sticker-psychology': ['why-custom-stickers-feel-like-objects', 'custom-puffy-stickers-guide', 'matte-vs-gloss-psychology'],
  'stickers-psychology': ['why-we-save-stickers-we-never-use'],
  'texture-psychology': ['matte-vs-gloss-psychology'],
  'tote-bags': ['custom-jute-tote-bags-the-perfect-blend-of-sustainability'],
  'vintage-sticker-collecting': ['when-3d-stickers-become-collectibles'],
  'why-we-keep-stickers': ['when-3d-stickers-become-collectibles'],
} as const satisfies Record<string, readonly string[]>

const labelOverrides: Readonly<Record<string, string>> = {
  '3d-holographic': '3D holographic',
  'foil-stickers': 'Foil Stickers',
  'matte-vs-gloss': 'Matte vs Gloss',
  'packaging-psychology': 'Packaging Psychology',
  'soft-touch-packaging': 'Soft Touch Packaging',
  'sticker-psychology': 'Sticker Psychology',
  'texture-psychology': 'Texture Psychology',
}

function tagLabel(slug: string): string {
  return labelOverrides[slug] ?? slug.replaceAll('-', ' ')
}

function articleRelationship(slug: string): ArchiveArticleRelationship {
  return {
    slug,
    source: slug === 'custom-puffy-stickers-guide'
      ? 'production-delta-blog-content-2026-08-21'
      : slug === 'why-custom-stickers-feel-like-objects'
        ? 'production-delta-blog-content-2026-09-01'
        : 'live-blog-content-2026-08-12',
  }
}

function productRelationship(slug: string): ArchiveProductRelationship {
  return { slug, source: 'live-product-content-2026-08-12' }
}

/**
 * Route-owned archive renderer manifest. Relationships were reconciled
 * against the audited production crawl; copy is resolved only from the
 * named committed blog/product snapshots at render time.
 */
export const archiveRendererManifest: readonly ArchiveContent[] = [
  {
    path: '/blog/page/2',
    kind: 'pagination',
    renderer: 'published-blog-archive',
    relationshipSource: ARCHIVE_RELATIONSHIP_SOURCE,
    eyebrow: 'The Puff Blog',
    heading: 'Blog',
    label: 'Page 2',
    articles: [
      articleRelationship('custom-puffy-stickers-became-the-new-therapy'),
      articleRelationship('custom-jute-tote-bags-the-perfect-blend-of-sustainability'),
      articleRelationship('puffy-stickers-are-trending-2025'),
    ],
    products: [],
  },
  ...Object.entries(blogTagArticles).map(([slug, articleSlugs]) => {
    const label = tagLabel(slug)
    return {
      path: `/blog/tag/${slug}`,
      kind: 'blog-tag' as const,
      renderer: 'published-blog-archive' as const,
      relationshipSource: ARCHIVE_RELATIONSHIP_SOURCE,
      eyebrow: 'Published tag',
      heading: `Tags: ${label}`,
      label,
      articles: articleSlugs.map(articleRelationship),
      products: [],
    }
  }),
  {
    path: '/product-tag/embossed-stickers',
    kind: 'product-tag',
    renderer: 'published-product-tag',
    relationshipSource: ARCHIVE_RELATIONSHIP_SOURCE,
    eyebrow: 'Products tagged',
    heading: 'embossed stickers',
    label: 'embossed stickers',
    articles: [],
    products: [productRelationship('pu-embossed-stickers')],
  },
  {
    path: '/product-tag/pu-labels',
    kind: 'product-tag',
    renderer: 'published-product-tag',
    relationshipSource: ARCHIVE_RELATIONSHIP_SOURCE,
    eyebrow: 'Products tagged',
    heading: 'pu labels',
    label: 'pu labels',
    articles: [],
    products: [productRelationship('pu-embossed-stickers')],
  },
]

const archiveByPath = new Map(archiveRendererManifest.map((archive) => [archive.path, archive]))

export const legacyArchivePaths = archiveRendererManifest.map((archive) => archive.path)

export function getArchiveContent(pathname: string): ArchiveContent | undefined {
  return archiveByPath.get(pathname)
}
