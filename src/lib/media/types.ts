export const DEFAULT_MEDIA_MAX_BYTES = 10 * 1024 * 1024

export const ALLOWED_MEDIA_TYPES = [
  'image/avif',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const

export type AllowedMediaType = (typeof ALLOWED_MEDIA_TYPES)[number]

export type MediaUploadCandidate = {
  bytes: Uint8Array
  contentType: string
  fileName: string
}

export type ValidatedMediaUpload = {
  bytes: Uint8Array
  byteLength: number
  contentType: AllowedMediaType
  extension: 'avif' | 'jpg' | 'png' | 'webp'
  originalFileName: string
  safeBaseName: string
}

export type StoredMediaObject = {
  contentType: string
  pathname: string
  provider: 'vercel-blob' | (string & {})
  size: number
  url: string
}

export type StoreMediaInput = {
  bytes: Uint8Array
  contentType: AllowedMediaType
  pathname: string
}

/**
 * Production media is always delegated to durable object storage. A local
 * filesystem implementation is deliberately absent from the public package.
 */
export interface MediaStorage {
  delete(pathnameOrUrl: string): Promise<void>
  put(input: StoreMediaInput): Promise<StoredMediaObject>
}
