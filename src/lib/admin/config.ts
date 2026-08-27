import 'server-only'

import type { AdminConfigurationStatus, AdminRole } from './types'
import { resolveConfiguredAdminRole } from './config-core'
import { isVersionedAdminPasswordHash } from './crypto-core'

const MINIMUM_SECRET_LENGTH = 32
const DEFAULT_SESSION_TTL_SECONDS = 8 * 60 * 60
const MINIMUM_SESSION_TTL_SECONDS = 15 * 60
const MAXIMUM_SESSION_TTL_SECONDS = 12 * 60 * 60

export type AdminConfiguration = Readonly<{
  username: string
  passwordHash: string
  role: AdminRole
  sessionSecret: string
  previousSessionSecret?: string
  sessionVersion: string
  sessionTtlSeconds: number
}>

function normalized(value: string | undefined): string {
  return value?.trim() ?? ''
}

function hasStrongSecret(value: string): boolean {
  return value.length >= MINIMUM_SECRET_LENGTH
}

function configuredRole(): AdminRole | null {
  return resolveConfiguredAdminRole(process.env.PUFF_ADMIN_ROLE)
}

function configuredTtl(): number {
  const parsed = Number.parseInt(normalized(process.env.PUFF_ADMIN_SESSION_TTL_SECONDS), 10)
  if (!Number.isSafeInteger(parsed)) return DEFAULT_SESSION_TTL_SECONDS
  return Math.max(MINIMUM_SESSION_TTL_SECONDS, Math.min(MAXIMUM_SESSION_TTL_SECONDS, parsed))
}

export function getAdminConfigurationStatus(): AdminConfigurationStatus {
  const missing: string[] = []
  if (!normalized(process.env.PUFF_ADMIN_USERNAME)) missing.push('PUFF_ADMIN_USERNAME')
  if (!isVersionedAdminPasswordHash(normalized(process.env.PUFF_ADMIN_PASSWORD_HASH))) {
    missing.push('PUFF_ADMIN_PASSWORD_HASH (valid versioned scrypt hash)')
  }
  if (!hasStrongSecret(normalized(process.env.PUFF_ADMIN_SESSION_SECRET))) {
    missing.push('PUFF_ADMIN_SESSION_SECRET (at least 32 characters)')
  }
  if (!configuredRole()) missing.push('PUFF_ADMIN_ROLE (editor, publisher, or admin)')
  return { configured: missing.length === 0, missing }
}

export function getAdminConfiguration(): AdminConfiguration | null {
  if (!getAdminConfigurationStatus().configured) return null
  const role = configuredRole()
  if (!role) return null

  const previousSessionSecret = normalized(process.env.PUFF_ADMIN_SESSION_SECRET_PREVIOUS)
  return {
    username: normalized(process.env.PUFF_ADMIN_USERNAME),
    passwordHash: normalized(process.env.PUFF_ADMIN_PASSWORD_HASH),
    role,
    sessionSecret: normalized(process.env.PUFF_ADMIN_SESSION_SECRET),
    previousSessionSecret: hasStrongSecret(previousSessionSecret)
      ? previousSessionSecret
      : undefined,
    sessionVersion: normalized(process.env.PUFF_ADMIN_SESSION_VERSION) || '1',
    sessionTtlSeconds: configuredTtl(),
  }
}

export function adminCookieName(): string {
  return process.env.NODE_ENV === 'production'
    ? '__Host-puff_admin_session'
    : 'puff_admin_session'
}
