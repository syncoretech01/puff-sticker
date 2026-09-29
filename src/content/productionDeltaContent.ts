import productionDeltaFixture from '../lib/seo/fixtures/production-post-delta-custom-puffy-stickers-guide-2026-08-21.json' with { type: 'json' }
import productionPostCurrentDeltaFixture from '../lib/seo/fixtures/production-post-delta-why-custom-stickers-feel-like-objects-2026-09-01'

const productionUploadDirectory = 'https://puffsticker.com/wp-content/uploads/2026/08/'
const currentDeltaFixture = productionPostCurrentDeltaFixture as typeof productionDeltaFixture

function localizePublishedHtml(html: string, publicAssetDirectory: string): string {
  return html
    .replaceAll(productionUploadDirectory, publicAssetDirectory)
    .replace(/href="https:\/\/puffsticker\.com\/([^"#]*)"/g, 'href="/$1"')
}

function publishedPost(
  fixture: typeof productionDeltaFixture,
  publicAssetDirectory: string,
) {
  return {
    id: fixture.post.id,
    title: fixture.post.title.rendered,
    html: localizePublishedHtml(fixture.post.content.rendered, publicAssetDirectory),
    excerptHtml: fixture.post.excerpt.rendered,
    modifiedAt: fixture.post.modified,
    sourceUrl: fixture.post.link,
  }
}

const guideSlug = 'custom-puffy-stickers-guide'
const currentSlug = 'why-custom-stickers-feel-like-objects'
const guideAssetDirectory = `/assets/live/blog/${guideSlug}/`
const currentAssetDirectory = `/assets/live/blog/${currentSlug}/`

export const productionDeltaBlogContent = {
  [guideSlug]: publishedPost(productionDeltaFixture, guideAssetDirectory),
  [currentSlug]: publishedPost(currentDeltaFixture, currentAssetDirectory),
} as const

export const productionDeltaPosts = {
  [guideSlug]: {
    id: productionDeltaFixture.post.id,
    date: productionDeltaFixture.post.date,
    categories: productionDeltaFixture.post.categories,
  },
  [currentSlug]: {
    id: currentDeltaFixture.post.id,
    date: currentDeltaFixture.post.date,
    categories: currentDeltaFixture.post.categories,
  },
} as const

export const productionDeltaFeaturedImage = `${guideAssetDirectory}custom-puffy-sticker-flat-vs-domed-proof-scaled.webp`
export const productionCurrentDeltaFeaturedImage = `${currentAssetDirectory}Featured-scaled.jpg`
