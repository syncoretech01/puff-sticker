import { chromium } from 'playwright-core'

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  args: ['--disable-gpu'],
})

const issues = []
const mode = process.argv[2] ?? 'all'

async function inspect(name, viewport, targets) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  page.on('pageerror', (error) => issues.push(`${name} pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') issues.push(`${name} console: ${message.text()}`)
  })

  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
  await page.waitForSelector('.loader', { state: 'detached', timeout: 12_000 })
  await page.waitForTimeout(900)

  for (const target of targets) {
    if (target.selector) {
      await page.locator(target.selector).scrollIntoViewIfNeeded()
      await page.waitForTimeout(900)
    }
    await page.screenshot({ path: target.path, fullPage: Boolean(target.fullPage) })
  }

  const overflow = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }))
  if (overflow.documentWidth > overflow.viewportWidth + 2) {
    issues.push(`${name} horizontal overflow: ${overflow.documentWidth}px > ${overflow.viewportWidth}px`)
  }

  await page.close()
}

if (mode === 'all' || mode === 'desktop') {
  await inspect('desktop', { width: 1440, height: 1000 }, [
    { path: 'qa-desktop.png' },
    { selector: '#story', path: 'qa-story.png' },
    { selector: '#anatomy', path: 'qa-anatomy.png' },
    { selector: '.finish-lab', path: 'qa-finish.png' },
    { selector: '.closing', path: 'qa-closing.png' },
  ])
}

if (mode === 'all' || mode === 'mobile') {
  await inspect('mobile', { width: 390, height: 844 }, [
    { path: 'qa-mobile.png' },
    { selector: '#collection', path: 'qa-mobile-collection.png' },
    { selector: '#faq', path: 'qa-mobile-faq.png' },
  ])
}

await browser.close()

if (issues.length) {
  console.error(issues.join('\n'))
  process.exitCode = 1
} else {
  console.log('Visual QA completed with no runtime or overflow issues.')
}
