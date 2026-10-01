import { createHash } from 'node:crypto'

import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

import {
  CANONICALIZING_ALIAS_CONTRACTS,
  CANONICAL_SITEMAP_ROUTES,
  EXACT_SEO_ENDPOINT_PATHS,
  EXPLICIT_NOT_FOUND_CONTRACTS,
  LEGACY_SITEMAP_PATHS,
  PRIMARY_ROUTE_CONTRACTS,
  PRODUCTION_ROBOTS_TXT,
  SITEMAP_ENTRIES,
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
import {
  ARCHIVE_RELATIONSHIP_SOURCE,
  archiveRendererManifest,
  getArchiveContent,
  legacyArchivePaths,
  type ArchiveContent,
} from '../../src/content/archiveContent'
import { liveBlogContent } from '../../src/content/liveBlogContent'
import { livePageContent } from '../../src/content/livePageContent'
import { liveProductContent } from '../../src/content/liveProductContent'
import { productionDeltaBlogContent } from '../../src/content/productionDeltaContent'
import {
  extractPublishedFaqs,
  publishedPlainText,
  splitPublishedProductFaqs,
  stripPricomDemoImages,
} from '../../src/content/publishedHtml'
import { productionEndpointEvidence } from '../../src/lib/seo/production-evidence-fixture'
import currentContentFixture from '../../src/content/fixtures/production-content-2026-09-30.json' with { type: 'json' }
import checkoutContentFixture from '../../src/content/fixtures/production-content-2026-10-01-checkout.json' with { type: 'json' }
import { regressionEnvironment } from './environment'
import { gotoReady, installDeterministicBrowserState } from './helpers'

const sitemapPaths = new Set(CANONICAL_SITEMAP_ROUTES.map((route) => route.path))
const AUDITED_ARCHIVE_RELATIONSHIP_HASH = '2276daefde2eeb22d2ba38e1ad73de246756fcd0815a01df3112e392ea4291c0'
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

function publishedContentTokens(value: string) {
  return value.normalize('NFC').match(/[\p{L}\p{N}]+(?:['’.-][\p{L}\p{N}]+)*|[^\s\p{L}\p{N}]/gu) ?? []
}

function rawMainHtml(html: string) {
  return html.match(/<main\b[^>]*>[\s\S]*?<\/main>/i)?.[0] ?? ''
}

async function expectExactPublishedFragment(page: Page, selector: string, html: string) {
  const source = page.locator(selector)
  await expect(source, selector).toHaveCount(1)
  const observed = await source.evaluate((element) => {
    const semanticText = (root: Element) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      const segments: string[] = []
      let node: Node | null
      while ((node = walker.nextNode())) {
        const value = (node.textContent ?? '').replace(/\s+/g, ' ').trim()
        if (value) segments.push(value)
      }
      return segments.join(' ')
    }
    return {
      text: semanticText(element),
      headings: [...element.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((heading) => ({
        level: Number(heading.tagName.slice(1)),
        text: semanticText(heading),
      })),
      images: [...element.querySelectorAll('img')].map((image) => ({
        src: image.getAttribute('src') ?? '',
        alt: image.getAttribute('alt') ?? '',
      })),
      links: [...element.querySelectorAll('a[href]')].map((anchor) => anchor.getAttribute('href') ?? ''),
    }
  })
  const expectedHeadings = [...html.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map((match) => ({
    level: Number(match[1]),
    text: publishedPlainText(match[2]),
  }))
  const expectedImages = [...html.matchAll(/<img\b[^>]*>/gi)].map((match) => {
    const attributes = tagAttributes(match[0])
    return { src: attributes.src ?? '', alt: attributes.alt ?? '' }
  })
  const expectedLinks = [...html.matchAll(/<a\b[^>]*>/gi)].flatMap((match) => {
    const attributes = tagAttributes(match[0])
    return Object.hasOwn(attributes, 'href') ? [attributes.href] : []
  })

  expect(publishedContentTokens(observed.text), `${selector}: complete published text`).toEqual(
    publishedContentTokens(publishedPlainText(html)),
  )
  expect(
    observed.headings.map((heading) => ({ level: heading.level, tokens: publishedContentTokens(heading.text) })),
    `${selector}: heading inventory`,
  ).toEqual(expectedHeadings.map((heading) => ({
    level: heading.level,
    tokens: publishedContentTokens(heading.text),
  })))
  expect(observed.images, `${selector}: image and alt inventory`).toEqual(expectedImages)
  expect(observed.links, `${selector}: link inventory`).toEqual(expectedLinks)
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
    lastModified: entry.lastModified ?? '',
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
  expect(await metaValues(page, 'meta[name="robots"]')).toEqual(
    nextMetadata.robots === undefined ? [] : [nextMetadata.robots],
  )

  const exactTags = exactSocialMetaTags(route)
  const expectedTagValues = (attribute: 'property' | 'name', key: string) => exactTags
    .filter((tag) => tag.attribute === attribute && tag.key === key)
    .map((tag) => tag.content)
  for (const key of ['og:title', 'og:description', 'og:url', 'og:type', 'og:image', 'og:image:alt']) {
    expect(await metaValues(page, `meta[property="${key}"]`), key).toEqual(expectedTagValues('property', key))
  }
  for (const key of ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image', 'twitter:image:alt']) {
    expect(await metaValues(page, `meta[name="${key}"]`), key).toEqual(expectedTagValues('name', key))
  }

  const tagKeys = new Set(exactTags.map((tag) => `${tag.attribute}\u0000${tag.key}`))
  for (const compoundKey of tagKeys) {
    const [attribute, key] = compoundKey.split('\u0000')
    const expected = exactTags
      .filter((tag) => tag.attribute === attribute && tag.key === key)
      .map((tag) => tag.content)
    expect(await metaValues(page, `meta[${attribute}="${key}"]`), key).toEqual(expected)
  }
}

type ExpectedArchiveResult = {
  path: string
  source: string
  sourceUrl: string
  copy: string
}

function expectedArchiveResults(archive: ArchiveContent): ExpectedArchiveResult[] {
  const articles = archive.articles.map((relationship) => {
    const published = relationship.source.startsWith('production-delta-blog-content-')
      ? productionDeltaBlogContent[relationship.slug as keyof typeof productionDeltaBlogContent]
      : liveBlogContent[relationship.slug as keyof typeof liveBlogContent]
    if (!published) throw new Error(`${archive.path}: missing ${relationship.source} record for ${relationship.slug}`)
    return {
      path: `/blog/${relationship.slug}`,
      source: relationship.source,
      sourceUrl: published.sourceUrl,
      copy: publishedPlainText(published.excerptHtml),
    }
  })
  const products = archive.products.map((relationship) => {
    const published = liveProductContent[relationship.slug as keyof typeof liveProductContent]
    if (!published) throw new Error(`${archive.path}: missing ${relationship.source} record for ${relationship.slug}`)
    return {
      path: `/puffy-labels-stickers/${relationship.slug}`,
      source: relationship.source,
      sourceUrl: published.sourceUrl,
      copy: publishedPlainText(published.shortDescriptionHtml),
    }
  })
  return [...articles, ...products]
}

async function expectArchiveRenderer(page: Page, route: PageRouteContract, archive: ArchiveContent) {
  const expectedResults = expectedArchiveResults(archive)
  const root = page.locator('[data-archive-renderer]')
  await expect(root, `${route.path}: one route-owned archive renderer`).toHaveCount(1)

  const observed = await root.evaluate((element) => {
    const normalize = (value: string | null | undefined) => (value ?? '').replace(/\s+/g, ' ').trim()
    const style = getComputedStyle(element)
    const rect = element.getBoundingClientRect()
    const footer = document.querySelector('footer')
    const results = [...element.querySelectorAll<HTMLElement>('[data-archive-result-path]')].map((result) => ({
      path: result.getAttribute('data-archive-result-path') ?? '',
      source: result.getAttribute('data-archive-result-source') ?? '',
      sourceUrl: result.getAttribute('data-archive-source-url') ?? '',
      copy: normalize(result.querySelector<HTMLElement>('[data-archive-source-copy]')?.innerText),
      images: [...result.querySelectorAll<HTMLImageElement>('img')].map((image) => ({
        src: image.getAttribute('src') ?? '',
        alt: image.getAttribute('alt') ?? '',
      })),
    }))
    const unnamedLinks = [...element.querySelectorAll<HTMLAnchorElement>('a[href]')]
      .filter((link) => !normalize(link.textContent) && !normalize(link.getAttribute('aria-label')))
      .map((link) => link.getAttribute('href') ?? '')
    return {
      path: element.getAttribute('data-archive-path'),
      kind: element.getAttribute('data-archive-kind'),
      renderer: element.getAttribute('data-archive-renderer'),
      relationshipSource: element.getAttribute('data-archive-relationship-source'),
      resultCount: Number(element.getAttribute('data-archive-result-count')),
      heading: normalize(element.querySelector<HTMLElement>('h1')?.innerText),
      results,
      unnamedLinks,
      containsFormerGenericFallback: normalize(element.textContent).includes('Published PuffSticker articles and products grouped by their original archive relationship.'),
      insideMain: Boolean(element.closest('main')),
      beforeFooter: Boolean(footer && (element.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING)),
      presentation: {
        display: style.display,
        visibility: style.visibility,
        opacity: Number(style.opacity),
        width: rect.width,
        height: rect.height,
      },
    }
  })

  expect(observed.path, `${route.path}: route-owned archive path`).toBe(archive.path)
  expect(observed.kind, `${route.path}: route-owned archive kind`).toBe(archive.kind)
  expect(observed.renderer, `${route.path}: explicit archive renderer`).toBe(archive.renderer)
  expect(observed.relationshipSource, `${route.path}: audited relationship source`).toBe(ARCHIVE_RELATIONSHIP_SOURCE)
  expect(observed.resultCount, `${route.path}: exact result count`).toBe(expectedResults.length)
  expect(observed.heading, `${route.path}: exact route-specific archive label`).toBe(
    archive.kind === 'pagination' ? `${archive.heading} ${archive.label}` : archive.heading,
  )
  expect(observed.results, `${route.path}: exact source-backed archive relationships`).toEqual(
    expectedResults.map((result) => ({ ...result, images: expect.any(Array) })),
  )
  for (const result of observed.results) {
    expect(result.images.length, `${route.path}: ${result.path} has real media`).toBeGreaterThan(0)
    expect(result.images, `${route.path}: ${result.path} uses named committed media`).toEqual(
      result.images.map((image) => ({
        src: expect.stringMatching(/^\/assets\/(?!puff-logo\.webp$).+/),
        alt: expect.stringMatching(/\S/),
      })),
    )
  }
  expect(observed.unnamedLinks, `${route.path}: archive links have accessible names`).toEqual([])
  expect(observed.containsFormerGenericFallback, `${route.path}: no generic archive fallback copy`).toBe(false)
  expect(observed.insideMain, `${route.path}: archive renderer is inside main`).toBe(true)
  expect(observed.beforeFooter, `${route.path}: archive renderer precedes SiteFooter`).toBe(true)
  expect(observed.presentation.display, `${route.path}: archive renderer display`).not.toBe('none')
  expect(observed.presentation.visibility, `${route.path}: archive renderer visibility`).toBe('visible')
  expect(observed.presentation.opacity, `${route.path}: archive renderer opacity`).toBeGreaterThan(0)
  expect(observed.presentation.width, `${route.path}: archive renderer width`).toBeGreaterThan(0)
  expect(observed.presentation.height, `${route.path}: archive renderer height`).toBeGreaterThan(0)
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
  expect(rawMetaValues(rawHtml, 'name', 'robots'), `${route.path}: raw robots`).toEqual(
    route.metadata.robots === null ? [] : [route.metadata.robots],
  )
  expect(rawJsonLdGraphs(rawHtml), `${route.path}: raw exact JSON-LD graphs`).toEqual(route.structuredData)
  expect(wordCount(rawMainText(rawHtml)), `${route.path}: raw meaningful server content`).toBeGreaterThanOrEqual(
    route.audit.minimumMeaningfulWordCount,
  )

  expect(rawHtml, `${route.path}: no global production-content appendix`).not.toContain('data-production-content-parity=')
  const archive = getArchiveContent(route.renderPath)
  if (archive) {
    const mainHtml = rawMainHtml(rawHtml)
    const archiveIndex = mainHtml.indexOf(`data-archive-renderer="${archive.renderer}"`)
    const footerIndex = mainHtml.search(/<footer\b/i)
    expect(archiveIndex, `${route.path}: route-owned archive is server rendered`).toBeGreaterThan(-1)
    expect(footerIndex, `${route.path}: SiteFooter is server rendered`).toBeGreaterThan(-1)
    expect(archiveIndex, `${route.path}: server archive precedes SiteFooter`).toBeLessThan(footerIndex)
    for (const result of expectedArchiveResults(archive)) {
      expect(mainHtml, `${route.path}: server result ${result.path}`).toContain(`data-archive-result-path="${result.path}"`)
      expect(mainHtml, `${route.path}: server source ${result.source}`).toContain(`data-archive-result-source="${result.source}"`)
    }
  } else {
    expect(rawHtml, `${route.path}: non-archive route has no archive renderer`).not.toContain('data-archive-renderer=')
  }

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
  if (archive) await expectArchiveRenderer(page, route, archive)

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
    expect(PRIMARY_ROUTE_CONTRACTS).toHaveLength(77)
    expect(CANONICALIZING_ALIAS_CONTRACTS).toHaveLength(79)
    expect(TRAILING_SLASH_REDIRECTS).toHaveLength(155)
    expect(currentContentFixture.routeCount).toBe(72)
    expect(currentContentFixture.assetCount).toBe(230)
    expect(checkoutContentFixture.routeCount).toBe(1)
    expect(checkoutContentFixture.assetCount).toBe(0)
    expect(Object.keys(currentContentFixture.pages).sort()).toEqual(
      CANONICAL_SITEMAP_ROUTES.map((route) => route.path).sort(),
    )
    expect(archiveRendererManifest).toHaveLength(40)
    expect(new Set(legacyArchivePaths).size).toBe(40)
    const relationshipSnapshot = archiveRendererManifest.map((archive) => ({
      path: archive.path,
      articles: archive.articles,
      products: archive.products,
    }))
    expect(createHash('sha256').update(JSON.stringify(relationshipSnapshot)).digest('hex')).toBe(
      AUDITED_ARCHIVE_RELATIONSHIP_HASH,
    )
    const contractedArchivePaths = PRIMARY_ROUTE_CONTRACTS
      .filter((route) => route.kind === 'blog-tag' || route.kind === 'product-tag' || route.kind === 'pagination')
      .map((route) => route.path)
      .sort()
    expect(contractedArchivePaths).toEqual(['/product-tag/embossed-stickers', '/product-tag/pu-labels'])
    expect(contractedArchivePaths.every((path) => legacyArchivePaths.includes(path))).toBe(true)
    for (const archive of archiveRendererManifest) {
      expect(archive.relationshipSource).toBe(ARCHIVE_RELATIONSHIP_SOURCE)
      expect(archive.renderer === 'published-blog-archive' || archive.renderer === 'published-product-tag').toBe(true)
      expect(expectedArchiveResults(archive).length).toBeGreaterThan(0)
    }
  })

  for (const route of PRIMARY_ROUTE_CONTRACTS) {
    test(`primary ${route.publicPath} matches exact rendered SEO`, async ({ page }) => {
      await assertRenderedPage(page, route)
    })
  }

  const currentArticleSources = Object.entries(currentContentFixture.pages)
    .filter(([path]) => path.startsWith('/blog/') && path.split('/').filter(Boolean).length === 2)
  for (const [path, published] of currentArticleSources) {
    test(`current article ${path} renders its complete dated semantic source`, async ({ page }) => {
      const response = await gotoReady(page, `${path}/`)
      expect(response.status()).toBe(200)
      await expectExactPublishedFragment(page, '[data-live-loaded="blog-article"]', published.semanticHtml)
    })
  }

  const currentProductSources = Object.entries(currentContentFixture.pages)
    .filter(([path]) => CANONICAL_SITEMAP_ROUTES.some((route) => route.path === path && route.kind === 'product'))
  for (const [path, published] of currentProductSources) {
    const route = PRIMARY_ROUTE_CONTRACTS.find((candidate) => candidate.path === path)
    if (!route) throw new Error(`Missing product route for current source ${path}`)
    test(`current product ${path} renders complete dated copy and FAQ sources`, async ({ page }) => {
      const response = await gotoReady(page, route.publicPath)
      expect(response.status()).toBe(200)
      await expectExactPublishedFragment(page, '.product-live-copy__long', published.semanticHtml)

      const expectedFaqs = extractPublishedFaqs(published.semanticHtml)
      const observedFaqs = await page.locator('.product-page-faq .faq-item').evaluateAll((items) => items.map((item) => {
        const semanticText = (root: Element | null) => {
          if (!root) return ''
          const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
          const segments: string[] = []
          let node: Node | null
          while ((node = walker.nextNode())) {
            const value = (node.textContent ?? '').replace(/\s+/g, ' ').trim()
            if (value) segments.push(value)
          }
          return segments.join(' ')
        }
        const question = item.querySelector('button span')?.cloneNode(true) as HTMLElement | undefined
        question?.querySelector('small')?.remove()
        return {
          question: semanticText(question ?? null),
          answer: semanticText(item.querySelector('.faq-answer-rich')),
        }
      }))
      expect(observedFaqs.map((faq) => faq.question), `${path}: FAQ questions`).toEqual(
        expectedFaqs.map((faq) => faq.question),
      )
      expect(observedFaqs.map((faq) => publishedContentTokens(faq.answer)), `${path}: FAQ answers`).toEqual(
        expectedFaqs.map((faq) => publishedContentTokens(publishedPlainText(faq.answerHtml))),
      )
    })
  }

  const directPageSources = [
    { path: '/', selector: '[data-live-loaded="page-home"] .official-page-source__content' },
    { path: '/about-us', selector: '[data-live-loaded="page-about-us"] .official-page-source__content' },
    { path: '/contact-us', selector: '[data-live-loaded="page-contact-us"] .official-page-source__content' },
    { path: '/request-a-quote', selector: '[data-live-loaded="page-request-a-quote"] .official-page-source__content' },
    { path: '/terms-of-service', selector: '[data-live-loaded="policy"]' },
    { path: '/reprint-policy', selector: '[data-live-loaded="policy"]' },
    { path: '/privacy-policy', selector: '[data-live-loaded="policy"]' },
    { path: '/payment-terms', selector: '[data-live-loaded="policy"]' },
    { path: '/shipping-policy', selector: '[data-live-loaded="policy"]' },
    { path: '/industries', selector: '[data-live-loaded="policy"]' },
    { path: '/puffy-labels-stickers', selector: '[data-live-loaded="category-description"] .official-page-source__content' },
    { path: '/flat-labels-stickers', selector: '[data-live-loaded="category-description"] .official-page-source__content' },
    { path: '/promotional-items', selector: '[data-live-loaded="category-description"] .official-page-source__content' },
    { path: '/cbd-packaging-boxes', selector: '[data-live-loaded="category-description"] .official-page-source__content' },
  ] as const
  for (const definition of directPageSources) {
    test(`current page ${definition.path} renders its complete dated semantic source`, async ({ page }) => {
      const published = currentContentFixture.pages[definition.path]
      const response = await gotoReady(page, definition.path === '/' ? '/' : `${definition.path}/`)
      expect(response.status()).toBe(200)
      await expectExactPublishedFragment(page, definition.selector, published.semanticHtml)
    })
  }

  test('current checkout renders its complete dated noindex semantic source', async ({ page }) => {
    const response = await gotoReady(page, '/checkout/')
    expect(response.status()).toBe(200)
    await expectExactPublishedFragment(
      page,
      '[data-live-loaded="policy"]',
      checkoutContentFixture.pages['/checkout'].semanticHtml,
    )
    await expect(page.locator('[data-live-loaded="policy"] form')).toHaveAttribute('aria-disabled', 'true')
  })

  test('current checkout query variants remain 200 with the exact noindex canonical contract', async ({ request }) => {
    for (const query of [
      '?product=sample-pack',
      '?product=foam-stickers&qty=250&finish=matte',
      '?product=puffy-stickers&qty=250&finish=matte',
    ]) {
      const response = await request.get(`/checkout/${query}`)
      expect(response.status(), query).toBe(200)
      const html = await response.text()
      expect(rawTitle(html), query).toBe('Checkout | Puff Sticker')
      expect(rawLinkValues(html, 'canonical'), query).toEqual(['https://puffsticker.com/checkout/'])
      expect(rawMetaValues(html, 'name', 'robots'), query).toEqual(['noindex'])
    }
  })

  test('published FAQ page renders every committed question and answer exactly', async ({ page }) => {
    const expectedFaqs = extractPublishedFaqs(currentContentFixture.pages['/faqs'].semanticHtml)
    const response = await gotoReady(page, '/faqs/')
    expect(response.status()).toBe(200)
    const observedFaqs = await page.locator('[data-live-loaded="page-faqs"] .faq-item').evaluateAll((items) => items.map((item) => {
      const semanticText = (root: Element | null) => {
        if (!root) return ''
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
        const segments: string[] = []
        let node: Node | null
        while ((node = walker.nextNode())) {
          const value = (node.textContent ?? '').replace(/\s+/g, ' ').trim()
          if (value) segments.push(value)
        }
        return segments.join(' ')
      }
      const question = item.querySelector('button span')?.cloneNode(true) as HTMLElement | undefined
      question?.querySelector('small')?.remove()
      return {
        question: semanticText(question ?? null),
        answer: semanticText(item.querySelector('.faq-answer-rich')),
      }
    }))
    expect(observedFaqs.map((faq) => faq.question)).toEqual(expectedFaqs.map((faq) => faq.question))
    expect(observedFaqs.map((faq) => publishedContentTokens(faq.answer))).toEqual(
      expectedFaqs.map((faq) => publishedContentTokens(publishedPlainText(faq.answerHtml))),
    )
  })

  test('current production article renders its exact committed published body', async ({ page }) => {
    const slug = 'why-custom-stickers-feel-like-objects'
    const published = currentContentFixture.pages[`/blog/${slug}`]
    const response = await gotoReady(page, `/blog/${slug}/`)
    expect(response.status()).toBe(200)
    const rawHtml = await response.text()
    expect(rawMainHtml(rawHtml)).toContain('data-live-loaded="blog-article"')
    expect(rawMainHtml(rawHtml)).toContain('/assets/production-2026-09-30/')

    const source = page.locator('[data-live-loaded="blog-article"]')
    await expect(source).toHaveCount(1)
    const observed = await source.evaluate((element) => ({
      text: (() => {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
        const segments: string[] = []
        let node: Node | null
        while ((node = walker.nextNode())) {
          const value = (node.textContent ?? '').replace(/\s+/g, ' ').trim()
          if (value) segments.push(value)
        }
        return segments.join(' ')
      })(),
      headings: [...element.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((heading) => ({
        level: Number(heading.tagName.slice(1)),
        text: (heading.textContent ?? '').replace(/\s+/g, ' ').trim(),
      })),
      images: [...element.querySelectorAll('img')].map((image) => ({
        src: image.getAttribute('src') ?? '',
        alt: image.getAttribute('alt') ?? '',
      })),
      links: [...element.querySelectorAll('a[href]')].map((anchor) => anchor.getAttribute('href') ?? ''),
    }))
    const expectedHeadings = [...published.semanticHtml.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map((match) => ({
      level: Number(match[1]),
      text: publishedPlainText(match[2]),
    }))
    const expectedImages = [...published.semanticHtml.matchAll(/<img\b[^>]*>/gi)].map((match) => {
      const attributes = tagAttributes(match[0])
      return { src: attributes.src ?? '', alt: attributes.alt ?? '' }
    })
    const expectedLinks = [...published.semanticHtml.matchAll(/<a\b[^>]*>/gi)].map((match) => tagAttributes(match[0]).href ?? '')
    // HTML parsing can move insignificant whitespace around inline anchors.
    // Compare the complete ordered word-and-punctuation stream so every piece
    // of published copy remains exact while presentation whitespace is inert.
    expect(publishedContentTokens(observed.text)).toEqual(publishedContentTokens(publishedPlainText(published.semanticHtml)))
    expect(observed.headings).toEqual(expectedHeadings)
    expect(observed.images).toEqual(expectedImages)
    expect(observed.links).toEqual(expectedLinks)
    expect(observed.images).toHaveLength(expectedImages.length)
    expect(observed.images.every((image) => image.src.startsWith('/assets/production-2026-09-30/'))).toBe(true)

    await expect(page.locator('.article-page__hero img')).toHaveAttribute(
      'alt',
      'Why Some Custom Stickers Feel Like Objects',
    )
    await page.setViewportSize({ width: 390, height: 844 })
    const responsiveGeometry = await source.evaluate((element) => {
      const sourceRect = element.getBoundingClientRect()
      const captions = [...element.querySelectorAll<HTMLElement>('figcaption')].map((caption) => {
        const rect = caption.getBoundingClientRect()
        return { left: rect.left, right: rect.right, width: rect.width }
      })
      return {
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
        source: { left: sourceRect.left, right: sourceRect.right, width: sourceRect.width },
        captions,
      }
    })
    expect(responsiveGeometry.documentWidth - responsiveGeometry.viewportWidth).toBeLessThanOrEqual(1)
    expect(responsiveGeometry.captions).toHaveLength((published.semanticHtml.match(/<figcaption\b/g) ?? []).length)
    for (const caption of responsiveGeometry.captions) {
      expect(caption.left).toBeGreaterThanOrEqual(responsiveGeometry.source.left - 1)
      expect(caption.right).toBeLessThanOrEqual(responsiveGeometry.source.right + 1)
      expect(caption.width).toBeLessThanOrEqual(responsiveGeometry.source.width + 1)
    }
  })

  test('current blog and canonicalizing archive alias expose exact live article order', async ({ page }) => {
    const observedPaths = async () => page.locator('.blog-feature a[href^="/blog/"], .blog-grid .blog-card a[href^="/blog/"]').evaluateAll((anchors) => {
      const paths = anchors.map((anchor) => anchor.getAttribute('href') ?? '').filter(Boolean)
      return paths.filter((path, index) => paths.indexOf(path) === index)
    })
    const currentArticlePathSet = new Set(currentArticleSources.map(([path]) => path))
    const expectedPaths = [...currentContentFixture.pages['/blog'].semanticHtml.matchAll(/<a\b[^>]*href="(\/blog\/[^"?#]+)\/?"/gi)]
      .map((match) => match[1].replace(/\/$/, ''))
      .filter((path, index, paths) => currentArticlePathSet.has(path) && paths.indexOf(path) === index)
    await gotoReady(page, '/blog/')
    expect(await observedPaths()).toEqual(expectedPaths)
    await gotoReady(page, '/blog/category/sticker-psychology/')
    expect(await observedPaths()).toEqual(expectedPaths)
  })

  test('current shop exposes every product in the dated production source', async ({ page }) => {
    const expectedPaths = [...currentContentFixture.pages['/shop'].semanticHtml.matchAll(/<a\b[^>]*href="(\/(?:puffy-labels-stickers|flat-labels-stickers|promotional-items|cbd-packaging-boxes)\/[^"?#]+)\/?"/gi)]
      .map((match) => match[1].replace(/\/$/, ''))
      .filter((path, index, paths) => paths.indexOf(path) === index)
    await gotoReady(page, '/shop/')
    const observedPaths = await page.locator('.catalog-grid a[href]').evaluateAll((anchors) => anchors
      .map((anchor) => (anchor.getAttribute('href') ?? '').replace(/\/$/, ''))
      .filter((path, index, paths) => path.split('/').filter(Boolean).length === 2 && paths.indexOf(path) === index))
    expect([...observedPaths].sort()).toEqual([...expectedPaths].sort())
    expect(observedPaths).toHaveLength(31)
  })

  test('live-delta visible image alts and caption geometry preserve the audited documents', async ({ page }) => {
    const expected = [
      ['why-custom-stickers-feel-like-objects', 'Why Some Custom Stickers Feel Like Objects'],
      ['custom-puffy-stickers-guide', 'The Complete Guide to Custom Puffy Stickers'],
    ] as const

    await page.setViewportSize({ width: 390, height: 844 })
    for (const [slug, alt] of expected) {
      await gotoReady(page, `/blog/${slug}/`)
      await expect(page.locator('.article-page__hero img')).toHaveAttribute('alt', alt)
      const source = currentContentFixture.pages[`/blog/${slug}`]
      const geometry = await page.locator('[data-live-loaded="blog-article"]').evaluate((element) => {
        const sourceRect = element.getBoundingClientRect()
        return {
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: document.documentElement.clientWidth,
          source: { left: sourceRect.left, right: sourceRect.right, width: sourceRect.width },
          captions: [...element.querySelectorAll<HTMLElement>('figure')].map((caption) => {
            const rect = caption.getBoundingClientRect()
            return { left: rect.left, right: rect.right, width: rect.width }
          }),
        }
      })
      expect(geometry.documentWidth - geometry.viewportWidth, `${slug}: horizontal overflow`).toBeLessThanOrEqual(1)
      expect(geometry.captions, `${slug}: figure inventory`).toHaveLength((source.semanticHtml.match(/<figure\b/g) ?? []).length)
      for (const caption of geometry.captions) {
        expect(caption.left, `${slug}: caption left edge`).toBeGreaterThanOrEqual(geometry.source.left - 1)
        expect(caption.right, `${slug}: caption right edge`).toBeLessThanOrEqual(geometry.source.right + 1)
        expect(caption.width, `${slug}: caption width`).toBeLessThanOrEqual(geometry.source.width + 1)
      }
    }

    for (const archivePath of ['/blog/', '/blog/category/sticker-psychology/']) {
      await gotoReady(page, archivePath)
      for (const [slug, alt] of expected) {
        await expect(page.locator(`a[href="/blog/${slug}"] img`).first()).toHaveAttribute('alt', alt)
      }
    }
  })

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

  test('/sitemap.xml is the exact current flat 200 sitemap', async ({ request }) => {
    const evidence = productionEndpointEvidence(LEGACY_SITEMAP_PATHS.compatibilityIndex)
    expect(evidence.redirectChain).toBeUndefined()
    const response = await request.get(LEGACY_SITEMAP_PATHS.compatibilityIndex, { maxRedirects: 0 })
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toBe(evidence.contentType)
    expect(response.headers().location).toBeUndefined()
    const body = await response.text()
    expect(body).toBe(evidence.body)
    const byUrl = <T extends { url: string }>(left: T, right: T) => left.url.localeCompare(right.url)
    expect(xmlEntries(body).sort(byUrl)).toEqual(expectedEntries(SITEMAP_ENTRIES).sort(byUrl))
  })

  test('/sitemap_index.xml preserves the current one-hop 301 to /sitemap.xml', async ({ request }) => {
    const evidence = productionEndpointEvidence(LEGACY_SITEMAP_PATHS.index)
    const redirect = evidence.redirectChain![0]
    expect(redirect.status).toBe(301)
    expect(redirect.location).toBe(`${SITE_ORIGIN}/sitemap.xml`)
    const response = await request.get(LEGACY_SITEMAP_PATHS.index, { maxRedirects: 0 })
    expect(response.status()).toBe(301)
    expect(response.headers().location).toBe(`${SITE_ORIGIN}/sitemap.xml`)
  })

  test('all public SEO discovery endpoints match captured response bytes and MIME types', async ({ request }) => {
    let imageRows = 0
    for (const path of EXACT_SEO_ENDPOINT_PATHS) {
      const expected = productionEndpointEvidence(path)
      const response = await request.get(path, { maxRedirects: 0 })
      const redirect = expected.redirectChain?.[0]
      if (redirect) {
        expect(response.status(), path).toBe(redirect.status)
        expect(response.headers()['content-type'], path).toBe(redirect.contentType)
        expect(response.headers().location, path).toBe(redirect.location)
        expect(await response.body(), path).toHaveLength(0)
        continue
      }
      expect(response.status(), path).toBe(expected.status)
      expect(response.headers()['content-type'], path).toBe(expected.contentType)
      const body = await response.text()
      expect(body, path).toBe(expected.body)
      if (path.endsWith('-sitemap.xml')) imageRows += body.match(/<image:image>/g)?.length ?? 0
    }
    expect(imageRows, 'current flat sitemap image row count').toBe(0)
  })

  test('internal compatibility handlers do not create a duplicate crawl surface', async ({ request }) => {
    for (const path of ['/seo-internal/robots.txt', '/seo-internal/sitemap.xml', '/seo-internal/sitemap-redirect']) {
      const response = await request.get(path, { maxRedirects: 0 })
      expect(response.status(), path).toBe(404)
      expect(response.headers()['x-robots-tag'], path).toBe('noindex, follow')
    }

    for (const path of ['/seo-internal/sitemap.xml', '/seo-internal/sitemap-redirect']) {
      const forgedSitemapRewrite = await request.get(path, {
        headers: { 'x-puff-seo-internal-rewrite': '1' },
        maxRedirects: 0,
      })
      expect(forgedSitemapRewrite.status(), path).toBe(404)
      expect(forgedSitemapRewrite.headers()['x-robots-tag'], path).toBe('noindex, follow')
    }
  })

  const childSitemaps: ReadonlyArray<{ path: string, group: SitemapGroup }> = [
    { path: LEGACY_SITEMAP_PATHS.post, group: 'post' },
    { path: LEGACY_SITEMAP_PATHS.page, group: 'page' },
    { path: LEGACY_SITEMAP_PATHS.product, group: 'product' },
    { path: LEGACY_SITEMAP_PATHS.productCategory, group: 'product-category' },
  ]
  for (const sitemap of childSitemaps) {
    test(`${sitemap.path} preserves the current one-hop redirect to the flat sitemap`, async ({ request }) => {
      expect(SITEMAP_GROUPS[sitemap.group].length).toBeGreaterThan(0)
      const response = await request.get(sitemap.path, { maxRedirects: 0 })
      expect(response.status()).toBe(301)
      expect(response.headers().location).toBe(`${SITE_ORIGIN}/sitemap.xml`)
      expect(await response.body()).toHaveLength(0)
    })
  }

  test('local sitemap redirects to the flat sitemap and KML preserves the current 404', async ({ request }) => {
    const local = await request.get(LEGACY_SITEMAP_PATHS.local, { maxRedirects: 0 })
    expect(local.status()).toBe(301)
    expect(local.headers().location).toBe(`${SITE_ORIGIN}/sitemap.xml`)
    const kmlEvidence = productionEndpointEvidence(LEGACY_SITEMAP_PATHS.locations)
    const kml = await request.get(LEGACY_SITEMAP_PATHS.locations, { maxRedirects: 0 })
    expect(kml.status()).toBe(404)
    expect(kml.headers()['content-type']).toBe(kmlEvidence.contentType)
    expect(await kml.text()).toBe(kmlEvidence.body)
  })

  test('robots preserves the exact captured production directives', async ({ request }) => {
    const response = await request.get('/robots.txt')
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toMatch(/text\/plain/i)
    const body = (await response.text()).replace(/\r\n/g, '\n')
    expect(body).toBe(PRODUCTION_ROBOTS_TXT)
  })
})
