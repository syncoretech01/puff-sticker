import { expect, test } from '@playwright/test'

import { gotoReady, observeRuntime } from './helpers'

test.use({
  reducedMotion: 'no-preference',
  viewport: { width: 1440, height: 1000 },
})

test.describe('full-motion interaction contract', () => {
  test('cursor follows the pointer and exposes hover labels', async ({ page }) => {
    const issues = observeRuntime(page)
    await gotoReady(page, '/')
    const category = page.locator('.core-category').first()
    await category.scrollIntoViewIfNeeded()
    await category.hover({ position: { x: 40, y: 40 } })
    await expect(page.locator('.cursor-ring')).toHaveClass(/cursor-ring--active/)
    await expect(page.locator('.cursor-ring span')).toHaveText('VIEW')
    expect(issues).toEqual([])
  })

  test('finish lab changes the selected surface profile', async ({ page }) => {
    await gotoReady(page, '/')
    const lab = page.locator('.finish-lab')
    await lab.scrollIntoViewIfNeeded()
    const tabs = lab.locator('[role="tab"]')
    await expect(tabs).toHaveCount(3)
    await tabs.nth(1).click()
    await expect(tabs.nth(1)).toHaveAttribute('aria-pressed', 'true')
    await expect(lab.locator('.finish-card')).toHaveClass(/finish-card--gloss/)
  })

  test('FAQ accordion updates expanded and hidden state', async ({ page }) => {
    await gotoReady(page, '/')
    const items = page.locator('#faq .faq-item')
    await items.nth(1).locator('button').click()
    await expect(items.nth(1).locator('button')).toHaveAttribute('aria-expanded', 'true')
    await expect(items.nth(1).locator('.faq-item__answer')).toHaveAttribute('aria-hidden', 'false')
    await expect(items.nth(0).locator('button')).toHaveAttribute('aria-expanded', 'false')
  })

  test('featured rail responds to desktop scroll', async ({ page }) => {
    await gotoReady(page, '/')
    const rail = page.locator('.product-rail')
    const before = await rail.evaluate((element) => getComputedStyle(element).transform)
    await page.locator('.collection').scrollIntoViewIfNeeded()
    await page.mouse.wheel(0, 900)
    await page.waitForTimeout(250)
    const after = await rail.evaluate((element) => getComputedStyle(element).transform)
    expect(after).not.toBe(before)
  })

  test('Three.js hero mounts or preserves its supported fallback', async ({ page }) => {
    await gotoReady(page, '/')
    const heroWorld = page.locator('.hero__world')
    await expect(heroWorld).toBeVisible()
    await expect.poll(async () => heroWorld.locator('canvas, .world-fallback img').count()).toBeGreaterThan(0)
  })
})
