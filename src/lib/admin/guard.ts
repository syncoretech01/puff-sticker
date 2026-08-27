import 'server-only'

import { redirect } from 'next/navigation'

import { getAdminConfigurationStatus } from './config'
import { getAdminSession } from './session'
import { hasAdminRole, type AdminRole, type AdminSession } from './types'

export class AdminAuthorizationError extends Error {
  readonly status: 401 | 403 | 503

  constructor(message: string, status: 401 | 403 | 503) {
    super(message)
    this.name = 'AdminAuthorizationError'
    this.status = status
  }
}

export async function requireAdminSession(requiredRole: AdminRole = 'editor'): Promise<AdminSession> {
  if (!getAdminConfigurationStatus().configured) {
    redirect('/admin/login?error=unconfigured')
  }
  const session = await getAdminSession()
  if (!session) redirect('/admin/login?error=session')
  if (!hasAdminRole(session.role, requiredRole)) redirect('/admin?error=forbidden')
  return session
}

/** Use from route handlers that must return status codes instead of redirects. */
export async function authorizeAdminRequest(
  requiredRole: AdminRole = 'editor',
): Promise<AdminSession> {
  if (!getAdminConfigurationStatus().configured) {
    throw new AdminAuthorizationError('Admin access is not configured.', 503)
  }
  const session = await getAdminSession()
  if (!session) throw new AdminAuthorizationError('Authentication required.', 401)
  if (!hasAdminRole(session.role, requiredRole)) {
    throw new AdminAuthorizationError('Insufficient permissions.', 403)
  }
  return session
}
