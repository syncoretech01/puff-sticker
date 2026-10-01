import { registerHooks } from 'node:module'

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
  PRIMARY_ROUTE_CONTRACTS,
  validatePageSeoObservation,
} = await import('../src/lib/seo/index.ts')

const route = PRIMARY_ROUTE_CONTRACTS.find((entry) => (
  entry.path === '/blog/kraft-look-packaging'
))
if (!route) throw new Error('Mutation fixture route is missing')

const schemaFixture = route.expectedSchemaTypes.map((type) => ({ '@type': type }))

const baseline = {
  path: route.publicPath,
  status: route.status,
  title: route.metadata.title,
  description: route.metadata.description,
  canonical: route.metadata.canonical,
  robots: route.metadata.robots,
  h1: ['Sticker Psychology'],
  meaningfulContent: `${'verified production content '.repeat(route.audit.minimumMeaningfulWordCount + 1)}`,
  structuredData: schemaFixture,
  images: [{ src: '/assets/catalog/puffy-stickers.webp', alt: 'Custom puffy stickers', decorative: false }],
  internalLinks: ['/', '/request-a-quote/'],
  inSitemap: route.inSitemap,
}

const baselineIssues = validatePageSeoObservation(route, baseline)
if (baselineIssues.length) {
  throw new Error(`Valid SEO observation was rejected:\n${baselineIssues.map((entry) => `${entry.code}: ${entry.detail}`).join('\n')}`)
}

const mutations = [
  ['wrong status', 'STATUS_MISMATCH', (value) => ({ ...value, status: 404 })],
  ['wrong canonical', 'CANONICAL_MISMATCH', (value) => ({ ...value, canonical: 'https://puffsticker.com/wrong/' })],
  ['wrong robots', 'ROBOTS_MISMATCH', (value) => ({ ...value, robots: 'noindex, follow' })],
  ['wrong title', 'TITLE_MISMATCH', (value) => ({ ...value, title: 'Changed title' })],
  ['missing schema', 'SCHEMA_TYPE_MISSING', (value) => ({ ...value, structuredData: [] })],
  ['collapsed meaningful content', 'CONTENT_TOO_THIN', (value) => ({ ...value, meaningfulContent: '' })],
  ['missing image alt', 'IMAGE_ALT_MISSING', (value) => ({
    ...value,
    images: [{ src: '/assets/catalog/puffy-stickers.webp', alt: '', decorative: false }],
  })],
  ['wrong sitemap membership', 'SITEMAP_MEMBERSHIP_MISMATCH', (value) => ({ ...value, inSitemap: !value.inSitemap })],
  ['broken internal link', 'INTERNAL_LINK_UNRESOLVED', (value) => ({ ...value, internalLinks: ['/definitely-not-a-production-route/'] })],
]

const failures = []
for (const [name, expectedCode, mutate] of mutations) {
  const issues = validatePageSeoObservation(route, mutate(structuredClone(baseline)))
  if (!issues.some((entry) => entry.code === expectedCode)) {
    failures.push(`${name}: expected ${expectedCode}, received ${issues.map((entry) => entry.code).join(', ') || 'no issues'}`)
  }
}

if (failures.length) throw new Error(`SEO mutation checks failed:\n${failures.join('\n')}`)

console.log(JSON.stringify({
  baseline: route.path,
  mutationsRejected: mutations.map(([name, expectedCode]) => ({ name, expectedCode })),
}, null, 2))
