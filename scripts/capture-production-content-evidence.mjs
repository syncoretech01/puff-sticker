/**
 * Captures sanitized semantic <main> markup and first-party image assets for
 * the dated production sitemap. Inline presentation and executable behavior
 * are deliberately removed so the protected local design remains authoritative.
 */
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, posix, resolve } from 'node:path'
import { chromium } from '@playwright/test'

const CAPTURE_DATE = process.env.PUFF_PRODUCTION_SEO_CAPTURE_DATE?.trim()
if (!CAPTURE_DATE || !/^\d{4}-\d{2}-\d{2}$/.test(CAPTURE_DATE)) {
  throw new Error('Set PUFF_PRODUCTION_SEO_CAPTURE_DATE=YYYY-MM-DD')
}

const ORIGIN = 'https://puffsticker.com'
const CAPTURE_SUFFIX = process.env.PUFF_PRODUCTION_SEO_CAPTURE_SUFFIX?.trim() ?? ''
if (CAPTURE_SUFFIX && !/^[a-z0-9-]+$/.test(CAPTURE_SUFFIX)) throw new Error('PUFF_PRODUCTION_SEO_CAPTURE_SUFFIX must be lowercase kebab-case')
const EXPLICIT_CONTENT_PATHS = (process.env.PUFF_PRODUCTION_CONTENT_PATHS ?? '')
  .split(',').map((value) => value.trim()).filter(Boolean)
const SEO_PATH = resolve(`src/lib/seo/fixtures/production-seo-capture-${CAPTURE_DATE}${CAPTURE_SUFFIX ? `-${CAPTURE_SUFFIX}` : ''}.json`)
const OUTPUT_PATH = resolve(`src/content/fixtures/production-content-${CAPTURE_DATE}${CAPTURE_SUFFIX ? `-${CAPTURE_SUFFIX}` : ''}.json`)
const PUBLIC_PREFIX = `/assets/production-${CAPTURE_DATE}`
const PUBLIC_ROOT = resolve(`public/assets/production-${CAPTURE_DATE}`)
const USER_AGENT = 'PuffSticker-Parity-Capture/1.0 (+https://puffsticker.com/)'
const CONCURRENCY = 3

const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const normalizeText = (value) => (value ?? '').replace(/\s+/g, ' ').trim()
const seo = JSON.parse(await readFile(SEO_PATH, 'utf8'))
const sitemapBody = seo.endpoints['/sitemap.xml']?.body
if (!sitemapBody) throw new Error('The dated SEO fixture has no /sitemap.xml body')

const routeUrls = EXPLICIT_CONTENT_PATHS.length
  ? EXPLICIT_CONTENT_PATHS.map((value) => new URL(value, ORIGIN).href)
  : [...sitemapBody.matchAll(/<loc>([\s\S]*?)<\/loc>/g)].map((match) => match[1].trim())
const routePaths = routeUrls.map((value) => {
  const pathname = new URL(value).pathname
  return pathname === '/' ? '/' : `/${pathname.split('/').filter(Boolean).join('/')}`
})

function localAssetPath(sourceUrl, occupied) {
  const parsed = new URL(sourceUrl)
  const assetRelative = parsed.pathname.startsWith('/assets/')
    ? parsed.pathname.slice('/assets/'.length)
    : `external/${basename(parsed.pathname) || 'asset'}`
  let relative = assetRelative
  const existing = occupied.get(relative)
  if (existing && existing !== sourceUrl) {
    const extension = extname(relative)
    relative = `${relative.slice(0, -extension.length)}-${sha256(sourceUrl).slice(0, 10)}${extension}`
  }
  occupied.set(relative, sourceUrl)
  return `${PUBLIC_PREFIX}/${relative.split('\\').join('/')}`
}

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ userAgent: USER_AGENT, locale: 'en-US', timezoneId: 'UTC', serviceWorkers: 'block' })
await context.route('**/*', async (route) => {
  if (route.request().resourceType() === 'document') await route.continue()
  else await route.abort('blockedbyclient')
})

const pages = {}
const sourceAssets = new Set()
let cursor = 0

async function worker(number) {
  const page = await context.newPage()
  try {
    while (cursor < routePaths.length) {
      const path = routePaths[cursor]
      cursor += 1
      const sourceUrl = `${ORIGIN}${path === '/' ? '/' : `${path}/`}`
      const response = await page.goto(sourceUrl, { waitUntil: 'domcontentloaded', timeout: 90_000 })
      if (!response || response.status() !== 200) throw new Error(`${path}: content capture returned ${response?.status() ?? 'no response'}`)
      const captured = await page.evaluate(() => {
        const root = document.querySelector('main')?.cloneNode(true)
        if (!(root instanceof HTMLElement)) throw new Error('Document has no main element')
        for (const element of root.querySelectorAll('script,style,noscript,template,svg,canvas')) element.remove()
        const assets = new Set()
        for (const element of [root, ...root.querySelectorAll('*')]) {
          for (const attribute of [...element.attributes]) {
            const name = attribute.name.toLowerCase()
            const keep = ['href', 'src', 'srcset', 'alt', 'title', 'width', 'height', 'role', 'name', 'value', 'type', 'placeholder', 'for', 'colspan', 'rowspan', 'open'].includes(name)
              || name.startsWith('aria-')
            if (!keep || name.startsWith('on')) element.removeAttribute(attribute.name)
          }
          if (element instanceof HTMLAnchorElement && element.hasAttribute('href')) {
            const parsed = new URL(element.getAttribute('href') ?? '', document.baseURI)
            element.setAttribute('href', parsed.origin === location.origin ? `${parsed.pathname}${parsed.search}${parsed.hash}` : parsed.href)
          }
          if ((element instanceof HTMLImageElement || element instanceof HTMLSourceElement) && element.hasAttribute('src')) {
            const absolute = new URL(element.getAttribute('src') ?? '', document.baseURI).href
            element.setAttribute('src', absolute)
            assets.add(absolute)
          }
          if ((element instanceof HTMLImageElement || element instanceof HTMLSourceElement) && element.hasAttribute('srcset')) {
            const localized = (element.getAttribute('srcset') ?? '').split(',').map((candidate) => {
              const [url, descriptor] = candidate.trim().split(/\s+/, 2)
              const absolute = new URL(url, document.baseURI).href
              assets.add(absolute)
              return `${absolute}${descriptor ? ` ${descriptor}` : ''}`
            }).join(', ')
            element.setAttribute('srcset', localized)
          }
          if (element instanceof HTMLButtonElement || element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) {
            element.setAttribute('disabled', '')
          }
          if (element instanceof HTMLFormElement) {
            element.removeAttribute('action')
            element.removeAttribute('method')
            element.setAttribute('aria-disabled', 'true')
          }
        }
        return { html: root.innerHTML.trim(), text: (root.textContent ?? '').replace(/\s+/g, ' ').trim(), assets: [...assets] }
      })
      const expected = seo.pages[path]
      if (!expected || expected.status !== 200) throw new Error(`${path}: missing current 200 SEO evidence`)
      if (captured.text !== expected.content.meaningfulText) throw new Error(`${path}: semantic content drifted during capture`)
      for (const asset of captured.assets) sourceAssets.add(asset)
      pages[path] = {
        sourceUrl,
        semanticHtml: captured.html,
        semanticHtmlHash: sha256(captured.html),
        meaningfulTextHash: sha256(captured.text),
        sourceAssets: captured.assets,
      }
      process.stdout.write(`[content ${number}] ${path} ${captured.text.split(/\s+/).length} words\n`)
    }
  } finally {
    await page.close()
  }
}

try {
  await Promise.all(Array.from({ length: CONCURRENCY }, (_, index) => worker(index + 1)))
} finally {
  await context.close()
  await browser.close()
}

for (const path of routePaths) {
  const page = seo.pages[path]
  for (const image of page.content.images) if (image.src) sourceAssets.add(image.src)
  if (page.openGraph.image) sourceAssets.add(page.openGraph.image)
  if (page.twitter.image) sourceAssets.add(page.twitter.image)
}

const occupied = new Map()
const assetMap = new Map([...sourceAssets].sort().map((sourceUrl) => [sourceUrl, localAssetPath(sourceUrl, occupied)]))
for (const page of Object.values(pages)) {
  for (const [sourceUrl, localPath] of assetMap) page.semanticHtml = page.semanticHtml.replaceAll(sourceUrl, localPath)
  page.semanticHtmlHash = sha256(page.semanticHtml)
  page.localAssets = page.sourceAssets.map((sourceUrl) => assetMap.get(sourceUrl))
}

const assets = {}
for (const [sourceUrl, localPath] of assetMap) {
  const response = await fetch(sourceUrl, { headers: { 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(90_000) })
  if (!response.ok) throw new Error(`${sourceUrl}: asset returned ${response.status}`)
  const bytes = Buffer.from(await response.arrayBuffer())
  const diskPath = resolve('public', localPath.replace(/^\//, '').split('/').join(posix.sep))
  if (!diskPath.startsWith(PUBLIC_ROOT)) throw new Error(`${sourceUrl}: unsafe asset path ${diskPath}`)
  await mkdir(dirname(diskPath), { recursive: true })
  try {
    await writeFile(diskPath, bytes, { flag: 'wx' })
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error
    const existing = await readFile(diskPath)
    if (sha256(existing) !== sha256(bytes)) throw new Error(`${localPath}: existing asset bytes differ`)
  }
  assets[sourceUrl] = { localPath, contentType: response.headers.get('content-type'), byteLength: bytes.length, sha256: sha256(bytes) }
  process.stdout.write(`[asset] ${localPath}\n`)
}

const fixture = {
  schemaVersion: 1,
  source: `production-content-crawl-${CAPTURE_DATE}`,
  capturedOn: CAPTURE_DATE,
  origin: ORIGIN,
  routeCount: routePaths.length,
  assetCount: Object.keys(assets).length,
  sanitization: 'semantic main markup; scripts/styles/classes/inline presentation removed; controls disabled; first-party links localized',
  pages: Object.fromEntries(Object.entries(pages).sort(([left], [right]) => left.localeCompare(right))),
  assets,
}

await mkdir(dirname(OUTPUT_PATH), { recursive: true })
await writeFile(OUTPUT_PATH, `${JSON.stringify(fixture, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' })
console.log(JSON.stringify({ output: OUTPUT_PATH, routes: fixture.routeCount, assets: fixture.assetCount, hash: sha256(JSON.stringify(fixture)) }, null, 2))
