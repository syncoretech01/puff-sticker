import 'server-only'

import { getDatabase } from '../db/client'
import {
  consumeAdminLoginAttemptWithDatabase,
  type AdminRateLimitDecision,
  type AdminRateLimitInput,
} from './rate-limit-database'

export type { AdminRateLimitDecision }

export function consumeAdminLoginAttempt(
  input: AdminRateLimitInput,
): Promise<AdminRateLimitDecision> {
  return consumeAdminLoginAttemptWithDatabase(getDatabase(), input)
}
