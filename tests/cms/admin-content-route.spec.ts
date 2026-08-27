import { expect, test } from '@playwright/test'

import {
  adminContentHref,
  decodeAdminContentRouteId,
  encodeAdminContentRouteId,
} from '../../src/lib/admin/content-route'

test('admin content IDs round-trip through a canonical path-safe segment', () => {
  const id = 'wp:product:123'
  const encoded = encodeAdminContentRouteId(id)
  expect(encoded).toMatch(/^id-[A-Za-z0-9_-]+$/)
  expect(decodeAdminContentRouteId(encoded)).toBe(id)
  expect(adminContentHref(id)).toBe(`/admin/content/${encoded}`)
  expect(() => decodeAdminContentRouteId('wp%3Aproduct%3A123')).toThrow()
  expect(() => decodeAdminContentRouteId('id-***')).toThrow()
})
