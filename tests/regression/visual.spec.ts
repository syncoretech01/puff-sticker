import { expect, test } from '@playwright/test'

import { breakpoints, visualCases } from './cases'
import { regressionEnvironment } from './environment'
import { prepareVisual } from './helpers'

for (const breakpoint of breakpoints) {
  test.describe(`${breakpoint.name} canonical visuals`, () => {
    test.use({ viewport: { width: breakpoint.width, height: breakpoint.height } })

    for (const visualCase of visualCases) {
      const currentBlogContent = regressionEnvironment.profile === 'next' && visualCase.name === 'blog'
      test(`${visualCase.name} matches the ${currentBlogContent ? 'current production-content' : 'Vite'} baseline`, async ({ page }) => {
        const target = await prepareVisual(page, visualCase.path, visualCase.selector)
        // The framework remains compared to Vite everywhere except the blog
        // surface whose published production inventory advanced after the
        // protected snapshot. Keep that content-only delta in its own strict,
        // same-browser baseline without replacing the Vite source of truth.
        const snapshotName = currentBlogContent
          ? `blog-next-current-${breakpoint.name}.png`
          : `${visualCase.name}-${breakpoint.name}.png`
        await expect(target).toHaveScreenshot(snapshotName, {
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
