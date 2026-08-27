import 'server-only'

import { cookies } from 'next/headers'

import {
  createAdminSessionToken,
  verifyAdminSessionToken,
} from './crypto-core'
import { adminCookieName, getAdminConfiguration } from './config'
import type { AdminSession } from './types'

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    maxAge,
    path: '/',
    sameSite: 'strict' as const,
    secure: process.env.NODE_ENV === 'production',
  }
}

export async function issueAdminSession(): Promise<AdminSession | null> {
  const configuration = getAdminConfiguration()
  if (!configuration) return null
  const { token, session } = createAdminSessionToken({
    username: configuration.username,
    role: configuration.role,
    secret: configuration.sessionSecret,
    sessionVersion: configuration.sessionVersion,
    ttlSeconds: configuration.sessionTtlSeconds,
  })
  const store = await cookies()
  store.set(adminCookieName(), token, cookieOptions(configuration.sessionTtlSeconds))
  return session
}

export async function clearAdminSession(): Promise<void> {
  const store = await cookies()
  store.set(adminCookieName(), '', cookieOptions(0))
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const configuration = getAdminConfiguration()
  if (!configuration) return null
  const store = await cookies()
  const token = store.get(adminCookieName())?.value
  if (!token) return null
  return verifyAdminSessionToken({
    token,
    secrets: [
      configuration.sessionSecret,
      ...(configuration.previousSessionSecret ? [configuration.previousSessionSecret] : []),
    ],
    expectedUsername: configuration.username,
    expectedRole: configuration.role,
    sessionVersion: configuration.sessionVersion,
  })
}
