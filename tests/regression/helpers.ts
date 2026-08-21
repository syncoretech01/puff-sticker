import { expect, type Page, type Response, type TestInfo } from '@playwright/test'

type RuntimeIssue = {
  kind: 'console' | 'pageerror' | 'requestfailed' | 'response'
  message: string
  url?: string
}

export function observeRuntime(page: Page) {
  const issues: RuntimeIssue[] = []

  page.on('console', (message) => {
    if (message.type() === 'error') {
      const url = message.location().url || undefined
      issues.push({ kind: 'console', message: message.text(), ...(url ? { url } : {}) })
    }
  })
  page.on('pageerror', (error) => issues.push({ kind: 'pageerror', message: error.message }))
  page.on('requestfailed', (request) => {
    if (new URL(request.url()).origin === new URL(page.url() || 'http://invalid.local').origin) {
      issues.push({
        kind: 'requestfailed',
        message: `${request.method()} ${request.url()}: ${request.failure()?.errorText ?? 'failed'}`,
        url: request.url(),
      })
    }
  })
  page.on('response', (response) => {
    if (response.status() >= 400 && new URL(response.url()).origin === new URL(page.url() || 'http://invalid.local').origin) {
      issues.push({ kind: 'response', message: `${response.status()} ${response.url()}`, url: response.url() })
    }
  })

  return issues
}

export async function installDeterministicBrowserState(page: Page) {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('puff-intro-seen', '1')
    const install = () => {
      if (!document.documentElement) return
      document.documentElement.dataset.regression = 'true'
      if (document.querySelector('style[data-regression]')) return
      const style = document.createElement('style')
      style.dataset.regression = 'true'
      style.textContent = `
      *, *::before, *::after {
        animation-delay: 0s !important;
        animation-duration: 0s !important;
        animation-iteration-count: 1 !important;
        caret-color: transparent !important;
        scroll-behavior: auto !important;
        transition-delay: 0s !important;
        transition-duration: 0s !important;
      }
      .cursor-ring, .cursor-dot, .scroll-progress { visibility: hidden !important; }
      .reveal-block {
        opacity: 1 !important;
        transform: none !important;
        visibility: visible !important;
      }
      `
      document.documentElement.appendChild(style)
    }
    install()
    document.addEventListener('DOMContentLoaded', install, { once: true })
  })
}

export async function gotoReady(page: Page, path: string): Promise<Response> {
  const response = await page.goto(path, { waitUntil: 'domcontentloaded' })
  expect(response, `${path} should return a document response`).not.toBeNull()
  await expect(page.locator('#main-content')).toBeAttached()
  await expect(page.locator('.route-fallback')).toHaveCount(0)
  await expect(page.locator('[data-live-pending]')).toHaveCount(0)
  await page.evaluate(async () => {
    await document.fonts.ready
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  })
  return response!
}

export async function prepareVisual(page: Page, path: string, selector: string) {
  await installDeterministicBrowserState(page)
  await gotoReady(page, path)
  const desktop = (page.viewportSize()?.width ?? 0) >= 901
  const tallDesktopHomeSection = desktop && (selector === '.core-categories' || selector === '.collection')
  const tallBlogSection = selector === '.blog-page'
  if (selector === '.finish-lab' || tallDesktopHomeSection || tallBlogSection) {
    // This section is taller than the desktop viewport. Chromium tiles its
    // element screenshot and can paint the fixed header once per tile, which
    // makes the fixture depend on capture timing rather than page output.
    await page.addStyleTag({ content: `
      .site-header, .skip-link { visibility: hidden !important; }
      ${selector} .reveal-block {
        opacity: 1 !important;
        transform: none !important;
        visibility: visible !important;
      }
    ` })
  }
  if (tallBlogSection) {
    // The journal section spans several viewports. Freeze its scroll-driven
    // image layers and move the hidden cursor masks outside the capture so
    // Chromium cannot cull non-composited copy while tiling the screenshot.
    await page.addStyleTag({ content: `
      .blog-page .blog-feature__media img,
      .blog-page .blog-card__media img {
        transform: none !important;
      }
      .cursor-ring,
      .cursor-dot {
        transform: translate(-10000px, -10000px) !important;
      }
    ` })
  }
  if (desktop && selector === '.collection') {
    // The desktop product rail is pinned and scrubbed. Element screenshots
    // are taller than the viewport, so Chromium's internal tiling otherwise
    // advances ScrollTrigger and captures an arbitrary rail position. Collapse
    // only the generated pin geometry and freeze a documented progress-0
    // state for the screenshot; application motion and styles stay untouched.
    await page.addStyleTag({ content: `
      .collection .pin-spacer {
        position: relative !important;
        width: 100% !important;
        height: auto !important;
        min-height: 0 !important;
        padding: 0 !important;
        transform: none !important;
      }
      .collection .rail-wrap {
        position: relative !important;
        inset: auto !important;
        width: 100% !important;
        max-width: none !important;
        transform: none !important;
      }
      .collection .product-rail,
      .collection .product-card {
        transform: none !important;
      }
      .collection .rail-progress span {
        transform: scaleX(0) !important;
      }
    ` })
  }
  const target = page.locator(selector).first()
  await expect(target).toBeVisible()
  await target.scrollIntoViewIfNeeded()
  await page.evaluate(async (targetSelector) => {
    document.querySelectorAll<HTMLImageElement>('img').forEach((image) => { image.loading = 'eager' })
    const targetElement = document.querySelector<HTMLElement>(targetSelector)
    const targetImages = targetElement ? [...targetElement.querySelectorAll<HTMLImageElement>('img')] : []
    await Promise.all(targetImages.map(async (image) => {
      if (!image.complete) {
        await new Promise<void>((resolve) => {
          const timeout = window.setTimeout(done, 5_000)
          function done() {
            window.clearTimeout(timeout)
            image.removeEventListener('load', done)
            image.removeEventListener('error', done)
            resolve()
          }
          image.addEventListener('load', done, { once: true })
          image.addEventListener('error', done, { once: true })
          if (image.complete) done()
        })
      }
      try { await image.decode() } catch { /* Broken local images fail in the smoke gate. */ }
    }))
    await document.fonts.ready
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  }, selector)
  await page.evaluate((targetSelector) => {
    const targetElement = document.querySelector<HTMLElement>(targetSelector)
    if (!targetElement) return
    const top = targetElement.getBoundingClientRect().top + window.scrollY
    window.scrollTo(0, Math.max(0, Math.round(top)))
    window.dispatchEvent(new Event('scroll'))
  }, selector)
  await page.waitForTimeout(100)
  return target
}

export async function attachRuntimeIssues(testInfo: TestInfo, issues: RuntimeIssue[]) {
  if (!issues.length) return
  await testInfo.attach('runtime-issues.json', {
    body: Buffer.from(JSON.stringify(issues, null, 2)),
    contentType: 'application/json',
  })
}
