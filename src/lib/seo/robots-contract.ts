import { SITE_ORIGIN } from './route-contract'
import { productionEndpointEvidence } from './production-evidence-fixture'

/** Exact production robots.txt captured from puffsticker.com on 2026-09-30. */
export const PRODUCTION_ROBOTS_LINES = [
  'User-agent: *',
  'Allow: /',
  '',
  '# WordPress internals the old site exposed. Nothing here exists now.',
  'Disallow: /wp-admin/',
  'Disallow: /wp-content/',
  '',
  `Sitemap: ${SITE_ORIGIN}/sitemap.xml`,
] as const

const robotsEvidence = productionEndpointEvidence('/robots.txt')
export const PRODUCTION_ROBOTS_TXT = robotsEvidence.body

if (PRODUCTION_ROBOTS_TXT !== `${PRODUCTION_ROBOTS_LINES.join('\n')}\n`) {
  throw new Error('Captured production robots.txt no longer matches its reviewed directive contract')
}

export const PRODUCTION_ROBOTS_EVIDENCE = {
  state: 'captured',
  source: 'production-crawl-2026-09-30',
  capturedOn: '2026-09-30',
  normalizedBodyHash: robotsEvidence.normalizedBodyHash,
} as const

export function robotsTxt(): string {
  return PRODUCTION_ROBOTS_TXT
}
