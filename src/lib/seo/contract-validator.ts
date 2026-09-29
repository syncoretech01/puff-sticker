import {
  CANONICALIZING_ALIAS_CONTRACTS,
  CANONICAL_SITEMAP_ROUTES,
  EXPLICIT_NOT_FOUND_CONTRACTS,
  PRIMARY_ROUTE_CONTRACTS,
  SITE_ORIGIN,
  TRAILING_SLASH_REDIRECTS,
  resolveSeoRoute,
  type PageRouteContract,
} from './route-contract'

export type ObservedImage = {
  src: string
  alt: string | null
  decorative: boolean
}

export type PageSeoObservation = {
  path: string
  status: number
  title: string | null
  description: string | null
  canonical: string | null
  robots: string | null
  h1: readonly string[]
  meaningfulContent: string
  structuredData: readonly Record<string, unknown>[]
  images: readonly ObservedImage[]
  internalLinks: readonly string[]
  inSitemap: boolean
}

export type SeoValidationIssueCode =
  | 'STATUS_MISMATCH'
  | 'TITLE_MISMATCH'
  | 'DESCRIPTION_MISMATCH'
  | 'CANONICAL_MISMATCH'
  | 'ROBOTS_MISMATCH'
  | 'H1_MISSING'
  | 'CONTENT_TOO_THIN'
  | 'SCHEMA_TYPE_MISSING'
  | 'IMAGE_ALT_MISSING'
  | 'SITEMAP_MEMBERSHIP_MISMATCH'
  | 'INTERNAL_LINK_INVALID'
  | 'INTERNAL_LINK_UNRESOLVED'

export type SeoValidationIssue = {
  code: SeoValidationIssueCode
  path: string
  detail: string
}

const normalizeRobots = (value: string | null) => (value ?? '')
  .toLowerCase()
  .split(',')
  .map((directive) => directive.trim())
  .filter(Boolean)
  .sort()
  .join(',')

const meaningfulWordCount = (value: string) => value
  .replace(/\s+/g, ' ')
  .trim()
  .split(' ')
  .filter(Boolean)
  .length

export function collectSchemaTypes(value: unknown): ReadonlySet<string> {
  const types = new Set<string>()
  const visit = (item: unknown) => {
    if (!item || typeof item !== 'object') return
    if (Array.isArray(item)) {
      item.forEach(visit)
      return
    }
    const record = item as Record<string, unknown>
    const type = record['@type']
    if (typeof type === 'string') types.add(type)
    else if (Array.isArray(type)) type.forEach((entry) => typeof entry === 'string' && types.add(entry))
    Object.values(record).forEach(visit)
  }
  visit(value)
  return types
}

function issue(
  issues: SeoValidationIssue[],
  route: PageRouteContract,
  code: SeoValidationIssueCode,
  detail: string,
) {
  issues.push({ code, path: route.path, detail })
}

function validateInternalLink(
  route: PageRouteContract,
  href: string,
  issues: SeoValidationIssue[],
) {
  if (!href || href.startsWith('#') || /^(mailto|tel|sms|javascript):/i.test(href)) return
  let url: URL
  try {
    url = new URL(href, `${SITE_ORIGIN}${route.publicPath}`)
  } catch {
    issue(issues, route, 'INTERNAL_LINK_INVALID', `invalid href: ${href}`)
    return
  }
  if (url.origin !== SITE_ORIGIN) return
  if (/^\/(?:assets|wp-content)\//.test(url.pathname)) return
  const resolved = resolveSeoRoute(url.pathname)
  if (resolved.disposition === 'not-found') {
    issue(issues, route, 'INTERNAL_LINK_UNRESOLVED', `unresolved first-party href: ${href}`)
  }
}

/**
 * Compares a rendered/crawled observation with a single immutable route
 * contract. Playwright and production crawlers can both feed this shape.
 */
export function validatePageSeoObservation(
  route: PageRouteContract,
  observation: PageSeoObservation,
): readonly SeoValidationIssue[] {
  const issues: SeoValidationIssue[] = []

  if (observation.status !== route.status) {
    issue(issues, route, 'STATUS_MISMATCH', `expected ${route.status}, received ${observation.status}`)
  }
  if (observation.title !== route.metadata.title) {
    issue(issues, route, 'TITLE_MISMATCH', `expected ${JSON.stringify(route.metadata.title)}, received ${JSON.stringify(observation.title)}`)
  }
  if (observation.description !== route.metadata.description) {
    issue(issues, route, 'DESCRIPTION_MISMATCH', 'meta description changed')
  }
  if (observation.canonical !== route.metadata.canonical) {
    issue(issues, route, 'CANONICAL_MISMATCH', `expected ${route.metadata.canonical}, received ${observation.canonical ?? 'none'}`)
  }
  if (normalizeRobots(observation.robots) !== normalizeRobots(route.metadata.robots)) {
    issue(issues, route, 'ROBOTS_MISMATCH', `expected ${route.metadata.robots}, received ${observation.robots ?? 'none'}`)
  }
  if (observation.h1.filter((heading) => heading.trim()).length < route.audit.minimumH1Count) {
    issue(issues, route, 'H1_MISSING', `expected at least ${route.audit.minimumH1Count} non-empty H1`)
  }
  const words = meaningfulWordCount(observation.meaningfulContent)
  if (words < route.audit.minimumMeaningfulWordCount) {
    issue(issues, route, 'CONTENT_TOO_THIN', `expected at least ${route.audit.minimumMeaningfulWordCount} meaningful words, received ${words}`)
  }

  const actualSchemaTypes = collectSchemaTypes(observation.structuredData)
  for (const expectedType of route.expectedSchemaTypes) {
    if (!actualSchemaTypes.has(expectedType)) {
      issue(issues, route, 'SCHEMA_TYPE_MISSING', `missing ${expectedType}`)
    }
  }

  if (route.audit.requireAltOnContentImages) {
    for (const image of observation.images) {
      if (!image.decorative && !(image.alt ?? '').trim()) {
        issue(issues, route, 'IMAGE_ALT_MISSING', `content image has no alt text: ${image.src}`)
      }
    }
  }

  if (observation.inSitemap !== route.inSitemap) {
    issue(issues, route, 'SITEMAP_MEMBERSHIP_MISMATCH', `expected inSitemap=${route.inSitemap}, received ${observation.inSitemap}`)
  }

  if (route.audit.requireResolvableInternalLinks) {
    observation.internalLinks.forEach((href) => validateInternalLink(route, href, issues))
  }

  return issues
}

export type SeoManifestSnapshot = {
  primaryRoutes: readonly PageRouteContract[]
  aliases: readonly PageRouteContract[]
}

export const SEO_MANIFEST_SNAPSHOT: SeoManifestSnapshot = {
  primaryRoutes: PRIMARY_ROUTE_CONTRACTS,
  aliases: CANONICALIZING_ALIAS_CONTRACTS,
}

/** Structural checks that do not require a running application. */
export function validateSeoManifest(snapshot: SeoManifestSnapshot = SEO_MANIFEST_SNAPSHOT): readonly string[] {
  const failures: string[] = []
  const allPages = [...snapshot.primaryRoutes, ...snapshot.aliases]
  const duplicatePaths = allPages
    .map((route) => route.path)
    .filter((path, index, paths) => paths.indexOf(path) !== index)
  if (duplicatePaths.length) failures.push(`duplicate page paths: ${[...new Set(duplicatePaths)].join(', ')}`)

  for (const route of allPages) {
    if (route.status !== 200) failures.push(`${route.path}: page status must be 200`)
    if (!route.metadata.title.trim()) failures.push(`${route.path}: title missing`)
    if (!route.metadata.canonical.startsWith(SITE_ORIGIN)) failures.push(`${route.path}: non-first-party canonical`)
    if (route.indexable === /noindex/i.test(route.metadata.robots)) failures.push(`${route.path}: robots/indexability mismatch`)
    if (route.inSitemap && !route.indexable) failures.push(`${route.path}: noindex page in sitemap`)
    if (route.evidence.searchConsole !== 'not-provided') failures.push(`${route.path}: unexpected Search Console evidence state`)
    if (route.evidence.backlinks !== 'not-provided') failures.push(`${route.path}: unexpected backlink evidence state`)
    if (route.evidence.accessLogs !== 'not-provided') failures.push(`${route.path}: unexpected access-log evidence state`)
    if (route.inSitemap !== (route.evidence.sitemap === 'listed-live')) failures.push(`${route.path}: sitemap provenance mismatch`)
    if (route.evidence.targetStatus !== route.status) failures.push(`${route.path}: target status provenance mismatch`)
    if (route.evidence.crawl === 'observed-live' && route.evidence.liveStatus !== route.status) failures.push(`${route.path}: observed live status mismatch`)
    if (route.evidence.crawl === 'approved-target-override') {
      if (route.evidence.liveStatus !== 404 || route.evidence.targetStatus !== 200) {
        failures.push(`${route.path}: approved target override must explicitly record live 404 and target 200`)
      }
      if (route.path !== '/resources' && route.path !== '/shipping-delivery') {
        failures.push(`${route.path}: unapproved target override`)
      }
    }
  }

  if (snapshot === SEO_MANIFEST_SNAPSHOT) {
    if (CANONICAL_SITEMAP_ROUTES.length !== 44) failures.push(`expected 44 canonical sitemap routes, found ${CANONICAL_SITEMAP_ROUTES.length}`)
    const expectedSlashPaths = new Set(allPages.filter((route) => route.path !== '/').map((route) => route.path))
    const actualSlashPaths = TRAILING_SLASH_REDIRECTS.map((route) => route.path)
    const actualSlashPathSet = new Set(actualSlashPaths)
    const missingSlashPaths = [...expectedSlashPaths].filter((path) => !actualSlashPathSet.has(path))
    const unexpectedSlashPaths = [...actualSlashPathSet].filter((path) => !expectedSlashPaths.has(path))
    if (
      actualSlashPaths.length !== actualSlashPathSet.size
      || missingSlashPaths.length
      || unexpectedSlashPaths.length
    ) {
      failures.push([
        'slash redirect coverage mismatch',
        missingSlashPaths.length ? `missing=${missingSlashPaths.join(',')}` : '',
        unexpectedSlashPaths.length ? `unexpected=${unexpectedSlashPaths.join(',')}` : '',
        actualSlashPaths.length !== actualSlashPathSet.size ? 'duplicates=true' : '',
      ].filter(Boolean).join(' '))
    }
    if (EXPLICIT_NOT_FOUND_CONTRACTS.some((route) => route.evidence.crawl !== 'observed-live')) failures.push('explicit 404 lacks live crawl evidence')
  }

  return failures
}
