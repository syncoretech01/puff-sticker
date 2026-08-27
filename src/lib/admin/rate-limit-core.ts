import { createHmac } from 'node:crypto'
import { isIP } from 'node:net'

export type AdminRateLimitScope = 'identity' | 'ip'

export type AdminRateLimitSubject = Readonly<{
  attemptLimit: number
  keyHash: string
  scope: AdminRateLimitScope
}>

function normalizedUsername(value: string): string {
  return value.trim().toLowerCase().slice(0, 128) || '(empty)'
}

function normalizedAddress(value: string): string | null {
  const candidate = value.trim()
  if (!candidate) return null
  if (candidate.startsWith('[')) {
    const end = candidate.indexOf(']')
    if (end > 1 && isIP(candidate.slice(1, end))) return candidate.slice(1, end)
  }
  if (isIP(candidate)) return candidate
  const ipv4WithPort = /^([^:]+):\d+$/.exec(candidate)
  return ipv4WithPort && isIP(ipv4WithPort[1]) ? ipv4WithPort[1] : null
}

export function resolveAdminClientAddress(headers: Pick<Headers, 'get'>): string {
  for (const name of ['x-vercel-forwarded-for', 'x-forwarded-for', 'x-real-ip']) {
    const first = headers.get(name)?.split(',', 1)[0]
    const address = first ? normalizedAddress(first) : null
    if (address) return address
  }
  return 'unavailable'
}

function keyHash(secret: string, value: string): string {
  return createHmac('sha256', secret).update(value).digest('hex')
}

export function adminRateLimitSubjects(input: Readonly<{
  clientAddress: string
  secret: string
  username: string
}>): readonly AdminRateLimitSubject[] {
  const address = normalizedAddress(input.clientAddress) ?? 'unavailable'
  const username = normalizedUsername(input.username)
  return [
    {
      attemptLimit: 30,
      keyHash: keyHash(input.secret, 'ip:' + address),
      scope: 'ip',
    },
    {
      attemptLimit: 8,
      keyHash: keyHash(input.secret, 'identity:' + username),
      scope: 'identity',
    },
  ]
}
