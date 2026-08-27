'use server'

import { createHash, timingSafeEqual } from 'node:crypto'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import {
  clearAdminSession,
  getAdminConfiguration,
  issueAdminSession,
} from '../../lib/admin'
import { verifyAdminPassword } from '../../lib/admin/crypto-core'
import { resolveAdminClientAddress } from '../../lib/admin/rate-limit-core'
import { consumeAdminLoginAttempt } from '../../lib/admin/rate-limit'

function field(formData: FormData, name: string, maximumLength: number): string {
  const value = formData.get(name)
  return typeof value === 'string' ? value.slice(0, maximumLength) : ''
}

function constantTimeTextMatch(actual: string, expected: string): boolean {
  const actualDigest = createHash('sha256').update(actual).digest()
  const expectedDigest = createHash('sha256').update(expected).digest()
  return timingSafeEqual(actualDigest, expectedDigest)
}

function safeAdminDestination(value: string): string {
  if (!value.startsWith('/admin') || value.startsWith('//') || value.includes('\\')) {
    return '/admin'
  }
  try {
    const parsed = new URL(value, 'https://admin.invalid')
    return parsed.origin === 'https://admin.invalid' && parsed.pathname.startsWith('/admin')
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : '/admin'
  } catch {
    return '/admin'
  }
}

export async function loginAction(formData: FormData): Promise<never> {
  const username = field(formData, 'username', 128).trim()
  const password = field(formData, 'password', 1_025)
  const destination = safeAdminDestination(field(formData, 'next', 512))
  const configuration = getAdminConfiguration()

  if (!configuration) {
    // Preserve a bounded scrypt cost even when setup is incomplete.
    await verifyAdminPassword(password, '')
    redirect('/admin/login?error=unconfigured')
  }

  let throttle
  try {
    const requestHeaders = await headers()
    throttle = await consumeAdminLoginAttempt({
      clientAddress: resolveAdminClientAddress(requestHeaders),
      secret: configuration.sessionSecret,
      username,
    })
  } catch {
    redirect('/admin/login?error=unavailable')
  }
  if (!throttle.allowed) redirect('/admin/login?error=rate-limited')

  // Every admitted attempt performs the same scrypt and username digest work.
  const passwordMatches = await verifyAdminPassword(password, configuration.passwordHash)
  const usernameMatches = constantTimeTextMatch(username, configuration.username)
  if (!usernameMatches || !passwordMatches) {
    redirect('/admin/login?error=invalid')
  }

  const session = await issueAdminSession()
  if (!session) redirect('/admin/login?error=unconfigured')
  redirect(destination)
}

export async function logoutAction(): Promise<never> {
  await clearAdminSession()
  redirect('/admin/login?status=signed-out')
}
