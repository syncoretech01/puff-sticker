import { writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const siteUrl = 'https://puffsticker.com'
const pagePaths = [
  '/faqs',
  '/puffy-labels-stickers/pu-embossed-stickers',
  '/flat-labels-stickers/bottle-labels',
  '/flat-labels-stickers/bumper-stickers',
  '/flat-labels-stickers/cheap-stickers',
  '/flat-labels-stickers/clear-vinyl-labels',
  '/flat-labels-stickers/custom-stickers',
  '/flat-labels-stickers/metallic-foil-stickers',
  '/promotional-items/jute-bag',
  '/promotional-items/eco-friendly-kraft-mylar-bags',
  '/promotional-items/non-woven-bag',
  '/promotional-items/nylon-bag',
  '/promotional-items/paper-bag',
  '/promotional-items/washable-paper-bags',
  '/promotional-items/woven-bags',
  '/puffy-labels-stickers/3d-labels',
  '/puffy-labels-stickers/dome-decals',
  '/puffy-labels-stickers/epoxy-stickers',
  '/puffy-labels-stickers/foam-stickers',
  '/puffy-labels-stickers/puffy-stickers',
  '/puffy-labels-stickers/puffy-sticker-sheets',
  '/flat-labels-stickers/holographic-stickers',
]

const hasType = (value, type) => (Array.isArray(value?.['@type']) ? value['@type'] : [value?.['@type']]).includes(type)

function findType(value, type, output = []) {
  if (Array.isArray(value)) value.forEach((item) => findType(item, type, output))
  else if (value && typeof value === 'object') {
    if (hasType(value, type)) output.push(value)
    Object.values(value).forEach((item) => findType(item, type, output))
  }
  return output
}

function structuredData(html) {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
  return scripts.flatMap((match) => {
    try { return [JSON.parse(match[1])] } catch { return [] }
  })
}

async function fetchFaq(pathname) {
  const response = await fetch(`${siteUrl}${pathname}/`, { headers: { 'user-agent': 'PuffSticker SEO migration verifier' } })
  if (!response.ok) throw new Error(`${response.status} ${pathname}`)
  const faq = structuredData(await response.text()).flatMap((entry) => findType(entry, 'FAQPage'))[0]
  if (!faq?.mainEntity?.length) throw new Error(`FAQ schema missing for ${pathname}`)
  return faq.mainEntity.map((question) => ({
    question: question.name,
    answer: question.acceptedAnswer?.text || '',
  }))
}

const faqByPath = {}
for (const pathname of pagePaths) faqByPath[pathname] = await fetchFaq(pathname)

if (faqByPath['/faqs'].length !== 24) throw new Error(`Expected 24 FAQ-page entries, found ${faqByPath['/faqs'].length}`)
if (Object.keys(faqByPath).length !== 22) throw new Error(`Expected 22 FAQ-bearing routes, found ${Object.keys(faqByPath).length}`)
for (const [pathname, items] of Object.entries(faqByPath)) {
  if (!items.every((item) => item.question && item.answer)) throw new Error(`Incomplete FAQ entry on ${pathname}`)
}

const source = `export type ExactFaqItem = {\n  question: string\n  answer: string\n}\n\n// Exact published FAQ schema copy captured from PuffSticker's canonical pages.\nexport const exactFaqByPath: Readonly<Record<string, readonly ExactFaqItem[]>> = ${JSON.stringify(faqByPath, null, 2)} as const\n`
await writeFile(path.join(root, 'src', 'content', 'liveFaqSchema.ts'), source, 'utf8')
console.log(JSON.stringify({ routes: Object.keys(faqByPath).length, questions: Object.values(faqByPath).reduce((total, items) => total + items.length, 0) }, null, 2))
