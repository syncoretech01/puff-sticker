import { expect, test } from '@playwright/test'

import {
  assertCmsPublicSourceEnabled,
  CMS_PUBLIC_SOURCE_ENABLED,
  CMS_PUBLIC_SOURCE_STATUS,
  CmsPublicSourceLockedError,
} from '../../src/lib/cms/public-source'

test('CMS public transitions remain code-locked during source parity work', () => {
  expect(CMS_PUBLIC_SOURCE_ENABLED).toBe(false)
  expect(CMS_PUBLIC_SOURCE_STATUS).toMatchObject({
    enabled: false,
    source: 'protected-static',
  })
  expect(() => assertCmsPublicSourceEnabled()).toThrow(CmsPublicSourceLockedError)
})
