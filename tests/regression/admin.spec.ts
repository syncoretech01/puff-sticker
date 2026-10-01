import { expect, test } from '@playwright/test'

import { regressionEnvironment } from './environment'

test.describe('private admin boundary', () => {
  test.skip(regressionEnvironment.profile !== 'next', 'Admin exists only in the Next migration target.')

  test('is noindex and fails closed when credentials and persistence are absent', async ({ page }) => {
    const response = await page.goto('/admin/login', { waitUntil: 'domcontentloaded' })
    expect(response?.status()).toBe(200)
    expect(response?.headers()['cache-control']).toContain('no-store')
    expect(response?.headers()['x-content-type-options']).toBe('nosniff')
    expect(response?.headers()['x-frame-options']).toBe('DENY')
    expect(response?.headers()['x-robots-tag']).toContain('noindex')
    await expect(page).toHaveTitle(/Puff Sticker Admin/)
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
    await expect(page.getByRole('heading', { name: 'Puff Sticker Admin' })).toBeVisible()
    await expect(page.getByText('Secure setup required.')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toHaveCount(0)

    await page.goto('/admin', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/admin\/login\?error=unconfigured/)
    await expect(page.locator('main')).toContainText('Puff Sticker Admin')
  })

  test('does not alter the public content source or public indexability', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('main h1')).toHaveCount(2)
    await expect(page.locator('h1.hero-title')).toHaveAttribute('aria-label', 'Make your mark touchable')
    await expect(page.locator('[data-live-loaded="page-home"] h1')).toHaveText('Custom puffy stickers, made to order.')
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0)
    await expect(page.locator('a[href^="/admin"]')).toHaveCount(0)
  })
})
