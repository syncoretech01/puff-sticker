import { expect, test } from '@playwright/test'

import {
  MediaValidationError,
  validateMediaUpload,
} from '../../src/lib/media/validation'
import { mediaObjectPath } from '../../src/lib/media/path'
import { createVercelBlobMediaStorage } from '../../src/lib/media/storage'
import { InMemoryMediaStorage } from './helpers/in-memory-media-storage'

const pngBytes = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x00,
])

test('validates signature, MIME, extension, size, and a deterministic object path', async () => {
  const upload = validateMediaUpload({
    bytes: pngBytes,
    contentType: 'IMAGE/PNG; charset=binary',
    fileName: '  Launch Artwork (Final).PNG',
  })

  expect(upload).toMatchObject({
    byteLength: pngBytes.byteLength,
    contentType: 'image/png',
    extension: 'png',
    safeBaseName: 'launch-artwork-final',
  })
  expect(mediaObjectPath(upload, '01J_STABLE', 'Editorial')).toBe(
    'cms/editorial/01j_stable-launch-artwork-final.png',
  )

  const storage = new InMemoryMediaStorage()
  const pathname = mediaObjectPath(upload, '01J_STABLE', 'Editorial')
  const stored = await storage.put({
    bytes: upload.bytes,
    contentType: upload.contentType,
    pathname,
  })
  expect(stored).toMatchObject({ pathname, provider: 'test-memory', size: pngBytes.byteLength })
  expect(storage.objects.get(pathname)?.bytes).toEqual(pngBytes)
})

test('rejects active formats, spoofed files, mismatched extensions, empty files, and oversize files', () => {
  const cases = [
    {
      candidate: { bytes: pngBytes, contentType: 'image/svg+xml', fileName: 'vector.svg' },
      code: 'unsupported-media-type',
    },
    {
      candidate: { bytes: new TextEncoder().encode('<script>'), contentType: 'image/png', fileName: 'x.png' },
      code: 'signature-mismatch',
    },
    {
      candidate: { bytes: pngBytes, contentType: 'image/png', fileName: 'x.jpg' },
      code: 'mime-extension-mismatch',
    },
    {
      candidate: { bytes: new Uint8Array(), contentType: 'image/png', fileName: 'x.png' },
      code: 'empty-file',
    },
  ] as const

  for (const item of cases) {
    expect(() => validateMediaUpload(item.candidate)).toThrow(MediaValidationError)
    try {
      validateMediaUpload(item.candidate)
    } catch (error) {
      expect((error as MediaValidationError).code).toBe(item.code)
    }
  }

  expect(() => validateMediaUpload(
    { bytes: pngBytes, contentType: 'image/png', fileName: 'x.png' },
    { maxBytes: pngBytes.byteLength - 1 },
  )).toThrow(/exceeds/)
})

test('Vercel Blob adapter uses public immutable keys without silent overwrite', async () => {
  const calls: unknown[] = []
  const storage = createVercelBlobMediaStorage({
    async del(value) { calls.push(['del', value]) },
    async put(pathname, bytes, options) {
      calls.push(['put', pathname, bytes, options])
      return { pathname, url: `https://blob.example/${pathname}`, contentType: options.contentType }
    },
  })

  const result = await storage.put({
    bytes: pngBytes,
    contentType: 'image/png',
    pathname: 'cms/library/stable-art.png',
  })
  await storage.delete(result.url)

  expect(calls[0]).toEqual([
    'put',
    'cms/library/stable-art.png',
    pngBytes,
    {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: false,
      contentType: 'image/png',
    },
  ])
  expect(calls[1]).toEqual(['del', 'https://blob.example/cms/library/stable-art.png'])
  expect(result.provider).toBe('vercel-blob')
})

test('rejects traversal before calling object storage', async () => {
  let called = false
  const storage = createVercelBlobMediaStorage({
    async del() {},
    async put() {
      called = true
      return { pathname: 'never', url: 'https://never.invalid' }
    },
  })

  await expect(storage.put({
    bytes: pngBytes,
    contentType: 'image/png',
    pathname: 'cms/../secret.png',
  })).rejects.toThrow(/normalized|traversal/)
  expect(called).toBe(false)
})
