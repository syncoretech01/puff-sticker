import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

import type {
  ContentSeo,
  ContentSnapshot,
  JsonObject,
  JsonValue,
} from '../content/types'

export const contentTypeEnum = pgEnum('puff_content_type', [
  'page',
  'product',
  'post',
  'category',
  'global',
])

export const contentStatusEnum = pgEnum('puff_content_status', [
  'draft',
  'published',
  'archived',
])

export const mediaStorageProviderEnum = pgEnum('puff_media_storage_provider', [
  'object-storage',
  'external',
])

export const migrationProvenance = pgTable('migration_provenance', {
  id: text('id').primaryKey(),
  sourceSystem: text('source_system').notNull(),
  sourceKind: text('source_kind').notNull(),
  sourceId: text('source_id').notNull(),
  sourceUrl: text('source_url'),
  sourceModifiedAt: timestamp('source_modified_at', { withTimezone: true, mode: 'date' }),
  archiveSha256: text('archive_sha256'),
  payloadSha256: text('payload_sha256'),
  importBatch: text('import_batch').notNull(),
  metadata: jsonb('metadata').$type<JsonObject>().notNull().default({}),
  importedAt: timestamp('imported_at', { withTimezone: true, mode: 'date' }).notNull(),
}, (table) => [
  check('migration_provenance_archive_sha256_check', sql`${table.archiveSha256} is null or ${table.archiveSha256} ~ '^[0-9a-fA-F]{64}$'`),
  check('migration_provenance_payload_sha256_check', sql`${table.payloadSha256} is null or ${table.payloadSha256} ~ '^[0-9a-fA-F]{64}$'`),
  uniqueIndex('migration_provenance_source_uidx').on(table.sourceSystem, table.sourceKind, table.sourceId),
  index('migration_provenance_batch_idx').on(table.importBatch),
])

export const contentRecords = pgTable('content_records', {
  id: text('id').primaryKey(),
  type: contentTypeEnum('type').notNull(),
  path: text('path').notNull(),
  slug: text('slug').notNull(),
  title: text('title').notNull(),
  excerpt: text('excerpt'),
  bodyHtml: text('body_html'),
  data: jsonb('data').$type<JsonObject>().notNull().default({}),
  seo: jsonb('seo').$type<ContentSeo>().notNull(),
  status: contentStatusEnum('status').notNull().default('draft'),
  revision: integer('revision').notNull().default(1),
  provenanceId: text('provenance_id').references(() => migrationProvenance.id, { onDelete: 'set null' }),
  publishedAt: timestamp('published_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
  check('content_records_path_check', sql`left(${table.path}, 1) = '/' and left(${table.path}, 2) <> '//'`),
  check('content_records_revision_check', sql`${table.revision} > 0`),
  uniqueIndex('content_records_path_uidx').on(table.path),
  index('content_records_type_status_idx').on(table.type, table.status),
  index('content_records_slug_idx').on(table.slug),
  index('content_records_updated_at_idx').on(table.updatedAt),
])

export const contentVersions = pgTable('content_versions', {
  id: text('id').primaryKey(),
  contentId: text('content_id').notNull().references(() => contentRecords.id, { onDelete: 'restrict' }),
  revision: integer('revision').notNull(),
  snapshot: jsonb('snapshot').$type<ContentSnapshot>().notNull(),
  changeSummary: text('change_summary'),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
  check('content_versions_revision_check', sql`${table.revision} > 0`),
  uniqueIndex('content_versions_content_revision_uidx').on(table.contentId, table.revision),
  index('content_versions_created_at_idx').on(table.createdAt),
])

export const redirects = pgTable('redirects', {
  id: text('id').primaryKey(),
  sourcePath: text('source_path').notNull(),
  targetPath: text('target_path').notNull(),
  statusCode: integer('status_code').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  revision: integer('revision').notNull().default(1),
  provenanceId: text('provenance_id').references(() => migrationProvenance.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
  check('redirects_source_path_check', sql`left(${table.sourcePath}, 1) = '/' and left(${table.sourcePath}, 2) <> '//'`),
  check('redirects_target_path_check', sql`left(${table.targetPath}, 1) = '/' and left(${table.targetPath}, 2) <> '//'`),
  check('redirects_not_self_check', sql`${table.sourcePath} <> ${table.targetPath}`),
  check('redirects_status_code_check', sql`${table.statusCode} in (301, 308)`),
  check('redirects_revision_check', sql`${table.revision} > 0`),
  uniqueIndex('redirects_source_path_uidx').on(table.sourcePath),
  index('redirects_enabled_idx').on(table.enabled),
])

export const mediaAssets = pgTable('media_assets', {
  id: text('id').primaryKey(),
  provider: mediaStorageProviderEnum('provider').notNull(),
  storageKey: text('storage_key'),
  publicUrl: text('public_url').notNull(),
  mimeType: text('mime_type').notNull(),
  fileName: text('file_name').notNull(),
  altText: text('alt_text').notNull().default(''),
  caption: text('caption'),
  width: integer('width'),
  height: integer('height'),
  bytes: bigint('bytes', { mode: 'number' }),
  sha256: text('sha256'),
  metadata: jsonb('metadata').$type<JsonObject>().notNull().default({}),
  revision: integer('revision').notNull().default(1),
  provenanceId: text('provenance_id').references(() => migrationProvenance.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
  check('media_assets_storage_check', sql`${table.provider} <> 'object-storage' or (${table.storageKey} is not null and length(${table.storageKey}) > 0)`),
  check('media_assets_dimensions_check', sql`(${table.width} is null or ${table.width} >= 0) and (${table.height} is null or ${table.height} >= 0) and (${table.bytes} is null or ${table.bytes} >= 0)`),
  check('media_assets_sha256_check', sql`${table.sha256} is null or ${table.sha256} ~ '^[0-9a-fA-F]{64}$'`),
  check('media_assets_revision_check', sql`${table.revision} > 0`),
  uniqueIndex('media_assets_provider_storage_key_uidx').on(table.provider, table.storageKey),
  index('media_assets_mime_type_idx').on(table.mimeType),
  index('media_assets_sha256_idx').on(table.sha256),
])

export const adminLoginThrottles = pgTable('admin_login_throttles', {
  keyHash: text('key_hash').primaryKey(),
  scope: text('scope').notNull(),
  attemptCount: integer('attempt_count').notNull().default(0),
  windowStartedAt: timestamp('window_started_at', { withTimezone: true, mode: 'date' }).notNull(),
  lockedUntil: timestamp('locked_until', { withTimezone: true, mode: 'date' }),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
  check('admin_login_throttles_key_hash_check', sql`${table.keyHash} ~ '^[0-9a-f]{64}$'`),
  check('admin_login_throttles_scope_check', sql`${table.scope} in ('ip', 'identity')`),
  check('admin_login_throttles_attempt_count_check', sql`${table.attemptCount} >= 0`),
  index('admin_login_throttles_updated_at_idx').on(table.updatedAt),
])

export const auditEvents = pgTable('audit_events', {
  id: text('id').primaryKey(),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  actorId: text('actor_id').notNull(),
  requestId: text('request_id'),
  reason: text('reason'),
  previous: jsonb('previous').$type<JsonValue | null>(),
  next: jsonb('next').$type<JsonValue | null>(),
  occurredAt: timestamp('occurred_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
  check('audit_events_entity_type_check', sql`${table.entityType} in ('content', 'redirect', 'media', 'migration-provenance')`),
  index('audit_events_entity_idx').on(table.entityType, table.entityId),
  index('audit_events_actor_idx').on(table.actorId),
  index('audit_events_occurred_at_idx').on(table.occurredAt),
])

export const databaseSchema = {
  migrationProvenance,
  contentRecords,
  contentVersions,
  redirects,
  mediaAssets,
  adminLoginThrottles,
  auditEvents,
}
