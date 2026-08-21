import { expect, test } from '@playwright/test'

import { gotoReady } from './helpers'

test.describe('reduced-motion contract', () => {
  test.use({ reducedMotion: 'reduce' })

  test('uses the static hero and removes scroll-driven transforms', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.addInitScript(() => window.sessionStorage.setItem('puff-intro-seen', '1'))
    await gotoReady(page, '/')
    await expect(page.locator('.hero__world .world-fallback img')).toBeVisible()
    await expect(page.locator('.hero__world canvas')).toHaveCount(0)
    expect(await page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true)
    await expect(page.locator('.cursor-ring')).toHaveCount(0)
    await page.locator('.collection').scrollIntoViewIfNeeded()
    await expect(page.locator('.product-rail')).toHaveCSS('transform', 'none')
  })
})

test.describe('coarse-pointer contract', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } })

  test('hides the custom cursor and retains touch navigation', async ({ page }) => {
    await page.addInitScript(() => window.sessionStorage.setItem('puff-intro-seen', '1'))
    await gotoReady(page, '/')
    const cursor = page.locator('.cursor-ring')
    if (await cursor.count()) await expect(cursor).toHaveCSS('display', 'none')
    else await expect(cursor).toHaveCount(0)
    await page.locator('.menu-toggle').click()
    await expect(page.locator('#mobile-menu')).toHaveAttribute('aria-hidden', 'false')
    await expect(page.locator('.menu-toggle')).toHaveAttribute('aria-expanded', 'true')
  })
})

test('Save-Data keeps a static hero and disables the custom cursor', async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('puff-intro-seen', '1')
    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      value: { saveData: true, addEventListener() {}, removeEventListener() {} },
    })
  })
  await gotoReady(page, '/')
  await expect(page.locator('html')).toHaveClass(/save-data/)
  await expect(page.locator('.hero__world .world-fallback img')).toBeVisible()
  await expect(page.locator('.hero__world canvas')).toHaveCount(0)
  await expect(page.locator('.cursor-ring')).toHaveCount(0)
})

test('WebGL-disabled browsers preserve the branded hero fallback', async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('puff-intro-seen', '1')
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function getContext(contextId: string, ...args: unknown[]) {
      if (/^webgl2?$/.test(contextId)) return null
      return original.call(this, contextId, ...args as [])
    } as typeof HTMLCanvasElement.prototype.getContext
  })
  await gotoReady(page, '/')
  await expect(page.locator('.hero__world .world-fallback img')).toBeVisible()
  await expect(page.locator('.hero__world canvas')).toHaveCount(0)
})
