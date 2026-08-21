export type ArchiveContent = {
  label: string
  articleSlugs: readonly string[]
  productSlugs: readonly string[]
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
  'custom-puffy-stickers': ['custom-puffy-stickers-became-the-new-therapy'],
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
  'puffy-sheets': ['custom-puffy-stickers-became-the-new-therapy'],
  'soft-touch-mylar': ['sound-of-packaging-mylar-bags'],
  'soft-touch-packaging': ['matte-vs-gloss-psychology'],
  'sticker-books': ['why-sticker-books-never-really-disappeared'],
  'sticker-nostalgia': ['custom-puffy-stickers-guide', 'when-3d-stickers-become-collectibles'],
  'sticker-psychology': ['custom-puffy-stickers-guide', 'matte-vs-gloss-psychology'],
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

export const legacyArchivePaths = [
  '/blog/page/2',
  ...Object.keys(blogTagArticles).map((slug) => `/blog/tag/${slug}`),
  '/product-tag/embossed-stickers',
  '/product-tag/pu-labels',
] as const

export function getArchiveContent(pathname: string): ArchiveContent | undefined {
  if (pathname === '/blog/page/2') {
    return {
      label: 'Blog — page 2',
      articleSlugs: ['custom-jute-tote-bags-the-perfect-blend-of-sustainability', 'puffy-stickers-are-trending-2025'],
      productSlugs: [],
    }
  }

  if (pathname === '/product-tag/embossed-stickers' || pathname === '/product-tag/pu-labels') {
    const slug = pathname.split('/').at(-1) ?? ''
    return { label: tagLabel(slug), articleSlugs: [], productSlugs: ['pu-embossed-stickers'] }
  }

  const match = pathname.match(/^\/blog\/tag\/([^/]+)$/)
  if (!match) return undefined
  const slug = match[1] as keyof typeof blogTagArticles
  const articleSlugs = blogTagArticles[slug]
  if (!articleSlugs) return undefined
  return { label: tagLabel(slug), articleSlugs, productSlugs: [] }
}
