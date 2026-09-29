/**
 * Read-only production SEO evidence capture.
 *
 * This script deliberately writes one new, reviewable fixture and does not
 * update route contracts or overwrite a prior audit. A caller must provide an
 * explicit YYYY-MM-DD `PUFF_PRODUCTION_SEO_CAPTURE_DATE`; the output filename
 * is derived from that date and created exclusively. Review the resulting
 * unreferenced fixture before composing it into the production contract.
 */
import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { registerHooks } from 'node:module'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context)
    } catch (error) {
      if (
        error?.code === 'ERR_MODULE_NOT_FOUND'
        && (specifier.startsWith('./') || specifier.startsWith('../'))
        && !/\.[cm]?[jt]sx?$/.test(specifier)
      ) return nextResolve(`${specifier}.ts`, context)
      throw error
    }
  },
})

const {
  CANONICALIZING_ALIAS_CONTRACTS,
  PRIMARY_ROUTE_CONTRACTS,
  SITE_ORIGIN,
} = await import('../src/lib/seo/route-contract.ts')
const { LEGACY_SITEMAP_PATHS } = await import('../src/lib/seo/sitemap-contract.ts')

const CONCURRENCY = 3
const CAPTURE_DATE = process.env.PUFF_PRODUCTION_SEO_CAPTURE_DATE?.trim()
if (!CAPTURE_DATE || !/^\d{4}-\d{2}-\d{2}$/.test(CAPTURE_DATE)) {
  throw new Error('Set PUFF_PRODUCTION_SEO_CAPTURE_DATE=YYYY-MM-DD for a requested new production observation')
}
const OUTPUT_PATH = resolve(`src/lib/seo/fixtures/production-seo-capture-${CAPTURE_DATE}.json`)
const COMPATIBILITY_SITEMAP_REDIRECT_CAPTURE_DATE = CAPTURE_DATE
const USER_AGENT = 'PuffSticker-Parity-Capture/1.0 (+https://puffsticker.com/)'

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]))
  }
  return value
}

function stableJson(value) {
  return JSON.stringify(stableValue(value))
}

function collectSchemaTypes(value, result = new Set()) {
  if (Array.isArray(value)) {
    for (const item of value) collectSchemaTypes(item, result)
    return result
  }
  if (!value || typeof value !== 'object') return result
  const type = value['@type']
  if (typeof type === 'string') result.add(type)
  else if (Array.isArray(type)) {
    for (const item of type) if (typeof item === 'string') result.add(item)
  }
  for (const item of Object.values(value)) collectSchemaTypes(item, result)
  return result
}

async function retry(label, operation, attempts = 3) {
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      if (attempt < attempts) await new Promise((resolveDelay) => setTimeout(resolveDelay, 750 * attempt))
    }
  }
  throw new Error(`${label} failed after ${attempts} attempts: ${lastError?.message ?? lastError}`)
}

const contractedProductionRoutes = [
  ...PRIMARY_ROUTE_CONTRACTS.filter((route) => route.productionSignals.scope === 'production'),
  ...CANONICALIZING_ALIAS_CONTRACTS,
]

const endpointPaths = [
  '/robots.txt',
  LEGACY_SITEMAP_PATHS.compatibilityIndex,
  LEGACY_SITEMAP_PATHS.index,
  LEGACY_SITEMAP_PATHS.post,
  LEGACY_SITEMAP_PATHS.page,
  LEGACY_SITEMAP_PATHS.product,
  LEGACY_SITEMAP_PATHS.productCategory,
  LEGACY_SITEMAP_PATHS.local,
  LEGACY_SITEMAP_PATHS.locations,
]

const endpoints = {}
const redirectStatuses = new Set([301, 302, 303, 307, 308])

async function captureEndpoint(path, requestedUrl) {
  const redirectChain = []
  const seenUrls = new Set()
  let nextUrl = requestedUrl

  for (let hop = 0; hop < 10; hop += 1) {
    if (seenUrls.has(nextUrl)) throw new Error(`${path}: redirect loop detected at ${nextUrl}`)
    seenUrls.add(nextUrl)

    const response = await retry(`${path} hop ${hop + 1}`, () => fetch(nextUrl, {
      redirect: 'manual',
      headers: { 'user-agent': USER_AGENT, accept: '*/*' },
      signal: AbortSignal.timeout(90_000),
    }))
    const body = (await response.text()).replace(/\r\n/g, '\n')
    const rawLocation = response.headers.get('location')
    const location = rawLocation ? new URL(rawLocation, nextUrl).href : null
    redirectChain.push({
      url: nextUrl,
      status: response.status,
      location,
      contentType: response.headers.get('content-type'),
      bodyLength: Buffer.byteLength(body),
      normalizedBodyHash: sha256(body),
    })

    if (redirectStatuses.has(response.status)) {
      if (!location) throw new Error(`${path}: ${response.status} response has no Location header`)
      nextUrl = location
      continue
    }

    return { response, body, redirectChain }
  }

  throw new Error(`${path}: redirect chain exceeded 10 responses`)
}

for (const path of endpointPaths) {
  const requestedUrl = `${SITE_ORIGIN}${path}`
  const { response, body, redirectChain } = await captureEndpoint(path, requestedUrl)
  endpoints[path] = {
    requestedUrl,
    finalUrl: response.url,
    status: response.status,
    ...(redirectChain.length > 1 ? {
      redirectChainSource: 'production-http-manual-hop-capture',
      redirectChainCapturedOn: path === LEGACY_SITEMAP_PATHS.compatibilityIndex
        ? COMPATIBILITY_SITEMAP_REDIRECT_CAPTURE_DATE
        : CAPTURE_DATE,
      redirectChain,
    } : {}),
    contentType: response.headers.get('content-type'),
    normalizedBodyHash: sha256(body),
    body,
  }
  process.stdout.write(`[endpoint] ${path} ${redirectChain.map((hop) => hop.status).join(' -> ')}\n`)
}

function sitemapDocumentUrls(body) {
  return [...body.matchAll(/<url>([\s\S]*?)<\/url>/g)].flatMap((match) => {
    const location = match[1].match(/<loc>([\s\S]*?)<\/loc>/)?.[1]?.trim()
    return location ? [location.replaceAll('&amp;', '&')] : []
  })
}

const htmlSitemapPaths = [
  LEGACY_SITEMAP_PATHS.post,
  LEGACY_SITEMAP_PATHS.page,
  LEGACY_SITEMAP_PATHS.product,
  LEGACY_SITEMAP_PATHS.productCategory,
]
const sitemapDiscoveredRoutes = htmlSitemapPaths.flatMap((sitemapPath) =>
  sitemapDocumentUrls(endpoints[sitemapPath].body).flatMap((location) => {
    const url = new URL(location)
    if (url.origin !== SITE_ORIGIN) throw new Error(`${sitemapPath}: unexpected cross-origin URL ${location}`)
    const path = url.pathname === '/' ? '/' : `/${url.pathname.split('/').filter(Boolean).join('/')}`
    return [{ path, publicPath: url.pathname }]
  }),
)
const routeByPath = new Map(contractedProductionRoutes.map((route) => [route.path, route]))
for (const route of sitemapDiscoveredRoutes) {
  if (!routeByPath.has(route.path)) routeByPath.set(route.path, route)
}
const productionRoutes = [...routeByPath.values()].sort((left, right) => left.path.localeCompare(right.path))

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  userAgent: USER_AGENT,
  locale: 'en-US',
  timezoneId: 'UTC',
  serviceWorkers: 'block',
})

// WordPress renders the audited content server-side. Blocking subresources
// makes capture deterministic and prevents third-party pixels/scripts from
// changing the observed DOM while leaving the production document untouched.
await context.route('**/*', async (route) => {
  if (route.request().resourceType() === 'document') await route.continue()
  else await route.abort('blockedbyclient')
})

const pages = {}
let routeCursor = 0

async function captureRoute(workerNumber) {
  const page = await context.newPage()
  try {
    while (routeCursor < productionRoutes.length) {
      const route = productionRoutes[routeCursor]
      routeCursor += 1
      const requestedUrl = `${SITE_ORIGIN}${route.publicPath}`
      const response = await retry(route.path, () => page.goto(requestedUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 90_000,
      }))
      if (!response) throw new Error(`${route.path}: navigation returned no document response`)

      const dom = await page.evaluate(() => {
        const normalizeText = (value) => (value ?? '').replace(/\s+/g, ' ').trim()
        const content = (selector, attribute = 'content') =>
          document.querySelector(selector)?.getAttribute(attribute) ?? null
        const metaMap = (attribute, prefix) => {
          const values = {}
          for (const element of document.querySelectorAll(`meta[${attribute}^="${prefix}"]`)) {
            const key = element.getAttribute(attribute)
            if (!key) continue
            const list = values[key] ?? []
            list.push(element.getAttribute('content') ?? '')
            values[key] = list
          }
          return values
        }
        const metaTags = (attribute, prefix) => [...document.querySelectorAll(`meta[${attribute}^="${prefix}"]`)]
          .flatMap((element) => {
            const key = element.getAttribute(attribute)
            return key ? [{ key, content: element.getAttribute('content') ?? '' }] : []
          })
        const absoluteUrl = (value) => {
          if (!value) return ''
          try { return new URL(value, document.baseURI).href } catch { return value }
        }
        const selectedRoot = document.querySelector('main')
          ?? document.querySelector('#main')
          ?? document.querySelector('#content')
          ?? document.body
        const contentRootSelector = selectedRoot === document.body
          ? 'body'
          : selectedRoot.id
            ? `#${selectedRoot.id}`
            : selectedRoot.tagName.toLowerCase()
        const root = selectedRoot.cloneNode(true)
        for (const element of root.querySelectorAll('script,style,noscript,template,svg,canvas')) element.remove()
        const meaningfulText = normalizeText(root.textContent)
        const headings = [...root.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((heading) => ({
          level: Number(heading.tagName.slice(1)),
          text: normalizeText(heading.textContent),
        })).filter((heading) => heading.text)
        const images = [...root.querySelectorAll('img')].map((image) => ({
          src: absoluteUrl(image.getAttribute('src') || image.getAttribute('data-src') || image.getAttribute('data-lazy-src')),
          alt: image.getAttribute('alt') ?? '',
        }))
        const internalLinks = []
        const internalLinkDetails = []
        const seenLinks = new Set()
        for (const anchor of root.querySelectorAll('a[href]')) {
          const rawHref = anchor.getAttribute('href')?.trim() ?? ''
          if (!rawHref || rawHref.startsWith('#') || /^(?:mailto|tel|javascript):/i.test(rawHref)) continue
          let parsed
          try { parsed = new URL(rawHref, document.baseURI) } catch { continue }
          if (parsed.hostname.replace(/^www\./, '') !== location.hostname.replace(/^www\./, '')) continue
          const href = parsed.href
          if (seenLinks.has(href)) continue
          seenLinks.add(href)
          internalLinks.push(href)
          internalLinkDetails.push({
            href,
            text: normalizeText(anchor.textContent),
            rel: anchor.getAttribute('rel') ?? '',
          })
        }
        const jsonLd = [...document.querySelectorAll('script[type="application/ld+json"]')].map((script, index) => {
          const raw = script.textContent?.trim() ?? ''
          try {
            return { index, parsed: JSON.parse(raw) }
          } catch (error) {
            return { index, error: String(error), rawHash: null }
          }
        })
        return {
          documentTitle: document.title,
          coreMetadata: {
            title: document.title,
            description: content('meta[name="description" i]'),
            canonical: content('link[rel="canonical" i]', 'href'),
            robots: content('meta[name="robots" i]'),
          },
          openGraph: {
            title: content('meta[property="og:title" i]'),
            description: content('meta[property="og:description" i]'),
            url: content('meta[property="og:url" i]'),
            image: content('meta[property="og:image" i]'),
            imageAlt: content('meta[property="og:image:alt" i]'),
            type: content('meta[property="og:type" i]'),
            all: metaMap('property', 'og:'),
            tags: metaTags('property', 'og:'),
          },
          twitter: {
            card: content('meta[name="twitter:card" i]'),
            title: content('meta[name="twitter:title" i]'),
            description: content('meta[name="twitter:description" i]'),
            image: content('meta[name="twitter:image" i]'),
            imageAlt: content('meta[name="twitter:image:alt" i]'),
            site: content('meta[name="twitter:site" i]'),
            creator: content('meta[name="twitter:creator" i]'),
            all: metaMap('name', 'twitter:'),
            tags: metaTags('name', 'twitter:'),
          },
          content: {
            contentRootSelector,
            meaningfulText,
            headings,
            images,
            internalLinks,
            internalLinkDetails,
          },
          jsonLd,
        }
      })

      const invalidJsonLd = dom.jsonLd.filter((entry) => !('parsed' in entry))
      if (invalidJsonLd.length) {
        throw new Error(`${route.path}: ${invalidJsonLd.length} JSON-LD scripts could not be parsed`)
      }
      const normalizedGraphs = dom.jsonLd.map((entry) => stableValue(entry.parsed))
      const contentSnapshot = {
        contentRootSelector: dom.content.contentRootSelector,
        meaningfulText: dom.content.meaningfulText,
        meaningfulTextHash: sha256(dom.content.meaningfulText),
        meaningfulWordCount: dom.content.meaningfulText ? dom.content.meaningfulText.split(/\s+/).length : 0,
        headings: dom.content.headings,
        headingsHash: sha256(stableJson(dom.content.headings)),
        images: dom.content.images,
        imagesHash: sha256(stableJson(dom.content.images)),
        internalLinks: dom.content.internalLinks,
        internalLinkDetails: dom.content.internalLinkDetails,
        internalLinksHash: sha256(stableJson(dom.content.internalLinkDetails)),
      }
      pages[route.path] = {
        requestedUrl,
        finalUrl: page.url(),
        status: response.status(),
        responseHeaders: {
          contentType: response.headers()['content-type'] ?? null,
          xRobotsTag: response.headers()['x-robots-tag'] ?? null,
        },
        coreMetadata: dom.coreMetadata,
        openGraph: dom.openGraph,
        twitter: dom.twitter,
        structuredData: {
          normalizedGraphs,
          normalizedGraphHashes: normalizedGraphs.map((graph) => sha256(stableJson(graph))),
          types: [...collectSchemaTypes(normalizedGraphs)].sort(),
        },
        content: contentSnapshot,
      }
      process.stdout.write(`[worker ${workerNumber}] ${route.path} ${response.status()}\n`)
    }
  } finally {
    await page.close()
  }
}

try {
  await Promise.all(Array.from({ length: CONCURRENCY }, (_, index) => captureRoute(index + 1)))
} finally {
  await context.close()
  await browser.close()
}

const failedPages = Object.entries(pages).filter(([, page]) => page.status !== 200)
const failedEndpoints = Object.entries(endpoints).filter(([, endpoint]) => endpoint.status !== 200)
if (Object.keys(pages).length !== productionRoutes.length || failedPages.length || failedEndpoints.length) {
  throw new Error(JSON.stringify({
    expectedPages: productionRoutes.length,
    capturedPages: Object.keys(pages).length,
    failedPages: failedPages.map(([path, page]) => ({ path, status: page.status })),
    failedEndpoints: failedEndpoints.map(([path, endpoint]) => ({ path, status: endpoint.status })),
  }, null, 2))
}

const fixture = {
  schemaVersion: 1,
  source: `production-crawl-${CAPTURE_DATE}`,
  capturedOn: CAPTURE_DATE,
  origin: SITE_ORIGIN,
  capturePolicy: {
    userAgent: USER_AGENT,
    browser: 'Playwright pinned Chromium',
    pageResourcePolicy: 'document-only',
    contentRootPriority: ['main', '#main', '#content', 'body'],
    textNormalization: 'Unicode DOM text; consecutive whitespace collapsed; trim',
    jsonLdNormalization: 'JSON parse; object keys recursively sorted; array order retained',
    fingerprintAlgorithm: 'sha256',
    rawHtmlRetained: false,
  },
  routeCount: productionRoutes.length,
  endpointCount: endpointPaths.length,
  pages: Object.fromEntries(Object.entries(pages).sort(([left], [right]) => left.localeCompare(right))),
  endpoints,
}

await writeFile(OUTPUT_PATH, `${JSON.stringify(fixture, null, 2)}\n`, {
  encoding: 'utf8',
  flag: 'wx',
})
console.log(JSON.stringify({
  output: OUTPUT_PATH,
  pages: fixture.routeCount,
  endpoints: fixture.endpointCount,
  fixtureHash: sha256(stableJson(fixture)),
}, null, 2))
