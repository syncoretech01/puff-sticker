import { createHash } from 'node:crypto'

import normalizedContent from '../../data/migration/wordpress-public/content.json' with { type: 'json' }
import normalizedManifest from '../../data/migration/wordpress-public/manifest.json' with { type: 'json' }

import {
  EMPTY_CONTENT_SEO,
  type ContentSeo,
  type ContentType,
  type JsonObject,
  type RecordMigrationProvenanceInput,
  type SaveContentInput,
  type UpsertMediaInput,
} from '../../src/lib/content'
import { PRIMARY_ROUTE_CONTRACTS } from '../../src/lib/seo/route-contract'

type NormalizedRecord = {
  kind: string
  id: string
  slug: string
  status: string
  dateGmt: string
  modifiedGmt: string
  parentId: string
  permalink?: string
  canonicalPath?: string
  title: string
  excerpt?: string
  content?: string
  menuOrder?: string
  product?: JsonObject
  seo?: {
    title?: string
    description?: string
    canonical?: string
    robots?: string[]
  }
}

type NormalizedAttachment = NormalizedRecord & {
  url: string
  file: string
  mimeType: string
  altText: string
  mediaMetadata: {
    sourceSha256?: string
    width?: string
    height?: string
    files?: string[]
  }
}

type UnindexedMedia = {
  path: string
  archivePresent: boolean
  bytes: number
  sha256: string
}

type NormalizedContent = {
  posts: NormalizedRecord[]
  pages: NormalizedRecord[]
  products: NormalizedRecord[]
  variations: NormalizedRecord[]
  attachments: NormalizedAttachment[]
  unindexedPublicMedia: UnindexedMedia[]
  taxonomy: {
    terms: { id: string; name: string; slug: string }[]
    termTaxonomy: { id: string; termId: string; taxonomy: string; parentId: string }[]
    relationships: { objectId: string; termTaxonomyId: string; order: string }[]
    termMeta: { termId: string; key: string; value: string }[]
  }
}

export type WordpressSeedContent = {
  input: SaveContentInput
  provenance: RecordMigrationProvenanceInput
}

export type WordpressSeedMedia = {
  input: UpsertMediaInput
  provenance: RecordMigrationProvenanceInput
}

export type WordpressSeedPlan = {
  archiveSha256: string
  importBatch: string
  contents: WordpressSeedContent[]
  media: WordpressSeedMedia[]
  knownLiveDeltas: readonly string[]
}

const normalized = normalizedContent as unknown as NormalizedContent
const manifest = normalizedManifest as unknown as {
  provenance: { archiveSha256: string; databaseSnapshotAt: string }
}

function asJsonObject(value: unknown): JsonObject {
  return JSON.parse(JSON.stringify(value ?? {})) as JsonObject
}

function stablePayload(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stablePayload).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stablePayload(item)}`)
      .join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

function payloadSha256(value: unknown): string {
  return createHash('sha256').update(stablePayload(value)).digest('hex')
}

function iso(wordpressDate: string): string {
  const parsed = new Date(wordpressDate.replace(' ', 'T') + 'Z')
  if (Number.isNaN(parsed.valueOf())) throw new Error(`Invalid WordPress UTC date: ${wordpressDate}`)
  return parsed.toISOString()
}

function routeFor(record: NormalizedRecord) {
  const pathname = record.permalink ? new URL(record.permalink.replace('&#038;', '&')).pathname : record.canonicalPath
  const expectedKind = record.kind === 'post' ? 'blog-article' : record.kind === 'product' ? 'product' : undefined
  return PRIMARY_ROUTE_CONTRACTS.find((route) =>
    (!expectedKind || route.kind === expectedKind)
    && (route.publicPath === pathname || route.renderPath === pathname || route.publicPath.includes(`/${record.slug}/`)))
}

function seoFor(record: NormalizedRecord): ContentSeo {
  const route = routeFor(record)
  if (route) {
    return {
      title: route.metadata.title,
      description: route.metadata.description,
      canonical: route.metadata.canonical,
      robots: route.metadata.robots,
      openGraph: asJsonObject(route.metadata.openGraph),
      twitter: asJsonObject(route.metadata.twitter),
      structuredData: route.structuredData.map(asJsonObject),
    }
  }
  return {
    ...EMPTY_CONTENT_SEO,
    title: record.seo?.title ?? record.title,
    description: record.seo?.description ?? null,
    canonical: record.seo?.canonical ?? record.permalink ?? null,
    robots: record.seo?.robots?.join(', ') ?? null,
  }
}

function contentType(record: NormalizedRecord): ContentType {
  if (record.kind === 'product') return 'product'
  if (record.kind === 'post') return 'post'
  return 'page'
}

function publicPath(record: NormalizedRecord): string {
  const route = routeFor(record)
  if (route) return route.publicPath
  if (record.permalink) return new URL(record.permalink.replace('&#038;', '&')).pathname
  if (record.canonicalPath?.startsWith('/')) return record.canonicalPath
  throw new Error(`No public path for WordPress ${record.kind} ${record.id}`)
}

function provenance(
  record: NormalizedRecord,
  batch: string,
  payload: unknown,
): RecordMigrationProvenanceInput {
  return {
    id: `wp:${record.kind}:${record.id}`,
    sourceSystem: 'wordpress',
    sourceKind: record.kind,
    sourceId: record.id,
    sourceUrl: record.permalink ?? null,
    sourceModifiedAt: iso(record.modifiedGmt),
    archiveSha256: manifest.provenance.archiveSha256,
    payloadSha256: payloadSha256(payload),
    importBatch: batch,
    metadata: { backupSnapshotAt: manifest.provenance.databaseSnapshotAt },
  }
}

function taxonomyFor(objectId: string) {
  return normalized.taxonomy.relationships
    .filter((relationship) => relationship.objectId === objectId)
    .map((relationship) => {
      const taxonomy = normalized.taxonomy.termTaxonomy
        .find((item) => item.id === relationship.termTaxonomyId)
      const term = taxonomy
        ? normalized.taxonomy.terms.find((item) => item.id === taxonomy.termId)
        : undefined
      return { order: relationship.order, taxonomy: taxonomy ?? null, term: term ?? null }
    })
}

function contentRecord(record: NormalizedRecord, batch: string, variationsByParent: Map<string, NormalizedRecord[]>): WordpressSeedContent {
  const taxonomy = taxonomyFor(record.id)
  const variations = variationsByParent.get(record.id) ?? []
  const source = provenance(record, batch, { record, taxonomy, variations })
  return {
    provenance: source,
    input: {
      id: `wp:${record.kind}:${record.id}`,
      type: contentType(record),
      path: publicPath(record),
      slug: record.slug,
      title: record.title,
      excerpt: record.excerpt ?? null,
      bodyHtml: record.content ?? null,
      data: asJsonObject({
        wordpress: {
          id: record.id,
          parentId: record.parentId,
          createdAt: iso(record.dateGmt),
          modifiedAt: iso(record.modifiedGmt),
          menuOrder: record.menuOrder ?? null,
          product: record.product ?? null,
          variations,
        },
        taxonomy,
      }),
      seo: seoFor(record),
      status: 'published',
      provenanceId: source.id,
      publishedAt: iso(record.dateGmt),
      changeSummary: 'Initial public WordPress migration seed.',
    },
  }
}

function mediaProvenance(
  id: string,
  kind: string,
  sourceUrl: string,
  batch: string,
  payload: unknown,
): RecordMigrationProvenanceInput {
  return {
    id: `wp:${kind}:${id}`,
    sourceSystem: 'wordpress',
    sourceKind: kind,
    sourceId: id,
    sourceUrl,
    sourceModifiedAt: null,
    archiveSha256: manifest.provenance.archiveSha256,
    payloadSha256: payloadSha256(payload),
    importBatch: batch,
    metadata: { backupSnapshotAt: manifest.provenance.databaseSnapshotAt },
  }
}

function extensionMime(pathname: string): string {
  const extension = pathname.split('.').pop()?.toLowerCase()
  return extension === 'webp' ? 'image/webp'
    : extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg'
      : extension === 'svg' ? 'image/svg+xml'
        : 'image/png'
}

export function buildWordpressSeedPlan(): WordpressSeedPlan {
  const importBatch = `wordpress-${manifest.provenance.archiveSha256.slice(0, 12)}`
  const variationsByParent = new Map<string, NormalizedRecord[]>()
  for (const variation of normalized.variations) {
    const siblings = variationsByParent.get(variation.parentId) ?? []
    siblings.push(variation)
    variationsByParent.set(variation.parentId, siblings)
  }
  const records = [...normalized.pages, ...normalized.posts, ...normalized.products]
  const contents = records.map((record) => contentRecord(record, importBatch, variationsByParent))
  const attachments = normalized.attachments.map((attachment): WordpressSeedMedia => {
    const source = mediaProvenance(attachment.id, 'attachment', attachment.url, importBatch, attachment)
    return {
      provenance: source,
      input: {
        id: `wp:attachment:${attachment.id}`,
        provider: 'external',
        publicUrl: attachment.url,
        mimeType: attachment.mimeType,
        fileName: attachment.file.split('/').pop() ?? attachment.slug,
        altText: attachment.altText,
        width: Number.parseInt(attachment.mediaMetadata.width ?? '', 10) || null,
        height: Number.parseInt(attachment.mediaMetadata.height ?? '', 10) || null,
        sha256: attachment.mediaMetadata.sourceSha256 ?? null,
        metadata: asJsonObject({ wordpressFile: attachment.file, variants: attachment.mediaMetadata.files ?? [] }),
        provenanceId: source.id,
      },
    }
  })
  const unindexed = normalized.unindexedPublicMedia.map((media, index): WordpressSeedMedia => {
    const id = String(index + 1)
    const url = new URL(media.path, 'https://puffsticker.com').href
    const source = mediaProvenance(id, 'unindexed-public-media', url, importBatch, media)
    return {
      provenance: source,
      input: {
        id: `wp:unindexed-media:${id}`,
        provider: 'external',
        publicUrl: url,
        mimeType: extensionMime(media.path),
        fileName: media.path.split('/').pop() ?? `media-${id}`,
        altText: '',
        bytes: media.bytes,
        sha256: media.sha256,
        metadata: { archivePresent: media.archivePresent, wordpressPath: media.path },
        provenanceId: source.id,
      },
    }
  })
  return {
    archiveSha256: manifest.provenance.archiveSha256,
    importBatch,
    contents,
    media: [...attachments, ...unindexed],
    knownLiveDeltas: ['custom-puffy-stickers-guide'],
  }
}

export function assertWordpressSeedPlan(plan: WordpressSeedPlan): void {
  const counts = plan.contents.reduce<Record<string, number>>((result, item) => {
    result[item.input.type] = (result[item.input.type] ?? 0) + 1
    return result
  }, {})
  if (counts.product !== 21 || counts.post !== 11 || counts.page !== 9) {
    throw new Error(`Unexpected seed counts: ${JSON.stringify(counts)}`)
  }
  if (plan.media.length !== 156) throw new Error(`Unexpected media count: ${plan.media.length}`)
  if (!plan.knownLiveDeltas.includes('custom-puffy-stickers-guide')) {
    throw new Error('The known live-after-backup article must remain explicit.')
  }
  const ids = [...plan.contents.map((item) => item.input.id), ...plan.media.map((item) => item.input.id)]
  if (ids.some((id) => !id) || new Set(ids).size !== ids.length) throw new Error('Seed IDs must be present and unique.')
}
