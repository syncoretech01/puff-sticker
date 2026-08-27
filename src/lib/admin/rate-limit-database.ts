import { and, eq, lt, sql } from 'drizzle-orm'

import type { PuffDatabase } from '../db/client'
import { adminLoginThrottles } from '../db/schema'
import { adminRateLimitSubjects } from './rate-limit-core'

const WINDOW_MILLISECONDS = 15 * 60 * 1_000
const LOCK_MILLISECONDS = 15 * 60 * 1_000
const RETENTION_MILLISECONDS = 24 * 60 * 60 * 1_000

export type AdminRateLimitDecision = Readonly<{
  allowed: boolean
  retryAfterSeconds: number
}>

export type AdminRateLimitInput = Readonly<{
  clientAddress: string
  secret: string
  username: string
  now?: Date
}>

export async function consumeAdminLoginAttemptWithDatabase(
  database: PuffDatabase,
  input: AdminRateLimitInput,
): Promise<AdminRateLimitDecision> {
  const now = input.now ?? new Date()
  if (Number.isNaN(now.valueOf())) throw new TypeError('A valid rate-limit clock is required.')
  const subjects = [...adminRateLimitSubjects(input)].sort((a, b) =>
    a.keyHash.localeCompare(b.keyHash))

  return database.transaction(async (transaction) => {
    const db = transaction as PuffDatabase

    // Per-subject transaction locks serialize concurrent attempts across all
    // serverless instances without persisting an IP address or username.
    for (const subject of subjects) {
      await db.execute(sql`select pg_advisory_xact_lock(hashtextextended(${subject.keyHash}, 0))`)
    }

    await db.delete(adminLoginThrottles).where(lt(
      adminLoginThrottles.updatedAt,
      new Date(now.valueOf() - RETENTION_MILLISECONDS),
    ))

    let retryAfterSeconds = 0
    for (const subject of subjects) {
      const [row] = await db.select().from(adminLoginThrottles).where(and(
        eq(adminLoginThrottles.scope, subject.scope),
        eq(adminLoginThrottles.keyHash, subject.keyHash),
      )).limit(1)
      if (row?.lockedUntil && row.lockedUntil > now) {
        retryAfterSeconds = Math.max(
          retryAfterSeconds,
          Math.ceil((row.lockedUntil.valueOf() - now.valueOf()) / 1_000),
        )
      }
    }
    if (retryAfterSeconds > 0) return { allowed: false, retryAfterSeconds }

    for (const subject of subjects) {
      const [row] = await db.select().from(adminLoginThrottles).where(and(
        eq(adminLoginThrottles.scope, subject.scope),
        eq(adminLoginThrottles.keyHash, subject.keyHash),
      )).limit(1)
      const expired = !row
        || row.windowStartedAt.valueOf() <= now.valueOf() - WINDOW_MILLISECONDS

      if (expired) {
        await db.insert(adminLoginThrottles).values({
          attemptCount: 1,
          keyHash: subject.keyHash,
          lockedUntil: null,
          scope: subject.scope,
          updatedAt: now,
          windowStartedAt: now,
        }).onConflictDoUpdate({
          target: adminLoginThrottles.keyHash,
          set: {
            attemptCount: 1,
            lockedUntil: null,
            scope: subject.scope,
            updatedAt: now,
            windowStartedAt: now,
          },
        })
        continue
      }

      const attemptCount = row.attemptCount + 1
      const lockedUntil = attemptCount > subject.attemptLimit
        ? new Date(now.valueOf() + LOCK_MILLISECONDS)
        : null
      await db.update(adminLoginThrottles).set({
        attemptCount,
        lockedUntil,
        updatedAt: now,
      }).where(eq(adminLoginThrottles.keyHash, subject.keyHash))
      if (lockedUntil) {
        retryAfterSeconds = Math.max(
          retryAfterSeconds,
          Math.ceil(LOCK_MILLISECONDS / 1_000),
        )
      }
    }

    return {
      allowed: retryAfterSeconds === 0,
      retryAfterSeconds,
    }
  })
}
