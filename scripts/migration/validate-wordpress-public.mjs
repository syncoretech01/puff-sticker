#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const outputDir = resolve(process.argv[2] ?? REPOSITORY_ROOT, process.argv[2] ? '' : 'data/migration/wordpress-public')
const failures = []
const check = (condition, message) => { if (!condition) failures.push(message) }
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const EXPECTED_UNINDEXED_PUBLIC_MEDIA = new Set([
  '/wp-content/uploads/2022/02/payment-method-2.png',
  '/wp-content/uploads/2022/04/about-1-video-1.png',
  '/wp-content/uploads/2022/05/top-banner-img-1.svg',
  '/wp-content/uploads/2022/11/video-bg-9-1.jpg',
  '/wp-content/uploads/2023/02/puff-logo-cloud-background-blue-yellow-text-soft-branding-e1754688317309.webp',
  '/wp-content/uploads/2025/08/chef-illustration-okay-gesture-light-green.webp',
  '/wp-content/uploads/2025/08/eco-jute-handbag-rounded-handles.webp',
  '/wp-content/uploads/2025/08/johnny-bravo-cartoon-muscle-pose-sticker-mint-bg.webp',
  '/wp-content/uploads/revslider/home-6/decor-slide-61.svg',
  '/wp-content/uploads/revslider/home-6/decor-slide-62.svg',
  '/wp-content/uploads/revslider/home-6/decor-slide-63.svg',
  '/wp-content/uploads/revslider/home-6/decor-slide-64.svg',
  '/wp-content/uploads/revslider/home-6/product-slide-63.png',
])

const [manifestText, contentText, exclusionsText] = await Promise.all([
  readFile(resolve(outputDir, 'manifest.json'), 'utf8'),
  readFile(resolve(outputDir, 'content.json'), 'utf8'),
  readFile(resolve(outputDir, 'exclusions.json'), 'utf8'),
])
const manifest = JSON.parse(manifestText)
const content = JSON.parse(contentText)
const exclusions = JSON.parse(exclusionsText)

check(manifest.schemaVersion === 1, 'manifest schemaVersion must be 1')
check(content.schemaVersion === 1, 'content schemaVersion must be 1')
check(exclusions.schemaVersion === 1, 'exclusions schemaVersion must be 1')
check(manifest.policyVersion === exclusions.policyVersion, 'manifest/exclusions policy versions disagree')
check(manifest.source === 'isolated-read-only-wordpress-backup', 'manifest source is not the isolated read-only backup')
check(manifest.runtimeIntegration?.startsWith('none;'), 'Phase 4 artifact must explicitly remain disconnected from runtime')
check(content.scope === 'published-public-wordpress-content-only', 'content scope is not public-only')
check(exclusions.scope === 'public-only-no-pii', 'exclusion scope is not public-only/no-PII')
check(/^[a-f0-9]{64}$/.test(manifest.provenance?.archiveSha256 ?? ''), 'archive SHA-256 is missing or invalid')
check(/^[a-f0-9]{64}$/.test(manifest.provenance?.databaseSha256 ?? ''), 'database SHA-256 is missing or invalid')
check(Number.isInteger(manifest.provenance?.databaseBytes) && manifest.provenance.databaseBytes > 0, 'database byte size is invalid')
check(!Number.isNaN(Date.parse(manifest.provenance?.databaseSnapshotAt ?? '')), 'database snapshot timestamp is invalid')
check(manifest.provenance?.tablePrefix === 'SERVMASK_PREFIX_', 'logical ServMask table token changed')
check(manifest.outputs?.content?.path === 'content.json', 'manifest content path changed')
check(manifest.outputs?.exclusions?.path === 'exclusions.json', 'manifest exclusions path changed')
check(manifest.outputs?.content?.sha256 === sha256(contentText), 'content artifact hash mismatch')
check(manifest.outputs?.exclusions?.sha256 === sha256(exclusionsText), 'exclusions artifact hash mismatch')

const arrays = {
  posts: content.posts,
  pages: content.pages,
  products: content.products,
  variations: content.variations,
  attachments: content.attachments,
  terms: content.taxonomy?.terms,
  termTaxonomy: content.taxonomy?.termTaxonomy,
  termRelationships: content.taxonomy?.relationships,
  termMeta: content.taxonomy?.termMeta,
  redirects: content.redirects,
  unindexedPublicMedia: content.unindexedPublicMedia ?? [],
}
for (const [name, rows] of Object.entries(arrays)) {
  check(Array.isArray(rows), `${name} must be an array`)
  check(manifest.counts?.[name] === rows?.length, `${name} count disagrees with manifest`)
}

function unique(records, key, label) {
  const values = records.map((record) => String(record[key]))
  check(values.every(Boolean), `${label} contains a blank ${key}`)
  check(new Set(values).size === values.length, `${label} contains duplicate ${key} values`)
}

for (const type of ['posts', 'pages', 'products', 'variations', 'attachments', 'terms', 'termTaxonomy']) {
  unique(arrays[type], 'id', type)
}

const allObjects = [...content.posts, ...content.pages, ...content.products, ...content.variations, ...content.attachments]
unique(allObjects, 'id', 'WordPress object graph')
for (const record of allObjects) {
  check(!Object.hasOwn(record, 'author') && !Object.hasOwn(record, 'postAuthor'), `${record.kind}/${record.id}: author identity must not be emitted`)
  check(!Object.hasOwn(record, 'password') && !Object.hasOwn(record, 'passwordProtected'), `${record.kind}/${record.id}: password state must not be emitted`)
}
const primaryIds = new Set([...content.posts, ...content.pages, ...content.products].map((record) => record.id))
const productIds = new Set(content.products.map((record) => record.id))
const attachmentIds = new Set(content.attachments.map((record) => record.id))
const termIds = new Set(content.taxonomy.terms.map((record) => record.id))
const taxonomyIds = new Set(content.taxonomy.termTaxonomy.map((record) => record.id))

for (const [name, records, expectedKind] of [
  ['posts', content.posts, 'post'],
  ['pages', content.pages, 'page'],
  ['products', content.products, 'product'],
  ['variations', content.variations, 'product_variation'],
]) {
  for (const record of records) {
    check(record.kind === expectedKind, `${name}/${record.id}: kind is ${record.kind}`)
    check(record.status === 'publish', `${name}/${record.id}: non-published status escaped normalization`)
    check(Boolean(record.slug), `${name}/${record.id}: slug is blank`)
    check(/^\d+$/.test(record.parentId), `${name}/${record.id}: parentId is invalid`)
    check(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(record.date ?? ''), `${name}/${record.id}: date is invalid`)
    check(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(record.modified ?? ''), `${name}/${record.id}: modified date is invalid`)
    for (const mediaId of record.mediaIds ?? []) check(attachmentIds.has(mediaId), `${name}/${record.id}: media ${mediaId} is outside public attachment graph`)
    if (record.featuredMediaId) check(attachmentIds.has(record.featuredMediaId), `${name}/${record.id}: featured media is outside public attachment graph`)
    for (const termId of record.taxonomyTermIds ?? []) check(termIds.has(termId), `${name}/${record.id}: taxonomy term ${termId} is missing`)
  }
}
for (const variation of content.variations) {
  check(productIds.has(variation.parentId), `variation/${variation.id}: parent product ${variation.parentId} is not public`)
}

for (const attachment of content.attachments) {
  check(attachment.kind === 'attachment', `attachment/${attachment.id}: kind changed`)
  check(['inherit', 'publish'].includes(attachment.status), `attachment/${attachment.id}: status ${attachment.status} is not public`)
  check(Object.hasOwn(attachment, 'altText'), `attachment/${attachment.id}: explicit altText field is missing`)
  check(typeof attachment.altText === 'string', `attachment/${attachment.id}: altText is not a string`)
  check(!Object.hasOwn(attachment, 'serializedMetadata'), `attachment/${attachment.id}: raw serialized metadata must not be emitted`)
  check(!Object.hasOwn(attachment, 'description'), `attachment/${attachment.id}: nonessential attachment description must not be emitted`)
  if (attachment.parentId !== '0') {
    // A selected attachment can be referenced by a public object even when its
    // historical parent no longer is public; retain the ID without widening scope.
    check(/^\d+$/.test(attachment.parentId), `attachment/${attachment.id}: parentId is invalid`)
  }
}

for (const taxonomy of content.taxonomy.termTaxonomy) {
  check(termIds.has(taxonomy.termId), `term_taxonomy/${taxonomy.id}: term ${taxonomy.termId} is missing`)
}
for (const relationship of content.taxonomy.relationships) {
  check(primaryIds.has(relationship.objectId) || content.variations.some((variation) => variation.id === relationship.objectId), `term relationship object ${relationship.objectId} is not public`)
  check(taxonomyIds.has(relationship.termTaxonomyId), `term relationship taxonomy ${relationship.termTaxonomyId} is missing`)
}
for (const metadata of content.taxonomy.termMeta) {
  check(termIds.has(metadata.termId), `term meta/${metadata.id}: term ${metadata.termId} is missing`)
}

function validatePublicUrl(value, label) {
  if (!value) return
  try {
    const url = new URL(value)
    check(['http:', 'https:'].includes(url.protocol), `${label}: URL protocol is not public HTTP(S)`)
    check(!url.username && !url.password, `${label}: URL contains credentials`)
  } catch {
    check(false, `${label}: URL is invalid`)
  }
}
validatePublicUrl(content.site.home, 'site.home')
validatePublicUrl(content.site.siteUrl, 'site.siteUrl')
for (const record of allObjects) {
  validatePublicUrl(record.permalink, `${record.kind}/${record.id} permalink`)
  validatePublicUrl(record.url, `${record.kind}/${record.id} URL`)
  validatePublicUrl(record.seo?.canonical, `${record.kind}/${record.id} canonical`)
  validatePublicUrl(record.seo?.openGraphImage, `${record.kind}/${record.id} Open Graph image`)
  validatePublicUrl(record.seo?.twitterImage, `${record.kind}/${record.id} Twitter image`)
}

const redirectSources = new Set(content.redirects.map((redirect) => redirect.sourcePath))
for (const redirect of content.redirects) {
  check([301, 302, 307, 308].includes(redirect.statusCode), `redirect/${redirect.id}: unsupported status code`)
  check(redirect.sourcePath.startsWith('/'), `redirect/${redirect.id}: source is not a root-relative public path`)
  validatePublicUrl(redirect.target, `redirect/${redirect.id} target`)
  const target = new URL(redirect.target, content.site.home)
  check(!redirectSources.has(`${target.pathname}${target.search}`), `redirect/${redirect.id}: redirect chain detected`)
  check(`${target.pathname}${target.search}` !== redirect.sourcePath, `redirect/${redirect.id}: redirect loop detected`)
}

const unindexedPublicMedia = content.unindexedPublicMedia ?? []
const seenUnindexedMedia = new Set()
for (const media of unindexedPublicMedia) {
  check(EXPECTED_UNINDEXED_PUBLIC_MEDIA.has(media.path), `unindexed media is not an exact approved live reference: ${media.path}`)
  check(!seenUnindexedMedia.has(media.path), `duplicate unindexed media evidence: ${media.path}`)
  seenUnindexedMedia.add(media.path)
  check(typeof media.archivePresent === 'boolean', `${media.path}: backup presence must be explicit`)
  if (media.archivePresent) {
    check(Number.isInteger(media.bytes) && media.bytes >= 0, `${media.path}: byte size is invalid`)
    check(/^[a-f0-9]{64}$/.test(media.sha256 ?? ''), `${media.path}: SHA-256 is invalid`)
  } else {
    check(!Object.hasOwn(media, 'bytes') && !Object.hasOwn(media, 'sha256'), `${media.path}: absent media must not invent size/hash metadata`)
  }
}
const incompleteMediaGap = (manifest.gaps ?? []).find((gap) => gap.code === 'unindexed-public-media-evidence-incomplete')
const missingMedia = [...EXPECTED_UNINDEXED_PUBLIC_MEDIA].filter((path) => !seenUnindexedMedia.has(path))
if (missingMedia.length) {
  check(Boolean(incompleteMediaGap), 'exact first-party unindexed media evidence is incomplete without an explicit gap')
  check(JSON.stringify(incompleteMediaGap?.paths ?? []) === JSON.stringify(missingMedia), 'unindexed media evidence gap paths are inaccurate')
} else {
  check(!incompleteMediaGap, 'complete unindexed media evidence retains a stale incomplete gap')
}
if (unindexedPublicMedia.length) {
  check(/^[a-f0-9]{64}$/.test(manifest.provenance?.publicMediaEvidenceSha256 ?? ''), 'public media evidence source hash is missing')
}

const forbiddenKey = /(?:^|_)(?:password|passwd|user_pass|user_email|billing|shipping|customer|session|token|nonce|api_?key|secret|submission|remote_addr|ip_address)(?:$|_)/i
function inspectKeys(value, path = 'content') {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => inspectKeys(entry, `${path}[${index}]`))
    return
  }
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) {
    check(!forbiddenKey.test(key), `${path}.${key}: sensitive field name escaped normalization`)
    inspectKeys(child, `${path}.${key}`)
  }
}
inspectKeys(content)
check(!/\b(?:CREATE\s+TABLE|INSERT\s+INTO|REPLACE\s+INTO)\b/i.test(contentText), 'content artifact appears to contain raw SQL')
check(!/SERVMASK_PREFIX_(?:users|usermeta|wc_orders|e_submissions|wpforms|wflogins)/i.test(contentText), 'content artifact contains a prohibited source table identifier')
check(!/\$(?:P|H)\$[./0-9A-Za-z]{20,}/.test(contentText), 'content artifact appears to contain a WordPress password hash')

const requiredExclusionCategories = new Set([
  'identity-and-authentication',
  'commerce-and-customers',
  'forms-and-messages',
  'logs-and-analytics',
  'secrets-and-configuration',
  'private-content',
  'unreferenced-media',
])
for (const policy of exclusions.tablePolicy?.neverParsed ?? []) requiredExclusionCategories.delete(policy.category)
check(requiredExclusionCategories.size === 0, `exclusion ledger is missing: ${[...requiredExclusionCategories].join(', ')}`)
check(typeof exclusions.privacyStatement === 'string' && exclusions.privacyStatement.includes('No user'), 'privacy exclusion statement is missing')
check((manifest.gaps ?? []).some((gap) => gap.code === 'live-crawl-remains-current-seo-authority'), 'live SEO authority gap is not explicit')
check((manifest.gaps ?? []).some((gap) => gap.code.startsWith('known-live-delta-')), 'known public live delta is not explicit')

if (failures.length) throw new Error(`WordPress public migration validation failed:\n${failures.join('\n')}`)

console.log(JSON.stringify({
  valid: true,
  archiveSha256: manifest.provenance.archiveSha256,
  databaseSha256: manifest.provenance.databaseSha256,
  databaseSnapshotAt: manifest.provenance.databaseSnapshotAt,
  counts: manifest.counts,
  explicitBlankMediaAlts: content.attachments.filter((attachment) => attachment.altText === '').length,
  populatedMediaAlts: content.attachments.filter((attachment) => attachment.altText !== '').length,
  gaps: manifest.gaps.map((gap) => gap.code),
}, null, 2))
