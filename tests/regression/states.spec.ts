import { expect, test } from '@playwright/test'

import { regressionEnvironment } from './environment'
import { gotoReady, installDeterministicBrowserState } from './helpers'

test.use({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 } })

test.beforeEach(async ({ page }) => {
  await installDeterministicBrowserState(page)
})

test('mobile menu open and close state remains accessible', async ({ page }) => {
  await gotoReady(page, '/')
  const toggle = page.locator('.menu-toggle')
  const menu = page.locator('#mobile-menu')
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(menu).toHaveClass(/menu-panel--open/)
  await expect(menu).toHaveAttribute('aria-hidden', 'false')
  await expect(page.locator('body')).toHaveClass(/menu-open/)
  await page.locator('.menu-close').click()
  await expect(menu).not.toHaveClass(/menu-panel--open/)
  await expect(toggle).toBeFocused()
})

test('home FAQ preserves closed and open semantic states', async ({ page }) => {
  await gotoReady(page, '/')
  const first = page.locator('#faq .faq-item').first()
  await expect(first.locator('button')).toHaveAttribute('aria-expanded', 'true')
  await first.locator('button').click()
  await expect(first.locator('button')).toHaveAttribute('aria-expanded', 'false')
  await expect(first.locator('.faq-item__answer')).toHaveAttribute('aria-hidden', 'true')
  await first.locator('button').click()
  await expect(first.locator('.faq-item__answer')).toHaveAttribute('aria-hidden', 'false')
})

test('Finish Lab tab state updates its content and specimen class', async ({ page }) => {
  await gotoReady(page, '/')
  const lab = page.locator('.finish-lab')
  const tabs = lab.locator('[role="tab"]')
  await expect(tabs).toHaveCount(3)
  await tabs.nth(2).click()
  await expect(tabs.nth(2)).toHaveAttribute('aria-pressed', 'true')
  await expect(lab.locator('.finish-card')).toHaveClass(/finish-card--holo/)
  await expect(lab.locator('.finish-profile')).toContainText('light')
})

test('Anatomy toggles between assembled and exploded layers', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await gotoReady(page, '/')
  const anatomy = page.locator('#anatomy')
  const button = anatomy.locator('.explode-button')
  const stack = anatomy.locator('.anatomy-stack')
  const topLayer = anatomy.locator('.anatomy-layer--top')
  await expect(stack).not.toHaveClass(/anatomy-stack--open/)
  await expect(button).toContainText('Explode the layers')
  const closedTop = await topLayer.boundingBox()
  await button.evaluate((element) => element.click())
  await expect(stack).toHaveClass(/anatomy-stack--open/)
  await expect(button).toContainText('Bring it together')
  await expect.poll(async () => (await topLayer.boundingBox())?.y ?? 0).toBeLessThan((closedTop?.y ?? 0) - 1)
  await button.evaluate((element) => element.click())
  await expect(stack).not.toHaveClass(/anatomy-stack--open/)
  await expect(button).toContainText('Explode the layers')
})

test('quote workflow advances through all four validated steps', async ({ page }) => {
  await gotoReady(page, '/request-a-quote/')
  await page.getByLabel('First name *').fill('Puff')
  await page.getByLabel('Last name *').fill('Sticker')
  await page.getByLabel('Email *').fill('qa@example.com')
  await page.getByLabel('Phone *').fill('4075550100')
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.locator('.quote-step legend')).toContainText('What are we making?')
  await page.getByLabel('Product *').fill('Puffy Stickers')
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.locator('.quote-step legend')).toContainText('Quantity and artwork')
  await page.getByLabel('Primary quantity *').fill('1000')
  await page.locator('.file-drop input').setInputFiles({ name: 'artwork.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF regression') })
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.locator('.quote-step legend')).toContainText('Finish the specification')
  await expect(page.getByRole('button', { name: /Prepare free quote/ })).toBeEnabled()
})

test('quote product query survives the deterministic Next hydration handoff', async ({ page }) => {
  await gotoReady(page, '/request-a-quote/?product=puffy-stickers')
  await expect(page.locator('.quote-summary').getByText('Puffy Stickers', { exact: true })).toBeVisible()
})

test('protected Vite SPA navigation resolves the lazy route boundary', async ({ page }) => {
  test.skip(regressionEnvironment.profile !== 'vite', 'Next intentionally uses document navigation so server metadata stays authoritative.')
  await gotoReady(page, '/')
  await page.locator('.menu-toggle').click()
  await page.locator('#mobile-menu nav a[href="/shop"]').click()
  await expect(page).toHaveURL(/\/shop\/?$/)
  await expect(page.locator('.route-fallback')).toHaveCount(0)
  await expect(page.locator('main h1')).toContainText('Custom products')
  await page.locator('.catalog-card__media').first().click()
  await expect(page).toHaveURL(/\/(puffy-labels-stickers|flat-labels-stickers|promotional-items)\//)
  await expect(page.locator('.route-fallback')).toHaveCount(0)
  await expect(page.locator('main h1')).toBeVisible()
})

test('product gallery and FAQ retain content and interaction state', async ({ page }) => {
  await gotoReady(page, '/puffy-labels-stickers/puffy-stickers/')
  const gallery = page.locator('.product-gallery')
  await expect(gallery).toBeVisible()
  await expect(gallery.locator('figure')).toHaveCount(4)
  await expect(gallery.locator('img')).toHaveCount(4)
  const faqItems = page.locator('.product-page-faq .faq-item')
  expect(await faqItems.count()).toBeGreaterThan(1)
  await faqItems.nth(1).locator('button').click()
  await expect(faqItems.nth(1).locator('button')).toHaveAttribute('aria-expanded', 'true')
  await expect(faqItems.nth(1).locator('.faq-item__answer')).toHaveAttribute('aria-hidden', 'false')
})

test('unknown paths return a true 404 in the Next profile', async ({ page }) => {
  test.skip(regressionEnvironment.profile !== 'next', 'Protected Vite baseline is a documented soft-404; Next must enforce the true status.')
  const response = await page.goto('/definitely-not-a-real-puffsticker-route/', { waitUntil: 'domcontentloaded' })
  expect(response?.status()).toBe(404)
  await expect(page.locator('main h1')).toContainText('Page not found')
  const robots = await page.locator('meta[name="robots"]').evaluateAll((elements) =>
    elements.map((element) => element.getAttribute('content') ?? '').join(', '),
  )
  expect(robots).toMatch(/noindex/i)
})
