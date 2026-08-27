import type { ContentRepository } from './repository'
import { RepositoryValidationError } from './repository'
import type {
  AuditEvent,
  AuditListQuery,
  ContentListQuery,
  ContentLookup,
  ContentRecord,
  ContentVersion,
  MediaListQuery,
  MediaRecord,
  MigrationProvenance,
  ProvenanceListQuery,
  RedirectRecord,
  StaticContentSnapshot,
} from './types'
import {
  assertContentRecord,
  assertInternalLocation,
  assertListWindow,
  assertMediaRecord,
  assertRedirectGraph,
} from './validation'

function freezeCopy<T>(value: T): T {
  const clone = structuredClone(value)
  const freeze = (candidate: unknown): void => {
    if (candidate === null || typeof candidate !== 'object' || Object.isFrozen(candidate)) return
    Object.freeze(candidate)
    for (const nested of Object.values(candidate)) freeze(nested)
  }
  freeze(clone)
  return clone
}

function assertUnique(values: readonly string[], label: string): void {
  const seen = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) throw new RepositoryValidationError(`Duplicate ${label}: ${value}`)
    seen.add(value)
  }
}

function validateSnapshot(snapshot: StaticContentSnapshot): void {
  snapshot.records.forEach(assertContentRecord)
  snapshot.media?.forEach(assertMediaRecord)
  snapshot.redirects?.forEach((redirect) => {
    assertInternalLocation(redirect.sourcePath, 'sourcePath')
    assertInternalLocation(redirect.targetPath, 'targetPath')
  })
  assertRedirectGraph(snapshot.redirects ?? [])
  assertUnique(snapshot.records.map((record) => record.id), 'content ID')
  assertUnique(snapshot.records.map((record) => record.path), 'content path')
  assertUnique((snapshot.media ?? []).map((record) => record.id), 'media ID')
  assertUnique((snapshot.redirects ?? []).map((record) => record.sourcePath), 'redirect source')
}

/**
 * Read-only adapter for the protected source snapshot. It is intentionally not
 * wired into the public renderer during migration.
 */
export class ProtectedStaticContentRepository implements ContentRepository {
  readonly #records: readonly ContentRecord[]
  readonly #versions: readonly ContentVersion[]
  readonly #redirects: readonly RedirectRecord[]
  readonly #media: readonly MediaRecord[]
  readonly #provenance: readonly MigrationProvenance[]
  readonly #auditEvents: readonly AuditEvent[]

  constructor(snapshot: StaticContentSnapshot) {
    validateSnapshot(snapshot)
    const immutable = freezeCopy(snapshot)
    this.#records = immutable.records
    this.#versions = immutable.versions ?? []
    this.#redirects = immutable.redirects ?? []
    this.#media = immutable.media ?? []
    this.#provenance = immutable.provenance ?? []
    this.#auditEvents = immutable.auditEvents ?? []
  }

  async getContent(lookup: ContentLookup): Promise<ContentRecord | null> {
    const record = 'id' in lookup && lookup.id
      ? this.#records.find((candidate) => candidate.id === lookup.id)
      : this.#records.find((candidate) => candidate.path === lookup.path)
    if (!record) return null
    if (record.status === 'draft' && !lookup.includeDrafts) return null
    if (record.status === 'archived' && !lookup.includeArchived) return null
    return record
  }

  async listContent(query: ContentListQuery = {}): Promise<readonly ContentRecord[]> {
    const { limit, offset } = assertListWindow(query.limit, query.offset)
    const typeFilter = query.types ? new Set(query.types) : null
    const statusFilter = new Set(query.statuses ?? ['published'])
    return this.#records
      .filter((record) => !typeFilter || typeFilter.has(record.type))
      .filter((record) => statusFilter.has(record.status))
      .filter((record) => !query.pathPrefix || record.path.startsWith(query.pathPrefix))
      .sort((left, right) => left.path.localeCompare(right.path) || left.id.localeCompare(right.id))
      .slice(offset, offset + limit)
  }

  async getContentVersion(contentId: string, revision: number): Promise<ContentVersion | null> {
    return this.#versions.find((version) => version.contentId === contentId && version.revision === revision) ?? null
  }

  async listContentVersions(contentId: string): Promise<readonly ContentVersion[]> {
    return this.#versions
      .filter((version) => version.contentId === contentId)
      .sort((left, right) => right.revision - left.revision)
  }

  async getRedirect(sourcePath: string): Promise<RedirectRecord | null> {
    return this.#redirects.find((redirect) => redirect.sourcePath === sourcePath && redirect.enabled) ?? null
  }

  async listRedirects(): Promise<readonly RedirectRecord[]> {
    return this.#redirects.slice().sort((left, right) => left.sourcePath.localeCompare(right.sourcePath))
  }

  async getMedia(id: string): Promise<MediaRecord | null> {
    return this.#media.find((media) => media.id === id) ?? null
  }

  async listMedia(query: MediaListQuery = {}): Promise<readonly MediaRecord[]> {
    const { limit, offset } = assertListWindow(query.limit, query.offset)
    return this.#media
      .filter((media) => !query.mimeTypePrefix || media.mimeType.startsWith(query.mimeTypePrefix))
      .sort((left, right) => left.id.localeCompare(right.id))
      .slice(offset, offset + limit)
  }

  async listMigrationProvenance(query: ProvenanceListQuery = {}): Promise<readonly MigrationProvenance[]> {
    const { limit, offset } = assertListWindow(query.limit, query.offset)
    return this.#provenance
      .filter((item) => !query.sourceSystem || item.sourceSystem === query.sourceSystem)
      .filter((item) => !query.importBatch || item.importBatch === query.importBatch)
      .sort((left, right) => right.importedAt.localeCompare(left.importedAt) || left.id.localeCompare(right.id))
      .slice(offset, offset + limit)
  }

  async listAuditEvents(query: AuditListQuery = {}): Promise<readonly AuditEvent[]> {
    const { limit, offset } = assertListWindow(query.limit, query.offset)
    return this.#auditEvents
      .filter((event) => !query.entityType || event.entityType === query.entityType)
      .filter((event) => !query.entityId || event.entityId === query.entityId)
      .filter((event) => !query.actorId || event.actorId === query.actorId)
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt) || left.id.localeCompare(right.id))
      .slice(offset, offset + limit)
  }
}

export function createProtectedStaticContentRepository(
  snapshot: StaticContentSnapshot,
): ContentRepository {
  return new ProtectedStaticContentRepository(snapshot)
}
