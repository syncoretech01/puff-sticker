import { randomUUID } from 'node:crypto'

import { and, asc, desc, eq, sql } from 'drizzle-orm'

import {
  ContentNotFoundError,
  RepositoryValidationError,
  RevisionConflictError,
  type AuditEvent,
  type AuditListQuery,
  type ContentListQuery,
  type ContentLookup,
  type ContentRecord,
  type ContentSnapshot,
  type ContentVersion,
  EMPTY_CONTENT_SEO,
  type JsonValue,
  type MediaListQuery,
  type MediaRecord,
  type MigrationProvenance,
  type MutationContext,
  type ProvenanceListQuery,
  type RecordMigrationProvenanceInput,
  type RedirectRecord,
  type SaveContentInput,
  type SetContentStatusInput,
  type UpsertMediaInput,
  type UpsertRedirectInput,
  type WritableContentRepository,
} from '../content'
import {
  assertContentPath,
  assertContentSeo,
  assertInternalLocation,
  assertIsoDateTime,
  assertListWindow,
  assertMediaInput,
  assertNonEmpty,
  assertRedirectGraph,
} from '../content/validation'
import type { PuffDatabase } from './client'
import {
  auditEvents,
  contentRecords,
  contentVersions,
  mediaAssets,
  migrationProvenance,
  redirects,
} from './schema'

type ContentRow = typeof contentRecords.$inferSelect
type VersionRow = typeof contentVersions.$inferSelect
type RedirectRow = typeof redirects.$inferSelect
type MediaRow = typeof mediaAssets.$inferSelect
type ProvenanceRow = typeof migrationProvenance.$inferSelect
type AuditRow = typeof auditEvents.$inferSelect

function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null
}

function contentFromRow(row: ContentRow): ContentRecord {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    publishedAt: iso(row.publishedAt),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function snapshot(record: ContentRecord): ContentSnapshot {
  const { createdAt: _createdAt, updatedAt: _updatedAt, ...value } = record
  return value
}

function versionFromRow(row: VersionRow): ContentVersion {
  return { ...row, createdAt: row.createdAt.toISOString() }
}

function redirectFromRow(row: RedirectRow): RedirectRecord {
  return {
    ...row,
    statusCode: row.statusCode as RedirectRecord['statusCode'],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function mediaFromRow(row: MediaRow): MediaRecord {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function provenanceFromRow(row: ProvenanceRow): MigrationProvenance {
  return {
    ...row,
    importedAt: row.importedAt.toISOString(),
    sourceModifiedAt: iso(row.sourceModifiedAt),
  }
}

function auditFromRow(row: AuditRow): AuditEvent {
  return { ...row, occurredAt: row.occurredAt.toISOString() } as AuditEvent
}

function date(value: string | null | undefined): Date | null {
  assertIsoDateTime(value, 'timestamp')
  return value == null ? null : new Date(value)
}

function assertOptionalSha256(value: string | null, field: string): void {
  if (value != null && !/^[a-f\d]{64}$/i.test(value)) {
    throw new RepositoryValidationError(`${field} must contain exactly 64 hexadecimal characters.`)
  }
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

function auditContext(context: MutationContext) {
  assertNonEmpty(context.actorId, 'actorId')
  return {
    actorId: context.actorId,
    reason: context.reason ?? null,
    requestId: context.requestId ?? null,
  }
}

async function writeAudit(
  db: PuffDatabase,
  input: {
    action: string
    entityType: AuditEvent['entityType']
    entityId: string
    previous: JsonValue | null
    next: JsonValue | null
  },
  context: MutationContext,
) {
  await db.insert(auditEvents).values({
    id: randomUUID(),
    ...input,
    ...auditContext(context),
    occurredAt: new Date(),
  })
}

async function currentContent(db: PuffDatabase, id: string): Promise<ContentRecord | null> {
  const [row] = await db.select().from(contentRecords).where(eq(contentRecords.id, id)).limit(1)
  return row ? contentFromRow(row) : null
}

async function storeContentVersion(
  db: PuffDatabase,
  record: ContentRecord,
  context: MutationContext,
  changeSummary: string | null,
) {
  await db.insert(contentVersions).values({
    id: randomUUID(),
    contentId: record.id,
    revision: record.revision,
    snapshot: snapshot(record),
    changeSummary,
    createdBy: context.actorId,
    createdAt: new Date(),
  })
}

/**
 * Drizzle/Postgres implementation used only by authenticated CMS code. The
 * public renderer continues to use its protected static modules until a later
 * source-switch phase is explicitly approved and certified.
 */
export class DrizzleContentRepository implements WritableContentRepository {
  constructor(private readonly db: PuffDatabase) {}

  async getContent(lookup: ContentLookup): Promise<ContentRecord | null> {
    const rows = 'id' in lookup && lookup.id
      ? await this.db.select().from(contentRecords).where(eq(contentRecords.id, lookup.id)).limit(1)
      : await this.db.select().from(contentRecords).where(eq(contentRecords.path, lookup.path as string)).limit(1)
    const [row] = rows
    if (!row) return null
    if (row.status === 'draft' && !lookup.includeDrafts) return null
    if (row.status === 'archived' && !lookup.includeArchived) return null
    return contentFromRow(row)
  }

  async listContent(query: ContentListQuery = {}): Promise<readonly ContentRecord[]> {
    const { limit, offset } = assertListWindow(query.limit, query.offset)
    const typeFilter = query.types ? new Set(query.types) : null
    const statusFilter = new Set(query.statuses ?? ['published'])
    const rows = await this.db.select().from(contentRecords).orderBy(asc(contentRecords.path), asc(contentRecords.id))
    return rows
      .map(contentFromRow)
      .filter((record) => !typeFilter || typeFilter.has(record.type))
      .filter((record) => statusFilter.has(record.status))
      .filter((record) => !query.pathPrefix || record.path.startsWith(query.pathPrefix))
      .slice(offset, offset + limit)
  }

  async getContentVersion(contentId: string, revision: number): Promise<ContentVersion | null> {
    const [row] = await this.db.select().from(contentVersions).where(and(
      eq(contentVersions.contentId, contentId),
      eq(contentVersions.revision, revision),
    )).limit(1)
    return row ? versionFromRow(row) : null
  }

  async listContentVersions(contentId: string): Promise<readonly ContentVersion[]> {
    return (await this.db.select().from(contentVersions)
      .where(eq(contentVersions.contentId, contentId))
      .orderBy(desc(contentVersions.revision)))
      .map(versionFromRow)
  }

  async getRedirect(sourcePath: string): Promise<RedirectRecord | null> {
    const [row] = await this.db.select().from(redirects).where(and(
      eq(redirects.sourcePath, sourcePath),
      eq(redirects.enabled, true),
    )).limit(1)
    return row ? redirectFromRow(row) : null
  }

  async listRedirects(): Promise<readonly RedirectRecord[]> {
    return (await this.db.select().from(redirects).orderBy(asc(redirects.sourcePath))).map(redirectFromRow)
  }

  async getMedia(id: string): Promise<MediaRecord | null> {
    const [row] = await this.db.select().from(mediaAssets).where(eq(mediaAssets.id, id)).limit(1)
    return row ? mediaFromRow(row) : null
  }

  async listMedia(query: MediaListQuery = {}): Promise<readonly MediaRecord[]> {
    const { limit, offset } = assertListWindow(query.limit, query.offset)
    return (await this.db.select().from(mediaAssets).orderBy(asc(mediaAssets.id)))
      .map(mediaFromRow)
      .filter((media) => !query.mimeTypePrefix || media.mimeType.startsWith(query.mimeTypePrefix))
      .slice(offset, offset + limit)
  }

  async listMigrationProvenance(query: ProvenanceListQuery = {}): Promise<readonly MigrationProvenance[]> {
    const { limit, offset } = assertListWindow(query.limit, query.offset)
    return (await this.db.select().from(migrationProvenance)
      .orderBy(desc(migrationProvenance.importedAt), asc(migrationProvenance.id)))
      .map(provenanceFromRow)
      .filter((item) => !query.sourceSystem || item.sourceSystem === query.sourceSystem)
      .filter((item) => !query.importBatch || item.importBatch === query.importBatch)
      .slice(offset, offset + limit)
  }

  async listAuditEvents(query: AuditListQuery = {}): Promise<readonly AuditEvent[]> {
    const { limit, offset } = assertListWindow(query.limit, query.offset)
    return (await this.db.select().from(auditEvents)
      .orderBy(desc(auditEvents.occurredAt), asc(auditEvents.id)))
      .map(auditFromRow)
      .filter((event) => !query.entityType || event.entityType === query.entityType)
      .filter((event) => !query.entityId || event.entityId === query.entityId)
      .filter((event) => !query.actorId || event.actorId === query.actorId)
      .slice(offset, offset + limit)
  }

  async saveContent(input: SaveContentInput, context: MutationContext): Promise<ContentRecord> {
    assertContentPath(input.path)
    assertNonEmpty(input.slug, 'slug')
    assertNonEmpty(input.title, 'title')
    assertContentSeo(input.seo ?? EMPTY_CONTENT_SEO)
    const id = input.id ?? randomUUID()

    return this.db.transaction(async (tx) => {
      const existing = await currentContent(tx as PuffDatabase, id)
      const now = new Date()
      let record: ContentRecord

      if (existing) {
        if (input.expectedRevision !== existing.revision) {
          throw new RevisionConflictError(id, input.expectedRevision, existing.revision)
        }
        const revision = existing.revision + 1
        const [row] = await tx.update(contentRecords).set({
          type: input.type,
          path: input.path,
          slug: input.slug,
          title: input.title,
          excerpt: input.excerpt === undefined ? existing.excerpt : input.excerpt,
          bodyHtml: input.bodyHtml === undefined ? existing.bodyHtml : input.bodyHtml,
          data: input.data ?? existing.data,
          seo: input.seo ?? existing.seo,
          status: input.status ?? existing.status,
          revision,
          provenanceId: input.provenanceId === undefined ? existing.provenanceId : input.provenanceId,
          publishedAt: input.publishedAt === undefined ? date(existing.publishedAt) : date(input.publishedAt),
          updatedAt: now,
        }).where(and(eq(contentRecords.id, id), eq(contentRecords.revision, existing.revision))).returning()
        if (!row) throw new RevisionConflictError(id, input.expectedRevision, existing.revision)
        record = contentFromRow(row)
      } else {
        if (input.expectedRevision !== undefined) {
          throw new RevisionConflictError(id, input.expectedRevision, null)
        }
        const [row] = await tx.insert(contentRecords).values({
          id,
          type: input.type,
          path: input.path,
          slug: input.slug,
          title: input.title,
          excerpt: input.excerpt ?? null,
          bodyHtml: input.bodyHtml ?? null,
          data: input.data ?? {},
          seo: input.seo ?? EMPTY_CONTENT_SEO,
          status: input.status ?? 'draft',
          revision: 1,
          provenanceId: input.provenanceId ?? null,
          publishedAt: date(input.publishedAt),
          createdAt: now,
          updatedAt: now,
        }).returning()
        record = contentFromRow(row)
      }

      await storeContentVersion(tx as PuffDatabase, record, context, input.changeSummary ?? null)
      await writeAudit(tx as PuffDatabase, {
        action: existing ? 'content.updated' : 'content.created',
        entityType: 'content',
        entityId: id,
        previous: existing,
        next: record,
      }, context)
      return record
    })
  }

  async setContentStatus(input: SetContentStatusInput, context: MutationContext): Promise<ContentRecord> {
    return this.db.transaction(async (tx) => {
      const db = tx as PuffDatabase
      const existing = await currentContent(db, input.id)
      if (!existing) throw new ContentNotFoundError(input.id)
      if (input.expectedRevision !== existing.revision) {
        throw new RevisionConflictError(input.id, input.expectedRevision, existing.revision)
      }
      const [row] = await tx.update(contentRecords).set({
        status: input.status,
        publishedAt: date(input.publishedAt),
        revision: existing.revision + 1,
        updatedAt: new Date(),
      }).where(and(
        eq(contentRecords.id, input.id),
        eq(contentRecords.revision, existing.revision),
      )).returning()
      if (!row) throw new RevisionConflictError(input.id, input.expectedRevision, existing.revision)
      const record = contentFromRow(row)
      await storeContentVersion(db, record, context, input.changeSummary ?? null)
      await writeAudit(db, {
        action: `content.${input.status}`,
        entityType: 'content',
        entityId: input.id,
        previous: existing,
        next: record,
      }, context)
      return record
    })
  }

  async upsertRedirect(input: UpsertRedirectInput, context: MutationContext): Promise<RedirectRecord> {
    assertInternalLocation(input.sourcePath, 'sourcePath')
    assertInternalLocation(input.targetPath, 'targetPath')
    const id = input.id ?? randomUUID()
    return this.db.transaction(async (tx) => {
      const db = tx as PuffDatabase
      await db.execute(sql`select pg_advisory_xact_lock(hashtextextended('puff:redirect-graph', 0))`)
      const [existingRow] = await db.select().from(redirects).where(eq(redirects.id, id)).limit(1)
      const existing = existingRow ? redirectFromRow(existingRow) : null
      if (existing && input.expectedRevision !== existing.revision) {
        throw new RevisionConflictError(id, input.expectedRevision, existing.revision)
      }
      if (!existing && input.expectedRevision !== undefined) {
        throw new RevisionConflictError(id, input.expectedRevision, null)
      }
      const all = (await db.select().from(redirects)).map(redirectFromRow)
      assertRedirectGraph([
        ...all.filter((item) => item.id !== id),
        {
          id,
          sourcePath: input.sourcePath,
          targetPath: input.targetPath,
          statusCode: input.statusCode,
          enabled: input.enabled ?? true,
          revision: (existing?.revision ?? 0) + 1,
          provenanceId: input.provenanceId ?? null,
          createdAt: existing?.createdAt ?? new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ])
      const now = new Date()
      const values = {
        sourcePath: input.sourcePath,
        targetPath: input.targetPath,
        statusCode: input.statusCode,
        enabled: input.enabled ?? true,
        revision: (existing?.revision ?? 0) + 1,
        provenanceId: input.provenanceId ?? null,
        updatedAt: now,
      }
      const [row] = existing
        ? await tx.update(redirects).set(values).where(and(
          eq(redirects.id, id),
          eq(redirects.revision, existing.revision),
        )).returning()
        : await tx.insert(redirects).values({ id, ...values, createdAt: now }).returning()
      if (!row) throw new RevisionConflictError(id, input.expectedRevision, existing?.revision ?? null)
      const record = redirectFromRow(row)
      await writeAudit(db, {
        action: existing ? 'redirect.updated' : 'redirect.created',
        entityType: 'redirect',
        entityId: id,
        previous: existing,
        next: record,
      }, context)
      return record
    })
  }

  async removeRedirect(sourcePath: string, context: MutationContext): Promise<boolean> {
    assertInternalLocation(sourcePath, 'sourcePath')
    return this.db.transaction(async (tx) => {
      const db = tx as PuffDatabase
      await db.execute(sql`select pg_advisory_xact_lock(hashtextextended('puff:redirect-graph', 0))`)
      const [row] = await db.select().from(redirects).where(eq(redirects.sourcePath, sourcePath)).limit(1)
      if (!row) return false
      await tx.delete(redirects).where(eq(redirects.id, row.id))
      await writeAudit(db, {
        action: 'redirect.removed',
        entityType: 'redirect',
        entityId: row.id,
        previous: redirectFromRow(row),
        next: null,
      }, context)
      return true
    })
  }

  async upsertMedia(input: UpsertMediaInput, context: MutationContext): Promise<MediaRecord> {
    assertMediaInput(input)
    const id = input.id ?? randomUUID()
    return this.db.transaction(async (tx) => {
      const db = tx as PuffDatabase
      const [existingRow] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, id)).limit(1)
      const existing = existingRow ? mediaFromRow(existingRow) : null
      if (existing && input.expectedRevision !== existing.revision) {
        throw new RevisionConflictError(id, input.expectedRevision, existing.revision)
      }
      if (!existing && input.expectedRevision !== undefined) {
        throw new RevisionConflictError(id, input.expectedRevision, null)
      }
      const now = new Date()
      const values = {
        provider: input.provider,
        storageKey: input.storageKey ?? null,
        publicUrl: input.publicUrl,
        mimeType: input.mimeType,
        fileName: input.fileName,
        altText: input.altText ?? '',
        caption: input.caption ?? null,
        width: input.width ?? null,
        height: input.height ?? null,
        bytes: input.bytes ?? null,
        sha256: input.sha256 ?? null,
        metadata: input.metadata ?? {},
        revision: (existing?.revision ?? 0) + 1,
        provenanceId: input.provenanceId ?? null,
        updatedAt: now,
      }
      const [row] = existing
        ? await tx.update(mediaAssets).set(values).where(and(
          eq(mediaAssets.id, id),
          eq(mediaAssets.revision, existing.revision),
        )).returning()
        : await tx.insert(mediaAssets).values({ id, ...values, createdAt: now }).returning()
      if (!row) throw new RevisionConflictError(id, input.expectedRevision, existing?.revision ?? null)
      const record = mediaFromRow(row)
      await writeAudit(db, {
        action: existing ? 'media.updated' : 'media.created',
        entityType: 'media',
        entityId: id,
        previous: existing,
        next: record,
      }, context)
      return record
    })
  }

  async recordMigrationProvenance(
    input: RecordMigrationProvenanceInput,
    context: MutationContext,
  ): Promise<MigrationProvenance> {
    assertNonEmpty(input.id, 'id')
    assertNonEmpty(input.sourceSystem, 'sourceSystem')
    assertNonEmpty(input.sourceKind, 'sourceKind')
    assertNonEmpty(input.sourceId, 'sourceId')
    assertNonEmpty(input.importBatch, 'importBatch')
    assertOptionalSha256(input.archiveSha256, 'archiveSha256')
    assertOptionalSha256(input.payloadSha256, 'payloadSha256')
    const sourceModifiedAt = date(input.sourceModifiedAt)
    const requestedImportedAt = input.importedAt ? date(input.importedAt) : null
    return this.db.transaction(async (tx) => {
      const db = tx as PuffDatabase
      const [existing] = await db.select().from(migrationProvenance)
        .where(eq(migrationProvenance.id, input.id)).limit(1)
      if (existing) {
        if (
          existing.sourceSystem !== input.sourceSystem
          || existing.sourceKind !== input.sourceKind
          || existing.sourceId !== input.sourceId
        ) {
          throw new RepositoryValidationError(
            `Migration provenance ID ${input.id} already identifies a different source object.`,
          )
        }
        const previous = provenanceFromRow(existing)
        const unchanged = existing.sourceUrl === input.sourceUrl
          && existing.sourceModifiedAt?.toISOString() === sourceModifiedAt?.toISOString()
          && existing.archiveSha256 === input.archiveSha256
          && existing.payloadSha256 === input.payloadSha256
          && existing.importBatch === input.importBatch
          && stableJson(existing.metadata) === stableJson(input.metadata)
          && (!requestedImportedAt || existing.importedAt.valueOf() === requestedImportedAt.valueOf())
        if (unchanged) return previous

        const [updated] = await db.update(migrationProvenance).set({
          sourceUrl: input.sourceUrl,
          sourceModifiedAt,
          archiveSha256: input.archiveSha256,
          payloadSha256: input.payloadSha256,
          importBatch: input.importBatch,
          metadata: input.metadata,
          importedAt: requestedImportedAt ?? new Date(),
        }).where(eq(migrationProvenance.id, input.id)).returning()
        const record = provenanceFromRow(updated)
        await writeAudit(db, {
          action: 'migration-provenance.updated',
          entityType: 'migration-provenance',
          entityId: input.id,
          previous,
          next: record,
        }, context)
        return record
      }

      const [sourceCollision] = await db.select().from(migrationProvenance).where(and(
        eq(migrationProvenance.sourceSystem, input.sourceSystem),
        eq(migrationProvenance.sourceKind, input.sourceKind),
        eq(migrationProvenance.sourceId, input.sourceId),
      )).limit(1)
      if (sourceCollision) {
        throw new RepositoryValidationError(
          `Migration source object is already recorded as ${sourceCollision.id}.`,
        )
      }

      const [row] = await db.insert(migrationProvenance).values({
        ...input,
        sourceModifiedAt,
        importedAt: requestedImportedAt ?? new Date(),
      }).returning()
      const record = provenanceFromRow(row)
      await writeAudit(db, {
        action: 'migration-provenance.recorded',
        entityType: 'migration-provenance',
        entityId: input.id,
        previous: null,
        next: record,
      }, context)
      return record
    })
  }

  async transaction<T>(work: (repository: WritableContentRepository) => Promise<T>): Promise<T> {
    return this.db.transaction((tx) => work(new DrizzleContentRepository(tx as PuffDatabase)))
  }
}

export function createDrizzleContentRepository(db: PuffDatabase): WritableContentRepository {
  return new DrizzleContentRepository(db)
}
