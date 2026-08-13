import { access, readFile, readdir, stat, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright-core'

const workspaceRoot = process.cwd()
const publicRoot = path.join(workspaceRoot, 'public')
const blogAssetRoot = path.join(publicRoot, 'assets', 'live', 'blog')
const contentPath = path.join(workspaceRoot, 'src', 'content', 'liveBlogContent.ts')
const keepOriginals = process.argv.includes('--keep-originals')
const requestedQuality = Number(process.argv.find((argument) => argument.startsWith('--quality='))?.split('=')[1] ?? 88)
if (!Number.isFinite(requestedQuality)) throw new Error('WebP quality must be a number between 50 and 100.')
const quality = Math.min(100, Math.max(50, requestedQuality)) / 100

const browserCandidates = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean)

async function exists(filePath) {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

async function findBrowserExecutable() {
  for (const candidate of browserCandidates) if (await exists(candidate)) return candidate
  throw new Error('No local Chromium browser was found. Set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH and run again.')
}

async function walkFiles(directory) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await walkFiles(entryPath)))
    else if (entry.isFile()) files.push(entryPath)
  }
  return files
}

const isInside = (parent, child) => {
  const relative = path.relative(path.resolve(parent), path.resolve(child))
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative)
}

const publicUrl = (filePath) => `/${path.relative(publicRoot, filePath).split(path.sep).join('/')}`
const localPath = (url) => path.join(publicRoot, ...url.replace(/^\//, '').split('/'))

const getAttribute = (tag, name) => {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, 'i'))
  return match?.[2]
}

const hasAttribute = (tag, name) => new RegExp(`\\b${name}\\s*=`, 'i').test(tag)

const addAttribute = (tag, name, value) => {
  if (hasAttribute(tag, name)) return tag
  return tag.replace(/\s*\/?\s*>$/, (ending) => ` ${name}="${value}"${ending}`)
}

const setAttribute = (tag, name, value) => {
  if (!hasAttribute(tag, name)) return addAttribute(tag, name, value)
  return tag.replace(new RegExp(`(\\b${name}\\s*=\\s*)(["'])(.*?)\\2`, 'i'), (_, prefix, quote) => `${prefix}${quote}${value}${quote}`)
}

const imageTags = (html) => [...html.matchAll(/<img\b[^>]*>/gi)].map((match) => match[0])
const contentOutsideImages = (html) => html.replace(/<img\b[^>]*>/gi, '<img>')

function parseGeneratedContent(source) {
  const match = source.match(/^([\s\S]*?export const liveBlogContent = )([\s\S]*)( as const\s*)$/)
  if (!match) throw new Error(`Could not parse ${path.relative(workspaceRoot, contentPath)}`)
  return { prefix: match[1], data: JSON.parse(match[2]) }
}

let browser
let page

async function browserPage() {
  if (page) return page
  const executablePath = await findBrowserExecutable()
  browser = await chromium.launch({ executablePath, headless: true })
  page = await browser.newPage()
  return page
}

async function inspectOrConvert(filePath, outputType) {
  const input = await readFile(filePath)
  const inputType = path.extname(filePath).slice(1).toLowerCase().replace('jpg', 'jpeg')
  const dataUrl = `data:image/${inputType};base64,${input.toString('base64')}`
  const activePage = await browserPage()

  return activePage.evaluate(
    async ({ dataUrl: source, outputType: type, quality: outputQuality }) => {
      const image = new Image()
      image.src = source
      await image.decode()

      if (!type) return { width: image.naturalWidth, height: image.naturalHeight }

      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const context = canvas.getContext('2d', { alpha: true })
      context.drawImage(image, 0, 0)
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((result) => (result ? resolve(result) : reject(new Error('Canvas conversion failed'))), type, outputQuality)
      })
      const encoded = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(blob)
      })
      return {
        width: image.naturalWidth,
        height: image.naturalHeight,
        dataUrl: encoded,
        mimeType: blob.type,
      }
    },
    { dataUrl, outputType, quality },
  )
}

async function transformImageTags(html, dimensionsByUrl) {
  let output = ''
  let cursor = 0
  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    output += html.slice(cursor, match.index)
    let tag = match[0]
    const src = getAttribute(tag, 'src')
    if (!src) throw new Error('An inline blog image is missing its src attribute.')

    let dimensions = dimensionsByUrl.get(src)
    if ((!hasAttribute(tag, 'width') || !hasAttribute(tag, 'height')) && !dimensions) {
      const filePath = localPath(src)
      if (!isInside(blogAssetRoot, filePath)) throw new Error(`Refusing to inspect an image outside the live blog folder: ${src}`)
      dimensions = await inspectOrConvert(filePath)
      dimensionsByUrl.set(src, dimensions)
    }

    if (!hasAttribute(tag, 'width')) tag = addAttribute(tag, 'width', String(dimensions.width))
    if (!hasAttribute(tag, 'height')) tag = addAttribute(tag, 'height', String(dimensions.height))
    tag = setAttribute(tag, 'loading', 'lazy')
    tag = setAttribute(tag, 'decoding', 'async')
    output += tag
    cursor = match.index + match[0].length
  }
  return output + html.slice(cursor)
}

async function totalBytes(files) {
  let bytes = 0
  for (const filePath of files) bytes += (await stat(filePath)).size
  return bytes
}

async function main() {
  if (!isInside(workspaceRoot, blogAssetRoot) || !isInside(workspaceRoot, contentPath)) {
    throw new Error('Resolved paths escaped the workspace; refusing to continue.')
  }

  const originalSource = await readFile(contentPath, 'utf8')
  const { prefix, data } = parseGeneratedContent(originalSource)
  const entries = Object.entries(data).map(([slug, content]) => ({ slug, content }))
  const originalHtml = new Map(entries.map(({ slug, content }) => [slug, content.html]))
  const originalAlts = new Map(entries.map(({ slug, content }) => [slug, imageTags(content.html).map((tag) => getAttribute(tag, 'alt') ?? '')]))
  const referencedUrls = new Set(entries.flatMap(({ content }) => imageTags(content.html).map((tag) => getAttribute(tag, 'src')).filter(Boolean)))

  const filesBefore = await walkFiles(blogAssetRoot)
  const bytesBefore = await totalBytes(filesBefore)
  const pngFiles = filesBefore.filter((filePath) => path.extname(filePath).toLowerCase() === '.png')
  const conversions = new Map()
  const dimensionsByUrl = new Map()
  const skipped = []

  for (const pngPath of pngFiles) {
    const fromUrl = publicUrl(pngPath)
    if (!referencedUrls.has(fromUrl)) {
      skipped.push({ src: fromUrl, reason: 'not referenced by liveBlogContent.ts' })
      continue
    }

    const result = await inspectOrConvert(pngPath, 'image/webp')
    const encoded = Buffer.from(result.dataUrl.slice(result.dataUrl.indexOf(',') + 1), 'base64')
    if (encoded.subarray(0, 4).toString('ascii') !== 'RIFF' || encoded.subarray(8, 12).toString('ascii') !== 'WEBP') {
      throw new Error(`Browser returned an invalid WebP for ${fromUrl}`)
    }

    const originalBytes = (await stat(pngPath)).size
    if (encoded.length >= originalBytes) {
      skipped.push({ src: fromUrl, reason: 'WebP was not smaller than the PNG' })
      continue
    }

    const webpPath = pngPath.replace(/\.png$/i, '.webp')
    if (!isInside(blogAssetRoot, webpPath)) throw new Error(`Refusing to write outside the live blog folder: ${webpPath}`)
    await writeFile(webpPath, encoded)
    const toUrl = publicUrl(webpPath)
    conversions.set(fromUrl, { fromUrl, toUrl, pngPath, webpPath, originalBytes, optimizedBytes: encoded.length })
    dimensionsByUrl.set(toUrl, { width: result.width, height: result.height })
  }

  for (const { slug, content } of entries) {
    let html = content.html
    for (const { fromUrl, toUrl } of conversions.values()) html = html.split(fromUrl).join(toUrl)
    content.html = await transformImageTags(html, dimensionsByUrl)

    if (contentOutsideImages(originalHtml.get(slug)) !== contentOutsideImages(content.html)) {
      throw new Error(`Non-image editorial HTML changed for ${slug}; refusing to write.`)
    }
    const altsAfter = imageTags(content.html).map((tag) => getAttribute(tag, 'alt') ?? '')
    if (JSON.stringify(originalAlts.get(slug)) !== JSON.stringify(altsAfter)) {
      throw new Error(`Image alt text changed for ${slug}; refusing to write.`)
    }
  }

  const outputSource = `${prefix}${JSON.stringify(data, null, 2)} as const\n`
  const outputImages = entries.flatMap(({ content }) => imageTags(content.html))
  for (const tag of outputImages) {
    const src = getAttribute(tag, 'src')
    if (!src || !src.startsWith('/assets/live/blog/')) throw new Error(`Unexpected blog image source: ${src || '(missing)'}`)
    const filePath = localPath(src)
    if (!isInside(blogAssetRoot, filePath) || !(await exists(filePath))) throw new Error(`Referenced image does not exist: ${src}`)
    for (const attribute of ['width', 'height', 'loading', 'decoding']) {
      if (!hasAttribute(tag, attribute)) throw new Error(`${src} is missing ${attribute}`)
    }
  }

  await writeFile(contentPath, outputSource, 'utf8')

  if (!keepOriginals) {
    for (const conversion of conversions.values()) {
      if (outputSource.includes(conversion.fromUrl)) throw new Error(`Original PNG is still referenced: ${conversion.fromUrl}`)
      if (!isInside(blogAssetRoot, conversion.pngPath) || !(await exists(conversion.webpPath))) {
        throw new Error(`Deletion safety check failed for ${conversion.fromUrl}`)
      }
      await unlink(conversion.pngPath)
    }
  }

  const filesAfter = await walkFiles(blogAssetRoot)
  const bytesAfter = await totalBytes(filesAfter)
  const converted = [...conversions.values()].map(({ fromUrl, toUrl, originalBytes, optimizedBytes }) => ({
    from: fromUrl,
    to: toUrl,
    originalBytes,
    optimizedBytes,
    savedBytes: originalBytes - optimizedBytes,
  }))

  console.log(
    JSON.stringify(
      {
        quality: requestedQuality,
        keepOriginals,
        inlineImagesVerified: outputImages.length,
        convertedCount: converted.length,
        convertedBytesBefore: converted.reduce((sum, item) => sum + item.originalBytes, 0),
        convertedBytesAfter: converted.reduce((sum, item) => sum + item.optimizedBytes, 0),
        folderBytesBefore: bytesBefore,
        folderBytesAfter: bytesAfter,
        folderBytesSaved: bytesBefore - bytesAfter,
        converted,
        skipped,
      },
      null,
      2,
    ),
  )
}

try {
  await main()
} finally {
  if (browser) await browser.close()
}
