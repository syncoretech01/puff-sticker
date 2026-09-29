/**
 * Evidence values in this module describe what was actually captured from
 * production. They are deliberately separate from values inferred by the
 * local redesign or intended for the future Next.js target.
 */

export type SeoEvidenceSource =
  | 'production-crawl-2026-08-12'
  | 'production-crawl-2026-08-14'
  | 'production-crawl-2026-08-22'
  | 'production-crawl-2026-09-01'
  | 'production-http-capture-2026-08-31'
  | 'production-http-capture-2026-09-02'
  | 'approved-target-contract'

export type CapturedSignal<T> = {
  state: 'captured'
  value: T
  source: SeoEvidenceSource
  capturedOn: '2026-08-12' | '2026-08-14' | '2026-08-22' | '2026-08-31' | '2026-09-01' | '2026-09-02'
}

export type NotCapturedSignal = {
  state: 'not-captured'
  blocksPhase2: true
  reason: string
}

export type NotApplicableSignal = {
  state: 'not-applicable'
  reason: string
}

export type SeoSignal<T> = CapturedSignal<T> | NotCapturedSignal | NotApplicableSignal

export type ExactCoreMetadata = {
  title: string
  description: string | null
  canonical: string
  robots: string
}

export type ExactOpenGraphMetadata = {
  title: string | null
  description: string | null
  url: string | null
  image: string | null
  imageAlt: string | null
  type: 'website' | 'article' | 'product' | null
  all?: Readonly<Record<string, readonly string[]>>
  tags?: readonly { key: string; content: string }[]
}

export type ExactTwitterMetadata = {
  card: 'summary' | 'summary_large_image' | null
  title: string | null
  description: string | null
  image: string | null
  imageAlt: string | null
  site: string | null
  creator: string | null
  all?: Readonly<Record<string, readonly string[]>>
  tags?: readonly { key: string; content: string }[]
}

export type ExactStructuredDataSnapshot = {
  /** Stable, key-sorted JSON-LD scripts in DOM order. */
  normalizedGraphs: readonly Record<string, unknown>[]
  /** SHA-256 hashes of stable, key-sorted JSON-LD graphs in DOM order. */
  normalizedGraphHashes: readonly string[]
  types: readonly string[]
}

export type ExactContentSnapshot = {
  contentRootSelector: string
  meaningfulText: string
  meaningfulTextHash: string
  meaningfulWordCount: number
  headings: readonly { level: 1 | 2 | 3 | 4 | 5 | 6; text: string }[]
  headingsHash: string
  images: readonly { src: string; alt: string }[]
  imagesHash: string
  internalLinks: readonly string[]
  internalLinkDetails: readonly { href: string; text: string; rel: string }[]
  internalLinksHash: string
}

export type PageProductionSignals = {
  scope: 'production' | 'approved-target'
  coreMetadata: SeoSignal<ExactCoreMetadata>
  openGraph: SeoSignal<ExactOpenGraphMetadata>
  twitter: SeoSignal<ExactTwitterMetadata>
  structuredData: SeoSignal<ExactStructuredDataSnapshot>
  content: SeoSignal<ExactContentSnapshot>
}

export function capturedSignal<T>(
  value: T,
  source: SeoEvidenceSource,
  capturedOn: CapturedSignal<T>['capturedOn'],
): CapturedSignal<T> {
  return { state: 'captured', value, source, capturedOn }
}

export function notCaptured(reason: string): NotCapturedSignal {
  return { state: 'not-captured', blocksPhase2: true, reason }
}

export function notApplicable(reason: string): NotApplicableSignal {
  return { state: 'not-applicable', reason }
}
