import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { registerHooks } from 'node:module'

import currentBase from '../src/lib/seo/fixtures/production-seo-capture-2026-09-30.json' with { type: 'json' }
import checkoutSupplement from '../src/lib/seo/fixtures/production-seo-capture-2026-10-01-checkout.json' with { type: 'json' }

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context)
    } catch (error) {
      if (error?.code === 'ERR_MODULE_NOT_FOUND' && (specifier.startsWith('./') || specifier.startsWith('../')) && !/\.[cm]?[jt]sx?$/.test(specifier)) {
        return nextResolve(`${specifier}.ts`, context)
      }
      throw error
    }
  },
})

const { FROZEN_PRODUCTION_SEO_FIXTURE: frozen } = await import('../src/lib/seo/frozen-production-evidence-fixture.ts')

const OUTPUT = resolve('docs/migration/evidence/production-seo-diff-2026-10-01.json')
const current = {
  ...currentBase,
  source: 'production-crawl-2026-09-30-with-checkout-supplement-2026-10-01',
  capturedOn: '2026-10-01',
  routeCount: Object.keys({ ...currentBase.pages, ...checkoutSupplement.pages }).length,
  pages: { ...currentBase.pages, ...checkoutSupplement.pages },
}
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const stableValue = (value) => {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]))
  return value
}
const stableHash = (value) => sha256(JSON.stringify(stableValue(value)))
const sitemapPaths = (fixture) => {
  const compatibilityBody = fixture.endpoints['/sitemap.xml']?.body ?? ''
  const bodies = compatibilityBody.includes('<sitemapindex')
    ? ['/post-sitemap.xml', '/page-sitemap.xml', '/product-sitemap.xml', '/product_cat-sitemap.xml'].map((path) => fixture.endpoints[path]?.body ?? '')
    : [compatibilityBody]
  return [...new Set(bodies.flatMap((body) => [...body.matchAll(/<loc>https:\/\/puffsticker\.com([^<]+)<\/loc>/g)]
    .map((match) => match[1] === '/' ? '/' : `/${match[1].split('/').filter(Boolean).join('/')}`)))].sort()
}

const allPaths = [...new Set([...Object.keys(frozen.pages), ...Object.keys(current.pages)])].sort()
const routeDiffs = Object.fromEntries(allPaths.map((path) => {
  const before = frozen.pages[path]
  const after = current.pages[path]
  const fields = {
    status: [before?.status ?? null, after?.status ?? null],
    canonical: [before?.coreMetadata.canonical ?? null, after?.coreMetadata.canonical ?? null],
    metadataHash: [before ? stableHash(before.coreMetadata) : null, after ? stableHash(after.coreMetadata) : null],
    openGraphHash: [before ? stableHash(before.openGraph) : null, after ? stableHash(after.openGraph) : null],
    twitterHash: [before ? stableHash(before.twitter) : null, after ? stableHash(after.twitter) : null],
    meaningfulTextHash: [before?.content.meaningfulTextHash ?? null, after?.content.meaningfulTextHash ?? null],
    headingsHash: [before?.content.headingsHash ?? null, after?.content.headingsHash ?? null],
    internalLinksHash: [before?.content.internalLinksHash ?? null, after?.content.internalLinksHash ?? null],
    schemaHash: [before ? stableHash(before.structuredData.normalizedGraphHashes) : null, after ? stableHash(after.structuredData.normalizedGraphHashes) : null],
    assetsHash: [before?.content.imagesHash ?? null, after?.content.imagesHash ?? null],
  }
  const changed = Object.fromEntries(Object.entries(fields).filter(([, pair]) => pair[0] !== pair[1]))
  return [path, {
    classification: !before ? 'added-current' : !after ? 'missing-current' : after.status === 404 ? 'current-404-preserve-frozen' : Object.keys(changed).length ? 'changed-current' : 'unchanged',
    reconciliation: after?.status === 200 ? (path === '/checkout' ? 'use-2026-10-01-supplement' : 'use-2026-09-30') : before ? 'preserve-frozen-2026-09-02' : 'not-implemented',
    changed,
  }]
}))

const endpointPaths = [...new Set([...Object.keys(frozen.endpoints), ...Object.keys(current.endpoints)])].sort()
const endpointDiffs = Object.fromEntries(endpointPaths.map((path) => {
  const before = frozen.endpoints[path]
  const after = current.endpoints[path]
  const requested = (endpoint) => endpoint?.redirectChain?.[0] ?? endpoint
  const terminal = (endpoint) => endpoint?.redirectChain?.at(-1) ?? endpoint
  return [path, {
    requested: {
      before: before ? { status: requested(before).status, location: requested(before).location ?? null, contentType: requested(before).contentType } : null,
      current: after ? { status: requested(after).status, location: requested(after).location ?? null, contentType: requested(after).contentType } : null,
    },
    terminal: {
      before: before ? { status: terminal(before).status, finalUrl: before.finalUrl, bodyHash: before.normalizedBodyHash } : null,
      current: after ? { status: terminal(after).status, finalUrl: after.finalUrl, bodyHash: after.normalizedBodyHash } : null,
    },
  }]
}))

const frozenSitemap = sitemapPaths(frozen)
const currentSitemap = sitemapPaths(current)
const classificationCounts = Object.values(routeDiffs).reduce((counts, route) => ({ ...counts, [route.classification]: (counts[route.classification] ?? 0) + 1 }), {})
const report = {
  schemaVersion: 1,
  generatedOn: '2026-10-01',
  source: {
    frozen: { capturedOn: frozen.capturedOn, routeCount: frozen.routeCount, endpointCount: frozen.endpointCount },
    current: { capturedOn: current.capturedOn, routeCount: current.routeCount, endpointCount: current.endpointCount },
  },
  policy: {
    current200: 'use current evidence',
    current404PreviouslyKnown: 'preserve frozen route, content and SEO coverage',
    current404PreviouslyUnknown: 'do not invent coverage',
  },
  summary: {
    classifications: classificationCounts,
    currentStatusCounts: Object.values(current.pages).reduce((counts, page) => ({ ...counts, [page.status]: (counts[page.status] ?? 0) + 1 }), {}),
    sitemap: { frozen: frozenSitemap.length, current: currentSitemap.length, added: currentSitemap.filter((path) => !frozenSitemap.includes(path)), removed: frozenSitemap.filter((path) => !currentSitemap.includes(path)) },
  },
  endpoints: endpointDiffs,
  routes: routeDiffs,
}

await mkdir(dirname(OUTPUT), { recursive: true })
await writeFile(OUTPUT, `${JSON.stringify(report, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' })
console.log(JSON.stringify({ output: OUTPUT, sha256: sha256(JSON.stringify(report)), summary: report.summary }, null, 2))
