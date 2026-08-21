#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  parseCreateTable,
  parseInsertHeader,
  parseInsertRows,
  readSqlStatements,
  rowObject,
} from './lib/sql-dump.mjs'

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const DEFAULT_OUTPUT_DIR = resolve(REPOSITORY_ROOT, 'data/migration/wordpress-public')
const SCHEMA_VERSION = 1
const POLICY_VERSION = 1
const KNOWN_PUBLIC_DELTA_SLUG = 'custom-puffy-stickers-guide'
const UNINDEXED_PUBLIC_MEDIA_PATHS = [
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
]

const TABLE_SUFFIXES = [
  ['term_relationships', 'termRelationships'],
  ['term_taxonomy', 'termTaxonomy'],
  ['redirection_items', 'redirectionItems'],
  ['rank_math_redirections', 'rankMathRedirections'],
  ['yoast_indexable', 'yoastIndexable'],
  ['postmeta', 'postMeta'],
  ['termmeta', 'termMeta'],
  ['options', 'options'],
  ['posts', 'posts'],
  ['terms', 'terms'],
]

const POST_TYPES = new Set(['post', 'page', 'product', 'product_variation', 'attachment'])
const PUBLIC_CONTENT_TYPES = new Set(['post', 'page', 'product'])
const PRODUCT_META_KEYS = new Set([
  '_backorders',
  '_default_attributes',
  '_downloadable',
  '_height',
  '_length',
  '_manage_stock',
  '_price',
  '_product_attributes',
  '_product_image_gallery',
  '_regular_price',
  '_sale_price',
  '_sale_price_dates_from',
  '_sale_price_dates_to',
  '_sku',
  '_sold_individually',
  '_stock',
  '_stock_status',
  '_tax_class',
  '_tax_status',
  '_thumbnail_id',
  '_variation_description',
  '_virtual',
  '_weight',
  '_width',
])
const ATTACHMENT_META_KEYS = new Set([
  '_wp_attached_file',
  '_wp_attachment_image_alt',
  '_wp_attachment_metadata',
])
const SEO_META_KEYS = new Set([
  '_aioseo_canonical_url',
  '_aioseo_description',
  '_aioseo_keywords',
  '_aioseo_og_article_section',
  '_aioseo_og_description',
  '_aioseo_og_image_custom_url',
  '_aioseo_og_title',
  '_aioseo_robots_default',
  '_aioseo_robots_noindex',
  '_aioseo_robots_nofollow',
  '_aioseo_title',
  '_aioseo_twitter_description',
  '_aioseo_twitter_image_custom_url',
  '_aioseo_twitter_title',
  '_yoast_wpseo_bctitle',
  '_yoast_wpseo_canonical',
  '_yoast_wpseo_focuskw',
  '_yoast_wpseo_metadesc',
  '_yoast_wpseo_meta-robots-noindex',
  '_yoast_wpseo_meta-robots-nofollow',
  '_yoast_wpseo_opengraph-description',
  '_yoast_wpseo_opengraph-image',
  '_yoast_wpseo_opengraph-image-id',
  '_yoast_wpseo_opengraph-title',
  '_yoast_wpseo_primary_category',
  '_yoast_wpseo_primary_product_cat',
  '_yoast_wpseo_title',
  '_yoast_wpseo_twitter-description',
  '_yoast_wpseo_twitter-image',
  '_yoast_wpseo_twitter-image-id',
  '_yoast_wpseo_twitter-title',
  'rank_math_canonical_url',
  'rank_math_description',
  'rank_math_facebook_description',
  'rank_math_facebook_image',
  'rank_math_facebook_image_id',
  'rank_math_facebook_title',
  'rank_math_focus_keyword',
  'rank_math_primary_category',
  'rank_math_primary_product_cat',
  'rank_math_robots',
  'rank_math_title',
  'rank_math_twitter_description',
  'rank_math_twitter_image',
  'rank_math_twitter_image_id',
  'rank_math_twitter_title',
])
const PAGE_META_KEYS = new Set(['_wp_page_template'])
const TERM_META_KEYS = new Set([
  'display_type',
  'order',
  'product_count_product_cat',
  'thumbnail_id',
  ...SEO_META_KEYS,
])
const INDEXABLE_FIELDS = [
  'id',
  'object_id',
  'object_type',
  'object_sub_type',
  'permalink',
  'title',
  'description',
  'breadcrumb_title',
  'is_robots_noindex',
  'is_robots_nofollow',
  'is_robots_noarchive',
  'is_robots_noimageindex',
  'is_robots_nosnippet',
  'canonical',
  'primary_focus_keyword',
  'open_graph_title',
  'open_graph_description',
  'open_graph_image',
  'open_graph_image_id',
  'twitter_title',
  'twitter_description',
  'twitter_image',
  'twitter_image_id',
  'post_status',
  'number_of_pages',
  'version',
  'created_at',
  'updated_at',
]

function parseArguments(argv) {
  const argumentsMap = new Map()
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`)
    const key = token.slice(2)
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) throw new Error(`Missing value for --${key}`)
    argumentsMap.set(key, value)
    index += 1
  }
  if (!argumentsMap.has('input')) {
    throw new Error('Usage: node scripts/migration/normalize-wordpress-public.mjs --input <isolated database.sql> --archive-sha256 <sha256> [--output-dir <dir>] [--database-snapshot-at <ISO>] [--table-prefix <prefix>]')
  }
  if (!argumentsMap.has('archive-sha256')) throw new Error('--archive-sha256 is required for provenance')
  return {
    input: resolve(argumentsMap.get('input')),
    outputDir: resolve(argumentsMap.get('output-dir') ?? DEFAULT_OUTPUT_DIR),
    archiveSha256: argumentsMap.get('archive-sha256').toLowerCase(),
    databaseSnapshotAt: argumentsMap.get('database-snapshot-at') ?? null,
    tablePrefix: argumentsMap.get('table-prefix') ?? null,
    publicMediaEvidence: argumentsMap.has('public-media-evidence')
      ? resolve(argumentsMap.get('public-media-evidence'))
      : null,
  }
}

function isWithin(parent, child) {
  const path = relative(parent, child)
  return path === '' || (!path.startsWith('..') && !isAbsolute(path))
}

async function sha256File(path) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}

function sha256Text(value) {
  return createHash('sha256').update(value).digest('hex')
}

function stableIdCompare(left, right) {
  const leftValue = String(left ?? '')
  const rightValue = String(right ?? '')
  if (/^\d+$/.test(leftValue) && /^\d+$/.test(rightValue)) {
    const difference = BigInt(leftValue) - BigInt(rightValue)
    if (difference < 0n) return -1
    if (difference > 0n) return 1
    return 0
  }
  return leftValue.localeCompare(rightValue, 'en')
}

function sortById(records) {
  return records.sort((left, right) => stableIdCompare(left.id, right.id))
}

function compactObject(entries) {
  return Object.fromEntries(entries.filter(([, value]) => value !== null && value !== undefined && value !== ''))
}

function classifyTable(table) {
  for (const [suffix, kind] of TABLE_SUFFIXES) {
    if (table === suffix) return { prefix: '', kind, suffix }
    if (table.endsWith(`_${suffix}`)) return { prefix: table.slice(0, -(suffix.length)), kind, suffix }
  }
  return null
}

function createInstance(prefix) {
  return {
    prefix,
    tableNames: {},
    counts: {},
    posts: [],
    postMeta: [],
    terms: [],
    termTaxonomy: [],
    termRelationships: [],
    termMeta: [],
    options: [],
    yoastIndexable: [],
    redirectionItems: [],
    rankMathRedirections: [],
    excluded: {
      unsupportedPostType: 0,
      postMetaNotAllowlisted: 0,
      termMetaNotAllowlisted: 0,
    },
  }
}

function allowPostMeta(key) {
  return PRODUCT_META_KEYS.has(key)
    || ATTACHMENT_META_KEYS.has(key)
    || PAGE_META_KEYS.has(key)
    || SEO_META_KEYS.has(key)
    || /^attribute_[a-zA-Z0-9_-]+$/.test(key)
    || /^rank_math_schema_[a-zA-Z0-9_-]+$/.test(key)
}

function normalizePostRow(row) {
  const type = row.post_type ?? ''
  return {
    id: String(row.ID ?? ''),
    kind: type,
    slug: row.post_name ?? '',
    status: row.post_status ?? '',
    date: row.post_date ?? null,
    dateGmt: row.post_date_gmt ?? null,
    modified: row.post_modified ?? null,
    modifiedGmt: row.post_modified_gmt ?? null,
    parentId: String(row.post_parent ?? '0'),
    title: row.post_title ?? '',
    excerpt: row.post_excerpt ?? '',
    content: row.post_content ?? '',
    guid: row.guid ?? '',
    menuOrder: row.menu_order ?? '0',
    mimeType: row.post_mime_type ?? '',
    passwordProtected: Boolean(row.post_password),
  }
}

function normalizeMetaRow(row, ownerField) {
  return {
    id: String(row.meta_id ?? ''),
    [ownerField]: String(row[ownerField === 'postId' ? 'post_id' : 'term_id'] ?? ''),
    key: row.meta_key ?? '',
    value: row.meta_value ?? '',
  }
}

function selectFields(row, fields) {
  return Object.fromEntries(fields.filter((field) => Object.hasOwn(row, field)).map((field) => [field, row[field]]))
}

function ingestRow(instance, kind, table, row) {
  instance.tableNames[kind] = table
  instance.counts[kind] = (instance.counts[kind] ?? 0) + 1
  switch (kind) {
    case 'posts': {
      if (!POST_TYPES.has(row.post_type)) {
        instance.excluded.unsupportedPostType += 1
        return
      }
      instance.posts.push(normalizePostRow(row))
      return
    }
    case 'postMeta': {
      const key = row.meta_key ?? ''
      if (!allowPostMeta(key)) {
        instance.excluded.postMetaNotAllowlisted += 1
        return
      }
      instance.postMeta.push(normalizeMetaRow(row, 'postId'))
      return
    }
    case 'terms':
      instance.terms.push({
        id: String(row.term_id ?? ''),
        name: row.name ?? '',
        slug: row.slug ?? '',
        group: String(row.term_group ?? '0'),
      })
      return
    case 'termTaxonomy':
      instance.termTaxonomy.push({
        id: String(row.term_taxonomy_id ?? ''),
        termId: String(row.term_id ?? ''),
        taxonomy: row.taxonomy ?? '',
        description: row.description ?? '',
        parentId: String(row.parent ?? '0'),
        sourceCount: String(row.count ?? '0'),
      })
      return
    case 'termRelationships':
      instance.termRelationships.push({
        objectId: String(row.object_id ?? ''),
        termTaxonomyId: String(row.term_taxonomy_id ?? ''),
        order: String(row.term_order ?? '0'),
      })
      return
    case 'termMeta': {
      const key = row.meta_key ?? ''
      if (!TERM_META_KEYS.has(key) && !/^rank_math_/.test(key)) {
        instance.excluded.termMetaNotAllowlisted += 1
        return
      }
      instance.termMeta.push(normalizeMetaRow(row, 'termId'))
      return
    }
    case 'options': {
      if (['siteurl', 'home', 'blogname', 'permalink_structure'].includes(row.option_name)) {
        instance.options.push({ name: row.option_name, value: row.option_value ?? '' })
      }
      return
    }
    case 'yoastIndexable':
      instance.yoastIndexable.push(selectFields(row, INDEXABLE_FIELDS))
      return
    case 'redirectionItems':
      instance.redirectionItems.push(selectFields(row, [
        'id', 'url', 'match_url', 'match_data', 'regex', 'position', 'last_count',
        'last_access', 'group_id', 'status', 'action_type', 'action_code', 'action_data', 'title',
      ]))
      return
    case 'rankMathRedirections':
      instance.rankMathRedirections.push(selectFields(row, [
        'id', 'sources', 'url_to', 'header_code', 'hits', 'status', 'created', 'updated',
      ]))
      return
    default:
      throw new Error(`Unsupported table kind: ${kind}`)
  }
}

function chooseInstance(instances, requestedPrefix) {
  if (requestedPrefix !== null) {
    const instance = instances.get(requestedPrefix)
    if (!instance) throw new Error(`No recognized WordPress tables found for prefix ${requestedPrefix}`)
    return instance
  }

  const candidates = [...instances.values()]
  if (!candidates.length) throw new Error('No recognized WordPress tables found in SQL dump')
  const score = (instance) => {
    const siteUrl = instance.options.find((option) => option.name === 'siteurl')?.value ?? ''
    const publicSiteBonus = /(^|\.)puffsticker\.com(?:\/|$)/i.test(siteUrl.replace(/^https?:\/\//, '')) ? 1_000_000 : 0
    return publicSiteBonus + (instance.counts.posts ?? 0)
  }
  candidates.sort((left, right) => score(right) - score(left) || left.prefix.localeCompare(right.prefix, 'en'))
  return candidates[0]
}

function metaMap(records, ownerField) {
  const map = new Map()
  for (const record of records) {
    const ownerId = record[ownerField]
    if (!map.has(ownerId)) map.set(ownerId, new Map())
    const values = map.get(ownerId)
    if (!values.has(record.key)) values.set(record.key, [])
    values.get(record.key).push(record.value)
  }
  return map
}

function lastMeta(metadata, keys) {
  for (const key of keys) {
    const values = metadata?.get(key)
    if (values?.length) return values.at(-1)
  }
  return null
}

function numericReferences(value) {
  return (String(value ?? '').match(/\b\d+\b/g) ?? []).filter((id) => id !== '0')
}

function normalizeUploadFile(value) {
  if (!value) return null
  let normalized = String(value).replace(/\\\//g, '/').replace(/&amp;/g, '&').split(/[?#]/, 1)[0]
  try { normalized = decodeURIComponent(normalized) } catch { /* Preserve malformed-but-public legacy paths verbatim. */ }
  normalized = normalized.replace(/^\/+/, '')
  return normalized && !normalized.includes('..') && !normalized.includes('\\') ? normalized.toLowerCase() : null
}

function extractContentMediaReferences(content) {
  const ids = new Set()
  const files = new Set()
  const source = String(content ?? '').replace(/\\\//g, '/')
  for (const match of source.matchAll(/(?:wp-image-|attachment[_-]|data-(?:attachment-)?id=["']?)(\d+)/gi)) {
    if (match[1] !== '0') ids.add(match[1])
  }
  for (const match of source.matchAll(/(?:https?:\/\/[^\s"'<>]+)?\/wp-content\/uploads\/[^\s"'<>?#)]+/gi)) {
    const marker = match[0].toLowerCase().indexOf('/wp-content/uploads/')
    const file = normalizeUploadFile(match[0].slice(marker + '/wp-content/uploads/'.length))
    if (file) files.add(file)
  }
  return { ids, files }
}

function safeAttachmentMetadata(value) {
  if (!value) return null
  const files = [...String(value).matchAll(/s:4:"file";s:\d+:"([^"]+)"/g)]
    .map((match) => match[1])
    .filter((file) => !file.includes('..') && !file.startsWith('/') && !file.includes('\\'))
  const width = String(value).match(/s:5:"width";i:(\d+)/)?.[1] ?? null
  const height = String(value).match(/s:6:"height";i:(\d+)/)?.[1] ?? null
  return compactObject([
    ['sourceSha256', sha256Text(value)],
    ['width', width],
    ['height', height],
    ['files', files.length ? [...new Set(files)].sort() : null],
  ])
}

function decodeSimpleSerializedList(value) {
  if (!value) return []
  if (!/^[aObisNd]:/.test(value)) return String(value).split(',').map((part) => part.trim()).filter(Boolean)
  return [...String(value).matchAll(/s:\d+:"([^"]*)"/g)].map((match) => match[1])
}

function deriveRobots(metadata, indexable) {
  const directives = new Set()
  if (lastMeta(metadata, ['_yoast_wpseo_meta-robots-noindex', '_aioseo_robots_noindex']) === '1') directives.add('noindex')
  if (lastMeta(metadata, ['_yoast_wpseo_meta-robots-nofollow', '_aioseo_robots_nofollow']) === '1') directives.add('nofollow')
  for (const directive of decodeSimpleSerializedList(lastMeta(metadata, ['rank_math_robots']))) directives.add(directive)
  if (indexable?.is_robots_noindex === '1') directives.add('noindex')
  if (indexable?.is_robots_nofollow === '1') directives.add('nofollow')
  if (indexable?.is_robots_noarchive === '1') directives.add('noarchive')
  if (indexable?.is_robots_noimageindex === '1') directives.add('noimageindex')
  if (indexable?.is_robots_nosnippet === '1') directives.add('nosnippet')
  return [...directives].sort()
}

function safePublicUrl(value, siteOrigin) {
  if (!value) return null
  try {
    const url = new URL(value, siteOrigin || 'https://puffsticker.com')
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null
    return url.href
  } catch {
    return null
  }
}

function canonicalPath(value, siteOrigin) {
  const publicUrl = safePublicUrl(value, siteOrigin)
  if (!publicUrl) return null
  const url = new URL(publicUrl)
  if (siteOrigin && url.origin !== new URL(siteOrigin).origin) return null
  return `${url.pathname}${url.search}`
}

function seoForPost(metadata, indexable, siteOrigin) {
  const canonical = lastMeta(metadata, [
    '_yoast_wpseo_canonical', 'rank_math_canonical_url', '_aioseo_canonical_url',
  ]) ?? indexable?.canonical ?? indexable?.permalink ?? null
  const robots = deriveRobots(metadata, indexable)
  return compactObject([
    ['title', lastMeta(metadata, ['_yoast_wpseo_title', 'rank_math_title', '_aioseo_title']) ?? indexable?.title],
    ['description', lastMeta(metadata, ['_yoast_wpseo_metadesc', 'rank_math_description', '_aioseo_description']) ?? indexable?.description],
    ['canonical', safePublicUrl(canonical, siteOrigin)],
    ['canonicalPath', canonicalPath(canonical, siteOrigin)],
    ['robots', robots.length ? robots : null],
    ['focusKeyword', lastMeta(metadata, ['_yoast_wpseo_focuskw', 'rank_math_focus_keyword']) ?? indexable?.primary_focus_keyword],
    ['openGraphTitle', lastMeta(metadata, ['_yoast_wpseo_opengraph-title', 'rank_math_facebook_title', '_aioseo_og_title']) ?? indexable?.open_graph_title],
    ['openGraphDescription', lastMeta(metadata, ['_yoast_wpseo_opengraph-description', 'rank_math_facebook_description', '_aioseo_og_description']) ?? indexable?.open_graph_description],
    ['openGraphImage', safePublicUrl(lastMeta(metadata, ['_yoast_wpseo_opengraph-image', 'rank_math_facebook_image', '_aioseo_og_image_custom_url']) ?? indexable?.open_graph_image, siteOrigin)],
    ['twitterTitle', lastMeta(metadata, ['_yoast_wpseo_twitter-title', 'rank_math_twitter_title', '_aioseo_twitter_title']) ?? indexable?.twitter_title],
    ['twitterDescription', lastMeta(metadata, ['_yoast_wpseo_twitter-description', 'rank_math_twitter_description', '_aioseo_twitter_description']) ?? indexable?.twitter_description],
    ['twitterImage', safePublicUrl(lastMeta(metadata, ['_yoast_wpseo_twitter-image', 'rank_math_twitter_image', '_aioseo_twitter_image_custom_url']) ?? indexable?.twitter_image, siteOrigin)],
  ])
}

function productPublicData(metadata) {
  const attributes = Object.fromEntries(
    [...(metadata?.entries() ?? [])]
      .filter(([key]) => key.startsWith('attribute_'))
      .map(([key, values]) => [key.slice('attribute_'.length), values.at(-1)]),
  )
  return compactObject([
    ['sku', lastMeta(metadata, ['_sku'])],
    ['price', lastMeta(metadata, ['_price'])],
    ['regularPrice', lastMeta(metadata, ['_regular_price'])],
    ['salePrice', lastMeta(metadata, ['_sale_price'])],
    ['stockStatus', lastMeta(metadata, ['_stock_status'])],
    ['weight', lastMeta(metadata, ['_weight'])],
    ['length', lastMeta(metadata, ['_length'])],
    ['width', lastMeta(metadata, ['_width'])],
    ['height', lastMeta(metadata, ['_height'])],
    ['attributes', Object.keys(attributes).length ? attributes : null],
    ['serializedAttributes', lastMeta(metadata, ['_product_attributes'])],
    ['serializedDefaultAttributes', lastMeta(metadata, ['_default_attributes'])],
    ['variationDescription', lastMeta(metadata, ['_variation_description'])],
  ])
}

function normalizeRedirects(instance, siteOrigin, exclusionCounts) {
  const redirects = []
  for (const row of instance.redirectionItems) {
    const enabled = !row.status || row.status === 'enabled'
    const statusCode = Number.parseInt(row.action_code || '301', 10)
    const sourcePath = row.url || row.match_url
    const target = safePublicUrl(row.action_data, siteOrigin)
    if (!enabled || !sourcePath || !target || ![301, 302, 307, 308].includes(statusCode)) {
      exclusionCounts.redirectRowsNotActivePublicRules += 1
      continue
    }
    redirects.push({
      id: String(row.id ?? ''),
      sourcePath,
      target,
      statusCode,
      regex: row.regex === '1',
      sourcePlugin: 'redirection',
    })
  }

  for (const row of instance.rankMathRedirections) {
    const enabled = row.status === 'active'
    const statusCode = Number.parseInt(row.header_code || '301', 10)
    const target = safePublicUrl(row.url_to, siteOrigin)
    const sources = decodeSimpleSerializedList(row.sources).filter((source) => source.startsWith('/'))
    if (!enabled || !target || !sources.length || ![301, 302, 307, 308].includes(statusCode)) {
      exclusionCounts.redirectRowsNotActivePublicRules += 1
      continue
    }
    for (const sourcePath of sources) {
      redirects.push({
        id: String(row.id ?? ''),
        sourcePath,
        target,
        statusCode,
        regex: false,
        sourcePlugin: 'rank-math',
      })
    }
  }
  return redirects.sort((left, right) => left.sourcePath.localeCompare(right.sourcePath, 'en') || stableIdCompare(left.id, right.id))
}

function buildNormalizedContent(instance) {
  const optionMap = new Map(instance.options.map((option) => [option.name, option.value]))
  const siteOrigin = safePublicUrl(optionMap.get('home') ?? optionMap.get('siteurl') ?? 'https://puffsticker.com')
  const allPostMeta = metaMap(instance.postMeta, 'postId')
  const allTermMeta = metaMap(instance.termMeta, 'termId')
  const exclusionCounts = {
    unpublishedOrPasswordProtectedContent: 0,
    orphanOrUnpublishedVariations: 0,
    unreferencedAttachments: 0,
    taxonomyRowsOutsidePublicGraph: 0,
    postMetaOutsidePublicGraph: 0,
    termMetaOutsidePublicGraph: 0,
    indexablesOutsidePublicGraph: 0,
    redirectRowsNotActivePublicRules: 0,
  }

  const contentPosts = instance.posts.filter((post) => PUBLIC_CONTENT_TYPES.has(post.kind))
  const publicPrimary = contentPosts.filter((post) => post.status === 'publish' && !post.passwordProtected)
  exclusionCounts.unpublishedOrPasswordProtectedContent = contentPosts.length - publicPrimary.length
  const publicIds = new Set(publicPrimary.map((post) => post.id))

  const variations = instance.posts.filter((post) => post.kind === 'product_variation')
  const publicVariations = variations.filter((post) => post.status === 'publish' && !post.passwordProtected && publicIds.has(post.parentId))
  exclusionCounts.orphanOrUnpublishedVariations = variations.length - publicVariations.length
  for (const variation of publicVariations) publicIds.add(variation.id)

  const relationships = instance.termRelationships.filter((relationship) => publicIds.has(relationship.objectId))
  const taxonomyIds = new Set(relationships.map((relationship) => relationship.termTaxonomyId))
  const termTaxonomy = instance.termTaxonomy.filter((taxonomy) => taxonomyIds.has(taxonomy.id))
  const termIds = new Set(termTaxonomy.map((taxonomy) => taxonomy.termId))
  const terms = instance.terms.filter((term) => termIds.has(term.id))
  const termMeta = instance.termMeta.filter((metadata) => termIds.has(metadata.termId))
  exclusionCounts.taxonomyRowsOutsidePublicGraph = instance.termTaxonomy.length - termTaxonomy.length
  exclusionCounts.termMetaOutsidePublicGraph = instance.termMeta.length - termMeta.length

  const attachmentIds = new Set()
  const referencedUploadFiles = new Set()
  const addReferencesFromMeta = (metadata) => {
    for (const key of ['_thumbnail_id', '_product_image_gallery', '_yoast_wpseo_opengraph-image-id', '_yoast_wpseo_twitter-image-id', 'rank_math_facebook_image_id', 'rank_math_twitter_image_id']) {
      for (const value of metadata?.get(key) ?? []) for (const id of numericReferences(value)) attachmentIds.add(id)
    }
  }
  for (const post of [...publicPrimary, ...publicVariations]) {
    const metadata = allPostMeta.get(post.id)
    addReferencesFromMeta(metadata)
    const contentReferences = extractContentMediaReferences(`${post.content}\n${post.excerpt}`)
    for (const id of contentReferences.ids) attachmentIds.add(id)
    for (const file of contentReferences.files) referencedUploadFiles.add(file)
    for (const [key, values] of metadata?.entries() ?? []) {
      if (!/image/i.test(key)) continue
      for (const value of values) {
        const references = extractContentMediaReferences(value)
        for (const id of references.ids) attachmentIds.add(id)
        for (const file of references.files) referencedUploadFiles.add(file)
      }
    }
  }
  for (const indexable of instance.yoastIndexable) {
    if (indexable.object_type !== 'post' || !publicIds.has(String(indexable.object_id))) continue
    const references = extractContentMediaReferences([
      indexable.open_graph_image,
      indexable.twitter_image,
    ].filter(Boolean).join('\n'))
    for (const id of references.ids) attachmentIds.add(id)
    for (const file of references.files) referencedUploadFiles.add(file)
  }
  for (const termId of termIds) {
    const metadata = allTermMeta.get(termId)
    for (const value of metadata?.get('thumbnail_id') ?? []) for (const id of numericReferences(value)) attachmentIds.add(id)
  }

  const allAttachments = instance.posts.filter((post) => post.kind === 'attachment')
  for (const attachment of allAttachments) {
    if (publicIds.has(attachment.parentId)) attachmentIds.add(attachment.id)
    const metadata = allPostMeta.get(attachment.id)
    const attachedFile = lastMeta(metadata, ['_wp_attached_file'])
    const normalizedAttachedFile = normalizeUploadFile(attachedFile)
    const attachmentFiles = new Set(normalizedAttachedFile ? [normalizedAttachedFile] : [])
    const metadataFiles = safeAttachmentMetadata(lastMeta(metadata, ['_wp_attachment_metadata']))?.files ?? []
    const parentDirectory = normalizedAttachedFile?.includes('/')
      ? normalizedAttachedFile.slice(0, normalizedAttachedFile.lastIndexOf('/') + 1)
      : ''
    for (const file of metadataFiles) {
      const normalizedFile = normalizeUploadFile(file)
      if (normalizedFile) attachmentFiles.add(normalizedFile.includes('/') ? normalizedFile : `${parentDirectory}${normalizedFile}`)
    }
    if ([...attachmentFiles].some((file) => referencedUploadFiles.has(file))) attachmentIds.add(attachment.id)
    try {
      const guidPath = new URL(attachment.guid).pathname
      const marker = guidPath.toLowerCase().indexOf('/wp-content/uploads/')
      const guidFile = marker >= 0 ? normalizeUploadFile(guidPath.slice(marker + '/wp-content/uploads/'.length)) : null
      if (guidFile && referencedUploadFiles.has(guidFile)) attachmentIds.add(attachment.id)
    } catch {
      // A non-URL attachment GUID is not a safe public media reference.
    }
  }
  const attachments = allAttachments.filter((post) => attachmentIds.has(post.id) && !post.passwordProtected)
  exclusionCounts.unreferencedAttachments = allAttachments.length - attachments.length
  for (const attachment of attachments) publicIds.add(attachment.id)

  const indexableByPostId = new Map()
  for (const indexable of instance.yoastIndexable) {
    if (indexable.object_type === 'post' && publicIds.has(String(indexable.object_id))) {
      indexableByPostId.set(String(indexable.object_id), indexable)
    } else {
      exclusionCounts.indexablesOutsidePublicGraph += 1
    }
  }

  const taxonomyByObject = new Map()
  const taxonomyById = new Map(termTaxonomy.map((taxonomy) => [taxonomy.id, taxonomy]))
  const termById = new Map(terms.map((term) => [term.id, term]))
  for (const relationship of relationships) {
    const taxonomy = taxonomyById.get(relationship.termTaxonomyId)
    const term = taxonomy && termById.get(taxonomy.termId)
    if (!taxonomy || !term) continue
    if (!taxonomyByObject.has(relationship.objectId)) taxonomyByObject.set(relationship.objectId, [])
    taxonomyByObject.get(relationship.objectId).push({
      termId: term.id,
      termTaxonomyId: taxonomy.id,
      taxonomy: taxonomy.taxonomy,
      slug: term.slug,
    })
  }

  const attachmentByParent = new Map()
  const attachmentIdByFile = new Map()
  for (const attachment of attachments) {
    if (!attachmentByParent.has(attachment.parentId)) attachmentByParent.set(attachment.parentId, [])
    attachmentByParent.get(attachment.parentId).push(attachment.id)
    const metadata = allPostMeta.get(attachment.id)
    const attachedFile = normalizeUploadFile(lastMeta(metadata, ['_wp_attached_file']))
    const parentDirectory = attachedFile?.includes('/')
      ? attachedFile.slice(0, attachedFile.lastIndexOf('/') + 1)
      : ''
    const files = new Set(attachedFile ? [attachedFile] : [])
    for (const file of safeAttachmentMetadata(lastMeta(metadata, ['_wp_attachment_metadata']))?.files ?? []) {
      const normalizedFile = normalizeUploadFile(file)
      if (normalizedFile) files.add(normalizedFile.includes('/') ? normalizedFile : `${parentDirectory}${normalizedFile}`)
    }
    try {
      const path = new URL(attachment.guid).pathname
      const marker = path.toLowerCase().indexOf('/wp-content/uploads/')
      const guidFile = marker >= 0 ? normalizeUploadFile(path.slice(marker + '/wp-content/uploads/'.length)) : null
      if (guidFile) files.add(guidFile)
    } catch { /* Invalid historical GUIDs are already excluded from public URLs. */ }
    for (const file of files) if (!attachmentIdByFile.has(file)) attachmentIdByFile.set(file, attachment.id)
  }

  const publicRecord = (post) => {
    const metadata = allPostMeta.get(post.id)
    const indexable = indexableByPostId.get(post.id)
    const taxonomy = (taxonomyByObject.get(post.id) ?? []).sort((left, right) => stableIdCompare(left.termTaxonomyId, right.termTaxonomyId))
    const rawFeaturedMediaId = lastMeta(metadata, ['_thumbnail_id'])
    const featuredMediaId = rawFeaturedMediaId && rawFeaturedMediaId !== '0' ? rawFeaturedMediaId : null
    const mediaIds = new Set([
      ...numericReferences(lastMeta(metadata, ['_product_image_gallery'])),
      ...(attachmentByParent.get(post.id) ?? []),
    ])
    for (const key of ['_yoast_wpseo_opengraph-image-id', '_yoast_wpseo_twitter-image-id', 'rank_math_facebook_image_id', 'rank_math_twitter_image_id']) {
      for (const value of metadata?.get(key) ?? []) for (const id of numericReferences(value)) mediaIds.add(id)
    }
    const contentMedia = extractContentMediaReferences(`${post.content}\n${post.excerpt}`)
    for (const id of contentMedia.ids) mediaIds.add(id)
    for (const file of contentMedia.files) {
      const attachmentId = attachmentIdByFile.get(file)
      if (attachmentId) mediaIds.add(attachmentId)
    }
    if (featuredMediaId) mediaIds.add(featuredMediaId)
    const seo = seoForPost(metadata, indexable, siteOrigin)
    const permalink = safePublicUrl(indexable?.permalink ?? post.guid, siteOrigin)
    return compactObject([
      ['kind', post.kind],
      ['id', post.id],
      ['slug', post.slug],
      ['status', post.status],
      ['date', post.date],
      ['dateGmt', post.dateGmt],
      ['modified', post.modified],
      ['modifiedGmt', post.modifiedGmt],
      ['parentId', post.parentId],
      ['permalink', permalink],
      ['canonicalPath', seo.canonicalPath ?? canonicalPath(permalink, siteOrigin)],
      ['title', post.title],
      ['excerpt', post.excerpt],
      ['content', post.content],
      ['menuOrder', post.menuOrder],
      ['seo', Object.keys(seo).length ? seo : null],
      ['taxonomy', taxonomy.length ? taxonomy : null],
      ['taxonomyTermIds', taxonomy.length ? [...new Set(taxonomy.map((item) => item.termId))].sort(stableIdCompare) : null],
      ['taxonomySlugs', taxonomy.length ? [...new Set(taxonomy.map((item) => item.slug))].sort() : null],
      ['featuredMediaId', featuredMediaId],
      ['mediaIds', mediaIds.size ? [...mediaIds].filter((id) => attachmentIds.has(id)).sort(stableIdCompare) : null],
      ['product', ['product', 'product_variation'].includes(post.kind) ? productPublicData(metadata) : null],
    ])
  }

  const records = publicPrimary.map(publicRecord)
  const variationRecords = publicVariations.map(publicRecord)
  const attachmentRecords = attachments.map((post) => {
    const metadata = allPostMeta.get(post.id)
    const record = compactObject([
      ['kind', 'attachment'],
      ['id', post.id],
      ['slug', post.slug],
      ['status', post.status],
      ['date', post.date],
      ['dateGmt', post.dateGmt],
      ['modified', post.modified],
      ['modifiedGmt', post.modifiedGmt],
      ['parentId', post.parentId],
      ['title', post.title],
      ['caption', post.excerpt],
      ['url', safePublicUrl(post.guid, siteOrigin)],
      ['file', lastMeta(metadata, ['_wp_attached_file'])],
      ['mimeType', post.mimeType],
      ['mediaMetadata', safeAttachmentMetadata(lastMeta(metadata, ['_wp_attachment_metadata']))],
    ])
    // Absence and an intentionally blank WordPress alt are semantically
    // different from a dropped field; every selected attachment records it.
    record.altText = lastMeta(metadata, ['_wp_attachment_image_alt']) ?? ''
    return record
  })

  const selectedPostMeta = instance.postMeta.filter((metadata) => publicIds.has(metadata.postId))
  exclusionCounts.postMetaOutsidePublicGraph = instance.postMeta.length - selectedPostMeta.length
  const redirects = normalizeRedirects(instance, siteOrigin, exclusionCounts)

  const content = {
    schemaVersion: SCHEMA_VERSION,
    scope: 'published-public-wordpress-content-only',
    site: compactObject([
      ['home', siteOrigin],
      ['siteUrl', safePublicUrl(optionMap.get('siteurl'), siteOrigin)],
      ['name', optionMap.get('blogname')],
      ['permalinkStructure', optionMap.get('permalink_structure')],
    ]),
    posts: sortById(records.filter((record) => record.kind === 'post')),
    pages: sortById(records.filter((record) => record.kind === 'page')),
    products: sortById(records.filter((record) => record.kind === 'product')),
    variations: sortById(variationRecords),
    attachments: sortById(attachmentRecords),
    taxonomy: {
      terms: sortById(terms),
      termTaxonomy: sortById(termTaxonomy),
      relationships: relationships.sort((left, right) => stableIdCompare(left.objectId, right.objectId) || stableIdCompare(left.termTaxonomyId, right.termTaxonomyId)),
      termMeta: sortById(termMeta),
    },
    redirects,
  }

  return { content, exclusionCounts, selectedPostMetaCount: selectedPostMeta.length }
}

function countSummary(content) {
  return {
    posts: content.posts.length,
    pages: content.pages.length,
    products: content.products.length,
    variations: content.variations.length,
    attachments: content.attachments.length,
    terms: content.taxonomy.terms.length,
    termTaxonomy: content.taxonomy.termTaxonomy.length,
    termRelationships: content.taxonomy.relationships.length,
    termMeta: content.taxonomy.termMeta.length,
    redirects: content.redirects.length,
    unindexedPublicMedia: content.unindexedPublicMedia?.length ?? 0,
  }
}

function writeJsonValue(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

async function loadPublicMediaEvidence(path, archiveSha256) {
  if (!path) return { records: [], sourceSha256: null, missingEvidence: [...UNINDEXED_PUBLIC_MEDIA_PATHS] }
  const text = await readFile(path, 'utf8')
  const evidence = JSON.parse(text)
  if (String(evidence.archiveSha256 ?? '').toLowerCase() !== archiveSha256) {
    throw new Error('Public media evidence archive hash does not match --archive-sha256')
  }
  if (!Array.isArray(evidence.entries)) throw new Error('Public media evidence entries must be an array')
  const byPath = new Map()
  for (const entry of evidence.entries) {
    const pathValue = String(entry.path ?? '').replace(/\\/g, '/')
    const rootRelative = pathValue.startsWith('/') ? pathValue : `/${pathValue}`
    const normalizedPath = rootRelative.startsWith('/wp-content/uploads/')
      ? rootRelative
      : `/wp-content/uploads/${rootRelative.replace(/^\/+/, '')}`
    if (!UNINDEXED_PUBLIC_MEDIA_PATHS.includes(normalizedPath)) {
      throw new Error(`Public media evidence is not an approved exact live reference: ${normalizedPath}`)
    }
    if (byPath.has(normalizedPath)) throw new Error(`Duplicate public media evidence path: ${normalizedPath}`)
    const present = entry.present === true
    if (present && (!Number.isInteger(entry.bytes) || entry.bytes < 0 || !/^[a-fA-F0-9]{64}$/.test(entry.sha256 ?? ''))) {
      throw new Error(`Present public media evidence is incomplete: ${normalizedPath}`)
    }
    byPath.set(normalizedPath, compactObject([
      ['path', normalizedPath],
      ['archivePresent', present],
      ['bytes', present ? entry.bytes : null],
      ['sha256', present ? entry.sha256.toLowerCase() : null],
    ]))
  }
  const missingEvidence = UNINDEXED_PUBLIC_MEDIA_PATHS.filter((pathValue) => !byPath.has(pathValue))
  const records = UNINDEXED_PUBLIC_MEDIA_PATHS
    .filter((pathValue) => byPath.has(pathValue))
    .map((pathValue) => byPath.get(pathValue))
  return { records, sourceSha256: sha256Text(text), missingEvidence }
}

async function main() {
  const args = parseArguments(process.argv.slice(2))
  if (!/^[a-f0-9]{64}$/.test(args.archiveSha256)) throw new Error('--archive-sha256 must be a 64-character SHA-256')
  const inputPath = await realpath(args.input)
  const outputDir = resolve(args.outputDir)
  if (isWithin(REPOSITORY_ROOT, inputPath)) throw new Error('Raw WordPress SQL must remain outside the repository')
  if (!isWithin(REPOSITORY_ROOT, outputDir)) throw new Error('Normalized output directory must remain inside the repository')
  const inputStats = await stat(inputPath)
  if (!inputStats.isFile()) throw new Error('--input must point to an isolated database.sql file')
  const snapshotAt = args.databaseSnapshotAt ?? inputStats.mtime.toISOString()
  if (Number.isNaN(Date.parse(snapshotAt))) throw new Error('--database-snapshot-at must be an ISO timestamp')

  const tableColumns = new Map()
  const instances = new Map()
  let statements = 0
  let recognizedRows = 0
  for await (const statement of readSqlStatements(inputPath)) {
    statements += 1
    const create = parseCreateTable(statement)
    if (create) {
      tableColumns.set(create.table, create.columns)
      const classification = classifyTable(create.table)
      if (classification) {
        const instance = instances.get(classification.prefix) ?? createInstance(classification.prefix)
        instance.tableNames[classification.kind] = create.table
        instances.set(classification.prefix, instance)
      }
      continue
    }
    const header = parseInsertHeader(statement)
    if (!header) continue
    const classification = classifyTable(header.table)
    if (!classification) continue
    const columns = header.columns ?? tableColumns.get(header.table)
    if (!columns?.length) throw new Error(`No column definition available for ${header.table}`)
    const instance = instances.get(classification.prefix) ?? createInstance(classification.prefix)
    instances.set(classification.prefix, instance)
    const rows = parseInsertRows(statement, header)
    recognizedRows += rows.length
    for (const values of rows) ingestRow(instance, classification.kind, header.table, rowObject(columns, values))
  }

  const instance = chooseInstance(instances, args.tablePrefix)
  const databaseSha256 = await sha256File(inputPath)
  const { content, exclusionCounts, selectedPostMetaCount } = buildNormalizedContent(instance)
  const publicMediaEvidence = await loadPublicMediaEvidence(args.publicMediaEvidence, args.archiveSha256)
  content.unindexedPublicMedia = publicMediaEvidence.records
  const counts = countSummary(content)
  const liveDeltaPresent = [...content.posts, ...content.pages, ...content.products].some((record) => record.slug === KNOWN_PUBLIC_DELTA_SLUG)
  const gaps = [
    {
      code: 'live-crawl-remains-current-seo-authority',
      severity: 'expected',
      detail: 'The backup is a historical structural/data reference. Current production crawl evidence remains authoritative for live URLs, status, canonicals, metadata, schema and rendered content.',
    },
    {
      code: liveDeltaPresent ? 'known-live-delta-found-in-backup' : 'known-live-delta-absent-from-backup',
      severity: liveDeltaPresent ? 'informational' : 'reconcile',
      slug: KNOWN_PUBLIC_DELTA_SLUG,
      detail: liveDeltaPresent
        ? 'The production-delta post captured through the public WordPress REST API is present in this database snapshot.'
        : 'The production-delta post captured through the public WordPress REST API is newer than or otherwise absent from this database snapshot; retain the protected live fixture during reconciliation.',
    },
    ...(instance.yoastIndexable.length ? [] : [{
      code: 'yoast-indexables-unavailable',
      severity: 'informational',
      detail: 'No Yoast indexable table rows were available; SEO values are limited to allowlisted post/term metadata and must be reconciled against live crawl evidence.',
    }]),
    ...(publicMediaEvidence.missingEvidence.length ? [{
      code: 'unindexed-public-media-evidence-incomplete',
      severity: 'reconcile',
      paths: publicMediaEvidence.missingEvidence,
      detail: 'Exact first-party live media references without WordPress attachment rows still need isolated archive presence/hash evidence.',
    }] : []),
    ...(publicMediaEvidence.records.filter((record) => !record.archivePresent).length ? [{
      code: 'unindexed-public-media-absent-from-backup',
      severity: 'reconcile',
      paths: publicMediaEvidence.records.filter((record) => !record.archivePresent).map((record) => record.path),
      detail: 'These exact first-party live references have no attachment row and were not present as binary entries in the supplied backup.',
    }] : []),
  ]

  const exclusions = {
    schemaVersion: SCHEMA_VERSION,
    policyVersion: POLICY_VERSION,
    scope: 'public-only-no-pii',
    tablePolicy: {
      included: [
        'posts (published post/page/product and public published variations; referenced public attachments only)',
        'postmeta (strict public product/media/SEO allowlist only)',
        'terms, term_taxonomy, term_relationships and allowlisted termmeta (public content graph only)',
        'yoast_indexable (public selected object fields only, when present)',
        'redirection_items/rank_math_redirections (enabled public redirect rules only, when present)',
        'options (siteurl, home, blogname and permalink_structure only)',
      ],
      neverParsed: [
        { category: 'identity-and-authentication', patterns: ['users', 'usermeta', 'sessions'], reason: 'Users, password hashes, sessions and identity metadata are prohibited.' },
        { category: 'commerce-and-customers', patterns: ['orders', 'order_items', 'customer', 'woocommerce_sessions'], reason: 'Orders, customer records, addresses and commerce sessions are prohibited.' },
        { category: 'forms-and-messages', patterns: ['form', 'submission', 'inbox', 'contact'], reason: 'Quote/contact submissions and message payloads are prohibited.' },
        { category: 'logs-and-analytics', patterns: ['log', '404', 'analytics', 'statistics'], reason: 'Logs, visitor data, IPs, referrers and analytics records are prohibited.' },
        { category: 'secrets-and-configuration', patterns: ['all options except four public values', 'API credentials', 'tokens', 'nonces'], reason: 'Secrets and non-public configuration are prohibited.' },
        { category: 'private-content', patterns: ['draft', 'pending', 'private', 'trash', 'password-protected'], reason: 'Only published, non-password-protected public content is in scope.' },
        { category: 'unreferenced-media', patterns: ['attachments outside the selected public graph'], reason: 'Unreferenced uploads can contain private form/customer material and are prohibited.' },
      ],
    },
    excludedFields: {
      posts: ['post_author', 'post_password', 'to_ping', 'pinged', 'post_content_filtered', 'comment_count'],
      postmeta: ['all keys outside the explicit public product/media/SEO/page-template allowlist'],
      redirects: ['access counts/timestamps are read only to recognize shape and are not emitted'],
      options: ['all values except siteurl, home, blogname and permalink_structure'],
    },
    counts: {
      ...instance.excluded,
      ...exclusionCounts,
      selectedAllowlistedPostMetaRows: selectedPostMetaCount,
    },
    privacyStatement: 'No user, credential, order, customer, quote/form submission, log, session, secret or unreferenced-upload record is represented in the normalized artifact.',
  }

  const contentText = writeJsonValue(content)
  const exclusionsText = writeJsonValue(exclusions)
  const manifest = {
    schemaVersion: SCHEMA_VERSION,
    policyVersion: POLICY_VERSION,
    source: 'isolated-read-only-wordpress-backup',
    sourceOfTruthPolicy: {
      visual: 'protected React/Vite baseline',
      seo: 'https://puffsticker.com/ live production evidence',
      backup: 'historical IDs, relationships, dates, public media metadata and reconciliation evidence only',
    },
    provenance: {
      archiveSha256: args.archiveSha256,
      databaseSha256,
      databaseBytes: inputStats.size,
      databaseSnapshotAt: new Date(snapshotAt).toISOString(),
      databaseSnapshotAtSource: args.databaseSnapshotAt ? 'wpress-entry-header' : 'isolated-file-mtime',
      tablePrefix: instance.prefix,
      selectedTables: instance.tableNames,
      sqlStatementsScanned: statements,
      recognizedRowsScannedAcrossCandidates: recognizedRows,
      publicMediaEvidenceSha256: publicMediaEvidence.sourceSha256,
    },
    outputs: {
      content: { path: 'content.json', sha256: sha256Text(contentText) },
      exclusions: { path: 'exclusions.json', sha256: sha256Text(exclusionsText) },
    },
    counts,
    gaps,
    runtimeIntegration: 'none; this Phase 4 artifact is intentionally not imported by the public application',
  }
  const manifestText = writeJsonValue(manifest)

  await mkdir(outputDir, { recursive: true })
  await Promise.all([
    writeFile(resolve(outputDir, 'content.json'), contentText, 'utf8'),
    writeFile(resolve(outputDir, 'exclusions.json'), exclusionsText, 'utf8'),
    writeFile(resolve(outputDir, 'manifest.json'), manifestText, 'utf8'),
  ])

  console.log(JSON.stringify({
    outputDir,
    databaseSha256,
    archiveSha256: args.archiveSha256,
    tablePrefix: instance.prefix,
    counts,
    gaps: gaps.map((gap) => gap.code),
  }, null, 2))
}

await main()
