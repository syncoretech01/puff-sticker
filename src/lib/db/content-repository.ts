import 'server-only'

import type { WritableContentRepository } from '../content'
import { getDatabase } from './client'
import { createDrizzleContentRepository } from './repository'

export type CmsPersistenceStatus = {
  configured: boolean
  reason: string | null
}

export function getCmsPersistenceStatus(): CmsPersistenceStatus {
  if (!process.env.DATABASE_URL?.trim()) {
    return {
      configured: false,
      reason: 'DATABASE_URL is not configured for this deployment.',
    }
  }
  return { configured: true, reason: null }
}

/**
 * Authenticated admin code is the only runtime consumer. Public routes remain
 * bound to the protected static content modules during this migration phase.
 */
export function getCmsContentRepository(): WritableContentRepository {
  const status = getCmsPersistenceStatus()
  if (!status.configured) throw new Error(status.reason ?? 'CMS persistence is unavailable.')
  return createDrizzleContentRepository(getDatabase())
}
