/** JSON values accepted by every repository implementation. */
export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonObject | readonly JsonValue[]
export type JsonObject = { readonly [key: string]: JsonValue }

export const CONTENT_TYPES = ['page', 'product', 'post', 'category', 'global'] as const
export type ContentType = (typeof CONTENT_TYPES)[number]

export const CONTENT_STATUSES = ['draft', 'published', 'archived'] as const
export type ContentStatus = (typeof CONTENT_STATUSES)[number]

export const REDIRECT_STATUS_CODES = [301, 308] as const
export type RedirectStatusCode = (typeof REDIRECT_STATUS_CODES)[number]

export const MEDIA_STORAGE_PROVIDERS = ['object-storage', 'external'] as const
export type MediaStorageProvider = (typeof MEDIA_STORAGE_PROVIDERS)[number]

/** UTC timestamp serialized in ISO 8601 form at repository boundaries. */
export type IsoDateTime = string

export type ContentSeo = {
  readonly title: string | null
  readonly description: string | null
  readonly canonical: string | null
  readonly robots: string | null
  readonly openGraph: JsonObject
  readonly twitter: JsonObject
  readonly structuredData: readonly JsonObject[]
}

export const EMPTY_CONTENT_SEO: ContentSeo = Object.freeze({
  title: null,
  description: null,
  canonical: null,
  robots: null,
  openGraph: Object.freeze({}),
  twitter: Object.freeze({}),
  structuredData: Object.freeze([]),
})

export type ContentRecord = {
  readonly id: string
  readonly type: ContentType
  /** Exact public pathname. Trailing-slash behavior is never normalized here. */
  readonly path: string
  readonly slug: string
  readonly title: string
  readonly excerpt: string | null
  readonly bodyHtml: string | null
  readonly data: JsonObject
  readonly seo: ContentSeo
  readonly status: ContentStatus
  readonly revision: number
  readonly provenanceId: string | null
  readonly publishedAt: IsoDateTime | null
  readonly createdAt: IsoDateTime
  readonly updatedAt: IsoDateTime
}

export type ContentSnapshot = Omit<
  ContentRecord,
  'createdAt' | 'updatedAt'
>

export type ContentVersion = {
  readonly id: string
  readonly contentId: string
  readonly revision: number
  readonly snapshot: ContentSnapshot
  readonly changeSummary: string | null
  readonly createdBy: string
  readonly createdAt: IsoDateTime
}

export type RedirectRecord = {
  readonly id: string
  readonly sourcePath: string
  readonly targetPath: string
  readonly statusCode: RedirectStatusCode
  readonly enabled: boolean
  readonly revision: number
  readonly provenanceId: string | null
  readonly createdAt: IsoDateTime
  readonly updatedAt: IsoDateTime
}

/**
 * Media is metadata only. Binary data must live in durable object storage or at
 * an externally managed HTTPS URL; a repository implementation never writes a
 * file to the deployment filesystem.
 */
export type MediaRecord = {
  readonly id: string
  readonly provider: MediaStorageProvider
  readonly storageKey: string | null
  readonly publicUrl: string
  readonly mimeType: string
  readonly fileName: string
  readonly altText: string
  readonly caption: string | null
  readonly width: number | null
  readonly height: number | null
  readonly bytes: number | null
  readonly sha256: string | null
  readonly metadata: JsonObject
  readonly revision: number
  readonly provenanceId: string | null
  readonly createdAt: IsoDateTime
  readonly updatedAt: IsoDateTime
}

export type MigrationProvenance = {
  readonly id: string
  readonly sourceSystem: string
  readonly sourceKind: string
  readonly sourceId: string
  readonly sourceUrl: string | null
  readonly sourceModifiedAt: IsoDateTime | null
  readonly archiveSha256: string | null
  readonly payloadSha256: string | null
  readonly importBatch: string
  readonly metadata: JsonObject
  readonly importedAt: IsoDateTime
}

export type AuditEntityType = 'content' | 'redirect' | 'media' | 'migration-provenance'

export type AuditEvent = {
  readonly id: string
  readonly action: string
  readonly entityType: AuditEntityType
  readonly entityId: string
  readonly actorId: string
  readonly requestId: string | null
  readonly reason: string | null
  readonly previous: JsonValue | null
  readonly next: JsonValue | null
  readonly occurredAt: IsoDateTime
}

export type MutationContext = {
  readonly actorId: string
  readonly requestId?: string | null
  readonly reason?: string | null
}

export type ContentLocator =
  | { readonly id: string; readonly path?: never }
  | { readonly id?: never; readonly path: string }

export type ContentLookup = ContentLocator & {
  /** False by default so accidental public consumers cannot read drafts. */
  readonly includeDrafts?: boolean
  readonly includeArchived?: boolean
}

export type ContentListQuery = {
  readonly types?: readonly ContentType[]
  readonly statuses?: readonly ContentStatus[]
  readonly pathPrefix?: string
  readonly limit?: number
  readonly offset?: number
}

export type MediaListQuery = {
  readonly mimeTypePrefix?: string
  readonly limit?: number
  readonly offset?: number
}

export type ProvenanceListQuery = {
  readonly sourceSystem?: string
  readonly importBatch?: string
  readonly limit?: number
  readonly offset?: number
}

export type AuditListQuery = {
  readonly entityType?: AuditEntityType
  readonly entityId?: string
  readonly actorId?: string
  readonly limit?: number
  readonly offset?: number
}

export type SaveContentInput = {
  /** Supply deterministic IDs for imports; omit for an application-generated ID. */
  readonly id?: string
  readonly type: ContentType
  readonly path: string
  readonly slug: string
  readonly title: string
  readonly excerpt?: string | null
  readonly bodyHtml?: string | null
  readonly data?: JsonObject
  readonly seo?: ContentSeo
  readonly status?: ContentStatus
  /** Required whenever the ID already exists. Omit only when creating. */
  readonly expectedRevision?: number
  readonly provenanceId?: string | null
  readonly publishedAt?: IsoDateTime | null
  readonly changeSummary?: string | null
}

export type SetContentStatusInput = {
  readonly id: string
  readonly status: ContentStatus
  readonly expectedRevision: number
  readonly publishedAt?: IsoDateTime | null
  readonly changeSummary?: string | null
}

export type UpsertRedirectInput = {
  readonly id?: string
  readonly sourcePath: string
  readonly targetPath: string
  readonly statusCode: RedirectStatusCode
  readonly enabled?: boolean
  readonly expectedRevision?: number
  readonly provenanceId?: string | null
}

export type UpsertMediaInput = {
  /** Deterministic IDs such as wp:attachment:123 are supported. */
  readonly id?: string
  readonly provider: MediaStorageProvider
  readonly storageKey?: string | null
  readonly publicUrl: string
  readonly mimeType: string
  readonly fileName: string
  readonly altText?: string
  readonly caption?: string | null
  readonly width?: number | null
  readonly height?: number | null
  readonly bytes?: number | null
  readonly sha256?: string | null
  readonly metadata?: JsonObject
  readonly expectedRevision?: number
  readonly provenanceId?: string | null
}

export type RecordMigrationProvenanceInput = Omit<MigrationProvenance, 'importedAt'> & {
  readonly importedAt?: IsoDateTime
}

export type StaticContentSnapshot = {
  readonly records: readonly ContentRecord[]
  readonly versions?: readonly ContentVersion[]
  readonly redirects?: readonly RedirectRecord[]
  readonly media?: readonly MediaRecord[]
  readonly provenance?: readonly MigrationProvenance[]
  readonly auditEvents?: readonly AuditEvent[]
}
