import { isAdminRole, type AdminRole } from './types'

export function resolveConfiguredAdminRole(value: string | undefined): AdminRole | null {
  const normalized = value?.trim() ?? ''
  return isAdminRole(normalized) ? normalized : null
}
