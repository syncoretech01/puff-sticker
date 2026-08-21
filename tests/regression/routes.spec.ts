import { expect, test } from '@playwright/test'

import { regressionEnvironment } from './environment'
import { gotoReady, installDeterministicBrowserState, observeRuntime } from './helpers'
import { canonicalRoutes, localExtensionContracts } from './route-contract'

test.describe('canonical route contract', () => {
  for (const route of canonicalRoutes) {
    test(`${route.path} renders its canonical document`, async ({ page }) => {
      await installDeterministicBrowserState(page)
      const runtimeIssues = observeRuntime(page)
      const response = await gotoReady(page, route.path)

      expect(response.status()).toBe(200)
      await expect(page).toHaveTitle(/\S+/)
      await expect(page.locator('meta[name="description"]')).toHaveCount(1)
      const robots = await page.locator('meta[name="robots"]').evaluateAll((elements) => elements[0]?.getAttribute('content') ?? null)
      if (regressionEnvironment.profile === 'next') expect(robots).toMatch(/index/i)
      expect(robots ?? '').not.toMatch(/noindex/i)
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', route.canonical)
      expect(await page.locator('main h1').count()).toBeGreaterThanOrEqual(1)
      await expect(page.locator('#puff-structured-data')).toHaveCount(1)
      expect(runtimeIssues).toEqual([])
    })
  }
})

test.describe('local extensions', () => {
  for (const route of localExtensionContracts) {
    test(`${route.path} follows the ${regressionEnvironment.profile} SEO contract`, async ({ page }) => {
      await installDeterministicBrowserState(page)
      const response = await gotoReady(page, route.path)
      const expected = route[regressionEnvironment.profile]
      expect(response.status()).toBe(200)
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', expected.canonical)
      const robots = await page.locator('meta[name="robots"]').evaluateAll((elements) => elements[0]?.getAttribute('content') ?? null)
      if (expected.indexable) {
        if (regressionEnvironment.profile === 'next') expect(robots).toMatch(/\bindex\b/i)
        expect(robots ?? '').not.toMatch(/\bnoindex\b/i)
      } else {
        expect(robots).toMatch(/\bnoindex\b[^\n]*\bfollow\b/i)
      }
      expect(await page.locator('main h1').count()).toBeGreaterThanOrEqual(1)
    })
  }
})
