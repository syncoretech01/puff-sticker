import { SITE_ORIGIN } from './route-contract'
import { productionEndpointEvidence } from './production-evidence-fixture'

/** Exact production robots.txt captured from puffsticker.com on 2026-08-14. */
export const PRODUCTION_ROBOTS_LINES = [
  'User-agent: *',
  'Disallow: /wp-content/uploads/wc-logs/',
  'Disallow: /wp-content/uploads/woocommerce_transient_files/',
  'Disallow: /wp-content/uploads/woocommerce_uploads/',
  'Disallow: /*?add-to-cart=',
  'Disallow: /*?*add-to-cart=',
  'Disallow: /wp-admin/',
  'Allow: /wp-admin/admin-ajax.php',
  '',
  `Sitemap: ${SITE_ORIGIN}/sitemap_index.xml`,
] as const

const robotsEvidence = productionEndpointEvidence('/robots.txt')
export const PRODUCTION_ROBOTS_TXT = robotsEvidence.body

if (PRODUCTION_ROBOTS_TXT !== `${PRODUCTION_ROBOTS_LINES.join('\n')}\n`) {
  throw new Error('Captured production robots.txt no longer matches its reviewed directive contract')
}

export const PRODUCTION_ROBOTS_EVIDENCE = {
  state: 'captured',
  source: 'production-crawl-2026-08-22',
  capturedOn: '2026-08-22',
  normalizedBodyHash: robotsEvidence.normalizedBodyHash,
} as const

export function robotsTxt(): string {
  return PRODUCTION_ROBOTS_TXT
}
