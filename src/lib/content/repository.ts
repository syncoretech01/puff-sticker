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
  MutationContext,
  ProvenanceListQuery,
  RecordMigrationProvenanceInput,
  RedirectRecord,
  SaveContentInput,
  SetContentStatusInput,
  UpsertMediaInput,
  UpsertRedirectInput,
} from './types'

export interface ContentRepository {
  getContent(lookup: ContentLookup): Promise<ContentRecord | null>
  listContent(query?: ContentListQuery): Promise<readonly ContentRecord[]>
  getContentVersion(contentId: string, revision: number): Promise<ContentVersion | null>
  listContentVersions(contentId: string): Promise<readonly ContentVersion[]>

  getRedirect(sourcePath: string): Promise<RedirectRecord | null>
  listRedirects(): Promise<readonly RedirectRecord[]>

  getMedia(id: string): Promise<MediaRecord | null>
  listMedia(query?: MediaListQuery): Promise<readonly MediaRecord[]>

  listMigrationProvenance(query?: ProvenanceListQuery): Promise<readonly MigrationProvenance[]>
  listAuditEvents(query?: AuditListQuery): Promise<readonly AuditEvent[]>
}

export interface WritableContentRepository extends ContentRepository {
  /** Atomically stores the current row, an immutable version, and an audit event. */
  saveContent(input: SaveContentInput, context: MutationContext): Promise<ContentRecord>
  /** Atomically changes state, creates a version, and records an audit event. */
  setContentStatus(input: SetContentStatusInput, context: MutationContext): Promise<ContentRecord>

  upsertRedirect(input: UpsertRedirectInput, context: MutationContext): Promise<RedirectRecord>
  removeRedirect(sourcePath: string, context: MutationContext): Promise<boolean>

  upsertMedia(input: UpsertMediaInput, context: MutationContext): Promise<MediaRecord>
  recordMigrationProvenance(
    input: RecordMigrationProvenanceInput,
    context: MutationContext,
  ): Promise<MigrationProvenance>

  /** Runs multi-entity workflows on one database transaction. */
  transaction<T>(work: (repository: WritableContentRepository) => Promise<T>): Promise<T>
}

export class ContentRepositoryError extends Error {
  constructor(message: string, readonly code: string) {
    super(message)
    this.name = 'ContentRepositoryError'
  }
}

export class RepositoryValidationError extends ContentRepositoryError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR')
    this.name = 'RepositoryValidationError'
  }
}

export class ContentNotFoundError extends ContentRepositoryError {
  constructor(id: string) {
    super(`Content record not found: ${id}`, 'CONTENT_NOT_FOUND')
    this.name = 'ContentNotFoundError'
  }
}

export class RevisionConflictError extends ContentRepositoryError {
  constructor(
    readonly entityId: string,
    readonly expectedRevision: number | undefined,
    readonly actualRevision: number | null,
  ) {
    super(
      `Revision conflict for ${entityId}: expected ${expectedRevision ?? 'new'}, actual ${actualRevision ?? 'missing'}`,
      'REVISION_CONFLICT',
    )
    this.name = 'RevisionConflictError'
  }
}

export class RedirectGraphError extends ContentRepositoryError {
  constructor(message: string) {
    super(message, 'REDIRECT_GRAPH_ERROR')
    this.name = 'RedirectGraphError'
  }
}

export class ReadOnlyRepositoryError extends ContentRepositoryError {
  constructor() {
    super('The protected static content repository is read-only.', 'READ_ONLY_REPOSITORY')
    this.name = 'ReadOnlyRepositoryError'
  }
}
