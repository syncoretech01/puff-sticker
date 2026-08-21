import { expect, test } from '@playwright/test'

import { gotoReady, installDeterministicBrowserState, observeRuntime } from './helpers'

const boundaryViewports = [
  { name: '1100', width: 1100, height: 900 },
  { name: '1101', width: 1101, height: 900 },
  { name: '900', width: 900, height: 900 },
  { name: '901', width: 901, height: 900 },
  { name: '800', width: 800, height: 900 },
  { name: '801', width: 801, height: 900 },
  { name: '600', width: 600, height: 900 },
  { name: '601', width: 601, height: 900 },
  { name: '560', width: 560, height: 900 },
  { name: '561', width: 561, height: 900 },
  { name: 'height-760', width: 1200, height: 760 },
  { name: 'height-761', width: 1200, height: 761 },
] as const

const routes = [
  { name: 'home', path: '/', anchors: ['.hero', '.core-categories', '.collection'] },
  { name: 'product', path: '/puffy-labels-stickers/puffy-stickers/', anchors: ['.product-detail', '.product-content', '.product-page-faq'] },
  { name: 'site', path: '/about-us/', anchors: ['.page-hero', '.about-origin', '.about-principles'] },
] as const

for (const viewport of boundaryViewports) {
  test(`${viewport.name} breakpoint boundaries preserve representative geometry`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await installDeterministicBrowserState(page)

    for (const route of routes) {
      const issues = observeRuntime(page)
      await gotoReady(page, route.path)
      const geometry = await page.evaluate((selectors) => ({
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
        anchors: selectors.map((selector) => {
          const element = document.querySelector<HTMLElement>(selector)
          if (!element) return { selector, exists: false }
          const rect = element.getBoundingClientRect()
          return { selector, exists: true, left: rect.left, right: rect.right, height: rect.height }
        }),
      }), [...route.anchors])

      expect(geometry.documentWidth - geometry.viewportWidth, `${route.name}: horizontal overflow`).toBeLessThanOrEqual(1)
      for (const anchor of geometry.anchors) {
        expect(anchor.exists, `${route.name}: ${anchor.selector}`).toBe(true)
        if (!anchor.exists) continue
        expect(anchor.left).toBeGreaterThanOrEqual(-1)
        expect(anchor.right).toBeLessThanOrEqual(geometry.viewportWidth + 1)
        expect(anchor.height).toBeGreaterThan(1)
      }
      expect(issues).toEqual([])
    }
  })
}
