import { expect, test } from '@playwright/test'

import { assertWordpressSeedPlan, buildWordpressSeedPlan } from '../../scripts/cms/wordpress-seed'

test('sanitized WordPress seed is deterministic and preserves the explicit live deltas', () => {
  const first = buildWordpressSeedPlan()
  const second = buildWordpressSeedPlan()
  assertWordpressSeedPlan(first)
  expect(second).toEqual(first)
  expect(first.contents).toHaveLength(41)
  expect(first.media).toHaveLength(156)
  expect(first.contents.filter((item) => item.input.type === 'product')).toHaveLength(21)
  expect(first.contents.filter((item) => item.input.type === 'post')).toHaveLength(11)
  expect(first.knownLiveDeltas).toEqual(['custom-puffy-stickers-guide', 'why-custom-stickers-feel-like-objects'])
  expect(first.contents.every((item) => item.input.provenanceId === item.provenance.id)).toBe(true)
  expect([...first.contents, ...first.media].every((item) =>
    /^[a-f0-9]{64}$/.test(item.provenance.payloadSha256 ?? ''),
  )).toBe(true)
  expect(first.media.every((item) => item.input.provider === 'external')).toBe(true)
  expect(JSON.stringify(first)).not.toMatch(/user_pass|billing_email|shipping_address|database\.sql/i)
})
