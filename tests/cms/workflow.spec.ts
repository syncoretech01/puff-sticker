import { expect, test } from '@playwright/test'

import { createContentWorkflow, createRevalidationBoundary } from '../../src/lib/cms'
import { EMPTY_CONTENT_SEO, RevisionConflictError, type ContentRecord, type WritableContentRepository } from '../../src/lib/content'

function fakeRepository() {
  const records = new Map<string, ContentRecord>()
  const repository = {
    async getContent(lookup: { id?: string; path?: string }) {
      return [...records.values()].find((item) => lookup.id ? item.id === lookup.id : item.path === lookup.path) ?? null
    },
    async saveContent(input: any) {
      const existing = input.id ? records.get(input.id) : undefined
      if (existing && input.expectedRevision !== existing.revision) throw new RevisionConflictError(existing.id, input.expectedRevision, existing.revision)
      const now = '2026-08-12T00:00:00.000Z'
      const record: ContentRecord = {
        id: input.id ?? 'draft-1',
        type: input.type,
        path: input.path,
        slug: input.slug,
        title: input.title,
        excerpt: input.excerpt ?? null,
        bodyHtml: input.bodyHtml ?? null,
        data: input.data ?? {},
        seo: input.seo ?? EMPTY_CONTENT_SEO,
        status: input.status ?? existing?.status ?? 'draft',
        revision: (existing?.revision ?? 0) + 1,
        provenanceId: input.provenanceId ?? null,
        publishedAt: input.publishedAt ?? existing?.publishedAt ?? null,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      }
      records.set(record.id, record)
      return record
    },
    async setContentStatus(input: any) {
      const existing = records.get(input.id)
      if (!existing) throw new Error('missing')
      if (input.expectedRevision !== existing.revision) throw new RevisionConflictError(existing.id, input.expectedRevision, existing.revision)
      const record = { ...existing, status: input.status, publishedAt: input.publishedAt ?? null, revision: existing.revision + 1 }
      records.set(record.id, record)
      return record
    },
  } as unknown as WritableContentRepository
  return { records, repository }
}

test('draft, update, publish, unpublish, and archive transitions are revision checked', async () => {
  const { repository } = fakeRepository()
  const refreshed: string[] = []
  const workflow = createContentWorkflow({
    clock: () => new Date('2026-08-22T00:00:00.000Z'),
    repository,
    revalidation: createRevalidationBoundary({
      path: (value) => refreshed.push(`path:${value}`),
      tag: (value) => refreshed.push(`tag:${value}`),
    }),
  })
  const context = { actorId: 'publisher' }
  const draft = await workflow.createDraft({ type: 'post', path: '/blog/new/', slug: 'new', title: 'New', seo: EMPTY_CONTENT_SEO }, context)
  const edited = await workflow.updateDraft(draft.id, draft.revision, { title: 'Edited' }, context)
  await expect(workflow.updateDraft(draft.id, draft.revision, { title: 'Stale' }, context)).rejects.toBeInstanceOf(RevisionConflictError)
  const published = await workflow.publish(edited.id, edited.revision, context)
  expect(published.record).toMatchObject({ status: 'published', revision: 3, publishedAt: '2026-08-22T00:00:00.000Z' })
  expect(refreshed).toContain('path:/blog/new')
  const draftAgain = await workflow.unpublish(published.record.id, published.record.revision, context)
  const archived = await workflow.archive(draftAgain.record.id, draftAgain.record.revision, context)
  expect(archived.record.status).toBe('archived')
})
