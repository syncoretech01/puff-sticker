/**
 * Read-only capture for production facts discovered after the protected Vite
 * baseline: the new WP post record and `/shop/`'s query canonical target.
 */
import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'

const ORIGIN = 'https://puffsticker.com'
const CAPTURE_DATE = '2026-08-21'
const USER_AGENT = 'PuffSticker-Parity-Capture/1.0 (+https://puffsticker.com/)'
const POST_SLUG = 'custom-puffy-stickers-guide'
const POST_API_URL = `${ORIGIN}/wp-json/wp/v2/posts?slug=${POST_SLUG}&context=view`
const SHOP_CANONICAL_URL = `${ORIGIN}/?page_id=9`

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { 'user-agent': USER_AGENT, accept: '*/*', ...options.headers },
    signal: AbortSignal.timeout(90_000),
  })
  return response
}

const postResponse = await request(POST_API_URL, { headers: { accept: 'application/json' } })
if (postResponse.status !== 200) throw new Error(`WP REST post request returned ${postResponse.status}`)
const postList = await postResponse.json()
if (!Array.isArray(postList) || postList.length !== 1 || postList[0]?.slug !== POST_SLUG) {
  throw new Error(`WP REST did not return exactly one ${POST_SLUG} post`)
}
const post = postList[0]
const postFixture = {
  schemaVersion: 1,
  source: 'public-wordpress-rest-api',
  capturedOn: CAPTURE_DATE,
  request: {
    url: POST_API_URL,
    status: postResponse.status,
    contentType: postResponse.headers.get('content-type'),
    total: postResponse.headers.get('x-wp-total'),
  },
  post: {
    id: post.id,
    date: post.date,
    dateGmt: post.date_gmt,
    modified: post.modified,
    modifiedGmt: post.modified_gmt,
    slug: post.slug,
    status: post.status,
    type: post.type,
    link: post.link,
    title: post.title,
    content: post.content,
    excerpt: post.excerpt,
    author: post.author,
    featuredMedia: post.featured_media,
    categories: post.categories,
    tags: post.tags,
    classList: post.class_list,
    ...(post.yoast_head === undefined ? {} : { yoastHead: post.yoast_head }),
    ...(post.yoast_head_json === undefined ? {} : { yoastHeadJson: post.yoast_head_json }),
    links: post._links,
  },
  unavailablePublicFields: [
    ...(post.yoast_head === undefined ? ['yoast_head'] : []),
    ...(post.yoast_head_json === undefined ? ['yoast_head_json'] : []),
  ],
  fingerprints: {
    renderedContentHash: sha256(post.content?.rendered ?? ''),
    renderedExcerptHash: sha256(post.excerpt?.rendered ?? ''),
    ...(post.yoast_head === undefined ? {} : { yoastHeadHash: sha256(post.yoast_head) }),
  },
}

const redirectChain = []
let nextUrl = SHOP_CANONICAL_URL
let finalHtml = ''
for (let hop = 0; hop < 10; hop += 1) {
  const response = await request(nextUrl, { redirect: 'manual', headers: { accept: 'text/html' } })
  const location = response.headers.get('location')
  redirectChain.push({ url: nextUrl, status: response.status, location })
  if (response.status >= 300 && response.status < 400 && location) {
    nextUrl = new URL(location, nextUrl).href
    continue
  }
  finalHtml = await response.text()
  if (response.status !== 200) throw new Error(`Shop canonical chain ended with ${response.status}`)
  break
}
if (!finalHtml) throw new Error('Shop canonical redirect chain did not terminate in HTML')

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ locale: 'en-US', timezoneId: 'UTC', serviceWorkers: 'block' })
await context.route('**/*', (route) => route.abort('blockedbyclient'))
const page = await context.newPage()
await page.setContent(finalHtml, { waitUntil: 'domcontentloaded', timeout: 90_000 })
const finalObservation = await page.evaluate(() => {
  const normalize = (value) => (value ?? '').replace(/\s+/g, ' ').trim()
  const root = document.querySelector('main') ?? document.querySelector('#main') ?? document.querySelector('#content') ?? document.body
  const clone = root.cloneNode(true)
  for (const element of clone.querySelectorAll('script,style,noscript,template,svg,canvas')) element.remove()
  const headings = [...clone.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((element) => ({
    level: Number(element.tagName.slice(1)),
    text: normalize(element.textContent),
  })).filter((heading) => heading.text)
  return {
    title: document.title,
    description: document.querySelector('meta[name="description" i]')?.getAttribute('content') ?? null,
    canonical: document.querySelector('link[rel="canonical" i]')?.getAttribute('href') ?? null,
    robots: document.querySelector('meta[name="robots" i]')?.getAttribute('content') ?? null,
    meaningfulText: normalize(clone.textContent),
    headings,
  }
})
await context.close()
await browser.close()

const shopFixture = {
  schemaVersion: 1,
  source: 'production-query-sensitive-capture',
  capturedOn: CAPTURE_DATE,
  requestedUrl: SHOP_CANONICAL_URL,
  redirectChain,
  finalUrl: nextUrl,
  finalObservation: {
    title: finalObservation.title,
    description: finalObservation.description,
    canonical: finalObservation.canonical,
    robots: finalObservation.robots,
    meaningfulTextHash: sha256(finalObservation.meaningfulText),
    meaningfulWordCount: finalObservation.meaningfulText ? finalObservation.meaningfulText.split(/\s+/).length : 0,
    headingsHash: sha256(JSON.stringify(finalObservation.headings)),
    headings: finalObservation.headings,
  },
}

const postOutput = resolve(`src/lib/seo/fixtures/production-post-delta-${POST_SLUG}-${CAPTURE_DATE}.json`)
const shopOutput = resolve(`src/lib/seo/fixtures/production-shop-canonical-target-${CAPTURE_DATE}.json`)
await writeFile(postOutput, `${JSON.stringify(postFixture, null, 2)}\n`, 'utf8')
await writeFile(shopOutput, `${JSON.stringify(shopFixture, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({
  postOutput,
  shopOutput,
  postId: post.id,
  shopRedirectChain: redirectChain,
  shopFinalCanonical: finalObservation.canonical,
}, null, 2))
