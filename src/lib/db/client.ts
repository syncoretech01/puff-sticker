import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres, { type Sql } from 'postgres'

import * as schema from './schema'
export { createDrizzleContentRepository, DrizzleContentRepository } from './repository'

export type PuffDatabase = PostgresJsDatabase<typeof schema>

export type DatabaseHandle = {
  readonly db: PuffDatabase
  /** Explicitly close long-lived local processes; serverless requests reuse it. */
  close(): Promise<void>
}

export type DatabaseClientOptions = {
  readonly maxConnections?: number
  readonly idleTimeoutSeconds?: number
  readonly connectTimeoutSeconds?: number
}

type CachedDatabase = {
  db: PuffDatabase
  sql: Sql
}

declare global {
  // eslint-disable-next-line no-var
  var __puffDatabase: CachedDatabase | undefined
}

/**
 * Creates a lazy Postgres.js/Drizzle client. `prepare: false` keeps it safe for
 * transaction-pooling and serverless Postgres providers used from Vercel.
 */
export function createDatabase(
  connectionString: string,
  options: DatabaseClientOptions = {},
): DatabaseHandle {
  if (!/^postgres(?:ql)?:\/\//i.test(connectionString)) {
    throw new Error('A PostgreSQL DATABASE_URL is required.')
  }
  const sql = postgres(connectionString, {
    prepare: false,
    max: options.maxConnections ?? 1,
    idle_timeout: options.idleTimeoutSeconds ?? 20,
    connect_timeout: options.connectTimeoutSeconds ?? 10,
  })
  return {
    db: drizzle(sql, { schema }),
    close: async () => sql.end(),
  }
}

/** No connection is opened merely by importing this module. */
export function getDatabase(): PuffDatabase {
  if (globalThis.__puffDatabase) return globalThis.__puffDatabase.db
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is not configured.')
  const sql = postgres(connectionString, {
    prepare: false,
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
  })
  const db = drizzle(sql, { schema })
  globalThis.__puffDatabase = { db, sql }
  return db
}
