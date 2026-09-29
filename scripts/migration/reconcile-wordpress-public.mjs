import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { registerHooks } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

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

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(scriptDirectory, '../..')
const inputDirectory = path.join(repositoryRoot, 'data/migration/wordpress-public')
const reportDirectory = path.join(repositoryRoot, 'docs/migration/reports')
const reportPath = path.join(reportDirectory, 'wordpress-reconciliation.json')
const documentationPath = path.join(repositoryRoot, 'docs/migration/wordpress-reconciliation.md')

const [
  { catalogProducts, categories },
  { editorialArticleList },
  { productDetails },
  { productionDeltaBlogContent, productionDeltaPosts },
  { PRIMARY_ROUTE_CONTRACTS, TRAILING_SLASH_REDIRECTS },
] = await Promise.all([
  import('../../src/content/catalog.ts'),
  import('../../src/content/editorial.ts'),
  import('../../src/content/productDetails.ts'),
  import('../../src/content/productionDeltaContent.ts'),
  import('../../src/lib/seo/index.ts'),
])

const inputPaths = {
  manifest: path.join(inputDirectory, 'manifest.json'),
  content: path.join(inputDirectory, 'content.json'),
  exclusions: path.join(inputDirectory, 'exclusions.json'),
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
}

function sortByIdentity(values) {
  return [...values].sort((left, right) => {
    const a = `${left.scope ?? ''}:${left.identity ?? left.slug ?? left.id ?? ''}:${left.field ?? ''}`
    const b = `${right.scope ?? ''}:${right.identity ?? right.slug ?? right.id ?? ''}:${right.field ?? ''}`
    return a.localeCompare(b)
  })
}

function normalizePath(value) {
  if (!value) return null
  try {
    const pathname = new URL(String(value), 'https://puffsticker.com').pathname
    const compact = `/${pathname.split('/').filter(Boolean).join('/')}`
    return compact === '/' ? '/' : compact.replace(/\/$/, '')
  } catch {
    return null
  }
}

function slugify(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function normalizeSeoText(value) {
  const named = {
    amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', ndash: '–', mdash: '—', quot: '"', rsquo: '’', lsquo: '‘', hellip: '…',
  }
  return String(value ?? '')
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_match, decimal) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&([a-z]+);/gi, (match, entity) => named[entity.toLowerCase()] ?? match)
    .replace(/\s+/g, ' ')
    .trim()
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function firstArray(object, keys) {
  for (const key of keys) {
    const value = key.split('.').reduce((current, part) => current?.[part], object)
    if (Array.isArray(value)) return value
  }
  return []
}

function recordId(record) {
  return Number(record?.id ?? record?.postId ?? record?.termId ?? record?.attachmentId ?? record?.variationId)
}

function recordSlug(record) {
  return String(record?.slug ?? record?.postName ?? record?.name ?? '').trim()
}

function recordStatus(record) {
  return String(record?.status ?? record?.postStatus ?? '').toLowerCase()
}

function recordPath(record) {
  return normalizePath(record?.canonicalPath ?? record?.path ?? record?.permalink ?? record?.link ?? record?.url)
}

function recordDate(record) {
  return record?.dateGmt ?? record?.publishedAt ?? record?.date ?? record?.postDateGmt ?? record?.postDate ?? null
}

function recordModified(record) {
  return record?.modifiedGmt ?? record?.modifiedAt ?? record?.modified ?? record?.postModifiedGmt ?? record?.postModified ?? null
}

function recordContent(record) {
  return String(record?.content?.rendered ?? record?.contentHtml ?? record?.content ?? record?.description ?? '')
}

function taxonomySlugs(record, taxonomy) {
  const direct = record?.taxonomies?.[taxonomy]
    ?? record?.taxonomySlugs?.[taxonomy]
    ?? record?.terms?.[taxonomy]
    ?? record?.[taxonomy]
  if (Array.isArray(direct)) return direct.map((entry) => slugify(entry?.slug ?? entry?.name ?? entry)).filter(Boolean)
  const relations = [
    ...asArray(record?.termRelationships ?? record?.taxonomyTerms),
    ...asArray(record?.taxonomy),
  ]
  return relations
    .filter((entry) => !taxonomy || entry.taxonomy === taxonomy)
    .map((entry) => slugify(entry.slug ?? entry.name))
    .filter(Boolean)
}

function recordSeo(record) {
  const seo = record?.seo ?? record?.metadata ?? {}
  return {
    title: seo.title ?? seo.seoTitle ?? seo.rankMathTitle ?? null,
    description: seo.description ?? seo.metaDescription ?? seo.rankMathDescription ?? null,
    canonical: seo.canonical ?? seo.canonicalUrl ?? seo.rankMathCanonical ?? null,
    robots: seo.robots ?? seo.rankMathRobots ?? null,
  }
}

function findSchemaValues(value, predicate, output = []) {
  if (!value || typeof value !== 'object') return output
  if (Array.isArray(value)) {
    value.forEach((entry) => findSchemaValues(entry, predicate, output))
    return output
  }
  if (predicate(value)) output.push(value)
  Object.values(value).forEach((entry) => findSchemaValues(entry, predicate, output))
  return output
}

function livePublishedDate(route) {
  const candidates = findSchemaValues(route?.structuredData, (value) => {
    const types = asArray(value['@type']).length ? value['@type'] : [value['@type']]
    return types.includes('BlogPosting') || types.includes('Article') || types.includes('Product') || types.includes('WebPage')
  })
  return candidates.find((entry) => entry.datePublished)?.datePublished ?? null
}

function liveModifiedDate(route) {
  const candidates = findSchemaValues(route?.structuredData, (value) => {
    const types = asArray(value['@type']).length ? value['@type'] : [value['@type']]
    return types.includes('BlogPosting') || types.includes('Article') || types.includes('Product') || types.includes('WebPage')
  })
  return candidates.find((entry) => entry.dateModified)?.dateModified ?? null
}

function parseDate(value) {
  if (!value) return null
  const raw = String(value)
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw)
    ? `${raw.replace(' ', 'T')}Z`
    : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(raw)
      ? `${raw}Z`
      : raw
  const milliseconds = Date.parse(normalized)
  return Number.isNaN(milliseconds) ? null : milliseconds
}

function sameInstant(left, right) {
  const a = parseDate(left)
  const b = parseDate(right)
  if (a === null || b === null) return String(left ?? '') === String(right ?? '')
  return Math.abs(a - b) < 1000
}

function mediaKey(value) {
  if (!value) return null
  let pathname
  try {
    pathname = decodeURIComponent(new URL(String(value), 'https://puffsticker.com').pathname)
  } catch {
    return null
  }
  if (!pathname.includes('/wp-content/uploads/')) return null
  return pathname.toLowerCase().replace(/-\d+x\d+(?=\.[a-z0-9]+$)/, '')
}

function mediaOrigin(value) {
  try {
    return new URL(String(value), 'https://puffsticker.com').origin
  } catch {
    return null
  }
}

function attachmentUrls(attachment) {
  const file = attachment?.file
  const fileDirectory = file ? path.posix.dirname(String(file).replaceAll('\\', '/')) : ''
  const candidates = [
    attachment?.url,
    attachment?.sourceUrl,
    attachment?.guid,
    file,
    ...asArray(attachment?.urls),
    ...asArray(attachment?.variants).map((variant) => variant?.url ?? variant?.sourceUrl ?? variant),
    ...Object.values(attachment?.sizes ?? {}).map((variant) => variant?.url ?? variant?.sourceUrl ?? variant?.file ?? variant),
    ...asArray(attachment?.mediaMetadata?.files),
  ].filter(Boolean)
  return candidates.flatMap((candidate) => {
    const value = String(candidate).replaceAll('\\', '/')
    if (/^https?:\/\//i.test(value) || value.startsWith('/wp-content/uploads/')) return [value]
    const relative = value.includes('/') ? value.replace(/^\/+/, '') : `${fileDirectory}/${value}`.replace(/^\.\//, '')
    return [value, `https://puffsticker.com/wp-content/uploads/${relative}`]
  })
}

function attachmentAlt(attachment) {
  return String(attachment?.altText ?? attachment?.alt ?? attachment?.metadata?.altText ?? '')
}

function normalizeExclusionCounts(exclusions) {
  const candidates = [
    ...asArray(exclusions?.counts),
    ...asArray(exclusions?.excludedTypes),
    ...asArray(exclusions?.recordTypes),
    ...asArray(exclusions?.summary),
  ]
  const counted = !candidates.length && exclusions?.counts && typeof exclusions.counts === 'object'
    ? Object.entries(exclusions.counts).map(([type, count]) => ({ type, count: Number(count) || 0, disposition: 'excluded' }))
    : candidates.map((entry) => ({
    type: String(entry?.type ?? entry?.recordType ?? entry?.table ?? entry?.category ?? 'unspecified'),
    count: Number(entry?.count ?? entry?.records ?? entry?.excluded ?? 0) || 0,
    disposition: 'excluded',
  }))
  const neverParsed = asArray(exclusions?.tablePolicy?.neverParsed).map((entry) => ({
    type: String(entry?.category ?? entry?.type ?? 'unspecified-private-type'),
    count: null,
    disposition: 'never-parsed',
  }))
  return [...counted, ...neverParsed]
}

function prohibitedKeyPaths(value, prefix = '', output = []) {
  if (!value || typeof value !== 'object') return output
  if (Array.isArray(value)) {
    value.forEach((entry, index) => prohibitedKeyPaths(entry, `${prefix}[${index}]`, output))
    return output
  }
  const prohibited = /(^|_)(user_?pass|password|pass_hash|session|token|secret|billing_email|shipping_email|customer_email|payment_method|transaction_id|ip_address)(_|$)/i
  for (const [key, entry] of Object.entries(value)) {
    const keyPath = prefix ? `${prefix}.${key}` : key
    if (prohibited.test(key)) output.push(keyPath)
    prohibitedKeyPaths(entry, keyPath, output)
  }
  return output
}

const [manifestRaw, contentRaw, exclusionsRaw] = await Promise.all([
  readFile(inputPaths.manifest, 'utf8'),
  readFile(inputPaths.content, 'utf8'),
  readFile(inputPaths.exclusions, 'utf8'),
])
const [manifest, content, exclusions] = [manifestRaw, contentRaw, exclusionsRaw].map(JSON.parse)
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const inputHashes = {
  content: sha256(contentRaw),
  exclusions: sha256(exclusionsRaw),
}

const rawTerms = firstArray(content, ['terms', 'taxonomyTerms', 'content.terms', 'content.taxonomyTerms', 'taxonomy.terms', 'records.terms'])
const rawTermTaxonomy = firstArray(content, ['termTaxonomy', 'taxonomy.termTaxonomy', 'content.termTaxonomy', 'records.termTaxonomy'])
const rawTermMeta = firstArray(content, ['termMeta', 'taxonomy.termMeta', 'content.termMeta', 'records.termMeta'])
const rawTermById = new Map(rawTerms.map((term) => [String(term.id ?? term.termId), term]))
const rawTermMetaById = Map.groupBy(rawTermMeta, (meta) => String(meta.termId))
const enrichedTerms = rawTermTaxonomy.length
  ? rawTermTaxonomy.map((taxonomy) => {
      const term = rawTermById.get(String(taxonomy.termId)) ?? {}
      const termMeta = rawTermMetaById.get(String(taxonomy.termId)) ?? []
      const meta = Object.fromEntries(termMeta.map((entry) => [entry.key, entry.value]))
      return {
        ...term,
        taxonomyId: taxonomy.id,
        taxonomy: taxonomy.taxonomy,
        description: taxonomy.description,
        parentId: taxonomy.parentId,
        sourceCount: taxonomy.sourceCount,
        seo: {
          title: meta.rank_math_title ?? null,
          description: meta.rank_math_description ?? null,
          canonical: meta.rank_math_canonical_url ?? null,
          robots: meta.rank_math_robots ?? null,
        },
      }
    })
  : rawTerms

const collections = {
  posts: firstArray(content, ['posts', 'content.posts', 'records.posts']),
  pages: firstArray(content, ['pages', 'content.pages', 'records.pages']),
  products: firstArray(content, ['products', 'content.products', 'records.products']),
  redirects: firstArray(content, ['redirects', 'content.redirects', 'records.redirects']),
  variations: firstArray(content, ['variations', 'content.variations', 'records.variations']),
  attachments: firstArray(content, ['attachments', 'media', 'content.attachments', 'content.media', 'records.attachments']),
  terms: enrichedTerms,
  unindexedPublicMedia: firstArray(content, ['unindexedPublicMedia', 'content.unindexedPublicMedia', 'records.unindexedPublicMedia']),
}

const mismatches = []
const addMismatch = ({ code, severity = 'blocker', scope, identity, field, expected = null, observed = null, authority, resolution }) => {
  mismatches.push({ code, severity, scope, identity, field, expected, observed, authority, resolution })
}

const knownSourceHashes = {
  archive: '9faae116d4723390636a53bb0834879aa998c21ba2c42bc3c466647a9108b21d',
  database: 'c23d278a02a591d91e14ce77c82b9a878503f104e05901c11572866ed85dbc3d',
}
const declaredSourceHashes = {
  archive: String(manifest.provenance?.archiveSha256 ?? '').toLowerCase(),
  database: String(manifest.provenance?.databaseSha256 ?? '').toLowerCase(),
}
for (const source of Object.keys(knownSourceHashes)) {
  if (declaredSourceHashes[source] !== knownSourceHashes[source]) {
    addMismatch({
      code: 'SOURCE_HASH_MISMATCH', scope: 'provenance', identity: source, field: 'sha256',
      expected: knownSourceHashes[source], observed: declaredSourceHashes[source] || null,
      authority: 'verified-read-only-source-inventory',
      resolution: 'Stop and verify the isolated source before using any normalized record.',
    })
  }
}
for (const output of ['content', 'exclusions']) {
  const declared = String(manifest.outputs?.[output]?.sha256 ?? '').toLowerCase()
  if (declared !== inputHashes[output]) {
    addMismatch({
      code: 'NORMALIZED_OUTPUT_HASH_MISMATCH', scope: 'provenance', identity: `${output}.json`, field: 'sha256',
      expected: declared || null, observed: inputHashes[output], authority: 'normalized-manifest',
      resolution: 'Regenerate the normalized public artifacts and manifest together before reconciliation.',
    })
  }
}
if (manifest.runtimeIntegration !== 'none; this Phase 4 artifact is intentionally not imported by the public application') {
  addMismatch({
    code: 'RUNTIME_ISOLATION_NOT_DECLARED', scope: 'normalization', identity: 'manifest.json', field: 'runtimeIntegration',
    expected: 'none; this Phase 4 artifact is intentionally not imported by the public application',
    observed: manifest.runtimeIntegration ?? null, authority: 'Phase-4-isolation-policy',
    resolution: 'Keep normalized backup artifacts detached from the public runtime until the separately gated data-source phase.',
  })
}
if (content.scope !== 'published-public-wordpress-content-only') {
  addMismatch({
    code: 'PUBLIC_SCOPE_MISMATCH', scope: 'privacy', identity: 'content.json', field: 'scope',
    expected: 'published-public-wordpress-content-only', observed: content.scope ?? null,
    authority: 'public-only-migration-policy',
    resolution: 'Regenerate the artifact with the published-public scope before reconciliation.',
  })
}
for (const field of ['home', 'siteUrl']) {
  if (mediaOrigin(content.site?.[field]) !== 'https://puffsticker.com' || normalizePath(content.site?.[field]) !== '/') {
    addMismatch({
      code: 'SITE_ORIGIN_MISMATCH', scope: 'normalization', identity: 'site', field,
      expected: 'https://puffsticker.com/', observed: content.site?.[field] ?? null,
      authority: 'live-production',
      resolution: 'Normalize public records against the production PuffSticker origin.',
    })
  }
}

const requiredCollections = ['posts', 'pages', 'products', 'variations', 'attachments', 'terms', 'redirects']
for (const collection of requiredCollections) {
  if (!Array.isArray(collections[collection])) {
    addMismatch({
      code: 'NORMALIZED_COLLECTION_MISSING',
      scope: 'normalization',
      identity: collection,
      field: collection,
      authority: 'normalization-contract',
      resolution: `Regenerate content.json with a ${collection} array.`,
    })
  }
}

const prohibitedPaths = prohibitedKeyPaths(content)
if (prohibitedPaths.length) {
  addMismatch({
    code: 'PRIVATE_FIELD_IN_PUBLIC_ARTIFACT',
    scope: 'privacy',
    identity: 'content.json',
    field: 'keys',
    expected: 'No credential, session, payment, private customer, or secret-bearing fields',
    observed: prohibitedPaths.map((value) => value.replace(/\[\d+\]/g, '[]')),
    authority: 'public-only-migration-policy',
    resolution: 'Remove the prohibited fields in the normalizer; never copy their values into a report.',
  })
}

const productBySlug = new Map(collections.products.map((record) => [recordSlug(record), record]))
const productById = new Map(collections.products.map((record) => [recordId(record), record]))
const expectedProductSlugs = new Set(catalogProducts.map((product) => product.slug))

for (const expected of catalogProducts) {
  const actual = productBySlug.get(expected.slug)
  if (!actual) {
    addMismatch({
      code: 'PUBLISHED_PRODUCT_MISSING', scope: 'product', identity: expected.slug, field: 'record',
      expected: { id: expected.id, status: 'publish' }, observed: null,
      authority: 'live-production-and-protected-catalog',
      resolution: 'Recover the published product record before any data-source cutover.',
    })
    continue
  }
  if (recordStatus(actual) && recordStatus(actual) !== 'publish') {
    addMismatch({
      code: 'PRODUCT_NOT_PUBLISHED', scope: 'product', identity: expected.slug, field: 'status',
      expected: 'publish', observed: recordStatus(actual), authority: 'live-production',
      resolution: 'Reconcile the archive status with the live 200/indexable product before cutover.',
    })
  }
  if (recordId(actual) !== expected.id) {
    addMismatch({
      code: 'PRODUCT_ID_MISMATCH', scope: 'product', identity: expected.slug, field: 'id',
      expected: expected.id, observed: recordId(actual), authority: 'wordpress-backup-for-identity',
      resolution: 'Treat the backup ID as authoritative and update the protected mapping only in a separately gated data-source change.',
    })
  }
  const categoryCandidates = new Set([
    ...taxonomySlugs(actual, 'product_cat'),
    ...taxonomySlugs(actual, 'product-category'),
    slugify(actual.category?.slug ?? actual.category),
    slugify(actual.canonicalCategory),
  ].filter(Boolean))
  if (!categoryCandidates.has(expected.category)) {
    addMismatch({
      code: 'PRODUCT_CATEGORY_RELATION_MISMATCH', scope: 'product', identity: expected.slug, field: 'productCategory',
      expected: expected.category, observed: [...categoryCandidates].sort(), authority: 'wordpress-backup-for-relationships',
      resolution: 'Reconcile the product-term relationship while preserving the current canonical product URL.',
    })
  }
  if (!recordContent(actual).trim()) {
    addMismatch({
      code: 'PRODUCT_CONTENT_EMPTY', scope: 'product', identity: expected.slug, field: 'content',
      expected: 'Non-empty published product content', observed: 'empty', authority: 'wordpress-backup-for-source-content',
      resolution: 'Restore the product body from the backup before cutover; current protected rendering remains unchanged.',
    })
  }
}

for (const actual of collections.products) {
  const slug = recordSlug(actual)
  if (recordStatus(actual) === 'publish' && slug && !expectedProductSlugs.has(slug)) {
    addMismatch({
      code: 'ARCHIVE_ONLY_PUBLISHED_PRODUCT', severity: 'explained', scope: 'product', identity: slug, field: 'route',
      expected: 'Not in the 21-product live route contract', observed: { id: recordId(actual), status: 'publish' },
      authority: 'live-production-for-publication',
      resolution: 'Keep as an archive-only record and do not expose it unless later production URL evidence authorizes it.',
    })
  }
}

const expectedVariations = Object.values(productDetails).flatMap((product) =>
  asArray(product.commerce.variations).map((variation) => ({
    id: variation.id,
    parentId: product.productId,
    parentSlug: product.slug,
    label: variation.label,
  })),
)
const variationById = new Map(collections.variations.map((record) => [recordId(record), record]))
const expectedVariationIds = new Set(expectedVariations.map((variation) => variation.id))

for (const expected of expectedVariations) {
  const actual = variationById.get(expected.id)
  if (!actual) {
    addMismatch({
      code: 'PRODUCT_VARIATION_MISSING', scope: 'variation', identity: String(expected.id), field: 'record',
      expected, observed: null, authority: 'wordpress-backup-for-product-relations',
      resolution: 'Recover the variation and its parent relationship before data-source cutover.',
    })
    continue
  }
  const actualParentId = Number(actual.parentId ?? actual.parentProductId ?? actual.postParent)
  if (actualParentId !== expected.parentId) {
    addMismatch({
      code: 'VARIATION_PARENT_MISMATCH', scope: 'variation', identity: String(expected.id), field: 'parentId',
      expected: expected.parentId, observed: actualParentId, authority: 'wordpress-backup-for-product-relations',
      resolution: 'Preserve the backup parent relation and reconcile the protected variation mapping before cutover.',
    })
  }
}

for (const actual of collections.variations) {
  const id = recordId(actual)
  const parentId = Number(actual.parentId ?? actual.parentProductId ?? actual.postParent)
  if (recordStatus(actual) === 'publish' && productById.has(parentId) && !expectedVariationIds.has(id)) {
    addMismatch({
      code: 'UNEXPLAINED_PUBLISHED_VARIATION', scope: 'variation', identity: String(id), field: 'record',
      expected: 'One of the protected Store API variation IDs', observed: { parentId, status: 'publish' },
      authority: 'wordpress-backup-for-product-relations',
      resolution: 'Determine whether the live storefront intentionally exposes this child variation before cutover.',
    })
  }
}

const primaryRoutesByPath = new Map(PRIMARY_ROUTE_CONTRACTS.map((route) => [route.path, route]))
const expectedArticles = editorialArticleList.map((article) => ({
  slug: article.slug,
  path: `/blog/${article.slug}`,
  localDate: article.publishedAt,
  categories: article.categories.map(slugify),
  isLiveDelta: false,
}))
for (const [slug, deltaPost] of Object.entries(productionDeltaPosts)) {
  expectedArticles.push({
    slug,
    path: `/blog/${slug}`,
    id: deltaPost.id,
    localDate: deltaPost.date,
    categories: [],
    categoryIds: deltaPost.categories,
    isLiveDelta: true,
  })
}

const archiveSnapshotValue = manifest.archive?.databaseSnapshotAt
  ?? manifest.source?.databaseSnapshotAt
  ?? manifest.provenance?.databaseSnapshotAt
  ?? manifest.databaseSnapshotAt
  ?? manifest.snapshotAt
  ?? null
const archiveSnapshotTime = parseDate(archiveSnapshotValue)
const declaredLiveDeltaSlugs = new Set(asArray(manifest.gaps)
  .filter((gap) => gap?.code === 'known-live-delta-absent-from-backup' && gap.slug)
  .map((gap) => String(gap.slug)))
const postBySlug = new Map(collections.posts.map((record) => [recordSlug(record), record]))

for (const expected of expectedArticles) {
  const actual = postBySlug.get(expected.slug)
  const route = primaryRoutesByPath.get(expected.path)
  const productionDate = livePublishedDate(route) ?? expected.localDate
  const publishedAfterSnapshot = Boolean(
    expected.isLiveDelta
    && (
      declaredLiveDeltaSlugs.has(expected.slug)
      || (
        archiveSnapshotTime !== null
        && parseDate(productionDate) !== null
        && parseDate(productionDate) > archiveSnapshotTime
      )
    ),
  )
  if (!actual) {
    addMismatch({
      code: publishedAfterSnapshot ? 'LIVE_POST_AFTER_ARCHIVE_SNAPSHOT' : 'PUBLISHED_POST_MISSING',
      severity: publishedAfterSnapshot ? 'explained' : 'blocker',
      scope: 'post', identity: expected.slug, field: 'record',
      expected: expected.isLiveDelta ? { id: expected.id, publishedAt: productionDate } : { publishedAt: productionDate },
      observed: null,
      authority: publishedAfterSnapshot ? 'live-production-after-archive' : 'live-production-and-protected-content',
      resolution: publishedAfterSnapshot
        ? 'Keep the captured production article as an authoritative live delta and inject it during normalization reconciliation; do not treat its absence from the older archive as data loss.'
        : 'Recover the published article from the backup before data-source cutover.',
    })
    continue
  }
  if (expected.id && recordId(actual) !== expected.id) {
    addMismatch({
      code: 'POST_ID_MISMATCH', scope: 'post', identity: expected.slug, field: 'id', expected: expected.id,
      observed: recordId(actual), authority: 'wordpress-backup-for-identity',
      resolution: 'Reconcile the production delta ID against the backup/public API evidence before cutover.',
    })
  }
  if (recordStatus(actual) && recordStatus(actual) !== 'publish') {
    addMismatch({
      code: 'POST_NOT_PUBLISHED', scope: 'post', identity: expected.slug, field: 'status', expected: 'publish',
      observed: recordStatus(actual), authority: 'live-production',
      resolution: 'Preserve the live published route and reconcile the archive record status before cutover.',
    })
  }
  if (!recordContent(actual).trim()) {
    addMismatch({
      code: 'POST_CONTENT_EMPTY', scope: 'post', identity: expected.slug, field: 'content',
      expected: 'Non-empty published article content', observed: 'empty', authority: 'wordpress-backup-for-source-content',
      resolution: 'Restore the article body before cutover.',
    })
  }
  if (expected.categories.length) {
    const actualCategories = new Set([
      ...taxonomySlugs(actual, 'category'),
      ...taxonomySlugs(actual, 'post_category'),
    ])
    for (const category of expected.categories) {
      if (!actualCategories.has(category)) {
        addMismatch({
          code: 'POST_CATEGORY_RELATION_MISMATCH', scope: 'post', identity: expected.slug, field: 'categories',
          expected: expected.categories, observed: [...actualCategories].sort(), authority: 'wordpress-backup-for-relationships',
          resolution: 'Preserve the backup taxonomy relation and reconcile the current article category mapping before cutover.',
        })
        break
      }
    }
  }
  const protectedDateMatches = /^\d{4}-\d{2}-\d{2}$/.test(String(expected.localDate))
    ? String(recordDate(actual) ?? '').slice(0, 10) === expected.localDate
    : sameInstant(recordDate(actual), expected.localDate)
  if (!protectedDateMatches) {
    addMismatch({
      code: 'PROTECTED_POST_DATE_DIFFERS_FROM_BACKUP', severity: 'explained', scope: 'post', identity: expected.slug, field: 'publishedAt',
      expected: recordDate(actual), observed: expected.localDate, authority: 'wordpress-backup-for-dates',
      resolution: 'Adopt the normalized backup date in the future repository while the current protected renderer remains unchanged until the data-source parity gate.',
    })
  }
  if (productionDate && !sameInstant(recordDate(actual), productionDate)) {
    addMismatch({
      code: 'LIVE_SCHEMA_DATE_DIFFERS_FROM_BACKUP', severity: 'explained', scope: 'post', identity: expected.slug, field: 'publishedAt',
      expected: recordDate(actual), observed: productionDate, authority: 'wordpress-backup-for-dates; live-production-for-rendered-seo',
      resolution: 'Retain the backup date as canonical data and preserve the captured live schema signal until a separately gated content-source cutover resolves the difference.',
    })
  }
}

const expectedPageRoutes = PRIMARY_ROUTE_CONTRACTS.filter((route) => route.kind === 'home' || route.kind === 'page' || route.kind === 'blog-index')
const pageByPath = new Map(collections.pages.map((record) => [recordPath(record), record]))
const pageBySlug = new Map(collections.pages.map((record) => [recordSlug(record), record]))

for (const route of expectedPageRoutes) {
  const slug = route.path === '/' ? 'home' : route.path.split('/').filter(Boolean).at(-1)
  const actual = pageByPath.get(route.path) ?? pageBySlug.get(slug)
  if (!actual) {
    addMismatch({
      code: 'PUBLISHED_PAGE_MISSING', scope: 'page', identity: route.path, field: 'record',
      expected: { path: route.path, status: 200 }, observed: null, authority: 'live-production',
      resolution: 'Map the public WordPress page record to this live route before data-source cutover.',
    })
    continue
  }
  if (recordStatus(actual) && recordStatus(actual) !== 'publish') {
    addMismatch({
      code: 'PAGE_NOT_PUBLISHED', scope: 'page', identity: route.path, field: 'status', expected: 'publish',
      observed: recordStatus(actual), authority: 'live-production',
      resolution: 'Reconcile the backup status while preserving the live 200 route.',
    })
  }
  if (route.kind !== 'blog-index' && !recordContent(actual).trim()) {
    addMismatch({
      code: 'PAGE_CONTENT_EMPTY', scope: 'page', identity: route.path, field: 'content',
      expected: 'Non-empty public page content', observed: 'empty', authority: 'wordpress-backup-for-source-content',
      resolution: 'Restore or explicitly map the public page content before data-source cutover.',
    })
  }
}

const expectedTaxonomies = [
  ...PRIMARY_ROUTE_CONTRACTS
    .filter((route) => route.kind === 'product-category')
    .map((route) => ({ taxonomy: 'product_cat', slug: route.path.split('/').filter(Boolean).at(-1), path: route.path })),
  ...PRIMARY_ROUTE_CONTRACTS
    .filter((route) => route.kind === 'blog-category')
    .map((route) => ({ taxonomy: 'category', slug: route.path.split('/').filter(Boolean).at(-1), path: route.path })),
  ...PRIMARY_ROUTE_CONTRACTS
    .filter((route) => route.kind === 'blog-tag')
    .map((route) => ({ taxonomy: 'post_tag', slug: route.path.split('/').filter(Boolean).at(-1), path: route.path })),
  ...PRIMARY_ROUTE_CONTRACTS
    .filter((route) => route.kind === 'product-tag')
    .map((route) => ({ taxonomy: 'product_tag', slug: route.path.split('/').filter(Boolean).at(-1), path: route.path })),
]
const termIndex = new Map(collections.terms.map((term) => [`${term.taxonomy ?? term.type}:${recordSlug(term)}`, term]))

for (const expected of expectedTaxonomies) {
  const actual = termIndex.get(`${expected.taxonomy}:${expected.slug}`)
    ?? collections.terms.find((term) => recordSlug(term) === expected.slug && recordPath(term) === expected.path)
  if (!actual) {
    const currentLiveDelta = new Set([
      '/blog/tag/dimensional-stickers',
      '/blog/tag/embossed-stickers',
      '/blog/tag/product-design',
      '/blog/tag/raised-stickers',
    ]).has(expected.path)
    addMismatch({
      code: currentLiveDelta ? 'LIVE_TAXONOMY_AFTER_ARCHIVE_SNAPSHOT' : 'PUBLIC_TAXONOMY_TERM_MISSING',
      severity: currentLiveDelta ? 'explained' : 'blocker',
      scope: 'taxonomy', identity: `${expected.taxonomy}:${expected.slug}`, field: 'term',
      expected, observed: null, authority: 'live-production-for-public-route; wordpress-backup-for-term-identity',
      resolution: currentLiveDelta
        ? 'Create this audited live-after-backup tag during normalization reconciliation before data-source cutover.'
        : 'Recover or map this public archive term before data-source cutover.',
    })
  }
}

const routeRecord = (route) => {
  if (route.kind === 'product') return productBySlug.get(route.path.split('/').filter(Boolean).at(-1))
  if (route.kind === 'blog-article') return postBySlug.get(route.path.split('/').filter(Boolean).at(-1))
  if (route.kind === 'home' || route.kind === 'page' || route.kind === 'blog-index') {
    const slug = route.path === '/' ? 'home' : route.path.split('/').filter(Boolean).at(-1)
    return pageByPath.get(route.path) ?? pageBySlug.get(slug)
  }
  if (route.kind === 'product-category') return termIndex.get(`product_cat:${route.path.split('/').filter(Boolean).at(-1)}`)
  if (route.kind === 'blog-category') return termIndex.get(`category:${route.path.split('/').filter(Boolean).at(-1)}`)
  if (route.kind === 'blog-tag') return termIndex.get(`post_tag:${route.path.split('/').filter(Boolean).at(-1)}`)
  if (route.kind === 'product-tag') return termIndex.get(`product_tag:${route.path.split('/').filter(Boolean).at(-1)}`)
  return undefined
}

let seoComparableRecordCount = 0
let seoExactFieldCount = 0
let seoOverrideFieldCount = 0
for (const route of PRIMARY_ROUTE_CONTRACTS.filter((entry) => ['home', 'page', 'blog-index', 'product', 'blog-article', 'product-category', 'blog-category', 'blog-tag', 'product-tag'].includes(entry.kind))) {
  const record = routeRecord(route)
  if (!record) continue
  const normalizedSeo = recordSeo(record)
  const expectedSeo = {
    title: route.metadata.title,
    description: route.metadata.description,
    canonical: route.metadata.canonical,
    robots: route.metadata.robots,
  }
  const fields = Object.keys(expectedSeo)
  const comparableFields = fields.filter((field) => normalizedSeo[field] !== null && normalizedSeo[field] !== '')
  if (comparableFields.length) seoComparableRecordCount += 1
  for (const field of comparableFields) {
    const expected = String(expectedSeo[field] ?? '')
    const observed = String(normalizedSeo[field] ?? '')
    const equal = field === 'canonical'
      ? normalizePath(expected) === normalizePath(observed)
      : normalizeSeoText(expected) === normalizeSeoText(observed)
    if (equal) seoExactFieldCount += 1
    else {
      seoOverrideFieldCount += 1
      addMismatch({
        code: 'BACKUP_SEO_DIFFERS_FROM_LIVE', severity: 'explained', scope: 'seo', identity: route.path, field,
        expected, observed, authority: 'live-production-for-seo',
        resolution: 'Preserve the exact production SEO contract; do not let the older backup metadata override it during framework or data-source migration.',
      })
    }
  }
}

let liveDateComparableFieldCount = 0
let liveDateExactFieldCount = 0
let liveDateOverrideFieldCount = 0
for (const route of PRIMARY_ROUTE_CONTRACTS.filter((entry) => ['home', 'page', 'blog-index', 'product', 'blog-article'].includes(entry.kind))) {
  const record = routeRecord(route)
  if (!record) continue
  const comparisons = [
    ...(route.kind === 'blog-article' ? [] : [{ field: 'publishedAt', backup: recordDate(record), live: livePublishedDate(route) }]),
    { field: 'modifiedAt', backup: recordModified(record), live: liveModifiedDate(route) },
  ]
  for (const comparison of comparisons) {
    if (!comparison.backup || !comparison.live) continue
    liveDateComparableFieldCount += 1
    if (sameInstant(comparison.backup, comparison.live)) {
      liveDateExactFieldCount += 1
      continue
    }
    liveDateOverrideFieldCount += 1
    addMismatch({
      code: 'LIVE_SCHEMA_DATE_DIFFERS_FROM_BACKUP', severity: 'explained', scope: 'date', identity: route.path, field: comparison.field,
      expected: comparison.backup, observed: comparison.live,
      authority: 'wordpress-backup-for-dates; live-production-for-rendered-seo',
      resolution: 'Keep the backup record date as normalized source data and preserve the captured live schema value until the separately gated data-source cutover reconciles it.',
    })
  }
}

const attachmentByMediaKey = new Map()
for (const attachment of collections.attachments) {
  for (const url of attachmentUrls(attachment)) {
    const key = mediaKey(url)
    if (key && !attachmentByMediaKey.has(key)) attachmentByMediaKey.set(key, attachment)
  }
}

const liveMedia = new Map()
const externalLiveMedia = new Map()
for (const route of PRIMARY_ROUTE_CONTRACTS) {
  const contentSignal = route.productionSignals?.content
  const images = contentSignal?.state === 'captured' ? asArray(contentSignal.value?.images) : []
  for (const image of images) {
    if (mediaOrigin(image.src) !== 'https://puffsticker.com') {
      const external = externalLiveMedia.get(image.src) ?? { alt: String(image.alt ?? ''), routes: new Set() }
      external.routes.add(route.path)
      externalLiveMedia.set(image.src, external)
      continue
    }
    const key = mediaKey(image.src)
    if (!key) continue
    const existing = liveMedia.get(key) ?? { urls: new Set(), alts: new Set(), routes: new Set() }
    existing.urls.add(image.src)
    existing.alts.add(String(image.alt ?? ''))
    existing.routes.add(route.path)
    liveMedia.set(key, existing)
  }
}

for (const [url, reference] of externalLiveMedia) {
  addMismatch({
    code: 'EXTERNAL_LIVE_MEDIA_REFERENCE', severity: 'explained', scope: 'media', identity: url, field: 'source',
    expected: { routes: [...reference.routes].sort() }, observed: 'Third-party theme/demo media URL',
    authority: 'live-production-for-rendered-content; outside-wordpress-backup-boundary',
    resolution: 'Preserve the captured reference for parity. Any localization or removal is a separately approved content/visual cleanup, not part of this framework migration.',
  })
}

let matchedMediaCount = 0
let verifiedUnindexedMediaCount = 0
let altExactCount = 0
let altOverrideCount = 0
const unindexedMediaByKey = new Map(collections.unindexedPublicMedia.map((entry) => [mediaKey(entry.path ?? entry.url), entry]))
if (unindexedMediaByKey.size !== collections.unindexedPublicMedia.length) {
  addMismatch({
    code: 'DUPLICATE_UNINDEXED_MEDIA_EVIDENCE', scope: 'media', identity: 'unindexedPublicMedia', field: 'path',
    expected: 'Unique exact first-party public paths', observed: collections.unindexedPublicMedia.length - unindexedMediaByKey.size,
    authority: 'public-only-migration-policy',
    resolution: 'Remove duplicate or invalid unindexed media evidence before cutover.',
  })
}
if (Number(manifest.counts?.unindexedPublicMedia) !== collections.unindexedPublicMedia.length) {
  addMismatch({
    code: 'UNINDEXED_MEDIA_COUNT_MISMATCH', scope: 'provenance', identity: 'manifest.json', field: 'counts.unindexedPublicMedia',
    expected: collections.unindexedPublicMedia.length, observed: manifest.counts?.unindexedPublicMedia ?? null,
    authority: 'normalized-manifest',
    resolution: 'Regenerate the content and manifest artifacts together.',
  })
}
for (const [key, entry] of unindexedMediaByKey) {
  if (
    !key
    || !liveMedia.has(key)
    || attachmentByMediaKey.has(key)
    || entry.archivePresent !== true
    || Number(entry.bytes) <= 0
    || !/^[a-f0-9]{64}$/i.test(String(entry.sha256 ?? ''))
  ) {
    addMismatch({
      code: 'UNINDEXED_MEDIA_EVIDENCE_OUTSIDE_PUBLIC_GRAPH', scope: 'privacy', identity: key ?? 'invalid-path', field: 'record',
      expected: 'One exact live-referenced, archive-present, non-attachment media path with bytes and SHA-256',
      observed: { liveReferenced: Boolean(key && liveMedia.has(key)), hasAttachment: Boolean(key && attachmentByMediaKey.has(key)), archivePresent: entry.archivePresent === true },
      authority: 'public-only-migration-policy',
      resolution: 'Exclude unrelated upload evidence and regenerate only the exact live-referenced public binary mapping.',
    })
  }
}
for (const [key, observed] of liveMedia) {
  const attachment = attachmentByMediaKey.get(key)
  const unindexedEvidence = unindexedMediaByKey.get(key)
  const mediaDelta = Object.entries(productionDeltaPosts).find(([slug]) => observed.routes.has(`/blog/${slug}`))
  const isDeltaMedia = key.includes('/2026/08/') && Boolean(mediaDelta)
  const deltaAfterSnapshot = isDeltaMedia
    && (
      declaredLiveDeltaSlugs.has(mediaDelta?.[0])
      || (archiveSnapshotTime !== null && parseDate(mediaDelta?.[1].date) > archiveSnapshotTime)
    )
  if (!attachment) {
    if (
      unindexedEvidence?.archivePresent === true
      && Number(unindexedEvidence.bytes) > 0
      && /^[a-f0-9]{64}$/i.test(String(unindexedEvidence.sha256 ?? ''))
    ) {
      verifiedUnindexedMediaCount += 1
      addMismatch({
        code: 'LIVE_MEDIA_VERIFIED_AS_UNINDEXED_ARCHIVE_FILE', severity: 'explained', scope: 'media', identity: key, field: 'attachment',
        expected: { routes: [...observed.routes].sort(), renderedAlt: [...observed.alts].sort() },
        observed: { archivePresent: true, bytes: Number(unindexedEvidence.bytes), sha256: String(unindexedEvidence.sha256).toLowerCase() },
        authority: 'wordpress-backup-for-binary-presence; live-production-for-rendered-alt',
        resolution: 'Preserve this verified public binary through object-storage migration; no attachment row or attachment alt metadata should be invented.',
      })
      continue
    }
    addMismatch({
      code: deltaAfterSnapshot ? 'LIVE_MEDIA_AFTER_ARCHIVE_SNAPSHOT' : 'LIVE_PUBLIC_MEDIA_MISSING_FROM_BACKUP',
      severity: deltaAfterSnapshot ? 'explained' : 'blocker', scope: 'media', identity: key, field: 'attachment',
      expected: { routes: [...observed.routes].sort(), urls: [...observed.urls].sort() }, observed: null,
      authority: deltaAfterSnapshot ? 'live-production-after-archive' : 'live-production-reference-and-wordpress-backup-metadata',
      resolution: deltaAfterSnapshot
        ? 'Use the captured production-delta asset; its absence from the older archive is intentional and already isolated.'
        : 'Recover the referenced public media metadata and binary mapping before cutover.',
    })
    continue
  }
  matchedMediaCount += 1
  const backupAlt = attachmentAlt(attachment)
  if (observed.alts.has(backupAlt)) altExactCount += 1
  else {
    altOverrideCount += 1
    addMismatch({
      code: 'ATTACHMENT_ALT_DIFFERS_FROM_RENDERED_ALT', severity: 'explained', scope: 'media-alt', identity: key, field: 'alt',
      expected: backupAlt, observed: [...observed.alts].sort(),
      authority: 'wordpress-backup-for-media-metadata; live-production-for-rendered-seo',
      resolution: 'Retain the backup attachment alt as source metadata and preserve the captured rendered alt on public routes until a separately approved SEO cleanup.',
    })
  }
}

const exclusionCounts = normalizeExclusionCounts(exclusions)
const privateTypePattern = /(user|customer|order|payment|session|token|credential|password|form|submission|quote|subscriber|comment|log|analytics)/i
const privateExclusionCount = exclusionCounts.filter((entry) => privateTypePattern.test(entry.type)).reduce((sum, entry) => sum + entry.count, 0)

if (!exclusionCounts.length) {
  addMismatch({
    code: 'EXCLUSION_LEDGER_EMPTY', scope: 'privacy', identity: 'exclusions.json', field: 'counts',
    expected: 'Aggregate counts by excluded private/system type', observed: [], authority: 'public-only-migration-policy',
    resolution: 'Emit type/count-only exclusion evidence without retaining private values.',
  })
}

const sortedMismatches = sortByIdentity(mismatches)
const blockers = sortedMismatches.filter((entry) => entry.severity === 'blocker')
const explained = sortedMismatches.filter((entry) => entry.severity === 'explained')
const archiveSnapshotLabel = archiveSnapshotValue ?? 'not-declared'

const report = stable({
  schemaVersion: 1,
  status: blockers.length ? 'blocked' : 'accepted',
  purpose: 'Read-only Phase 4 reconciliation; this report does not alter or wire public rendering.',
  authorityOrder: {
    liveProduction: ['SEO metadata', 'status codes', 'public URLs', 'rendered image alt text'],
    protectedReactVite: ['visual output', 'DOM/layout', 'content currently used by the protected migration baseline'],
    wordpressBackup: ['record IDs', 'relationships', 'dates', 'media attachment metadata'],
  },
  sources: {
    normalizedManifestSchemaVersion: manifest.schemaVersion ?? null,
    archiveDatabaseSnapshotAt: archiveSnapshotLabel,
    archiveSha256: manifest.archive?.sha256 ?? manifest.source?.archiveSha256 ?? manifest.provenance?.archiveSha256 ?? manifest.archiveSha256 ?? null,
    databaseSha256: manifest.database?.sha256 ?? manifest.source?.databaseSha256 ?? manifest.provenance?.databaseSha256 ?? manifest.databaseSha256 ?? null,
    liveSeoEvidence: [
      'src/lib/seo/fixtures/production-seo-2026-08-22.json',
      'src/lib/seo/fixtures/production-seo-current-delta-2026-09-01.ts',
    ],
    liveSeoCapturedOn: '2026-09-01',
    protectedContentSources: [
      'src/content/catalog.ts',
      'src/content/editorial.ts',
      'src/content/productDetails.ts',
      'src/content/productionDeltaContent.ts',
    ],
  },
  snapshotDeltas: Object.entries(productionDeltaPosts).map(([slug, deltaPost]) => ({
    slug,
    postId: deltaPost.id,
    publishedAt: deltaPost.date,
    archiveSnapshotAt: archiveSnapshotLabel,
    publishedAfterArchiveSnapshot: archiveSnapshotTime === null ? null : parseDate(deltaPost.date) > archiveSnapshotTime,
    explicitlyDeclaredAbsentFromBackup: declaredLiveDeltaSlugs.has(slug),
    policy: 'Captured live articles and their media remain authoritative production deltas when absent from the archive. File mtime is provenance, not proof of the SQL content cutoff.',
  })),
  normalizedInventory: Object.fromEntries(Object.entries(collections).map(([key, values]) => [key, values.length])),
  expectedPublicInventory: {
    products: catalogProducts.length,
    protectedBaselinePosts: editorialArticleList.length,
    liveDeltaPosts: Object.keys(productionDeltaBlogContent).length,
    publicCorePages: expectedPageRoutes.length,
    productCategories: Object.keys(categories).length,
    publicTaxonomyArchiveTerms: expectedTaxonomies.length,
    protectedVariationRows: expectedVariations.length,
    liveReferencedUploadKeys: liveMedia.size,
  },
  checks: {
    productSlugsAndIds: { expected: catalogProducts.length, found: catalogProducts.filter((product) => productBySlug.has(product.slug)).length },
    articleSlugsAndDates: { expected: expectedArticles.length, foundInArchive: expectedArticles.filter((article) => postBySlug.has(article.slug)).length },
    publicPages: { expected: expectedPageRoutes.length, found: expectedPageRoutes.filter((route) => {
      const slug = route.path === '/' ? 'home' : route.path.split('/').filter(Boolean).at(-1)
      return pageByPath.has(route.path) || pageBySlug.has(slug)
    }).length },
    productVariations: { expected: expectedVariations.length, found: expectedVariations.filter((variation) => variationById.has(variation.id)).length },
    publicTaxonomyTerms: { expected: expectedTaxonomies.length, found: expectedTaxonomies.filter((expected) => termIndex.has(`${expected.taxonomy}:${expected.slug}`) || collections.terms.some((term) => recordSlug(term) === expected.slug && recordPath(term) === expected.path)).length },
    seo: { comparableRecords: seoComparableRecordCount, exactFields: seoExactFieldCount, liveAuthoritativeOverrides: seoOverrideFieldCount },
    dates: { comparableFields: liveDateComparableFieldCount, exactFields: liveDateExactFieldCount, authorityReconciliations: liveDateOverrideFieldCount },
    media: { liveReferencedFirstParty: liveMedia.size, liveReferencedExternal: externalLiveMedia.size, matchedToBackupAttachment: matchedMediaCount + verifiedUnindexedMediaCount, indexedAttachmentMatches: matchedMediaCount, verifiedUnindexedArchiveFile: verifiedUnindexedMediaCount, totalArchiveVerified: matchedMediaCount + verifiedUnindexedMediaCount, exactAltMetadata: altExactCount, renderedAltOverrides: altOverrideCount },
    publicArtifactPrivacy: { prohibitedKeyPaths: prohibitedPaths.length, privateExcludedRecordCount: privateExclusionCount },
  },
  exclusions: {
    policy: 'Public-only. Private/system records remain excluded; only aggregate type/count evidence is reported.',
    byType: exclusionCounts.sort((a, b) => a.type.localeCompare(b.type)),
  },
  mismatchLedger: sortedMismatches,
  explainedMismatchCount: explained.length,
  cutoverBlockers: blockers,
  acceptance: {
    passed: blockers.length === 0,
    rule: 'Fail only on unexplained published-public mismatches or a privacy-boundary violation.',
    publicRuntimeWired: false,
    nextStep: blockers.length
      ? 'Resolve every cutover blocker and rerun this validator. Do not wire normalized content into the public runtime.'
      : 'The public-only dataset is reconciled for Phase 4. Keep the runtime on protected sources until the separately gated persistence/CMS phase.',
  },
})

function markdownValue(value) {
  return value === null || value === undefined ? 'not declared' : String(value)
}

function buildMarkdown(value) {
  const blockerRows = value.cutoverBlockers.length
    ? value.cutoverBlockers.map((entry) => `| ${entry.code} | ${entry.scope} | \`${entry.identity}\` | ${entry.resolution} |`).join('\n')
    : '| None | - | - | Phase 4 reconciliation gate passed. |'
  const explainedRows = value.mismatchLedger.filter((entry) => entry.severity === 'explained')
    .map((entry) => `| ${entry.code} | ${entry.scope} | \`${entry.identity}\` | ${entry.authority} |`)
    .join('\n') || '| None | - | - | - |'
  const exclusionsRows = value.exclusions.byType
    .map((entry) => `| ${entry.type} | ${entry.count ?? 'not parsed'} | ${entry.disposition} |`)
    .join('\n') || '| None declared | 0 |'
  const deltaSummary = value.snapshotDeltas
    .map((entry) => `\`${entry.slug}\` (post ${entry.postId}, published ${entry.publishedAt})`)
    .join('; ')

  return `# WordPress public-data reconciliation\n\nStatus: **${value.status.toUpperCase()}**\n\nThis is a read-only Phase 4 audit. The normalized WordPress data is not connected to public rendering, so the protected React/Vite-to-Next visual and SEO output remains unchanged.\n\n## Authority and snapshot boundary\n\n- Live production remains authoritative for URLs, status codes, canonicals, metadata, schema-facing SEO behavior, and rendered image alt text.\n- The protected React/Vite implementation remains authoritative for visual output and currently rendered content.\n- The WordPress backup remains authoritative for record IDs, relations, dates, and attachment metadata.\n- Archive database snapshot: **${markdownValue(value.sources.archiveDatabaseSnapshotAt)}**.\n- Live crawl evidence through: **${value.sources.liveSeoCapturedOn}**.\n- Production deltas newer than the backup: ${deltaSummary}. Published-after-snapshot absence is explicitly explained, not treated as archive data loss.\n\n## Deterministic inventory\n\n| Check | Expected | Found/matched |\n| --- | ---: | ---: |\n| Products | ${value.checks.productSlugsAndIds.expected} | ${value.checks.productSlugsAndIds.found} |\n| Baseline + live-delta posts | ${value.checks.articleSlugsAndDates.expected} | ${value.checks.articleSlugsAndDates.foundInArchive} |\n| Protected variation rows | ${value.checks.productVariations.expected} | ${value.checks.productVariations.found} |\n| Public taxonomy archive terms | ${value.checks.publicTaxonomyTerms.expected} | ${value.checks.publicTaxonomyTerms.found} |\n| Live referenced first-party upload keys | ${value.checks.media.liveReferencedFirstParty} | ${value.checks.media.matchedToBackupAttachment} |\n| Live referenced external media URLs | ${value.checks.media.liveReferencedExternal} | Preserved as explained dependencies |\n| SEO records with comparable backup fields | - | ${value.checks.seo.comparableRecords} |\n\n## Cutover blockers\n\nThe gate fails only for unexplained published-public mismatches or a privacy-boundary violation. Explained source-age differences and authority overrides remain visible below but do not fail the gate.\n\n| Code | Scope | Identity | Required resolution |\n| --- | --- | --- | --- |\n${blockerRows}\n\n## Explained mismatches and precedence decisions\n\n| Code | Scope | Identity | Authority |\n| --- | --- | --- | --- |\n${explainedRows}\n\n## Private/system exclusions\n\nOnly aggregate types and counts are reported. No customer, order, form, credential, session, or other private values are present in this report.\n\n| Excluded type | Count | Disposition |\n| --- | ---: | --- |\n${exclusionsRows}\n\n## Acceptance\n\n- Passed: **${value.acceptance.passed ? 'yes' : 'no'}**.\n- Public runtime wired to normalized data: **no**.\n- ${value.acceptance.nextStep}\n- Search Console exports, backlink data, and access-log URL evidence remain required pre-cutover inputs when available; this archive reconciliation does not claim those sources were supplied.\n`
}

await mkdir(reportDirectory, { recursive: true })
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
const documentation = buildMarkdown(report).replace(
  '\n| Products |',
  `\n| Public pages (including the posts index) | ${report.checks.publicPages.expected} | ${report.checks.publicPages.found} |\n| Products |`,
).replace(
  `| Baseline + live-delta posts | ${report.checks.articleSlugsAndDates.expected} | ${report.checks.articleSlugsAndDates.foundInArchive} |`,
  `| Baseline + live-delta posts | ${report.checks.articleSlugsAndDates.expected} | ${report.checks.articleSlugsAndDates.foundInArchive} archive + ${report.mismatchLedger.filter((entry) => entry.code === 'LIVE_POST_AFTER_ARCHIVE_SNAPSHOT').length} live deltas |`,
).replace(
  `| Live referenced first-party upload keys | ${report.checks.media.liveReferencedFirstParty} | ${report.checks.media.matchedToBackupAttachment} |`,
  `| Live referenced first-party upload keys | ${report.checks.media.liveReferencedFirstParty} | ${report.checks.media.totalArchiveVerified} archive verified + ${report.mismatchLedger.filter((entry) => entry.code === 'LIVE_MEDIA_AFTER_ARCHIVE_SNAPSHOT').length} live delta |`,
)
await writeFile(documentationPath, documentation, 'utf8')

console.log(JSON.stringify({
  status: report.status,
  blockers: blockers.length,
  explainedMismatches: explained.length,
  inventory: report.normalizedInventory,
  report: path.relative(repositoryRoot, reportPath).replaceAll('\\', '/'),
  documentation: path.relative(repositoryRoot, documentationPath).replaceAll('\\', '/'),
}, null, 2))

if (blockers.length) process.exitCode = 1
