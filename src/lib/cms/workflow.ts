import {
  ContentNotFoundError,
  type ContentRecord,
  type MutationContext,
  type SaveContentInput,
  type WritableContentRepository,
} from '../content'

import {
  noOpRevalidationBoundary,
  publicContentRevalidationTargets,
  type RevalidationBoundary,
  type RevalidationResult,
} from './revalidation'

export class ContentWorkflowError extends Error {
  constructor(message: string, readonly code: string) {
    super(message)
    this.name = 'ContentWorkflowError'
  }
}

export type CreateDraftInput = Omit<
  SaveContentInput,
  'expectedRevision' | 'publishedAt' | 'status'
>

export type UpdateDraftPatch = Partial<Pick<
  SaveContentInput,
  | 'bodyHtml'
  | 'changeSummary'
  | 'data'
  | 'excerpt'
  | 'path'
  | 'provenanceId'
  | 'seo'
  | 'slug'
  | 'title'
  | 'type'
>>

export type PublicTransitionResult = {
  record: ContentRecord
  /** A committed transition can succeed while cache invalidation needs retry. */
  revalidation: RevalidationResult
}

export type ContentWorkflow = ReturnType<typeof createContentWorkflow>

function utcNow(clock: () => Date) {
  const value = clock()
  if (!(value instanceof Date) || Number.isNaN(value.valueOf())) {
    throw new TypeError('The workflow clock must return a valid Date.')
  }
  return value.toISOString()
}

async function requiredRecord(repository: WritableContentRepository, id: string) {
  const record = await repository.getContent({
    id,
    includeArchived: true,
    includeDrafts: true,
  })
  if (!record) throw new ContentNotFoundError(id)
  return record
}

function assertStatus(record: ContentRecord, expected: ContentRecord['status'], action: string) {
  if (record.status !== expected) {
    throw new ContentWorkflowError(
      `Cannot ${action} ${record.id} while it is ${record.status}; expected ${expected}.`,
      'INVALID_TRANSITION',
    )
  }
}

export function createContentWorkflow(dependencies: {
  clock?: () => Date
  repository: WritableContentRepository
  revalidation?: RevalidationBoundary
}) {
  const {
    clock = () => new Date(),
    repository,
    revalidation = noOpRevalidationBoundary(),
  } = dependencies

  return {
    async createDraft(input: CreateDraftInput, context: MutationContext) {
      return repository.saveContent({
        ...input,
        publishedAt: null,
        status: 'draft',
      }, context)
    },

    async updateDraft(
      id: string,
      expectedRevision: number,
      patch: UpdateDraftPatch,
      context: MutationContext,
    ) {
      const current = await requiredRecord(repository, id)
      assertStatus(current, 'draft', 'edit')
      return repository.saveContent({
        bodyHtml: patch.bodyHtml === undefined ? current.bodyHtml : patch.bodyHtml,
        changeSummary: patch.changeSummary,
        data: patch.data ?? current.data,
        excerpt: patch.excerpt === undefined ? current.excerpt : patch.excerpt,
        expectedRevision,
        id: current.id,
        path: patch.path ?? current.path,
        provenanceId: patch.provenanceId === undefined
          ? current.provenanceId
          : patch.provenanceId,
        publishedAt: null,
        seo: patch.seo ?? current.seo,
        slug: patch.slug ?? current.slug,
        status: 'draft',
        title: patch.title ?? current.title,
        type: patch.type ?? current.type,
      }, context)
    },

    async publish(
      id: string,
      expectedRevision: number,
      context: MutationContext,
    ): Promise<PublicTransitionResult> {
      const current = await requiredRecord(repository, id)
      assertStatus(current, 'draft', 'publish')
      const record = await repository.setContentStatus({
        changeSummary: 'Published through the CMS workflow.',
        expectedRevision,
        id,
        publishedAt: utcNow(clock),
        status: 'published',
      }, context)
      const result = await revalidation.refresh(publicContentRevalidationTargets(record))
      return { record, revalidation: result }
    },

    async unpublish(
      id: string,
      expectedRevision: number,
      context: MutationContext,
    ): Promise<PublicTransitionResult> {
      const current = await requiredRecord(repository, id)
      assertStatus(current, 'published', 'unpublish')
      const record = await repository.setContentStatus({
        changeSummary: 'Returned to draft through the CMS workflow.',
        expectedRevision,
        id,
        publishedAt: null,
        status: 'draft',
      }, context)
      const result = await revalidation.refresh(publicContentRevalidationTargets(record))
      return { record, revalidation: result }
    },

    async archive(
      id: string,
      expectedRevision: number,
      context: MutationContext,
    ): Promise<PublicTransitionResult> {
      const current = await requiredRecord(repository, id)
      if (current.status === 'archived') {
        throw new ContentWorkflowError(
          `Cannot archive ${id} while it is already archived.`,
          'INVALID_TRANSITION',
        )
      }
      const wasPublic = current.status === 'published'
      const record = await repository.setContentStatus({
        changeSummary: 'Archived through the CMS workflow.',
        expectedRevision,
        id,
        publishedAt: null,
        status: 'archived',
      }, context)
      const result = wasPublic
        ? await revalidation.refresh(publicContentRevalidationTargets(record))
        : { completed: [], failed: [], ok: true }
      return { record, revalidation: result }
    },
  }
}
