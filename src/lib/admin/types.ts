export const ADMIN_ROLES = ['editor', 'publisher', 'admin'] as const

export type AdminRole = (typeof ADMIN_ROLES)[number]

export type AdminSession = Readonly<{
  subject: string
  role: AdminRole
  issuedAt: number
  expiresAt: number
  sessionId: string
}>

export type AdminConfigurationStatus = Readonly<{
  configured: boolean
  missing: readonly string[]
}>

export const ADMIN_ROLE_RANK: Readonly<Record<AdminRole, number>> = {
  editor: 1,
  publisher: 2,
  admin: 3,
}

export function isAdminRole(value: string): value is AdminRole {
  return (ADMIN_ROLES as readonly string[]).includes(value)
}

export function hasAdminRole(actual: AdminRole, required: AdminRole): boolean {
  return ADMIN_ROLE_RANK[actual] >= ADMIN_ROLE_RANK[required]
}
