import { expect, test } from '@playwright/test'

import {
  createRevalidationBoundary,
  publicContentRevalidationTargets,
} from '../../src/lib/cms/revalidation'

test('plans SEO-safe post revalidation deterministically', () => {
  expect(publicContentRevalidationTargets({
    path: '/blog/new-article/',
    type: 'post',
  })).toEqual([
    { kind: 'path', value: '/blog/new-article' },
    { kind: 'path', value: '/sitemap_index.xml' },
    { kind: 'path', value: '/blog' },
    { kind: 'path', value: '/post-sitemap.xml' },
    { kind: 'tag', value: 'content' },
    { kind: 'tag', value: 'content:post' },
    { kind: 'tag', value: 'content:path:blog:new:article' },
  ])
})

test('deduplicates calls and reports post-commit failures without hiding successes', async () => {
  const calls: string[] = []
  const boundary = createRevalidationBoundary({
    path(pathname) {
      calls.push(`path:${pathname}`)
      if (pathname === '/fails') throw new Error('cache unavailable')
    },
    tag(tag) { calls.push(`tag:${tag}`) },
  })

  const result = await boundary.refresh([
    { kind: 'path', value: '/ok' },
    { kind: 'path', value: '/ok' },
    { kind: 'path', value: '/fails' },
    { kind: 'tag', value: 'content:post' },
  ])

  expect(calls).toEqual(['path:/ok', 'path:/fails', 'tag:content:post'])
  expect(result).toEqual({
    completed: [
      { kind: 'path', value: '/ok' },
      { kind: 'tag', value: 'content:post' },
    ],
    failed: [{ kind: 'path', value: '/fails', message: 'cache unavailable' }],
    ok: false,
  })
})

test('rejects external paths and malformed tags before invoking framework code', async () => {
  const boundary = createRevalidationBoundary({ path() {}, tag() {} })
  await expect(boundary.refresh([{ kind: 'path', value: 'https://example.com/' }]))
    .rejects.toThrow(/site-relative/)
  await expect(boundary.refresh([{ kind: 'tag', value: 'bad tag' }]))
    .rejects.toThrow(/Invalid revalidation tag/)
})
