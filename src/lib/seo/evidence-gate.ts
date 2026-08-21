import {
  CANONICALIZING_ALIAS_CONTRACTS,
  PRIMARY_ROUTE_CONTRACTS,
  type PageRouteContract,
} from './route-contract'
import {
  SITEMAP_ENDPOINT_EVIDENCE,
  SITEMAP_IMAGE_EVIDENCE_BLOCKERS,
} from './sitemap-contract'
import type { SeoSignal } from './evidence'

export type SeoEvidenceBlocker = {
  path: string
  signal: 'open-graph' | 'twitter' | 'structured-data' | 'content' | 'sitemap-images' | 'endpoint-body'
  reason: string
}

const productionPages = [
  ...PRIMARY_ROUTE_CONTRACTS.filter((route) => route.productionSignals.scope === 'production'),
  ...CANONICALIZING_ALIAS_CONTRACTS,
]

function pageBlockers(route: PageRouteContract): SeoEvidenceBlocker[] {
  const blockers: SeoEvidenceBlocker[] = []
  const fields = [
    ['open-graph', route.productionSignals.openGraph],
    ['twitter', route.productionSignals.twitter],
    ['structured-data', route.productionSignals.structuredData],
    ['content', route.productionSignals.content],
  ] as const
  for (const [signal, evidence] of fields) {
    if (evidence.state === 'not-captured') blockers.push({ path: route.path, signal, reason: evidence.reason })
  }
  return blockers
}

const endpointSignals = Object.entries(SITEMAP_ENDPOINT_EVIDENCE) as readonly [string, SeoSignal<unknown>][]
const endpointBlockers: SeoEvidenceBlocker[] = endpointSignals.flatMap(([name, evidence]) =>
  evidence.state === 'not-captured'
    ? [{
      path: name === 'locations' ? '/locations.kml' : `/${name}-sitemap.xml`,
      signal: 'endpoint-body' as const,
      reason: evidence.reason,
    }]
    : [],
)

export const PHASE_2_SEO_EVIDENCE_BLOCKERS: readonly SeoEvidenceBlocker[] = [
  ...productionPages.flatMap(pageBlockers),
  ...SITEMAP_IMAGE_EVIDENCE_BLOCKERS,
  ...endpointBlockers,
]

export const PHASE_2_SEO_EVIDENCE_READY = PHASE_2_SEO_EVIDENCE_BLOCKERS.length === 0

export function assertPhase2SeoEvidenceReady(): void {
  if (PHASE_2_SEO_EVIDENCE_READY) return
  const bySignal = new Map<string, number>()
  for (const blocker of PHASE_2_SEO_EVIDENCE_BLOCKERS) {
    bySignal.set(blocker.signal, (bySignal.get(blocker.signal) ?? 0) + 1)
  }
  const summary = [...bySignal].map(([signal, count]) => `${signal}=${count}`).join(', ')
  throw new Error(`Phase 2 SEO evidence gate is blocked (${summary}). Run the reviewed production capture before endpoint cutover.`)
}
