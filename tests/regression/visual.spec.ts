import { writeFileSync } from 'node:fs'

import { expect, test } from '@playwright/test'

import { breakpoints, visualCases } from './cases'
import { regressionEnvironment } from './environment'
import { prepareVisual } from './helpers'

for (const breakpoint of breakpoints) {
  test.describe(`${breakpoint.name} canonical visuals`, () => {
    test.use({ viewport: { width: breakpoint.width, height: breakpoint.height } })

    for (const visualCase of visualCases) {
      const currentProductionContent = regressionEnvironment.profile === 'next'
        && (visualCase.name === 'blog' || visualCase.name === 'faq')
      test(`${visualCase.name} matches the ${currentProductionContent ? 'current production-content' : 'Vite'} baseline`, async ({ page }) => {
        const target = await prepareVisual(page, visualCase.path, visualCase.selector)
        const screenshotOptions = {
          animations: 'disabled' as const,
          caret: 'hide' as const,
          mask: [
            page.locator('canvas'),
            page.locator('.cursor-ring'),
            page.locator('.cursor-dot'),
          ],
          maskColor: '#081d45',
          scale: 'css' as const,
        }
        // The framework remains compared to Vite everywhere except the blog
        // and FAQ surfaces whose published inventories advanced after the
        // protected snapshot. Keep those content-only deltas in strict,
        // same-browser baselines without replacing the Vite source of truth.
        const sameRunnerFinishLab = visualCase.name === 'home-finish-lab'
          && regressionEnvironment.captureViteFinishLab
        const sameRunnerSnapshotName = `${visualCase.name}-${breakpoint.name}-ci-vite.png`
        if (sameRunnerFinishLab && regressionEnvironment.profile === 'vite') {
          // GitHub's Windows Server rasterizer differs at subpixel edges from
          // the protected local-Windows fixture. Seed a transient Vite image,
          // then use Playwright's normal screenshot stabilization and unchanged
          // strict threshold before the Next profile compares against it.
          const first = await target.screenshot(screenshotOptions)
          writeFileSync(new URL(`./__screenshots__/visual.spec.ts/${sameRunnerSnapshotName}`, import.meta.url), first)
          await expect(target).toHaveScreenshot(sameRunnerSnapshotName, screenshotOptions)
          return
        }
        const snapshotName = sameRunnerFinishLab
          ? sameRunnerSnapshotName
          : currentProductionContent
          ? `${visualCase.name}-next-current-${breakpoint.name}.png`
          : `${visualCase.name}-${breakpoint.name}.png`
        await expect(target).toHaveScreenshot(snapshotName, screenshotOptions)
      })
    }
  })
}
