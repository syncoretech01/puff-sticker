import {
  createHmac,
  randomBytes,
  randomUUID,
  scrypt as nodeScrypt,
  timingSafeEqual,
} from 'node:crypto'

import { isAdminRole, type AdminRole, type AdminSession } from './types'

const PASSWORD_HASH_PREFIX = 'scrypt'
const PASSWORD_HASH_VERSION = 1
const SCRYPT_N = 16_384
const SCRYPT_R = 8
const SCRYPT_P = 1
const SCRYPT_KEY_LENGTH = 64
const SCRYPT_MAX_MEMORY = 64 * 1024 * 1024
const SESSION_TOKEN_PREFIX = 'psa1'
const SESSION_AUDIENCE = 'puffsticker-admin'
const MAX_TOKEN_LENGTH = 2_048

type PasswordHash = Readonly<{
  salt: Buffer
  digest: Buffer
}>

type SessionClaims = Readonly<{
  aud: typeof SESSION_AUDIENCE
  exp: number
  iat: number
  jti: string
  role: AdminRole
  sub: string
  sv: string
  v: 1
}>

function passwordHashPayload(salt: Buffer, digest: Buffer): string {
  return [
    PASSWORD_HASH_PREFIX,
    PASSWORD_HASH_VERSION,
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString('base64url'),
    digest.toString('base64url'),
  ].join('$')
}

function parsePasswordHash(encoded: string): PasswordHash | null {
  const parts = encoded.split('$')
  if (parts.length !== 7) return null

  const [prefix, version, n, r, p, saltValue, digestValue] = parts
  if (
    prefix !== PASSWORD_HASH_PREFIX
    || version !== String(PASSWORD_HASH_VERSION)
    || n !== String(SCRYPT_N)
    || r !== String(SCRYPT_R)
    || p !== String(SCRYPT_P)
    || !/^[A-Za-z0-9_-]+$/.test(saltValue)
    || !/^[A-Za-z0-9_-]+$/.test(digestValue)
  ) return null

  try {
    const salt = Buffer.from(saltValue, 'base64url')
    const digest = Buffer.from(digestValue, 'base64url')
    if (salt.length !== 16 || digest.length !== SCRYPT_KEY_LENGTH) return null
    return { salt, digest }
  } catch {
    return null
  }
}

export function isVersionedAdminPasswordHash(encoded: string): boolean {
  return parsePasswordHash(encoded) !== null
}

async function derivePassword(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    nodeScrypt(password, salt, SCRYPT_KEY_LENGTH, {
      N: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P,
      maxmem: SCRYPT_MAX_MEMORY,
    }, (error, result) => {
      if (error) reject(error)
      else resolve(Buffer.from(result))
    })
  })
}

/** Generate a value suitable for PUFF_ADMIN_PASSWORD_HASH. */
export async function createAdminPasswordHash(password: string): Promise<string> {
  if (password.length < 14 || password.length > 1_024) {
    throw new Error('Admin passwords must contain between 14 and 1024 characters.')
  }
  const salt = randomBytes(16)
  return passwordHashPayload(salt, await derivePassword(password, salt))
}

/**
 * Verify a password without exposing parse failures through a fast path.
 * Invalid hashes are compared against a fixed-shape dummy record.
 */
export async function verifyAdminPassword(
  password: string,
  encodedHash: string,
): Promise<boolean> {
  const parsed = parsePasswordHash(encodedHash)
  const fallbackSalt = Buffer.from('1185686dd0dbbc426ab5c8ff057387dd', 'hex')
  const fallbackDigest = Buffer.alloc(SCRYPT_KEY_LENGTH)
  const target = parsed ?? { salt: fallbackSalt, digest: fallbackDigest }
  const boundedPassword = password.length <= 1_024 ? password : password.slice(0, 1_024)
  const candidate = await derivePassword(boundedPassword, target.salt)
  return Boolean(parsed) && password.length <= 1_024 && timingSafeEqual(candidate, target.digest)
}

function encodeClaims(claims: SessionClaims): string {
  return Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url')
}

function signPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(`${SESSION_TOKEN_PREFIX}.${payload}`).digest('base64url')
}

function signaturesMatch(actual: string, expected: string): boolean {
  if (!/^[A-Za-z0-9_-]+$/.test(actual)) return false
  const actualBuffer = Buffer.from(actual)
  const expectedBuffer = Buffer.from(expected)
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
}

function isSessionClaims(value: unknown): value is SessionClaims {
  if (!value || typeof value !== 'object') return false
  const claims = value as Partial<SessionClaims>
  return claims.aud === SESSION_AUDIENCE
    && claims.v === 1
    && typeof claims.exp === 'number'
    && Number.isSafeInteger(claims.exp)
    && typeof claims.iat === 'number'
    && Number.isSafeInteger(claims.iat)
    && typeof claims.jti === 'string'
    && /^[0-9a-f-]{36}$/.test(claims.jti)
    && typeof claims.role === 'string'
    && isAdminRole(claims.role)
    && typeof claims.sub === 'string'
    && claims.sub.length > 0
    && claims.sub.length <= 128
    && typeof claims.sv === 'string'
    && claims.sv.length > 0
    && claims.sv.length <= 64
}

export function createAdminSessionToken(input: Readonly<{
  username: string
  role: AdminRole
  secret: string
  sessionVersion: string
  ttlSeconds: number
  now?: number
}>): Readonly<{ token: string; session: AdminSession }> {
  const issuedAt = input.now ?? Math.floor(Date.now() / 1_000)
  const claims: SessionClaims = {
    aud: SESSION_AUDIENCE,
    exp: issuedAt + input.ttlSeconds,
    iat: issuedAt,
    jti: randomUUID(),
    role: input.role,
    sub: input.username,
    sv: input.sessionVersion,
    v: 1,
  }
  const payload = encodeClaims(claims)
  const signature = signPayload(payload, input.secret)
  return {
    token: `${SESSION_TOKEN_PREFIX}.${payload}.${signature}`,
    session: {
      subject: claims.sub,
      role: claims.role,
      issuedAt: claims.iat,
      expiresAt: claims.exp,
      sessionId: claims.jti,
    },
  }
}

export function verifyAdminSessionToken(input: Readonly<{
  token: string
  secrets: readonly string[]
  expectedUsername: string
  expectedRole: AdminRole
  sessionVersion: string
  now?: number
}>): AdminSession | null {
  if (!input.token || input.token.length > MAX_TOKEN_LENGTH) return null
  const [prefix, payload, signature, extra] = input.token.split('.')
  if (prefix !== SESSION_TOKEN_PREFIX || !payload || !signature || extra) return null

  const signatureValid = input.secrets.some((secret) =>
    signaturesMatch(signature, signPayload(payload, secret)))
  if (!signatureValid) return null

  let claims: unknown
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  if (!isSessionClaims(claims)) return null

  const now = input.now ?? Math.floor(Date.now() / 1_000)
  if (
    claims.exp <= now
    || claims.iat > now + 60
    || claims.exp <= claims.iat
    || claims.sub !== input.expectedUsername
    || claims.role !== input.expectedRole
    || claims.sv !== input.sessionVersion
  ) return null

  return {
    subject: claims.sub,
    role: claims.role,
    issuedAt: claims.iat,
    expiresAt: claims.exp,
    sessionId: claims.jti,
  }
}
