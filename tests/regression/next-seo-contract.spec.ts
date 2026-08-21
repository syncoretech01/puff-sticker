import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

import {
  CANONICALIZING_ALIAS_CONTRACTS,
  CANONICAL_SITEMAP_ROUTES,
  EXACT_SEO_ENDPOINT_PATHS,
  EXPLICIT_NOT_FOUND_CONTRACTS,
  LEGACY_SITEMAP_PATHS,
  PRIMARY_ROUTE_CONTRACTS,
  PRODUCTION_ROBOTS_TXT,
  SITEMAP_GROUPS,
  SHOP_CANONICAL_QUERY_REDIRECT,
  SITE_ORIGIN,
  TRAILING_SLASH_REDIRECTS,
  collectSchemaTypes,
  exactSocialMetaTags,
  toNextMetadata,
  validatePageSeoObservation,
  type PageRouteContract,
  type SitemapEntryContract,
  type SitemapGroup,
} from '../../src/lib/seo/index'
import { productionEndpointEvidence } from '../../src/lib/seo/production-evidence-fixture'
import { regressionEnvironment } from './environment'
import { gotoReady, installDeterministicBrowserState } from './helpers'

const sitemapPaths = new Set(CANONICAL_SITEMAP_ROUTES.map((route) => route.path))
const redirectBatches = Array.from(
  { length: Math.ceil(TRAILING_SLASH_REDIRECTS.length / 20) },
  (_value, index) => TRAILING_SLASH_REDIRECTS.slice(index * 20, (index + 1) * 20),
)

function normalizeXmlText(value: string) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .trim()
}

function decodeHtml(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_match, decimal: string) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&apos;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
}

function tagAttributes(tag: string) {
  const attributes: Record<string, string> = {}
  for (const match of tag.matchAll(/([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    attributes[match[1].toLowerCase()] = decodeHtml(match[2] ?? match[3] ?? '')
  }
  return attributes
}

function rawMetaValues(html: string, attribute: 'name' | 'property', key: string) {
  return [...html.matchAll(/<meta\b[^>]*>/gi)]
    .map((match) => tagAttributes(match[0]))
    .filter((attributes) => attributes[attribute] === key)
    .map((attributes) => attributes.content ?? '')
}

function rawLinkValues(html: string, rel: string) {
  return [...html.matchAll(/<link\b[^>]*>/gi)]
    .map((match) => tagAttributes(match[0]))
    .filter((attributes) => attributes.rel === rel)
    .map((attributes) => attributes.href ?? '')
}

function rawJsonLdGraphs(html: string) {
  return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter((match) => tagAttributes(match[1]).type === 'application/ld+json')
    // Script data is raw text in HTML; entity decoding would corrupt literal
    // strings such as "&amp;" inside a captured JSON-LD value.
    .map((match) => JSON.parse(match[2]) as Record<string, unknown>)
}

function rawMainText(html: string) {
  const main = html.match(/<main\b[^>]*>[\s\S]*?<\/main>/i)?.[0] ?? ''
  return decodeHtml(main
    .replace(/<(?:script|style|template|noscript)\b[^>]*>[\s\S]*?<\/(?:script|style|template|noscript)>/gi, ' ')
    .replace(/<!--([\s\S]*?)-->/g, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
}

function rawTitle(html: string) {
  const titles = [...html.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title>/gi)]
  return titles.length ? decodeHtml(titles.at(-1)?.[1] ?? '').trim() : null
}

function wordCount(value: string) {
  return value.match(/[\p{L}\p{N}]+(?:['’.-][\p{L}\p{N}]+)*/gu)?.length ?? 0
}

function expectNotFoundRobots(robots: readonly (string | null)[], expected: string) {
  expect(robots.filter((value) => value === expected)).toHaveLength(1)
  const frameworkRobots = robots.filter((value) => value !== expected)
  expect(frameworkRobots.length).toBeLessThanOrEqual(1)
  expect(frameworkRobots.every((value) => value === 'noindex')).toBe(true)
}

function xmlValues(xml: string, tag: string) {
  return [...xml.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'g'))]
    .map((match) => normalizeXmlText(match[1]))
}

function xmlEntries(xml: string) {
  return [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((match) => ({
    url: xmlValues(match[1], 'loc')[0] ?? '',
    lastModified: xmlValues(match[1], 'lastmod')[0] ?? '',
    images: [...match[1].matchAll(/<image:image>([\s\S]*?)<\/image:image>/g)].map((imageMatch) => ({
      location: xmlValues(imageMatch[1], 'image:loc')[0] ?? '',
      title: xmlValues(imageMatch[1], 'image:title')[0] ?? null,
      caption: xmlValues(imageMatch[1], 'image:caption')[0] ?? null,
    })),
  }))
}

function expectedEntries(entries: readonly SitemapEntryContract[]) {
  return entries.map((entry) => ({
    url: entry.url,
    lastModified: entry.lastModified,
    images: entry.images.state === 'captured'
      ? entry.images.value.map((image) => ({
        location: image.location,
        title: image.title ?? null,
        caption: image.caption ?? null,
      }))
      : [],
  }))
}

async function metaValues(page: Page, selector: string, attribute = 'content') {
  return page.locator(selector).evaluateAll(
    (elements, name) => elements.map((element) => element.getAttribute(name)),
    attribute,
  )
}

async function expectMetadata(page: Page, route: PageRouteContract) {
  const nextMetadata = toNextMetadata(route)
  expect(await page.title()).toBe(nextMetadata.title)
  expect(await metaValues(page, 'meta[name="description"]')).toEqual(
    nextMetadata.description === undefined ? [] : [nextMetadata.description],
  )
  expect(await metaValues(page, 'link[rel="canonical"]', 'href')).toEqual([route.metadata.canonical])
  expect(await metaValues(page, 'meta[name="robots"]')).toEqual([nextMetadata.robots])

  expect(await metaValues(page, 'meta[property="og:title"]')).toEqual([nextMetadata.openGraph!.title])
  expect(await metaValues(page, 'meta[property="og:description"]')).toEqual(
    nextMetadata.openGraph!.description === undefined ? [] : [nextMetadata.openGraph!.description],
  )
  expect(await metaValues(page, 'meta[property="og:url"]')).toEqual([nextMetadata.openGraph!.url])
  expect(await metaValues(page, 'meta[property="og:type"]')).toEqual([nextMetadata.openGraph!.type])
  expect(await metaValues(page, 'meta[property="og:image"]')).toEqual(
    (nextMetadata.openGraph!.images ?? []).map((image) => image.url),
  )
  expect(await metaValues(page, 'meta[property="og:image:alt"]')).toEqual(
    (nextMetadata.openGraph!.images ?? []).flatMap((image) => image.alt ? [image.alt] : []),
  )

  expect(await metaValues(page, 'meta[name="twitter:card"]')).toEqual([nextMetadata.twitter!.card])
  expect(await metaValues(page, 'meta[name="twitter:title"]')).toEqual([nextMetadata.twitter!.title])
  expect(await metaValues(page, 'meta[name="twitter:description"]')).toEqual(
    nextMetadata.twitter!.description === undefined ? [] : [nextMetadata.twitter!.description],
  )
  expect(await metaValues(page, 'meta[name="twitter:image"]')).toEqual(
    (nextMetadata.twitter!.images ?? []).map((image) => image.url),
  )
  expect(await metaValues(page, 'meta[name="twitter:image:alt"]')).toEqual(
    (nextMetadata.twitter!.images ?? []).flatMap((image) => image.alt ? [image.alt] : []),
  )

  const exactTags = exactSocialMetaTags(route)
  const tagKeys = new Set(exactTags.map((tag) => `${tag.attribute}\u0000${tag.key}`))
  for (const compoundKey of tagKeys) {
    const [attribute, key] = compoundKey.split('\u0000')
    const expected = exactTags
      .filter((tag) => tag.attribute === attribute && tag.key === key)
      .map((tag) => tag.content)
    expect(await metaValues(page, `meta[${attribute}="${key}"]`), key).toEqual(expected)
  }
}

async function assertRenderedPage(page: Page, route: PageRouteContract) {
  await installDeterministicBrowserState(page)
  const response = await gotoReady(page, route.publicPath)
  expect(response.status()).toBe(route.status)
  const rawHtml = await response.text()

  // These assertions operate on the HTTP response itself, before hydration.
  // They prevent a visually correct client shell from hiding an empty or
  // approximate server document from crawlers.
  expect(rawTitle(rawHtml), `${route.path}: raw title`).toBe(route.metadata.title)
  expect(rawMetaValues(rawHtml, 'name', 'description'), `${route.path}: raw description`).toEqual(
    route.metadata.description === null ? [] : [route.metadata.description],
  )
  expect(rawLinkValues(rawHtml, 'canonical'), `${route.path}: raw canonical`).toEqual([route.metadata.canonical])
  expect(rawMetaValues(rawHtml, 'name', 'robots'), `${route.path}: raw robots`).toEqual([route.metadata.robots])
  expect(rawJsonLdGraphs(rawHtml), `${route.path}: raw exact JSON-LD graphs`).toEqual(route.structuredData)
  expect(wordCount(rawMainText(rawHtml)), `${route.path}: raw meaningful server content`).toBeGreaterThanOrEqual(
    route.audit.minimumMeaningfulWordCount,
  )

  const exactRawTags = exactSocialMetaTags(route)
  for (const tag of exactRawTags) {
    expect(
      rawMetaValues(rawHtml, tag.attribute, tag.key),
      `${route.path}: raw ${tag.attribute}=${tag.key}`,
    ).toEqual(exactRawTags
      .filter((candidate) => candidate.attribute === tag.attribute && candidate.key === tag.key)
      .map((candidate) => candidate.content))
  }
  await expectMetadata(page, route)

  const rendered = await page.evaluate(() => {
    const main = document.querySelector<HTMLElement>('#main-content')
      ?? document.querySelector<HTMLElement>('main')
    if (!main) throw new Error('Rendered page has no main landmark')
    return {
      title: document.title || null,
      description: document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content ?? null,
      canonical: document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ?? null,
      robots: document.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content ?? null,
      h1: [...main.querySelectorAll('h1')].map((heading) => heading.textContent?.replace(/\s+/g, ' ').trim() ?? ''),
      meaningfulContent: main.innerText,
      jsonLd: [...document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]')]
        .map((script) => script.textContent ?? ''),
      images: [...main.querySelectorAll<HTMLImageElement>('img')].map((image) => {
        const alt = image.getAttribute('alt')
        return {
          src: image.currentSrc || image.src,
          alt,
          decorative: alt === '' || image.getAttribute('role') === 'presentation' || image.getAttribute('aria-hidden') === 'true',
        }
      }),
      internalLinks: [...main.querySelectorAll<HTMLAnchorElement>('a[href]')]
        .map((anchor) => anchor.getAttribute('href'))
        .filter((href): href is string => href !== null),
    }
  })
  const structuredData = rendered.jsonLd.map((source, index) => {
    expect(source.trim(), `${route.path}: JSON-LD script ${index + 1} is empty`).not.toBe('')
    return JSON.parse(source) as Record<string, unknown>
  })
  expect(structuredData, `${route.path}: hydrated exact JSON-LD graphs`).toEqual(route.structuredData)

  const issues = validatePageSeoObservation(route, {
    path: route.path,
    status: response.status(),
    title: rendered.title,
    description: rendered.description,
    canonical: rendered.canonical,
    robots: rendered.robots,
    h1: rendered.h1,
    meaningfulContent: rendered.meaningfulContent,
    structuredData,
    images: rendered.images,
    internalLinks: rendered.internalLinks,
    inSitemap: sitemapPaths.has(route.path),
  })
  expect(issues).toEqual([])
  expect([...collectSchemaTypes(structuredData)].sort()).toEqual([...route.expectedSchemaTypes].sort())
}

async function getXml(request: APIRequestContext, path: string) {
  const response = await request.get(path)
  expect(response.status(), path).toBe(200)
  expect(response.headers()['content-type'], path).toMatch(/(?:application|text)\/(?:xml|plain)/i)
  return response.text()
}

test.describe('Next rendered SEO contract', () => {
  test.skip(regressionEnvironment.profile !== 'next', 'Runs against the Next server after the implementation layer exists.')

  test.beforeAll(() => {
    expect(PRIMARY_ROUTE_CONTRACTS).toHaveLength(91)
    expect(CANONICALIZING_ALIAS_CONTRACTS).toHaveLength(34)
    expect(TRAILING_SLASH_REDIRECTS).toHaveLength(124)
  })

  for (const route of PRIMARY_ROUTE_CONTRACTS) {
    test(`primary ${route.publicPath} matches exact rendered SEO`, async ({ page }) => {
      await assertRenderedPage(page, route)
    })
  }

  for (const route of CANONICALIZING_ALIAS_CONTRACTS) {
    test(`alias ${route.publicPath} remains 200 and canonicalizes in-document`, async ({ page }) => {
      await assertRenderedPage(page, route)
    })
  }

  redirectBatches.forEach((routes, index) => {
    test(`slash redirects batch ${index + 1} are exact one-hop 301 responses`, async ({ request }) => {
      const observations = await Promise.all(routes.map(async (route) => {
        const response = await request.get(route.path, { maxRedirects: 0 })
        const location = response.headers().location ?? ''
        return {
          path: route.path,
          status: response.status(),
          destination: location ? new URL(location, regressionEnvironment.targetOrigin).pathname : '',
        }
      }))
      expect(observations).toEqual(routes.map((route) => ({
        path: route.path,
        status: route.status,
        destination: route.destination,
      })))
    })
  })

  test('slash redirects preserve queries without creating wildcard aliases', async ({ request }) => {
    const redirected = await request.get('/about-us?utm_source=parity-gate', { maxRedirects: 0 })
    expect(redirected.status()).toBe(301)
    const location = new URL(redirected.headers().location ?? '', regressionEnvironment.targetOrigin)
    expect(location.pathname).toBe('/about-us/')
    expect(location.search).toBe('?utm_source=parity-gate')

    for (const path of ['/not-a-real-page', '/product/not-a-real-product', '/blog/tag/not-a-real-tag']) {
      const response = await request.get(path, { maxRedirects: 0 })
      expect(response.status(), path).toBe(404)
      expect(response.headers().location, path).toBeUndefined()
    }
  })

  test('/shop/ keeps its captured canonical target behavior', async ({ request }) => {
    const response = await request.get(
      `${SHOP_CANONICAL_QUERY_REDIRECT.pathname}${SHOP_CANONICAL_QUERY_REDIRECT.search}`,
      { maxRedirects: 0 },
    )
    expect(response.status()).toBe(SHOP_CANONICAL_QUERY_REDIRECT.status)
    const location = new URL(response.headers().location ?? '', regressionEnvironment.targetOrigin)
    expect(location.pathname).toBe(SHOP_CANONICAL_QUERY_REDIRECT.destination)
    expect(location.search).toBe('')
  })

  for (const route of EXPLICIT_NOT_FOUND_CONTRACTS) {
    test(`explicit negative ${route.path} remains a noindex 404`, async ({ page }) => {
      const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' })
      expect(response?.status()).toBe(route.status)
      const rawHtml = await response!.text()
      expect(rawTitle(rawHtml), `${route.path}: raw 404 title`).toBe('Page Not Found | PuffSticker.com')
      expect(rawMainText(rawHtml), `${route.path}: raw 404 content`).toContain('Page not found.')
      expectNotFoundRobots(rawMetaValues(rawHtml, 'name', 'robots'), route.robots)

      await expect(page.locator('main h1')).toHaveCount(1)
      const robots = await metaValues(page, 'meta[name="robots"]')
      // `notFound()` injects a framework-owned `noindex` in addition to the
      // exact route contract. Retain the explicit `noindex, follow` value and
      // allow only that one semantically redundant Next directive.
      expectNotFoundRobots(robots, route.robots)
    })
  }

  test('both sitemap indexes expose the exact five-child production surface', async ({ request }) => {
    const expectedLocations = [
      LEGACY_SITEMAP_PATHS.post,
      LEGACY_SITEMAP_PATHS.page,
      LEGACY_SITEMAP_PATHS.product,
      LEGACY_SITEMAP_PATHS.productCategory,
      LEGACY_SITEMAP_PATHS.local,
    ].map((path) => `${SITE_ORIGIN}${path}`)
    for (const path of ['/sitemap.xml', LEGACY_SITEMAP_PATHS.index]) {
      const xml = await getXml(request, path)
      expect(xmlValues(xml, 'loc'), path).toEqual(expectedLocations)
      expect(xmlValues(xml, 'lastmod'), path).toHaveLength(5)
    }
  })

  test('all public SEO discovery endpoints match captured response bytes and MIME types', async ({ request }) => {
    let imageRows = 0
    for (const path of EXACT_SEO_ENDPOINT_PATHS) {
      const expected = productionEndpointEvidence(path)
      const response = await request.get(path)
      expect(response.status(), path).toBe(expected.status)
      expect(response.headers()['content-type'], path).toBe(expected.contentType)
      const body = await response.text()
      expect(body, path).toBe(expected.body)
      if (path.endsWith('-sitemap.xml')) imageRows += body.match(/<image:image>/g)?.length ?? 0
    }
    expect(imageRows, 'captured child-sitemap image row count').toBe(173)
  })

  test('internal compatibility handlers do not create a duplicate crawl surface', async ({ request }) => {
    for (const path of ['/seo-internal/robots.txt', '/seo-internal/sitemap.xml']) {
      const response = await request.get(path, { maxRedirects: 0 })
      expect(response.status(), path).toBe(404)
      expect(response.headers()['x-robots-tag'], path).toBe('noindex, follow')
    }
  })

  const childSitemaps: ReadonlyArray<{ path: string, group: SitemapGroup }> = [
    { path: LEGACY_SITEMAP_PATHS.post, group: 'post' },
    { path: LEGACY_SITEMAP_PATHS.page, group: 'page' },
    { path: LEGACY_SITEMAP_PATHS.product, group: 'product' },
    { path: LEGACY_SITEMAP_PATHS.productCategory, group: 'product-category' },
  ]
  for (const sitemap of childSitemaps) {
    test(`${sitemap.path} exposes its exact canonical URLs and last-modified values`, async ({ request }) => {
      const xml = await getXml(request, sitemap.path)
      expect(xmlEntries(xml)).toEqual(expectedEntries(SITEMAP_GROUPS[sitemap.group]))
    })
  }

  test('local sitemap and KML preserve the production discovery endpoints', async ({ request }) => {
    const xml = await getXml(request, LEGACY_SITEMAP_PATHS.local)
    expect(xmlValues(xml, 'loc')).toEqual([`${SITE_ORIGIN}${LEGACY_SITEMAP_PATHS.locations}`])
    const kml = await request.get(LEGACY_SITEMAP_PATHS.locations)
    expect(kml.status()).toBe(200)
    expect(kml.headers()['content-type']).toMatch(/(?:application|text)\/(?:vnd\.google-earth\.kml\+xml|xml)/i)
    expect(await kml.text()).toContain('<kml')
  })

  test('robots preserves the exact captured production directives', async ({ request }) => {
    const response = await request.get('/robots.txt')
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toMatch(/text\/plain/i)
    const body = (await response.text()).replace(/\r\n/g, '\n')
    expect(body).toBe(PRODUCTION_ROBOTS_TXT)
  })
})
