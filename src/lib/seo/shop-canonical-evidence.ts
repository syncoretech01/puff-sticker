import fixtureJson from './fixtures/production-shop-canonical-target-2026-08-21.json' with { type: 'json' }

export type ShopCanonicalTargetEvidence = {
  schemaVersion: 1
  source: 'production-query-sensitive-capture'
  capturedOn: '2026-08-21'
  requestedUrl: 'https://puffsticker.com/?page_id=9'
  redirectChain: readonly {
    url: string
    status: 200 | 301
    location: string | null
  }[]
  finalUrl: string
  finalObservation: {
    title: string
    description: string | null
    canonical: string
    robots: string
    meaningfulTextHash: string
    meaningfulWordCount: number
    headingsHash: string
    headings: readonly { level: 1 | 2 | 3 | 4 | 5 | 6; text: string }[]
  }
}

export const SHOP_CANONICAL_TARGET_EVIDENCE = fixtureJson as unknown as ShopCanonicalTargetEvidence
