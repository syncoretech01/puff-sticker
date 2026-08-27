import { expect, test } from '@playwright/test'

import { resolveConfiguredAdminRole } from '../../src/lib/admin/config-core'
import {
  createAdminPasswordHash,
  createAdminSessionToken,
  isVersionedAdminPasswordHash,
  verifyAdminPassword,
  verifyAdminSessionToken,
} from '../../src/lib/admin/crypto-core'

test('admin role configuration requires an explicit valid least-privilege role', () => {
  expect(resolveConfiguredAdminRole(undefined)).toBeNull()
  expect(resolveConfiguredAdminRole('')).toBeNull()
  expect(resolveConfiguredAdminRole('owner')).toBeNull()
  expect(resolveConfiguredAdminRole(' editor ')).toBe('editor')
  expect(resolveConfiguredAdminRole('publisher')).toBe('publisher')
  expect(resolveConfiguredAdminRole('admin')).toBe('admin')
})

test('scrypt password hashes verify without storing the password', async () => {
  const password = 'correct horse battery staple'
  const hash = await createAdminPasswordHash(password)
  expect(hash).toMatch(/^scrypt\$1\$16384\$8\$1\$/)
  expect(isVersionedAdminPasswordHash(hash)).toBe(true)
  expect(isVersionedAdminPasswordHash('not-a-versioned-hash')).toBe(false)
  expect(hash).not.toContain(password)
  await expect(verifyAdminPassword(password, hash)).resolves.toBe(true)
  await expect(verifyAdminPassword('not the password', hash)).resolves.toBe(false)
  await expect(verifyAdminPassword(password, 'invalid')).resolves.toBe(false)
})

test('signed sessions enforce identity, role, version, expiry, and rotation', () => {
  const input = {
    username: 'editor@example',
    role: 'publisher' as const,
    secret: 'a'.repeat(64),
    sessionVersion: '4',
    ttlSeconds: 3600,
    now: 1_000,
  }
  const issued = createAdminSessionToken(input)
  expect(verifyAdminSessionToken({
    token: issued.token,
    secrets: [input.secret],
    expectedUsername: input.username,
    expectedRole: input.role,
    sessionVersion: input.sessionVersion,
    now: 1_001,
  })).toMatchObject({ subject: input.username, role: input.role, expiresAt: 4_600 })

  const verify = (overrides: Record<string, unknown> = {}) => verifyAdminSessionToken({
    token: issued.token,
    secrets: [input.secret],
    expectedUsername: input.username,
    expectedRole: input.role,
    sessionVersion: input.sessionVersion,
    now: 1_001,
    ...overrides,
  })
  expect(verify({ expectedUsername: 'other' })).toBeNull()
  expect(verify({ expectedRole: 'admin' })).toBeNull()
  expect(verify({ sessionVersion: '5' })).toBeNull()
  expect(verify({ now: 4_600 })).toBeNull()
  expect(verify({ token: issued.token.slice(0, -1) + 'x' })).toBeNull()
  expect(verify({ secrets: ['b'.repeat(64), input.secret] })).not.toBeNull()
})
