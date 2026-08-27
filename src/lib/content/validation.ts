import { RedirectGraphError, RepositoryValidationError } from './repository'
import type {
  ContentRecord,
  ContentSeo,
  MediaRecord,
  RedirectRecord,
  UpsertMediaInput,
} from './types'

const SHA256_PATTERN = /^[a-f\d]{64}$/i
const MIME_TYPE_PATTERN = /^[a-z\d][a-z\d!#$&^_.+-]*\/[a-z\d][a-z\d!#$&^_.+-]*$/i
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/

export function assertNonEmpty(value: string, field: string): void {
  if (!value.trim()) throw new RepositoryValidationError(`${field} must not be empty.`)
}

/** Validates but deliberately does not rewrite parity-sensitive paths. */
export function assertInternalLocation(value: string, field: string): void {
  assertNonEmpty(value, field)
  if (!value.startsWith('/') || value.startsWith('//') || CONTROL_CHARACTER_PATTERN.test(value)) {
    throw new RepositoryValidationError(`${field} must be a root-relative internal location.`)
  }

  let parsed: URL
  try {
    parsed = new URL(value, 'https://puffsticker.invalid')
  } catch {
    throw new RepositoryValidationError(`${field} is not a valid internal location.`)
  }
  if (parsed.origin !== 'https://puffsticker.invalid') {
    throw new RepositoryValidationError(`${field} must remain on the PuffSticker origin.`)
  }
}

export function assertContentPath(value: string): void {
  assertInternalLocation(value, 'path')
  if (value.includes('?') || value.includes('#')) {
    throw new RepositoryValidationError('Content paths cannot contain a query string or fragment.')
  }
}

export function assertIsoDateTime(value: string | null | undefined, field: string): void {
  if (value == null) return
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) || Number.isNaN(Date.parse(value))) {
    throw new RepositoryValidationError(`${field} must be a UTC ISO 8601 timestamp.`)
  }
}

export function assertContentSeo(seo: ContentSeo): void {
  if (seo.canonical != null) {
    let canonical: URL
    try {
      canonical = new URL(seo.canonical)
    } catch {
      throw new RepositoryValidationError('seo.canonical must be an absolute URL or null.')
    }
    if (!['http:', 'https:'].includes(canonical.protocol)) {
      throw new RepositoryValidationError('seo.canonical must use HTTP or HTTPS.')
    }
  }
}

export function assertContentRecord(record: ContentRecord): void {
  assertNonEmpty(record.id, 'id')
  assertContentPath(record.path)
  assertNonEmpty(record.slug, 'slug')
  assertNonEmpty(record.title, 'title')
  if (!Number.isSafeInteger(record.revision) || record.revision < 1) {
    throw new RepositoryValidationError('revision must be a positive safe integer.')
  }
  assertIsoDateTime(record.createdAt, 'createdAt')
  assertIsoDateTime(record.updatedAt, 'updatedAt')
  assertIsoDateTime(record.publishedAt, 'publishedAt')
  assertContentSeo(record.seo)
}

export function assertMediaInput(input: UpsertMediaInput): void {
  assertNonEmpty(input.publicUrl, 'publicUrl')
  assertNonEmpty(input.fileName, 'fileName')
  if (!MIME_TYPE_PATTERN.test(input.mimeType)) {
    throw new RepositoryValidationError('mimeType must be a valid media type.')
  }

  let publicUrl: URL
  try {
    publicUrl = new URL(input.publicUrl)
  } catch {
    throw new RepositoryValidationError('publicUrl must be an absolute URL.')
  }
  if (publicUrl.protocol !== 'https:' && !(publicUrl.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(publicUrl.hostname))) {
    throw new RepositoryValidationError('publicUrl must use HTTPS (HTTP is allowed only for local development).')
  }
  if (input.provider === 'object-storage' && !input.storageKey?.trim()) {
    throw new RepositoryValidationError('Object-storage media requires a durable storageKey.')
  }
  if (input.storageKey && (input.storageKey.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(input.storageKey))) {
    throw new RepositoryValidationError('storageKey must be an object key, not a local filesystem path.')
  }
  for (const [field, value] of [['width', input.width], ['height', input.height], ['bytes', input.bytes]] as const) {
    if (value != null && (!Number.isSafeInteger(value) || value < 0)) {
      throw new RepositoryValidationError(`${field} must be a non-negative safe integer or null.`)
    }
  }
  if (input.sha256 != null && !SHA256_PATTERN.test(input.sha256)) {
    throw new RepositoryValidationError('sha256 must contain exactly 64 hexadecimal characters.')
  }
}

export function assertMediaRecord(record: MediaRecord): void {
  assertMediaInput(record)
  assertNonEmpty(record.id, 'id')
  if (!Number.isSafeInteger(record.revision) || record.revision < 1) {
    throw new RepositoryValidationError('revision must be a positive safe integer.')
  }
  assertIsoDateTime(record.createdAt, 'createdAt')
  assertIsoDateTime(record.updatedAt, 'updatedAt')
}

function redirectRequestKey(location: string): string {
  const parsed = new URL(location, 'https://puffsticker.invalid')
  return `${parsed.pathname}${parsed.search}`
}

/** Rejects self redirects, chains, and cycles before they reach production. */
export function assertRedirectGraph(records: readonly Pick<RedirectRecord, 'sourcePath' | 'targetPath' | 'enabled'>[]): void {
  const enabled = records.filter((record) => record.enabled)
  const targets = new Map<string, string>()

  for (const record of enabled) {
    assertInternalLocation(record.sourcePath, 'sourcePath')
    assertInternalLocation(record.targetPath, 'targetPath')
    if (record.sourcePath.includes('#')) {
      throw new RepositoryValidationError('Redirect sourcePath cannot contain a fragment.')
    }
    const source = redirectRequestKey(record.sourcePath)
    const target = redirectRequestKey(record.targetPath)
    if (targets.has(source)) throw new RedirectGraphError(`Duplicate enabled redirect source: ${source}`)
    if (source === target) throw new RedirectGraphError(`Self redirect is not allowed: ${source}`)
    targets.set(source, target)
  }

  for (const [source, target] of targets) {
    if (targets.has(target)) {
      throw new RedirectGraphError(`Redirect chains are not allowed: ${source} -> ${target}`)
    }
  }
}

export function assertListWindow(limit = 100, offset = 0): { limit: number; offset: number } {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) {
    throw new RepositoryValidationError('limit must be an integer between 1 and 500.')
  }
  if (!Number.isSafeInteger(offset) || offset < 0) {
    throw new RepositoryValidationError('offset must be a non-negative integer.')
  }
  return { limit, offset }
}
