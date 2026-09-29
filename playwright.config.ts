import { defineConfig } from '@playwright/test'
import { regressionEnvironment } from './tests/regression/environment'

const inCi = Boolean(process.env.CI)

export default defineConfig({
  testDir: './tests/regression',
  outputDir: 'test-results/regression',
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}{ext}',
  fullyParallel: true,
  forbidOnly: inCi,
  retries: inCi ? 2 : 0,
  // Screenshot and geometry baselines are certified serially so CI exercises
  // the same rendering workload as the protected local baseline.
  workers: 1,
  timeout: 45_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.001,
      scale: 'css',
      threshold: 0.2,
    },
  },
  reporter: inCi
    ? [['line'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : [['line']],
  use: {
    baseURL: regressionEnvironment.targetOrigin,
    browserName: 'chromium',
    colorScheme: 'light',
    locale: 'en-US',
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
    timezoneId: 'UTC',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    viewport: { width: 1440, height: 1000 },
  },
  webServer: regressionEnvironment.manageServer
    ? {
        command: regressionEnvironment.serverCommand,
        url: `${regressionEnvironment.targetOrigin}/`,
        reuseExistingServer: !inCi,
        stdout: 'ignore',
        stderr: 'ignore',
        timeout: 120_000,
      }
    : undefined,
})
