import { expect, test, type Locator, type Page } from '@playwright/test'

import {
  PRIMARY_ROUTE_CONTRACTS,
  type PageRouteContract,
} from '../../src/lib/seo/index'
import { regressionEnvironment } from './environment'
import {
  gotoReady,
  installDeterministicBrowserState,
  observeRuntime,
} from './helpers'

const HOME = primaryRoute('/')
const ABOUT = primaryRoute('/about-us')
const CONTACT = primaryRoute('/contact-us')
const PUFFY_CATEGORY = primaryRoute('/puffy-labels-stickers')
const PUFFY_PRODUCT = primaryRoute('/puffy-labels-stickers/puffy-stickers')
const QUOTE = primaryRoute('/request-a-quote')
const DOCUMENT_MARKER = 'puff-next-client-navigation'

type LifecycleSnapshot = {
  listeners: Record<string, number>
  pendingRafCallbacks: number
  pendingRafRequests: number
}

function primaryRoute(path: string): PageRouteContract {
  const route = PRIMARY_ROUTE_CONTRACTS.find((candidate) => candidate.path === path)
  if (!route) throw new Error(`Missing primary route contract for ${path}`)
  return route
}

async function markDocument(page: Page) {
  await page.evaluate((marker) => {
    const markedWindow = window as typeof window & { __puffNavigationMarker?: string }
    markedWindow.__puffNavigationMarker = marker
    document.documentElement.dataset.puffNavigationMarker = marker
  }, DOCUMENT_MARKER)
}

async function expectSameDocument(page: Page) {
  await expect.poll(() => page.evaluate((marker) => {
    const markedWindow = window as typeof window & { __puffNavigationMarker?: string }
    return {
      marker: markedWindow.__puffNavigationMarker,
      dataset: document.documentElement.dataset.puffNavigationMarker,
      navigationEntries: performance.getEntriesByType('navigation').length,
    }
  }, DOCUMENT_MARKER)).toEqual({
    marker: DOCUMENT_MARKER,
    dataset: DOCUMENT_MARKER,
    navigationEntries: 1,
  })
}

async function expectRoute(page: Page, route: PageRouteContract, h1: string | RegExp) {
  await expect.poll(() => new URL(page.url()).pathname).toBe(route.publicPath)
  await expect(page.locator('#main-content .route-fallback')).toHaveCount(0)
  await expect(page.locator('main h1').first()).toHaveAccessibleName(h1)
  await expect(page).toHaveTitle(route.metadata.title)
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(1)
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', route.metadata.canonical)
  const descriptions = await page.locator('meta[name="description"]').evaluateAll((elements) =>
    elements.map((element) => element.getAttribute('content')),
  )
  expect(descriptions).toEqual(route.metadata.description === null ? [] : [route.metadata.description])
}

async function clickRoute(page: Page, link: Locator, route: PageRouteContract, h1: string | RegExp) {
  await link.click()
  await expectRoute(page, route, h1)
  await expectSameDocument(page)
}

async function installLoaderObserver(page: Page) {
  await page.evaluate(() => {
    const loaderWindow = window as typeof window & {
      __puffLoaderInsertions?: number
      __puffVisibleLoaderInsertions?: number
      __puffLoaderObserver?: MutationObserver
    }
    loaderWindow.__puffLoaderInsertions = 0
    loaderWindow.__puffVisibleLoaderInsertions = 0
    loaderWindow.__puffLoaderObserver?.disconnect()
    loaderWindow.__puffLoaderObserver = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (!(node instanceof Element)) continue
          const loader = node.matches('.loader') ? node : node.querySelector('.loader')
          if (!(loader instanceof HTMLElement)) continue
          loaderWindow.__puffLoaderInsertions! += 1
          const style = getComputedStyle(loader)
          if (style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0 && loader.getClientRects().length) {
            loaderWindow.__puffVisibleLoaderInsertions! += 1
          }
        }
      }
    })
    loaderWindow.__puffLoaderObserver.observe(document.documentElement, { childList: true, subtree: true })
  })
}

async function loaderInsertions(page: Page) {
  return page.evaluate(() => {
    const loaderWindow = window as typeof window & {
      __puffLoaderInsertions?: number
      __puffVisibleLoaderInsertions?: number
    }
    return {
      total: loaderWindow.__puffLoaderInsertions ?? -1,
      visible: loaderWindow.__puffVisibleLoaderInsertions ?? -1,
    }
  })
}

async function installLifecycleProbe(page: Page) {
  await page.addInitScript(() => {
    const trackedTypes = new Set([
      'visibilitychange',
      'pointermove',
      'scroll',
      'wheel',
      'touchstart',
      'touchmove',
      'popstate',
      'hashchange',
      'puff:navigate',
    ])
    const activeListeners = new Map<string, Set<EventListenerOrEventListenerObject>>()
    const targetName = (target: EventTarget) => {
      if (target === window) return 'window'
      if (target === document) return 'document'
      if (target === document.documentElement) return 'html'
      if (target === document.body) return 'body'
      return target.constructor.name
    }
    const originalAdd = EventTarget.prototype.addEventListener
    const originalRemove = EventTarget.prototype.removeEventListener
    EventTarget.prototype.addEventListener = function addEventListener(type, listener, options) {
      if (listener && trackedTypes.has(type)) {
        const key = `${targetName(this)}:${type}`
        const listeners = activeListeners.get(key) ?? new Set<EventListenerOrEventListenerObject>()
        listeners.add(listener)
        activeListeners.set(key, listeners)
      }
      return originalAdd.call(this, type, listener, options)
    }
    EventTarget.prototype.removeEventListener = function removeEventListener(type, listener, options) {
      if (listener && trackedTypes.has(type)) activeListeners.get(`${targetName(this)}:${type}`)?.delete(listener)
      return originalRemove.call(this, type, listener, options)
    }

    const originalRequestAnimationFrame = window.requestAnimationFrame.bind(window)
    const originalCancelAnimationFrame = window.cancelAnimationFrame.bind(window)
    const pendingRaf = new Map<number, FrameRequestCallback>()
    window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      let id = 0
      id = originalRequestAnimationFrame((time) => {
        pendingRaf.delete(id)
        callback(time)
      })
      pendingRaf.set(id, callback)
      return id
    }) as typeof window.requestAnimationFrame
    window.cancelAnimationFrame = ((id: number) => {
      pendingRaf.delete(id)
      originalCancelAnimationFrame(id)
    }) as typeof window.cancelAnimationFrame

    const probeWindow = window as typeof window & {
      __puffLifecycleSnapshot?: () => LifecycleSnapshot
      __puffPopstateCount?: number
    }
    probeWindow.__puffPopstateCount = 0
    originalAdd.call(window, 'popstate', () => {
      probeWindow.__puffPopstateCount = (probeWindow.__puffPopstateCount ?? 0) + 1
    })
    probeWindow.__puffLifecycleSnapshot = () => ({
      listeners: Object.fromEntries(
        [...activeListeners.entries()]
          .filter(([, listeners]) => listeners.size > 0)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, listeners]) => [key, listeners.size]),
      ),
      pendingRafCallbacks: new Set(pendingRaf.values()).size,
      pendingRafRequests: pendingRaf.size,
    })
  })
}

async function navigationSnapshot(page: Page, responseStatus: number | null) {
  return page.evaluate((status) => {
    const probeWindow = window as typeof window & { __puffPopstateCount?: number }
    return {
      pathname: window.location.pathname,
      historyLength: window.history.length,
      historyState: window.history.state,
      popstateCount: probeWindow.__puffPopstateCount ?? -1,
      responseStatus: status,
    }
  }, responseStatus)
}

async function lifecycleSnapshot(page: Page): Promise<LifecycleSnapshot> {
  return page.evaluate(() => {
    const snapshot = (window as typeof window & {
      __puffLifecycleSnapshot?: () => LifecycleSnapshot
    }).__puffLifecycleSnapshot
    if (!snapshot) throw new Error('Lifecycle probe was not installed')
    return snapshot()
  })
}

test.describe('Next client navigation parity', () => {
  test.skip(regressionEnvironment.profile !== 'next', 'The protected Vite SPA keeps its existing navigation assertions.')
  test.use({ reducedMotion: 'reduce', viewport: { width: 1440, height: 1000 } })

  test('updates URL, route content, head signals, focus, and scroll without a document reload', async ({ page }) => {
    await installDeterministicBrowserState(page)
    await gotoReady(page, HOME.publicPath)
    await markDocument(page)
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(500)

    await clickRoute(page, page.locator('.desktop-nav a[href="/about-us"]'), ABOUT, /feel/i)
    await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBeLessThanOrEqual(1)
    await expect.poll(() => page.evaluate(() => document.activeElement?.id ?? '')).toBe('main-content')
  })

  test('preserves query-driven content and cross-route hash scrolling', async ({ page }) => {
    await installDeterministicBrowserState(page)
    await gotoReady(page, PUFFY_PRODUCT.publicPath)
    await markDocument(page)

    await page.locator('.product-detail a[href="/request-a-quote?product=puffy-stickers"]').click()
    await expectRoute(page, QUOTE, /clear brief/i)
    await expect.poll(() => new URL(page.url()).search).toBe('?product=puffy-stickers')
    await expect(page.locator('.quote-summary')).toContainText('Puffy Stickers')
    await expectSameDocument(page)

    await page.locator('.desktop-nav a[href="/#process"]').click()
    await expectRoute(page, HOME, /make your mark/i)
    await expect.poll(() => new URL(page.url()).hash).toBe('#process')
    await expect.poll(() => page.evaluate(() => {
      const target = document.getElementById('process')
      return target ? Math.round(target.getBoundingClientRect().top) : -1
    })).toBeGreaterThanOrEqual(0)
    await expect.poll(() => page.evaluate(() => {
      const target = document.getElementById('process')
      return target ? Math.round(target.getBoundingClientRect().top) : 10_000
    })).toBeLessThanOrEqual(160)
    await expectSameDocument(page)
  })

  test('back and forward restore route content and authoritative head state in place', async ({ page }) => {
    await installDeterministicBrowserState(page)
    await gotoReady(page, ABOUT.publicPath)
    await markDocument(page)
    await clickRoute(page, page.locator('.desktop-nav a[href="/contact-us"]'), CONTACT, /direct line/i)

    await page.goBack()
    await expectRoute(page, ABOUT, /feel/i)
    await expectSameDocument(page)

    await page.goForward()
    await expectRoute(page, CONTACT, /direct line/i)
    await expectSameDocument(page)
  })

  test('server HTML remains usable with JavaScript disabled and never exposes the loader', async ({ browser }) => {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      reducedMotion: 'no-preference',
      viewport: { width: 1440, height: 1000 },
    })
    const page = await context.newPage()

    try {
      const response = await page.goto(HOME.publicPath, { waitUntil: 'domcontentloaded' })
      expect(response?.status()).toBe(200)
      await expectRoute(page, HOME, /make your mark/i)
      await expect(page.locator('#main-content')).toBeVisible()
      await expect(page.locator('.loader')).not.toBeVisible()
    } finally {
      await context.close()
    }
  })

  test.describe('normal-motion lifecycle', () => {
    test.use({ reducedMotion: 'no-preference' })

    test('the entrance loader completes once and never replays during client routes', async ({ page }) => {
      await page.addInitScript(() => window.sessionStorage.removeItem('puff-intro-seen'))
      const issues = observeRuntime(page)
      const response = await page.goto(HOME.publicPath, { waitUntil: 'commit' })
      expect(response?.status()).toBe(200)
      await expect(page.locator('.loader')).toBeVisible({ timeout: 3_000 })
      await page.waitForLoadState('domcontentloaded')
      await expect(page.locator('.loader')).toHaveCount(0, { timeout: 5_000 })
      await markDocument(page)
      await installLoaderObserver(page)

      await clickRoute(page, page.locator('.desktop-nav a[href="/about-us"]'), ABOUT, /feel/i)
      await clickRoute(page, page.locator('a.brand'), HOME, /make your mark/i)
      await page.waitForTimeout(250)
      expect((await loaderInsertions(page)).visible).toBe(0)
      await expect(page.locator('.loader')).not.toBeVisible()

      await page.reload({ waitUntil: 'domcontentloaded' })
      await expect(page.locator('#main-content')).toBeVisible()
      await expect(page.locator('.loader')).not.toBeVisible()
      await expect(page.locator('.loader')).toHaveCount(0, { timeout: 5_000 })
      expect(issues).toEqual([])
    })

    test('repeated route loops keep one motion lifecycle and preserve hero, rail, reveal, and cursor behavior', async ({ page }) => {
      await page.addInitScript(() => window.sessionStorage.setItem('puff-intro-seen', '1'))
      await installLifecycleProbe(page)
      const issues = observeRuntime(page)
      await gotoReady(page, HOME.publicPath)
      await markDocument(page)
      await expect(page.locator('.cursor-ring')).toHaveCount(1)
      await expect(page.locator('.cursor-dot')).toHaveCount(1)
      await expect.poll(() => page.locator('.hero__world canvas, .hero__world .world-fallback img').count()).toBeGreaterThan(0)
      expect(await page.locator('.hero__world canvas').count()).toBeLessThanOrEqual(1)
      await expect(page.locator('.collection .pin-spacer')).toHaveCount(1)
      await expect(page.locator('.collection .pin-spacer .pin-spacer')).toHaveCount(0)
      await page.waitForTimeout(400)
      const baseline = await lifecycleSnapshot(page)
      const remountSnapshots: LifecycleSnapshot[] = []

      for (let iteration = 0; iteration < 2; iteration += 1) {
        await test.step(`route lifecycle iteration ${iteration + 1}`, async () => {
          await clickRoute(page, page.locator('.desktop-nav a[href="/shop"]'), primaryRoute('/shop'), /custom products/i)
          await expect(page.locator('.collection .pin-spacer')).toHaveCount(0)
          await page.locator('.catalog-card__media').first().click()
          await expectRoute(page, PUFFY_PRODUCT, /puffy stickers/i)
          await expectSameDocument(page)
          await expect(page.locator('.collection .pin-spacer')).toHaveCount(0)
          const backResponse = await page.goBack()
          await expect.poll(
            () => navigationSnapshot(page, backResponse?.status() ?? null),
            { message: `browser back must restore /shop/ during iteration ${iteration + 1}` },
          ).toMatchObject({ pathname: primaryRoute('/shop').publicPath })
          await expectRoute(page, primaryRoute('/shop'), /custom products/i)
          await expectSameDocument(page)
          await clickRoute(page, page.locator('a.brand'), HOME, /make your mark/i)
          await expect(page.locator('.collection .pin-spacer')).toHaveCount(1)
          await expect(page.locator('.collection .pin-spacer .pin-spacer')).toHaveCount(0)
          await expect.poll(() => page.locator('.hero__world canvas, .hero__world .world-fallback img').count()).toBeGreaterThan(0)
          await page.waitForTimeout(500)
          remountSnapshots.push(await lifecycleSnapshot(page))
        })
      }

      const [warmed, settled] = remountSnapshots
      expect(settled.listeners).toEqual(warmed.listeners)
      for (const [key, count] of Object.entries(settled.listeners)) {
        if (!key.startsWith('window:') && !key.startsWith('document:')) continue
        const coldCount = baseline.listeners[key] ?? 0
        const remountAllowance = key === 'window:touchstart' ? 1 : 0
        expect(count, `${key} must not accumulate across a home remount`).toBeLessThanOrEqual(coldCount + remountAllowance)
      }
      expect(settled.pendingRafCallbacks).toBeLessThanOrEqual(warmed.pendingRafCallbacks + 1)
      expect(settled.pendingRafRequests).toBeLessThanOrEqual(warmed.pendingRafRequests + 1)
      await expect(page.locator('.loader')).toHaveCount(0)
      await expect(page.locator('.cursor-ring')).toHaveCount(1)
      await expect(page.locator('.cursor-dot')).toHaveCount(1)
      expect(await page.locator('.hero__world canvas').count()).toBeLessThanOrEqual(1)

      const category = page.locator('.core-category').first()
      await category.scrollIntoViewIfNeeded()
      await expect(category).toBeVisible()
      await expect(page.locator('.core-categories__heading')).toBeVisible()
      await category.hover({ position: { x: 40, y: 40 } })
      await expect(page.locator('.cursor-ring')).toHaveClass(/cursor-ring--active/)
      await expect(page.locator('.cursor-ring span')).toHaveText('VIEW')

      const rail = page.locator('.product-rail')
      const before = await rail.evaluate((element) => getComputedStyle(element).transform)
      await page.locator('.collection').scrollIntoViewIfNeeded()
      await page.mouse.wheel(0, 900)
      await expect.poll(() => rail.evaluate((element) => getComputedStyle(element).transform)).not.toBe(before)
      expect(issues).toEqual([])
    })
  })
})
