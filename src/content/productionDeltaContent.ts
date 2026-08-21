import productionDeltaFixture from '../lib/seo/fixtures/production-post-delta-custom-puffy-stickers-guide-2026-08-21.json' with { type: 'json' }

const slug = 'custom-puffy-stickers-guide'
const publicAssetDirectory = `/assets/live/blog/${slug}/`
const productionUploadDirectory = 'https://puffsticker.com/wp-content/uploads/2026/08/'

function localizePublishedHtml(html: string): string {
  return html
    .replaceAll(productionUploadDirectory, publicAssetDirectory)
    .replace(/href="https:\/\/puffsticker\.com\/([^"#]*)"/g, 'href="/$1"')
}

export const productionDeltaBlogContent = {
  [slug]: {
    id: productionDeltaFixture.post.id,
    title: productionDeltaFixture.post.title.rendered,
    html: localizePublishedHtml(productionDeltaFixture.post.content.rendered),
    excerptHtml: productionDeltaFixture.post.excerpt.rendered,
    modifiedAt: productionDeltaFixture.post.modified,
    sourceUrl: productionDeltaFixture.post.link,
  },
} as const

export const productionDeltaFeaturedImage = `${publicAssetDirectory}custom-puffy-sticker-flat-vs-domed-proof-scaled.webp`
