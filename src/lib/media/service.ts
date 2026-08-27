import {
  type JsonObject,
  type MediaRecord,
  type MutationContext,
  type WritableContentRepository,
} from '../content'

import { mediaObjectPath } from './path'
import type { MediaStorage, MediaUploadCandidate, StoredMediaObject } from './types'
import { validateMediaUpload, type MediaValidationOptions } from './validation'

export type MediaLibraryUploadInput = MediaUploadCandidate & {
  altText: string
  caption?: string | null
  decorative?: boolean
  height?: number | null
  metadata?: JsonObject
  namespace?: string
  width?: number | null
}

export type MediaLibraryUploadResult = {
  media: MediaRecord
  object: StoredMediaObject
}

export class MediaLibraryError extends Error {
  constructor(
    message: string,
    readonly code: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'MediaLibraryError'
  }
}

async function sha256Hex(bytes: Uint8Array) {
  // Copy onto a concrete ArrayBuffer. TypeScript 7 correctly models incoming
  // Uint8Array values as potentially backed by SharedArrayBuffer, while the
  // Web Crypto digest contract accepts only an ArrayBuffer-backed view.
  const digest = await globalThis.crypto.subtle.digest('SHA-256', Uint8Array.from(bytes))
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')
}

function validateAlt(input: Pick<MediaLibraryUploadInput, 'altText' | 'decorative'>) {
  if (input.decorative && input.altText.trim()) {
    throw new MediaLibraryError(
      'Decorative media must use empty alt text.',
      'INVALID_ALT_TEXT',
    )
  }
  if (!input.decorative && !input.altText.trim()) {
    throw new MediaLibraryError(
      'Meaningful media requires descriptive alt text.',
      'INVALID_ALT_TEXT',
    )
  }
}

export function createMediaLibraryService(dependencies: {
  createId: () => string
  repository: WritableContentRepository
  storage: MediaStorage
  validation?: MediaValidationOptions
}) {
  const { createId, repository, storage, validation } = dependencies
  return {
    async upload(
      input: MediaLibraryUploadInput,
      context: MutationContext,
    ): Promise<MediaLibraryUploadResult> {
      validateAlt(input)
      const upload = validateMediaUpload(input, validation)
      const id = createId()
      if (!id.trim()) throw new MediaLibraryError('The media ID factory returned an empty ID.', 'INVALID_ID')
      if (await repository.getMedia(id)) {
        throw new MediaLibraryError(`Media ID already exists: ${id}`, 'ID_COLLISION')
      }

      const pathname = mediaObjectPath(upload, id, input.namespace)
      const object = await storage.put({
        bytes: upload.bytes,
        contentType: upload.contentType,
        pathname,
      })

      try {
        const media = await repository.upsertMedia({
          altText: input.altText.trim(),
          bytes: upload.byteLength,
          caption: input.caption ?? null,
          fileName: upload.originalFileName,
          height: input.height ?? null,
          id,
          metadata: {
            ...(input.metadata ?? {}),
            decorative: input.decorative ?? false,
            originalFileName: upload.originalFileName,
          },
          mimeType: upload.contentType,
          provider: 'object-storage',
          publicUrl: object.url,
          sha256: await sha256Hex(upload.bytes),
          storageKey: object.pathname,
          width: input.width ?? null,
        }, context)
        return { media, object }
      } catch (error) {
        try {
          await storage.delete(object.pathname)
        } catch (cleanupError) {
          throw new MediaLibraryError(
            `Media metadata failed and object cleanup also failed for ${object.pathname}.`,
            'PERSISTENCE_AND_CLEANUP_FAILED',
            { cause: { cleanupError, persistenceError: error } },
          )
        }
        throw new MediaLibraryError(
          `Media metadata failed; object ${object.pathname} was removed.`,
          'PERSISTENCE_FAILED',
          { cause: error },
        )
      }
    },
  }
}
