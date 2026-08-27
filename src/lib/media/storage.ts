import type { MediaStorage, StoreMediaInput } from './types'

export type VercelBlobPutResult = {
  contentDisposition?: string
  contentType?: string
  downloadUrl?: string
  pathname: string
  url: string
}

/**
 * Structural port implemented by `@vercel/blob`'s server-side `put` and `del`
 * functions. Keeping the SDK behind this boundary makes tests deterministic
 * and prevents provider code from entering the protected public bundle.
 */
export type VercelBlobPort = {
  del(pathnameOrUrl: string): Promise<unknown>
  put(
    pathname: string,
    body: Uint8Array,
    options: {
      access: 'public'
      addRandomSuffix: false
      allowOverwrite: false
      contentType: string
    },
  ): Promise<VercelBlobPutResult>
}

function assertStoragePath(pathname: string) {
  if (!/^cms\/[a-z0-9][a-z0-9/_-]*\.[a-z0-9]+$/.test(pathname)) {
    throw new TypeError('Media object paths must be normalized under cms/.')
  }
  if (pathname.includes('..') || pathname.includes('//')) {
    throw new TypeError('Media object paths cannot contain traversal or empty segments.')
  }
}

export function createVercelBlobMediaStorage(port: VercelBlobPort): MediaStorage {
  return {
    async delete(pathnameOrUrl) {
      await port.del(pathnameOrUrl)
    },

    async put(input: StoreMediaInput) {
      assertStoragePath(input.pathname)
      const result = await port.put(input.pathname, input.bytes, {
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: false,
        contentType: input.contentType,
      })
      if (!result.url || !result.pathname) {
        throw new Error('The object-storage provider returned an incomplete media record.')
      }
      return {
        contentType: result.contentType ?? input.contentType,
        pathname: result.pathname,
        provider: 'vercel-blob',
        size: input.bytes.byteLength,
        url: result.url,
      }
    },
  }
}
