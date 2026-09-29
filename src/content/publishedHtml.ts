export type PublishedFaq = {
  question: string
  answerHtml: string
}

const voidElements = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'])

function decodeHtmlText(value: string): string {
  const named: Readonly<Record<string, string>> = {
    amp: '&', apos: "'", gt: '>', hellip: '…', laquo: '«', ldquo: '“', lsquo: '‘', lt: '<', mdash: '—', nbsp: ' ', ndash: '–',
    quot: '"', raquo: '»', rdquo: '”', rsquo: '’', middot: '·',
  }
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, token: string) => {
    if (token[0] !== '#') return named[token.toLowerCase()] ?? entity
    const hexadecimal = token[1]?.toLowerCase() === 'x'
    const codePoint = Number.parseInt(token.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10)
    return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity
  })
}

function textContent(html: string): string {
  return decodeHtmlText(html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
}

export function publishedPlainText(html: string): string {
  return textContent(html)
}

function elementName(html: string): string {
  return html.match(/^<\s*([a-z][\w:-]*)/i)?.[1].toLowerCase() ?? ''
}

/**
 * Returns the same element-level sequence that `document.body.children`
 * exposes, without requiring a browser DOM during the server render.
 */
function topLevelElements(html: string): string[] {
  const elements: string[] = []
  const tags = /<!--[\s\S]*?-->|<\/?([a-z][\w:-]*)\b[^>]*>/gi
  let depth = 0
  let elementStart = -1
  let match: RegExpExecArray | null

  while ((match = tags.exec(html))) {
    if (match[0].startsWith('<!--')) continue
    const name = match[1]?.toLowerCase()
    if (!name) continue
    const closing = /^<\s*\//.test(match[0])
    const selfClosing = /\/\s*>$/.test(match[0]) || voidElements.has(name)

    if (!closing) {
      if (depth === 0) elementStart = match.index
      if (!selfClosing) depth += 1
      else if (depth === 0 && elementStart >= 0) {
        elements.push(html.slice(elementStart, tags.lastIndex))
        elementStart = -1
      }
      continue
    }

    if (depth > 0) depth -= 1
    if (depth === 0 && elementStart >= 0) {
      elements.push(html.slice(elementStart, tags.lastIndex))
      elementStart = -1
    }
  }

  return elements
}

function cleanQuestion(value: string): string {
  return textContent(value).replace(/^\s*[.·-]\s*/, '').replace(/\s+/g, ' ').trim()
}

function questionFromParagraph(element: string): string | null {
  if (elementName(element) !== 'p') return null
  const anchor = element.match(/<a(?:\s[^>]*)?>([\s\S]*?)<\/a>/i)
  if (!anchor) return null
  const question = cleanQuestion(anchor[1])
  return question && cleanQuestion(element) === question ? question : null
}

export function extractPublishedFaqs(html: string | undefined): PublishedFaq[] {
  if (!html) return []
  const elements = topLevelElements(html)
  return elements.flatMap((element, index) => {
    if (elementName(element) !== 'a') return []
    const answer = elements[index + 1]
    const question = cleanQuestion(element)
    if (!question || !answer || !['p', 'ul', 'ol'].includes(elementName(answer))) return []
    return [{ question, answerHtml: answer }]
  })
}

export function splitPublishedProductFaqs(html: string | undefined): { guideHtml: string; faqs: PublishedFaq[] } {
  if (!html) return { guideHtml: '', faqs: [] }
  const elements = topLevelElements(html)
  const headings = elements
    .map((element, index) => ({ element, index, name: elementName(element), text: textContent(element) }))
    .filter(({ name }) => /^h[1-6]$/.test(name))
  const selectedHeading = [...headings].reverse().find(({ text }) => /check out our frequently asked questions/i.test(text))
    ?? [...headings].reverse().find(({ text }) => /frequently asked questions/i.test(text))
  if (!selectedHeading) return { guideHtml: html, faqs: [] }

  let boundaryIndex = selectedHeading.index
  while (boundaryIndex > 0) {
    const previous = elements[boundaryIndex - 1]
    if (!/^h[1-6]$/.test(elementName(previous)) || !/frequently asked questions|faqs?/i.test(textContent(previous))) break
    boundaryIndex -= 1
  }

  const questions = elements
    .map((element, index) => ({ index, question: index > selectedHeading.index ? questionFromParagraph(element) : null }))
    .filter((entry): entry is { index: number; question: string } => Boolean(entry.question))
  const faqs = questions.flatMap(({ index, question }) => {
    const answerElements: string[] = []
    for (let cursor = index + 1; cursor < elements.length; cursor += 1) {
      if (questionFromParagraph(elements[cursor]) || /^h[1-6]$/.test(elementName(elements[cursor]))) break
      answerElements.push(elements[cursor])
    }
    return answerElements.length ? [{ question, answerHtml: answerElements.join('') }] : []
  })

  return {
    guideHtml: elements.slice(0, boundaryIndex).join(''),
    faqs,
  }
}

/** Mirrors the protected homepage transform: remove legacy images and wrap
 * meaningful root text nodes in paragraphs while retaining nested markup. */
function deactivateLegacyActionLinks(html: string): string {
  return html.replace(/<a\b[^>]*>/gi, (openingTag) => {
    const href = openingTag.match(/\s+href=(['"])(.*?)\1/i)
    if (!href || !/(?:^|\/)wp-json\/|(?:^|\/)wp-admin\/admin-ajax\.php|(?:^|\/)author\/taby\/?(?:[?#]|$)/i.test(href[2])) return openingTag
    return openingTag.replace(href[0], '')
  })
}

export function stripPricomDemoImages(html: string): string {
  return html.replace(/<img\b[^>]*\bsrc=(['"])(?:https?:)?\/\/pricom\.harutheme\.com\/[^>]*>/gi, '')
}

export function sanitizePublishedHomeHtml(html: string, deactivateLegacyLinks = false): string {
  const withoutImages = html.replace(/<img\b[^>]*>/gi, '')
  const tags = /<!--[\s\S]*?-->|<\/?([a-z][\w:-]*)\b[^>]*>/gi
  let depth = 0
  let cursor = 0
  let output = ''
  let match: RegExpExecArray | null

  const appendText = (value: string) => {
    if (depth === 0 && value.trim()) output += `<p>${value.replace(/\s+/g, ' ').trim()}</p>`
    else output += value
  }

  while ((match = tags.exec(withoutImages))) {
    appendText(withoutImages.slice(cursor, match.index))
    output += match[0]
    cursor = tags.lastIndex
    if (match[0].startsWith('<!--')) continue
    const name = match[1]?.toLowerCase()
    if (!name) continue
    if (/^<\s*\//.test(match[0])) depth = Math.max(0, depth - 1)
    else if (!voidElements.has(name) && !/\/\s*>$/.test(match[0])) depth += 1
  }
  appendText(withoutImages.slice(cursor))
  return deactivateLegacyLinks ? deactivateLegacyActionLinks(output) : output
}
