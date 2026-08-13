import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright-core'
import { preview } from 'vite'

const root = process.cwd()
const dist = path.join(root, 'dist')
const edgePath = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const port = 4174
const baseUrl = `http://127.0.0.1:${port}`

const sitemap = await readFile(path.join(root, 'public', 'sitemap.xml'), 'utf8')
const canonicalPaths = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => new URL(match[1]).pathname)
const localPaths = ['/shop/', '/resources/', '/shipping-delivery/']
const routes = [...new Set([...canonicalPaths, ...localPaths])]

const server = await preview({
  root,
  logLevel: 'error',
  preview: { host: '127.0.0.1', port, strictPort: true },
})
const browser = await chromium.launch({ executablePath: edgePath, headless: true })
const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 900 } })
await context.addInitScript(() => window.sessionStorage.setItem('puff-intro-seen', '1'))

const failures = []
let completed = 0

async function renderRoute(route, page) {
  const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded', timeout: 20_000 })
  if (!response?.ok()) throw new Error(`HTTP ${response?.status() ?? 'unknown'}`)
  await page.waitForFunction(() => {
    const canonical = document.querySelector('link[rel="canonical"]')
    const current = window.location.pathname.replace(/\/+$/, '') || '/'
    const canonicalPath = canonical ? new URL(canonical.href).pathname.replace(/\/+$/, '') || '/' : ''
    return Boolean(
      document.querySelector('#main-content')
      && !document.querySelector('.route-fallback')
      && !document.querySelector('[data-live-pending]')
      && document.querySelector('#puff-structured-data')
      && canonicalPath === current,
    )
  }, undefined, { timeout: 15_000 })
  await page.evaluate(() => document.fonts.ready)
  const html = (await page.content()).replaceAll(`${baseUrl}/`, '/')
  if (!html.includes('<main id="main-content"') || !html.includes('rel="canonical"')) throw new Error('Incomplete HTML snapshot')

  const normalized = route.split('/').filter(Boolean)
  const destination = normalized.length ? path.join(dist, ...normalized, 'index.html') : path.join(dist, 'index.html')
  await mkdir(path.dirname(destination), { recursive: true })
  await writeFile(destination, html)
  completed += 1
}

const workerCount = Math.min(4, routes.length)
let nextRoute = 0
await Promise.all(Array.from({ length: workerCount }, async () => {
  const page = await context.newPage()
  page.on('pageerror', (error) => failures.push(`${page.url()}: ${error.message}`))
  while (nextRoute < routes.length) {
    const route = routes[nextRoute++]
    try {
      await renderRoute(route, page)
    } catch (error) {
      failures.push(`${route}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  await page.close()
}))

await context.close()
await browser.close()
await new Promise((resolve, reject) => server.httpServer.close((error) => error ? reject(error) : resolve()))

if (failures.length) {
  throw new Error(`Prerender failed:\n${failures.join('\n')}`)
}

console.log(`Prerendered ${completed} routes (${canonicalPaths.length} canonical + ${localPaths.length} local).`)
