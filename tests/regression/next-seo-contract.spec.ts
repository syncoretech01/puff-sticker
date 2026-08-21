import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

import {
  CANONICALIZING_ALIAS_CONTRACTS,
  CANONICAL_SITEMAP_ROUTES,
  EXPLICIT_NOT_FOUND_CONTRACTS,
  LEGACY_SITEMAP_PATHS,
  PRIMARY_ROUTE_CONTRACTS,
  PRODUCTION_ROBOTS_TXT,
  SITEMAP_GROUPS,
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

  for (const route of EXPLICIT_NOT_FOUND_CONTRACTS) {
    test(`explicit negative ${route.path} remains a noindex 404`, async ({ page }) => {
      const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' })
      expect(response?.status()).toBe(route.status)
      await expect(page.locator('main h1')).toHaveCount(1)
      expect(await metaValues(page, 'meta[name="robots"]')).toEqual([route.robots])
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
