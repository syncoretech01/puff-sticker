import { expect, test } from '@playwright/test'

import {
  adminRateLimitSubjects,
  resolveAdminClientAddress,
} from '../../src/lib/admin/rate-limit-core'

test('admin rate-limit keys never persist raw identities or client addresses', () => {
  const subjects = adminRateLimitSubjects({
    clientAddress: '203.0.113.8',
    secret: 's'.repeat(64),
    username: ' Admin@Example.COM ',
  })

  expect(subjects.map((subject) => subject.scope)).toEqual(['ip', 'identity'])
  expect(subjects.map((subject) => subject.attemptLimit)).toEqual([30, 8])
  for (const subject of subjects) {
    expect(subject.keyHash).toMatch(/^[0-9a-f]{64}$/)
    expect(subject.keyHash).not.toContain('203.0.113.8')
    expect(subject.keyHash).not.toContain('admin@example.com')
  }

  const otherAddress = adminRateLimitSubjects({
    clientAddress: '198.51.100.22',
    secret: 's'.repeat(64),
    username: 'admin@example.com',
  })
  expect(otherAddress[0].keyHash).not.toBe(subjects[0].keyHash)
  expect(otherAddress[1].keyHash).toBe(subjects[1].keyHash)
})

test('admin client address resolution prefers the Vercel-controlled forwarding header', () => {
  const values = new Map([
    ['x-vercel-forwarded-for', '2001:db8::5'],
    ['x-forwarded-for', '198.51.100.4, 198.51.100.8'],
  ])
  expect(resolveAdminClientAddress({ get: (name) => values.get(name) ?? null })).toBe('2001:db8::5')
  expect(resolveAdminClientAddress({ get: () => 'not-an-ip' })).toBe('unavailable')
})
