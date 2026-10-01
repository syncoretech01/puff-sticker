import { expect, test, type Page } from '@playwright/test'

import { breakpoints } from './cases'
import { attachRuntimeIssues, gotoReady, installDeterministicBrowserState, observeRuntime } from './helpers'
import { allLocalRoutes } from './route-contract'
import { regressionEnvironment } from './environment'

const ABOUT_LEGACY_ASSET_HOST = 'pricom.harutheme.com'
const ABOUT_LEGACY_ASSET_COUNT = 16
const TRANSPARENT_PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)

async function installAboutLegacyAssetStubs(page: Page, path: string) {
  if (regressionEnvironment.profile !== 'vite' || path !== '/about-us/') return
  await page.route(`https://${ABOUT_LEGACY_ASSET_HOST}/**`, async (route) => {
    if (route.request().resourceType() !== 'image') {
      await route.fallback()
      return
    }
    await route.fulfill({ body: TRANSPARENT_PIXEL, contentType: 'image/png', status: 200 })
  })
}

function assertAboutLegacyAssets(path: string, externalImages: string[]) {
  if (path !== '/about-us/') return
  if (regressionEnvironment.profile === 'next') {
    expect(externalImages, 'Next must localize every protected About-page legacy image').toEqual([])
    return
  }

  expect(
    externalImages,
    `The protected Vite About page currently embeds exactly ${ABOUT_LEGACY_ASSET_COUNT} external legacy images`,
  ).toHaveLength(ABOUT_LEGACY_ASSET_COUNT)
  expect(new Set(externalImages.map((url) => new URL(url).hostname))).toEqual(new Set([ABOUT_LEGACY_ASSET_HOST]))
}

function baselineName(path: string, breakpoint: string) {
  const slug = path === '/' ? 'home' : path.split('/').filter(Boolean).join('--')
  if (regressionEnvironment.profile === 'next') {
    return `${slug}-next-current-${breakpoint}-structure.json`
  }
  return `${slug}-${breakpoint}-structure.json`
}

for (const breakpoint of breakpoints) {
  test.describe(`${breakpoint.name} complete route smoke`, () => {
    test.use({ viewport: { width: breakpoint.width, height: breakpoint.height } })

    for (const path of allLocalRoutes) {
      test(`${path} response, DOM, content, links, images, and overflow`, async ({ page }, testInfo) => {
        await installDeterministicBrowserState(page)
        await installAboutLegacyAssetStubs(page, path)
        const issues = observeRuntime(page)
        const response = await gotoReady(page, path)
        expect(response.status()).toBe(200)

        const audit = await page.evaluate(async () => {
          document.querySelectorAll<HTMLImageElement>('img').forEach((image) => { image.loading = 'eager' })
          await Promise.all([...document.images].map((image) => {
            if (image.complete) return Promise.resolve()
            return new Promise<void>((resolve) => {
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
          }))
          await document.fonts.ready
          await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))

          const main = document.querySelector<HTMLElement>('#main-content')!
          const isVisible = (element: Element) => element.getClientRects().length > 0
          const invalidLinks = [...main.querySelectorAll<HTMLAnchorElement>('a')]
            .filter(isVisible)
            .flatMap((anchor) => {
              const raw = anchor.getAttribute('href')?.trim()
              if (!raw) return []
              if (/^javascript:/i.test(raw)) return [raw]
              try { new URL(raw, window.location.href); return [] } catch { return [raw] }
            })
          const brokenImages = [...main.querySelectorAll<HTMLImageElement>('img')]
            .filter((image) => {
              const url = new URL(image.currentSrc || image.src, window.location.href)
              return url.origin === window.location.origin && (!image.complete || image.naturalWidth < 1)
            })
            .map((image) => image.currentSrc || image.src)
          const externalImages = [...new Set(
            [...main.querySelectorAll<HTMLImageElement>('img')]
              .map((image) => image.currentSrc || image.src)
              .filter((src) => new URL(src, window.location.href).origin !== window.location.origin),
          )]
          const headings = [...main.querySelectorAll<HTMLElement>('h1')].map((heading) => {
            const rect = heading.getBoundingClientRect()
            return {
              text: heading.textContent?.replace(/\s+/g, ' ').trim() ?? '',
              x: Math.round(rect.x),
              y: Math.round(rect.y + window.scrollY),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            }
          })
          const landmarks = [...main.children].map((element) => {
            const rect = element.getBoundingClientRect()
            return {
              element: element.tagName.toLowerCase(),
              id: element.id || null,
              className: typeof element.className === 'string' ? element.className : '',
              y: Math.round(rect.y + window.scrollY),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            }
          })
          return {
            contentLength: main.innerText.replace(/\s+/g, ' ').trim().length,
            documentWidth: document.documentElement.scrollWidth,
            viewportWidth: document.documentElement.clientWidth,
            invalidLinks,
            brokenImages,
            externalImages,
            headings,
            landmarks,
          }
        })

        expect(audit.contentLength).toBeGreaterThan(100)
        expect(audit.headings.length).toBeGreaterThanOrEqual(1)
        expect(audit.invalidLinks).toEqual([])
        expect(audit.brokenImages).toEqual([])
        assertAboutLegacyAssets(path, audit.externalImages)
        expect(audit.documentWidth - audit.viewportWidth).toBeLessThanOrEqual(1)
        expect(JSON.stringify({ headings: audit.headings, landmarks: audit.landmarks }, null, 2))
          .toMatchSnapshot(baselineName(path, breakpoint.name))

        await attachRuntimeIssues(testInfo, issues)
        expect(issues).toEqual([])
        if (regressionEnvironment.profile === 'vite' && path === '/about-us/') {
          await page.unroute(`https://${ABOUT_LEGACY_ASSET_HOST}/**`)
        }
      })
    }
  })
}
