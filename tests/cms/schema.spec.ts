import fs from 'node:fs'

import { expect, test } from '@playwright/test'
import { getTableConfig } from 'drizzle-orm/pg-core'

import { adminLoginThrottles, auditEvents, contentRecords, contentVersions, mediaAssets, migrationProvenance, redirects } from '../../src/lib/db/schema'

test('database schema contains revision, audit, redirect, media, and provenance boundaries', () => {
  const tables = [contentRecords, contentVersions, redirects, mediaAssets, migrationProvenance, adminLoginThrottles, auditEvents]
    .map((table) => getTableConfig(table).name)
  expect(tables).toEqual(['content_records', 'content_versions', 'redirects', 'media_assets', 'migration_provenance', 'admin_login_throttles', 'audit_events'])

  const content = getTableConfig(contentRecords)
  expect(content.columns.map((column) => column.name)).toEqual(expect.arrayContaining(['path', 'seo', 'status', 'revision', 'provenance_id']))
  expect(getTableConfig(contentVersions).uniqueConstraints.length + getTableConfig(contentVersions).indexes.length).toBeGreaterThan(0)
})

test('initial migration is additive and never creates user, order, form, or filesystem tables', () => {
  const sql = fs.readFileSync('migrations/0000_content_foundation.sql', 'utf8')
  expect(sql).toContain('CREATE TABLE')
  expect(sql).toContain('content_versions_append_only')
  expect(sql).toContain('audit_events_append_only')
  expect(sql).toContain('ON DELETE RESTRICT')
  expect(sql).not.toMatch(/DROP\s+(TABLE|DATABASE)|TRUNCATE/i)
  expect(sql).not.toMatch(/users|password|orders|customers|submissions|local_path/i)
})

test('every migration journal entry has a Drizzle snapshot', () => {
  const journal = JSON.parse(fs.readFileSync('migrations/meta/_journal.json', 'utf8')) as {
    entries: { tag: string }[]
  }
  for (const entry of journal.entries) {
    const prefix = entry.tag.split('_')[0]
    expect(fs.existsSync(`migrations/meta/${prefix}_snapshot.json`), entry.tag).toBe(true)
  }
})
