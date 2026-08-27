import { expect, test } from '@playwright/test'

import {
  ProtectedStaticContentRepository,
  RepositoryValidationError,
  type ContentRecord,
} from '../../src/lib/content'

function record(id: string, path: string, status: ContentRecord['status']): ContentRecord {
  return {
    id,
    type: 'page',
    path,
    slug: id,
    title: id,
    excerpt: null,
    bodyHtml: '<p>Protected</p>',
    data: {},
    seo: { title: id, description: null, canonical: `https://puffsticker.com${path}`, robots: 'index, follow', openGraph: {}, twitter: {}, structuredData: [] },
    status,
    revision: 1,
    provenanceId: null,
    publishedAt: status === 'published' ? '2026-08-12T00:00:00.000Z' : null,
    createdAt: '2026-08-12T00:00:00.000Z',
    updatedAt: '2026-08-12T00:00:00.000Z',
  }
}

test('protected repository hides drafts by default and freezes its snapshot', async () => {
  const source = [record('published', '/published/', 'published'), record('draft', '/draft/', 'draft')]
  const repository = new ProtectedStaticContentRepository({ records: source })
  source[0] = record('changed', '/changed/', 'published')

  expect((await repository.listContent()).map((item) => item.id)).toEqual(['published'])
  expect(await repository.getContent({ id: 'draft' })).toBeNull()
  expect((await repository.getContent({ id: 'draft', includeDrafts: true }))?.id).toBe('draft')
  const published = await repository.getContent({ path: '/published/' })
  expect(published?.title).toBe('published')
  expect(Object.isFrozen(published)).toBe(true)
})

test('snapshot validation rejects duplicate paths and redirect chains', () => {
  expect(() => new ProtectedStaticContentRepository({
    records: [record('a', '/same/', 'published'), record('b', '/same/', 'published')],
  })).toThrow(RepositoryValidationError)

  expect(() => new ProtectedStaticContentRepository({
    records: [],
    redirects: [
      { id: 'one', sourcePath: '/a', targetPath: '/b', statusCode: 301, enabled: true, revision: 1, provenanceId: null, createdAt: '2026-08-12T00:00:00.000Z', updatedAt: '2026-08-12T00:00:00.000Z' },
      { id: 'two', sourcePath: '/b', targetPath: '/c', statusCode: 301, enabled: true, revision: 1, provenanceId: null, createdAt: '2026-08-12T00:00:00.000Z', updatedAt: '2026-08-12T00:00:00.000Z' },
    ],
  })).toThrow(/chains/)
})
