import { expect, test } from '@playwright/test'

import { breakpoints, visualCases } from './cases'
import { prepareVisual } from './helpers'

for (const breakpoint of breakpoints) {
  test.describe(`${breakpoint.name} canonical visuals`, () => {
    test.use({ viewport: { width: breakpoint.width, height: breakpoint.height } })

    for (const visualCase of visualCases) {
      test(`${visualCase.name} matches the Vite baseline`, async ({ page }) => {
        const target = await prepareVisual(page, visualCase.path, visualCase.selector)
        await expect(target).toHaveScreenshot(`${visualCase.name}-${breakpoint.name}.png`, {
          mask: [
            page.locator('canvas'),
            page.locator('.cursor-ring'),
            page.locator('.cursor-dot'),
          ],
          maskColor: '#081d45',
        })
      })
    }
  })
}
