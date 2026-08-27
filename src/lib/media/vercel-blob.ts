import 'server-only'

import { del, put } from '@vercel/blob'

import { createVercelBlobMediaStorage } from './storage'

export function getVercelBlobConfigurationStatus() {
  const configured = Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim())
  return {
    configured,
    reason: configured ? null : 'BLOB_READ_WRITE_TOKEN is not configured for this deployment.',
  } as const
}

/** No local-filesystem fallback is permitted for production media. */
export function createConfiguredVercelBlobMediaStorage() {
  const status = getVercelBlobConfigurationStatus()
  if (!status.configured) throw new Error(status.reason ?? 'Vercel Blob is unavailable.')
  return createVercelBlobMediaStorage({
    del: (pathnameOrUrl) => del(pathnameOrUrl),
    put: (pathname, body, options) => put(pathname, Buffer.from(body), options),
  })
}
