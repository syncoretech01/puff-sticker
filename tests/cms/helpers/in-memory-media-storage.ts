import type {
  MediaStorage,
  StoredMediaObject,
  StoreMediaInput,
} from '../../../src/lib/media'

/** Test-only adapter. There is intentionally no filesystem storage adapter. */
export class InMemoryMediaStorage implements MediaStorage {
  readonly objects = new Map<string, StoreMediaInput>()

  async delete(pathnameOrUrl: string) {
    const pathname = pathnameOrUrl.startsWith('memory://')
      ? new URL(pathnameOrUrl).pathname.slice(1)
      : pathnameOrUrl
    this.objects.delete(pathname)
  }

  async put(input: StoreMediaInput): Promise<StoredMediaObject> {
    if (this.objects.has(input.pathname)) throw new Error('Object already exists.')
    this.objects.set(input.pathname, { ...input, bytes: input.bytes.slice() })
    return {
      contentType: input.contentType,
      pathname: input.pathname,
      provider: 'test-memory',
      size: input.bytes.byteLength,
      url: `memory://media/${input.pathname}`,
    }
  }
}
