const ROUTE_PREFIX = 'id-'
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/

export function encodeAdminContentRouteId(id: string): string {
  if (!id || id.length > 256) throw new TypeError('Admin content IDs must contain 1 to 256 characters.')
  return ROUTE_PREFIX + Buffer.from(id, 'utf8').toString('base64url')
}

export function decodeAdminContentRouteId(segment: string): string {
  if (!segment.startsWith(ROUTE_PREFIX)) throw new TypeError('Invalid admin content route ID.')
  const encoded = segment.slice(ROUTE_PREFIX.length)
  if (!BASE64URL_PATTERN.test(encoded)) throw new TypeError('Invalid admin content route ID.')
  const id = Buffer.from(encoded, 'base64url').toString('utf8')
  if (encodeAdminContentRouteId(id) !== segment) throw new TypeError('Invalid admin content route ID.')
  return id
}

export function adminContentHref(id: string): string {
  return `/admin/content/${encodeAdminContentRouteId(id)}`
}
