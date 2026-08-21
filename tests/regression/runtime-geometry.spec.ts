import { expect, test } from '@playwright/test'

import { breakpoints, representativeRoutes } from './cases'
import { attachRuntimeIssues, gotoReady, installDeterministicBrowserState, observeRuntime } from './helpers'

for (const breakpoint of breakpoints) {
  test.describe(`${breakpoint.name} runtime and geometry`, () => {
    test.use({ viewport: { width: breakpoint.width, height: breakpoint.height } })

    for (const route of representativeRoutes) {
      test(`${route.name} has no runtime or layout regression`, async ({ page }, testInfo) => {
        await installDeterministicBrowserState(page)
        const issues = observeRuntime(page)
        await gotoReady(page, route.path)

        const geometry = await page.evaluate((selectors) => {
          const viewportWidth = document.documentElement.clientWidth
          const sections = selectors.map((selector) => {
            const element = document.querySelector<HTMLElement>(selector)
            if (!element) return { selector, exists: false }
            const rect = element.getBoundingClientRect()
            return {
              selector,
              exists: true,
              height: rect.height,
              left: rect.left,
              right: rect.right,
            }
          })
          return {
            viewportWidth,
            documentWidth: document.documentElement.scrollWidth,
            sections,
          }
        }, [...route.selectors])

        expect(geometry.documentWidth - geometry.viewportWidth, 'document horizontal overflow').toBeLessThanOrEqual(1)
        for (const section of geometry.sections) {
          expect(section.exists, `${section.selector} should exist`).toBe(true)
          if (!section.exists) continue
          expect(section.height, `${section.selector} should have layout height`).toBeGreaterThan(1)
          expect(section.left, `${section.selector} should not escape left viewport`).toBeGreaterThanOrEqual(-1)
          expect(section.right, `${section.selector} should not escape right viewport`).toBeLessThanOrEqual(geometry.viewportWidth + 1)
        }

        await attachRuntimeIssues(testInfo, issues)
        expect(issues).toEqual([])
      })
    }
  })
}
