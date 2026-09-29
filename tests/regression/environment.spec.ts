import { existsSync, readFileSync } from 'node:fs'

import { expect, test } from '@playwright/test'

import { breakpoints } from './cases'
import { regressionEnvironment } from './environment'

type BaselineEnvironment = {
  platform: string
  architecture: string
  playwrightVersion: string
  browserName: string
  browserVersion: string
  deviceScaleFactor: number
}

const baseline = JSON.parse(
  readFileSync(new URL('./baseline-environment.json', import.meta.url), 'utf8'),
) as BaselineEnvironment

test('screenshots run in the canonical OS and browser environment', async ({ browser, browserName, page }) => {
  const installed = JSON.parse(
    readFileSync(new URL('../../node_modules/@playwright/test/package.json', import.meta.url), 'utf8'),
  ) as { version: string }
  const actual = {
    platform: process.platform,
    architecture: process.arch,
    playwrightVersion: installed.version,
    browserName,
    browserVersion: browser.version(),
    deviceScaleFactor: await page.evaluate(() => window.devicePixelRatio),
  }
  expect(actual).toEqual(baseline)
})

test('the configured pixel environment has every Finish Lab baseline', () => {
  test.skip(!regressionEnvironment.pixelEnvironment, 'The local Windows baseline uses the unsuffixed snapshots.')
  const snapshotRoot = new URL('./__screenshots__/visual.spec.ts/', import.meta.url)
  for (const breakpoint of breakpoints) {
    const name = `home-finish-lab-${breakpoint.name}-${regressionEnvironment.pixelEnvironment}.png`
    expect(existsSync(new URL(name, snapshotRoot)), name).toBe(true)
  }
})
