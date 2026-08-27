import {
  ALLOWED_MEDIA_TYPES,
  DEFAULT_MEDIA_MAX_BYTES,
  type AllowedMediaType,
  type MediaUploadCandidate,
  type ValidatedMediaUpload,
} from './types'

export type MediaValidationCode =
  | 'empty-file'
  | 'file-too-large'
  | 'invalid-file-name'
  | 'mime-extension-mismatch'
  | 'signature-mismatch'
  | 'unsupported-media-type'

export class MediaValidationError extends Error {
  readonly code: MediaValidationCode

  constructor(code: MediaValidationCode, message: string) {
    super(message)
    this.name = 'MediaValidationError'
    this.code = code
  }
}

export type MediaValidationOptions = {
  maxBytes?: number
}

const extensionsByType: Record<AllowedMediaType, readonly string[]> = {
  'image/avif': ['avif'],
  'image/jpeg': ['jpeg', 'jpg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
}

const canonicalExtensionByType: Record<AllowedMediaType, ValidatedMediaUpload['extension']> = {
  'image/avif': 'avif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

function hasPrefix(bytes: Uint8Array, expected: readonly number[], offset = 0) {
  if (bytes.byteLength < offset + expected.length) return false
  return expected.every((value, index) => bytes[offset + index] === value)
}

function ascii(bytes: Uint8Array, offset: number, length: number) {
  return String.fromCharCode(...bytes.slice(offset, offset + length))
}

function signatureMatches(type: AllowedMediaType, bytes: Uint8Array) {
  if (type === 'image/jpeg') {
    return hasPrefix(bytes, [0xff, 0xd8, 0xff])
  }
  if (type === 'image/png') {
    return hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  }
  if (type === 'image/webp') {
    return bytes.byteLength >= 12
      && ascii(bytes, 0, 4) === 'RIFF'
      && ascii(bytes, 8, 4) === 'WEBP'
  }
  return bytes.byteLength >= 12
    && ascii(bytes, 4, 4) === 'ftyp'
    && ['avif', 'avis'].includes(ascii(bytes, 8, 4))
}

function normalizeMimeType(value: string) {
  return value.trim().toLowerCase().split(';', 1)[0]
}

function fileExtension(fileName: string) {
  const match = /\.([a-z0-9]+)$/i.exec(fileName)
  return match?.[1].toLowerCase()
}

export function mediaBaseName(fileName: string) {
  const withoutExtension = fileName.replace(/\.[^.]+$/, '')
  const normalized = withoutExtension
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)

  return normalized || 'media'
}

export function validateMediaUpload(
  candidate: MediaUploadCandidate,
  options: MediaValidationOptions = {},
): ValidatedMediaUpload {
  const maxBytes = options.maxBytes ?? DEFAULT_MEDIA_MAX_BYTES
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new TypeError('maxBytes must be a positive safe integer.')
  }
  if (!candidate.fileName || candidate.fileName.includes('\0')) {
    throw new MediaValidationError('invalid-file-name', 'A non-empty file name is required.')
  }
  if (candidate.bytes.byteLength === 0) {
    throw new MediaValidationError('empty-file', 'The upload is empty.')
  }
  if (candidate.bytes.byteLength > maxBytes) {
    throw new MediaValidationError(
      'file-too-large',
      `The upload exceeds the ${maxBytes}-byte limit.`,
    )
  }

  const normalizedType = normalizeMimeType(candidate.contentType)
  if (!ALLOWED_MEDIA_TYPES.includes(normalizedType as AllowedMediaType)) {
    throw new MediaValidationError(
      'unsupported-media-type',
      `Unsupported media type: ${normalizedType || '(missing)'}.`,
    )
  }
  const contentType = normalizedType as AllowedMediaType
  const extension = fileExtension(candidate.fileName)
  if (!extension || !extensionsByType[contentType].includes(extension)) {
    throw new MediaValidationError(
      'mime-extension-mismatch',
      `The file extension does not match ${contentType}.`,
    )
  }
  if (!signatureMatches(contentType, candidate.bytes)) {
    throw new MediaValidationError(
      'signature-mismatch',
      `The file signature does not match ${contentType}.`,
    )
  }

  return {
    bytes: candidate.bytes,
    byteLength: candidate.bytes.byteLength,
    contentType,
    extension: canonicalExtensionByType[contentType],
    originalFileName: candidate.fileName,
    safeBaseName: mediaBaseName(candidate.fileName),
  }
}
