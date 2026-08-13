import { access, readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const dist = path.join(root, 'dist')
const sitemap = await readFile(path.join(root, 'public', 'sitemap.xml'), 'utf8')
const { liveSeo } = await import('../src/content/liveSeo.ts')
const canonicalPaths = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => new URL(match[1]).pathname)
const routes = [...new Set([...canonicalPaths, '/shop/', '/resources/', '/shipping-delivery/'])]
const failures = []
const liveAssets = new Set()
let productPages = 0
let blogArticles = 0
let exactPages = 0
let exactSeoRoutes = 0

const normalize = (value) => value.replace(/\/+$/, '') || '/'
const decodeHtml = (value = '') => value
  .replaceAll('&amp;', '&')
  .replaceAll('&quot;', '"')
  .replaceAll('&#39;', "'")
  .replaceAll('&lt;', '<')
  .replaceAll('&gt;', '>')

for (const route of routes) {
  const segments = route.split('/').filter(Boolean)
  const file = segments.length ? path.join(dist, ...segments, 'index.html') : path.join(dist, 'index.html')
  let html = ''
  try {
    html = await readFile(file, 'utf8')
  } catch {
    failures.push(`${route}: missing prerendered index.html`)
    continue
  }

  if (!/<main id="main-content"/.test(html)) failures.push(`${route}: main content missing`)
  if (!/<title>[^<]+<\/title>/.test(html)) failures.push(`${route}: title missing`)
  if (!/<meta[^>]+name="description"[^>]+content="[^"]+"/.test(html)) failures.push(`${route}: meta description missing`)
  if (!/<script id="puff-structured-data"/.test(html)) failures.push(`${route}: structured data missing`)
  if (/data-live-pending|class="route-fallback"/.test(html)) failures.push(`${route}: unresolved lazy content`)

  const mainHtml = html.match(/<main id="main-content"[\s\S]*?<\/main>/)?.[0] ?? ''
  if (/href="https?:\/\/(?:www\.)?puffsticker\.com/i.test(mainHtml)) failures.push(`${route}: visible legacy-site link remains`)
  if (/original listing|original article|canonical source|published source|published answers|live source|read original/i.test(mainHtml)) failures.push(`${route}: source-migration label remains`)
  if (/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/u.test(mainHtml)) failures.push(`${route}: decorative emoji remains`)

  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1]
  if (!canonical) failures.push(`${route}: canonical missing`)
  else if (normalize(new URL(canonical).pathname) !== normalize(route)) failures.push(`${route}: canonical path is ${new URL(canonical).pathname}`)

  const exactSeo = liveSeo[normalize(route)]
  if (exactSeo && normalize(new URL(exactSeo.canonical).pathname) === normalize(route)) {
    exactSeoRoutes += 1
    const renderedTitle = decodeHtml(html.match(/<title>([^<]+)<\/title>/)?.[1])
    const renderedDescription = decodeHtml(html.match(/<meta[^>]+name="description"[^>]+content="([^"]*)"/)?.[1])
    if (renderedTitle !== exactSeo.title) failures.push(`${route}: exact title mismatch`)
    if (exactSeo.description && renderedDescription !== exactSeo.description) failures.push(`${route}: exact meta description mismatch`)
  }

  const isProduct = segments.length === 2 && ['puffy-labels-stickers', 'flat-labels-stickers', 'promotional-items'].includes(segments[0])
  const isBlogArticle = segments.length === 2 && segments[0] === 'blog'
  if (isProduct) {
    productPages += 1
    if (!html.includes('data-live-loaded="product-description"') || !html.includes('data-live-loaded="product-gallery"')) failures.push(`${route}: exact product body/gallery missing`)
    if (!html.includes('"@type":"FAQPage"')) failures.push(`${route}: FAQ structured data missing`)
    if (!html.includes('"@type":"Product"') && !html.includes('"@type":"ProductGroup"')) failures.push(`${route}: product structured data missing`)
  }
  if (isBlogArticle) {
    blogArticles += 1
    if (!html.includes('data-live-loaded="blog-article"')) failures.push(`${route}: exact article body missing`)
  }
  if (route === '/' || ['about-us', 'contact-us', 'request-a-quote', 'faqs', 'privacy-policy', 'reprint-policy', 'terms-of-service'].includes(segments[0])) {
    exactPages += 1
    if (!html.includes('data-live-loaded=')) failures.push(`${route}: exact published page copy missing`)
  }
  if (route === '/' && !html.includes('"@type":"WebSite"')) failures.push(`${route}: WebSite structured data missing`)
  if (route === '/faqs/' && !html.includes('"@type":"FAQPage"')) failures.push(`${route}: FAQ structured data missing`)

  for (const match of html.matchAll(/(?:src|href)="(\/assets\/live\/[^"?#]+)[^"]*"/g)) liveAssets.add(decodeURIComponent(match[1]))
}

for (const asset of liveAssets) {
  try {
    await access(path.join(dist, ...asset.split('/').filter(Boolean)))
  } catch {
    failures.push(`missing live asset: ${asset}`)
  }
}

if (productPages !== 21) failures.push(`expected 21 product pages, found ${productPages}`)
if (blogArticles !== 11) failures.push(`expected 11 blog articles, found ${blogArticles}`)
if (exactPages !== 8) failures.push(`expected 8 exact published pages, found ${exactPages}`)

if (failures.length) throw new Error(`Build verification failed:\n${failures.join('\n')}`)

console.log(JSON.stringify({ routes: routes.length, canonicalRoutes: canonicalPaths.length, exactSeoRoutes, productPages, blogArticles, exactPages, verifiedLiveAssets: liveAssets.size }, null, 2))
