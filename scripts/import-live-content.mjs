import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright-core'

const root = process.cwd()
const sourceBase = 'https://puffsticker.com'
const edgePath = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const generatedAt = new Date().toISOString()

const api = async (pathname) => {
  const response = await fetch(`${sourceBase}${pathname}`, { headers: { 'user-agent': 'PuffSticker local content migration' } })
  if (!response.ok) throw new Error(`${response.status} ${pathname}`)
  return response.json()
}

const browser = await chromium.launch({ executablePath: edgePath, headless: true })
const parser = await browser.newPage()

async function cleanHtml(rawHtml) {
  return parser.evaluate((raw) => {
    const doc = new DOMParser().parseFromString(raw, 'text/html')
    const root = doc.body
    const decorativeEmoji = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu
    const textWalker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    const textNodes = []
    while (textWalker.nextNode()) textNodes.push(textWalker.currentNode)
    textNodes.forEach((node) => { node.nodeValue = node.nodeValue?.replace(decorativeEmoji, '').replace(/ {2,}/g, ' ') ?? '' })
    const comments = doc.createTreeWalker(root, NodeFilter.SHOW_COMMENT)
    const commentNodes = []
    while (comments.nextNode()) commentNodes.push(comments.currentNode)
    commentNodes.forEach((node) => node.remove())
    root.querySelectorAll('script, style, noscript, iframe, form, input, button, select, option, textarea, svg, canvas, video, audio').forEach((node) => node.remove())

    root.querySelectorAll('img').forEach((image) => {
      const source = image.getAttribute('src') || image.getAttribute('data-src') || ''
      image.setAttribute('src', source)
      image.setAttribute('loading', 'lazy')
      image.setAttribute('decoding', 'async')
      image.removeAttribute('srcset')
      image.removeAttribute('sizes')
    })

    root.querySelectorAll('a').forEach((anchor) => {
      const href = anchor.getAttribute('href') || ''
      if (!href || /^javascript:/i.test(href)) anchor.removeAttribute('href')
      if (/^https?:/i.test(href)) {
        anchor.setAttribute('target', '_blank')
        anchor.setAttribute('rel', 'noreferrer')
      }
    })

    root.querySelectorAll('p').forEach((paragraph) => {
      const text = paragraph.textContent?.trim() || ''
      const meaningfulNodes = [...paragraph.childNodes].filter((node) => {
        if (node.nodeType === Node.TEXT_NODE) return Boolean(node.textContent?.trim())
        return !(node instanceof HTMLBRElement)
      })
      const onlyStrong = meaningfulNodes.length === 1
        && meaningfulNodes[0] instanceof Element
        && ['STRONG', 'B'].includes(meaningfulNodes[0].tagName)
      if (onlyStrong && text.length > 2 && text.length < 150) {
        const heading = doc.createElement('h2')
        heading.innerHTML = meaningfulNodes[0].innerHTML
        paragraph.replaceWith(heading)
      }
    })

    const allowed = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'FIGURE', 'FIGCAPTION', 'IMG', 'A', 'STRONG', 'B', 'EM', 'I', 'U', 'BR', 'HR', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD'])
    const nodes = [...root.querySelectorAll('*')].reverse()
    for (const node of nodes) {
      if (!node.isConnected) continue
      if (!allowed.has(node.tagName)) {
        node.replaceWith(...node.childNodes)
        continue
      }
      const keep = new Set(node.tagName === 'A' ? ['href', 'target', 'rel'] : node.tagName === 'IMG' ? ['src', 'alt', 'title', 'width', 'height', 'loading', 'decoding'] : [])
      for (const attribute of [...node.attributes]) if (!keep.has(attribute.name)) node.removeAttribute(attribute.name)
    }

    root.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote, figure').forEach((node) => {
      if (!node.textContent?.trim() && !node.querySelector('img')) node.remove()
    })
    root.querySelectorAll('a[href^="https://puffsticker.com"]').forEach((anchor) => {
      const url = new URL(anchor.getAttribute('href'))
      anchor.setAttribute('href', `${url.pathname}${url.search}${url.hash}`)
      anchor.removeAttribute('target')
      anchor.removeAttribute('rel')
    })
    root.querySelectorAll('a[href]').forEach((anchor) => {
      const href = anchor.getAttribute('href') || ''
      anchor.setAttribute('href', href.replace(/^\/puff-labels-stickers(?=\/|$)/i, '/puffy-labels-stickers'))
    })
    return root.innerHTML.replace(/>\s+</g, '><').trim()
  }, rawHtml)
}

const imageJobs = new Map()
const safeName = (value) => value.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')

function localizeImages(html, group) {
  let index = 0
  return html.replace(/src="(https:\/\/puffsticker\.com\/wp-content\/uploads\/[^"?#]+)(?:\?[^"#]*)?"/gi, (match, url) => {
    const parsed = new URL(url)
    const original = decodeURIComponent(path.basename(parsed.pathname))
    const filename = `${String(++index).padStart(2, '0')}-${safeName(original)}`
    const relative = `assets/live/${group}/${filename}`
    imageJobs.set(`${url}|${relative}`, { url, relative })
    return `src="/${relative}"`
  })
}

async function downloadImage({ url, relative }) {
  const destination = path.join(root, 'public', relative)
  await mkdir(path.dirname(destination), { recursive: true })
  const response = await fetch(url, { headers: { 'user-agent': 'PuffSticker local content migration' } })
  if (!response.ok) throw new Error(`${response.status} image ${url}`)
  await writeFile(destination, Buffer.from(await response.arrayBuffer()))
}

async function headMeta(url) {
  const response = await fetch(url, { headers: { 'user-agent': 'PuffSticker local content migration' } })
  if (!response.ok) return { title: '', description: '', canonical: url }
  const html = await response.text()
  const decode = (value = '') => parser.evaluate((text) => {
    const area = document.createElement('textarea')
    area.innerHTML = text
    return area.value
  }, value)
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const descriptionMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i)
    || html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["'][^>]*>/i)
  const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["'][^>]*>/i)
  return {
    title: await decode(titleMatch?.[1]?.trim()),
    description: await decode(descriptionMatch?.[1]?.trim()),
    canonical: canonicalMatch?.[1] || url,
  }
}

const [posts, products, pages] = await Promise.all([
  api('/wp-json/wp/v2/posts?per_page=100&_fields=id,slug,link,title,excerpt,content,date,modified,categories,featured_media'),
  api('/wp-json/wc/store/v1/products?per_page=100'),
  api('/wp-json/wp/v2/pages?per_page=100&_fields=id,slug,link,title,excerpt,content,modified'),
])

const blogContent = {}
for (const post of posts) {
  const html = localizeImages(await cleanHtml(post.content.rendered), `blog/${post.slug}`)
  blogContent[post.slug] = {
    id: post.id,
    title: post.title.rendered,
    excerptHtml: await cleanHtml(post.excerpt.rendered),
    html,
    publishedAt: post.date,
    modifiedAt: post.modified,
    sourceUrl: post.link,
  }
}

const productContent = {}
for (const product of products) {
  const gallery = []
  for (const [imageIndex, image] of product.images.entries()) {
    const parsed = new URL(image.src)
    const filename = `${String(imageIndex + 1).padStart(2, '0')}-${safeName(decodeURIComponent(path.basename(parsed.pathname)))}`
    const relative = `assets/live/products/${product.slug}/${filename}`
    imageJobs.set(`${image.src}|${relative}`, { url: image.src, relative })
    gallery.push({ src: `/${relative}`, alt: image.alt || product.name, name: image.name || '' })
  }
  productContent[product.slug] = {
    id: product.id,
    name: product.name,
    shortDescriptionHtml: localizeImages(await cleanHtml(product.short_description), `products/${product.slug}/content`),
    descriptionHtml: localizeImages(await cleanHtml(product.description), `products/${product.slug}/content`),
    gallery,
    attributes: product.attributes,
    prices: product.prices,
    sourceUrl: product.permalink,
  }
}

const pageContent = {}
for (const page of pages) {
  if (page.slug === 'blog') continue
  pageContent[page.slug] = {
    id: page.id,
    title: page.title.rendered,
    html: localizeImages(await cleanHtml(page.content.rendered), `pages/${page.slug}`),
    modifiedAt: page.modified,
    sourceUrl: page.link,
  }
}

const blogCategoryPaths = [
  '/blog/category/custom-epoxy-stickers/',
  '/blog/category/custom-foil-stickers/',
  '/blog/category/custom-holographic-stickers/',
  '/blog/category/custom-jute-tote-bags/',
  '/blog/category/custom-mylar-bags/',
  '/blog/category/custom-puffy-stickers/',
  '/blog/category/sticker-psychology/',
]

const seoEntries = [
  ...pages.map((page) => ({ path: new URL(page.link).pathname, url: page.link })),
  ...posts.map((post) => ({ path: new URL(post.link).pathname, url: post.link })),
  ...products.map((product) => ({ path: new URL(product.permalink).pathname, url: product.permalink })),
  ...['/shop/', '/puffy-labels-stickers/', '/flat-labels-stickers/', '/promotional-items/', ...blogCategoryPaths].map((pathname) => ({ path: pathname, url: `${sourceBase}${pathname}` })),
]
const seo = {}
for (let index = 0; index < seoEntries.length; index += 5) {
  const batch = seoEntries.slice(index, index + 5)
  const metadata = await Promise.all(batch.map((entry) => headMeta(entry.url)))
  batch.forEach((entry, itemIndex) => { seo[entry.path.replace(/\/+$/, '') || '/'] = metadata[itemIndex] })
}

const jobs = [...imageJobs.values()]
for (let index = 0; index < jobs.length; index += 6) {
  await Promise.all(jobs.slice(index, index + 6).map(downloadImage))
}

const banner = `// Generated from ${sourceBase} on ${generatedAt}. Re-run scripts/import-live-content.mjs to refresh.\n`
await writeFile(path.join(root, 'src/content/liveBlogContent.ts'), `${banner}export const liveBlogContent = ${JSON.stringify(blogContent, null, 2)} as const\n`)
await writeFile(path.join(root, 'src/content/liveProductContent.ts'), `${banner}export const liveProductContent = ${JSON.stringify(productContent, null, 2)} as const\n`)
await writeFile(path.join(root, 'src/content/livePageContent.ts'), `${banner}export const livePageContent = ${JSON.stringify(pageContent, null, 2)} as const\n`)
await writeFile(path.join(root, 'src/content/liveSeo.ts'), `${banner}export const liveSeo = ${JSON.stringify(seo, null, 2)} as const\n`)

await browser.close()
const schemaGenerator = path.join(root, 'scripts', 'generate-live-faq-schema.mjs')
if (existsSync(schemaGenerator)) {
  const { spawn } = await import('node:child_process')
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [schemaGenerator], { cwd: root, stdio: 'inherit' })
    child.once('error', reject)
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`FAQ schema generator exited with ${code}`)))
  })
}
console.log(JSON.stringify({ posts: posts.length, products: products.length, pages: Object.keys(pageContent).length, seoRoutes: Object.keys(seo).length, downloadedImages: jobs.length }, null, 2))
