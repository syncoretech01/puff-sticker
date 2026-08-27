import { defineConfig } from '@playwright/test'

const port = Number.parseInt(process.env.PUFF_TEST_NEXT_PORT ?? '', 10)
if (!Number.isSafeInteger(port) || port < 1) {
  throw new Error('PUFF_TEST_NEXT_PORT is required for PostgreSQL integration tests.')
}

export default defineConfig({
  testDir: '.',
  testMatch: 'postgres.integration.spec.ts',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [['line']],
  timeout: 240_000,
  expect: { timeout: 15_000 },
  use: { baseURL: `http://127.0.0.1:${port}` },
  webServer: {
    command: `npm run start -- --hostname 127.0.0.1 --port ${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
    url: `http://127.0.0.1:${port}/admin/login`,
  },
})
