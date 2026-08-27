import type { ValidatedMediaUpload } from './types'

function normalizeNamespace(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  if (!normalized) throw new TypeError('A media namespace is required.')
  return normalized
}

/**
 * The caller supplies the stable object ID (normally a UUID). Randomness and
 * clocks do not live in this function, so paths can be asserted in tests.
 */
export function mediaObjectPath(
  upload: Pick<ValidatedMediaUpload, 'extension' | 'safeBaseName'>,
  objectId: string,
  namespace = 'library',
) {
  const safeObjectId = normalizeNamespace(objectId)
  const safeNamespace = normalizeNamespace(namespace)
  return `cms/${safeNamespace}/${safeObjectId}-${upload.safeBaseName}.${upload.extension}`
}
