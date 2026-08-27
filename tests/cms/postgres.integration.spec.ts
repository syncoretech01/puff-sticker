import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'

import { expect, test } from '@playwright/test'
import postgres, { type Sql } from 'postgres'

import { buildWordpressSeedPlan } from '../../scripts/cms/wordpress-seed'
import { consumeAdminLoginAttemptWithDatabase } from '../../src/lib/admin/rate-limit-database'
import { adminRateLimitSubjects } from '../../src/lib/admin/rate-limit-core'
import { adminContentHref } from '../../src/lib/admin/content-route'
import {
  EMPTY_CONTENT_SEO,
  RepositoryValidationError,
  assertRedirectGraph,
  type SaveContentInput,
} from '../../src/lib/content'
import { createDatabase, type DatabaseHandle } from '../../src/lib/db/client'
import { createDrizzleContentRepository } from '../../src/lib/db/repository'

const databaseUrl = process.env.PUFF_TEST_DATABASE_URL
if (!databaseUrl) throw new Error('PUFF_TEST_DATABASE_URL is required.')

const tsxCli = 'node_modules/tsx/dist/cli.mjs'
const actor = { actorId: 'postgres-integration' }

let handle: DatabaseHandle
let raw: Sql
let repository: ReturnType<typeof createDrizzleContentRepository>

function draftInput(id: string, path: string): SaveContentInput {
  return {
    id,
    type: 'page',
    path,
    slug: id,
    title: `Integration ${id}`,
    bodyHtml: '<p>Integration only</p>',
    data: { integration: true },
    seo: EMPTY_CONTENT_SEO,
    status: 'draft',
  }
}

type ImportResult = {
  result: {
    created: number
    mediaCreated: number
    mediaUnchanged: number
    unchanged: number
  }
}

function runImporter(expectSuccess: boolean) {
  const plan = buildWordpressSeedPlan()
  const result = spawnSync(process.execPath, [
    tsxCli,
    'scripts/cms/import-wordpress-public.ts',
    '--apply',
    `--confirm=${plan.archiveSha256}`,
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      PUFF_CMS_IMPORT_ACTOR: 'integration-importer',
    },
    timeout: 180_000,
  })
  if (expectSuccess && result.status !== 0) {
    throw new Error(`Importer failed:\n${result.stdout}\n${result.stderr}`)
  }
  if (!expectSuccess) return { status: result.status, stderr: result.stderr }
  const start = result.stdout.indexOf('{')
  if (start < 0) throw new Error(`Importer returned no JSON summary:\n${result.stdout}`)
  return JSON.parse(result.stdout.slice(start)) as ImportResult
}

test.beforeAll(async () => {
  handle = createDatabase(databaseUrl, { maxConnections: 6 })
  repository = createDrizzleContentRepository(handle.db)
  raw = postgres(databaseUrl, { max: 6, prepare: false })
})

test.afterAll(async () => {
  await handle.close()
  await raw.end()
})

test.describe.serial('real PostgreSQL persistence boundary', () => {
  test('applies the committed migration, checks, and append-only triggers', async () => {
    const tables = await raw`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
      order by table_name
    `
    expect(tables.map((row) => row.table_name)).toEqual(expect.arrayContaining([
      'admin_login_throttles',
      'audit_events',
      'content_records',
      'content_versions',
      'media_assets',
      'migration_provenance',
      'redirects',
    ]))
    const [migrationCount] = await raw`
      select count(*)::int as count from drizzle.__drizzle_migrations
    `
    expect(migrationCount.count).toBe(1)

    const constraints = await raw`
      select conname from pg_constraint
      where conname in (
        'content_records_path_check',
        'media_assets_storage_check',
        'redirects_status_code_check',
        'admin_login_throttles_key_hash_check'
      )
    `
    expect(constraints).toHaveLength(4)
    await expect(raw`
      insert into admin_login_throttles
        (key_hash, scope, attempt_count, window_started_at, updated_at)
      values ('invalid', 'ip', 0, now(), now())
    `).rejects.toThrow(/check constraint/i)
  })

  test('rolls back nested repository writes and enforces immutable history', async () => {
    const suffix = randomUUID()
    const firstId = `atomic-first-${suffix}`
    const secondId = `atomic-second-${suffix}`
    const sharedPath = `/integration/atomic-${suffix}/`
    await expect(repository.transaction(async (transaction) => {
      await transaction.saveContent(draftInput(firstId, sharedPath), actor)
      await transaction.saveContent(draftInput(secondId, sharedPath), actor)
    })).rejects.toThrow()
    expect(await repository.getContent({ id: firstId, includeDrafts: true })).toBeNull()
    expect(await repository.listAuditEvents({ entityId: firstId })).toHaveLength(0)

    const record = await repository.saveContent(
      draftInput(`immutable-${suffix}`, `/integration/immutable-${suffix}/`),
      actor,
    )
    const versions = await repository.listContentVersions(record.id)
    const audits = await repository.listAuditEvents({ entityId: record.id })
    expect(versions).toHaveLength(1)
    expect(audits).toHaveLength(1)
    await expect(raw`
      update content_versions set change_summary = 'mutated' where id = ${versions[0].id}
    `).rejects.toThrow(/append-only/i)
    await expect(raw`
      delete from audit_events where id = ${audits[0].id}
    `).rejects.toThrow(/append-only/i)
  })

  test('refreshes provenance without allowing identity collisions', async () => {
    const suffix = randomUUID()
    const id = `provenance-${suffix}`
    const initial = await repository.recordMigrationProvenance({
      id,
      sourceSystem: 'integration',
      sourceKind: 'page',
      sourceId: suffix,
      sourceUrl: 'https://puffsticker.com/integration-source/',
      sourceModifiedAt: '2026-08-12T00:00:00.000Z',
      archiveSha256: '1'.repeat(64),
      payloadSha256: '2'.repeat(64),
      importBatch: 'integration-one',
      metadata: { capture: 1 },
      importedAt: '2026-08-12T01:00:00.000Z',
    }, actor)
    const updated = await repository.recordMigrationProvenance({
      id,
      sourceSystem: 'integration',
      sourceKind: 'page',
      sourceId: suffix,
      sourceUrl: 'https://puffsticker.com/integration-source/',
      sourceModifiedAt: '2026-08-13T00:00:00.000Z',
      archiveSha256: '3'.repeat(64),
      payloadSha256: '4'.repeat(64),
      importBatch: 'integration-two',
      metadata: { capture: 2 },
    }, actor)
    expect(updated).toMatchObject({
      archiveSha256: '3'.repeat(64),
      payloadSha256: '4'.repeat(64),
      importBatch: 'integration-two',
    })
    expect(updated.importedAt).not.toBe(initial.importedAt)
    expect((await repository.listAuditEvents({ entityId: id })).map((event) => event.action))
      .toEqual(['migration-provenance.updated', 'migration-provenance.recorded'])

    await expect(repository.recordMigrationProvenance({
      ...updated,
      sourceId: `different-${suffix}`,
    }, actor)).rejects.toBeInstanceOf(RepositoryValidationError)
    await expect(repository.recordMigrationProvenance({
      ...updated,
      id: `different-id-${suffix}`,
    }, actor)).rejects.toBeInstanceOf(RepositoryValidationError)
  })

  test('serializes concurrent redirect graph mutations', async () => {
    const suffix = randomUUID()
    const firstPath = `/integration/redirect-${suffix}/a`
    const middlePath = `/integration/redirect-${suffix}/b`
    const lastPath = `/integration/redirect-${suffix}/c`
    const results = await Promise.allSettled([
      repository.upsertRedirect({
        id: `redirect-a-${suffix}`,
        sourcePath: firstPath,
        targetPath: middlePath,
        statusCode: 301,
      }, actor),
      repository.upsertRedirect({
        id: `redirect-b-${suffix}`,
        sourcePath: middlePath,
        targetPath: lastPath,
        statusCode: 308,
      }, actor),
    ])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)
    const redirects = (await repository.listRedirects()).filter((item) =>
      item.sourcePath.includes(`redirect-${suffix}`))
    expect(redirects).toHaveLength(1)
    expect(() => assertRedirectGraph(redirects)).not.toThrow()
    expect(await repository.removeRedirect(redirects[0].sourcePath, actor)).toBe(true)
  })

  test('enforces the global identity throttle and removes stale rows', async () => {
    const username = `distributed-${randomUUID()}@example.test`
    const secret = process.env.PUFF_ADMIN_SESSION_SECRET ?? ''
    const staleKey = 'a'.repeat(64)
    await raw`
      insert into admin_login_throttles
        (key_hash, scope, attempt_count, window_started_at, updated_at)
      values (${staleKey}, 'identity', 1, now() - interval '2 days', now() - interval '2 days')
    `
    const decisions = await Promise.all(Array.from({ length: 9 }, (_, index) =>
      consumeAdminLoginAttemptWithDatabase(handle.db, {
        clientAddress: `203.0.113.${index + 1}`,
        secret,
        username,
      })))
    expect(decisions.filter((decision) => decision.allowed)).toHaveLength(8)
    expect(decisions.filter((decision) => !decision.allowed)).toHaveLength(1)

    const identity = adminRateLimitSubjects({
      clientAddress: '198.51.100.10',
      secret,
      username,
    }).find((subject) => subject.scope === 'identity')
    expect(identity).toBeTruthy()
    const [identityRow] = await raw`
      select attempt_count from admin_login_throttles where key_hash = ${identity?.keyHash ?? ''}
    `
    expect(identityRow.attempt_count).toBe(9)
    const [staleCount] = await raw`
      select count(*)::int as count from admin_login_throttles where key_hash = ${staleKey}
    `
    expect(staleCount.count).toBe(0)
  })

  test('rolls back a failed WordPress import and converges idempotently', async () => {
    const plan = buildWordpressSeedPlan()
    const seedPath = plan.contents[0].input.path
    const blockerId = `import-blocker-${randomUUID()}`
    const blocker = await repository.saveContent(draftInput(blockerId, seedPath), actor)
    const failed = runImporter(false)
    expect(failed.status).not.toBe(0)
    const [rolledBack] = await raw`
      select count(*)::int as count
      from migration_provenance
      where source_system = 'wordpress'
    `
    expect(rolledBack.count).toBe(0)

    await repository.saveContent({
      id: blocker.id,
      type: blocker.type,
      path: `/integration/moved-${randomUUID()}/`,
      slug: blocker.slug,
      title: blocker.title,
      excerpt: blocker.excerpt,
      bodyHtml: blocker.bodyHtml,
      data: blocker.data,
      seo: blocker.seo,
      status: blocker.status,
      expectedRevision: blocker.revision,
      provenanceId: blocker.provenanceId,
      publishedAt: blocker.publishedAt,
      changeSummary: 'Move the intentional import blocker after rollback verification.',
    }, actor)

    const first = runImporter(true) as ImportResult
    const second = runImporter(true) as ImportResult
    expect(first.result).toMatchObject({ created: 41, mediaCreated: 156 })
    expect(second.result).toMatchObject({ unchanged: 41, mediaUnchanged: 156 })
    const [provenance] = await raw`
      select count(*)::int as count,
        count(payload_sha256)::int as payload_count
      from migration_provenance
      where source_system = 'wordpress'
    `
    expect(provenance).toMatchObject({ count: 197, payload_count: 197 })
  })

  test('authenticates a configured admin with hardened cookies and no public noindex leak', async ({ page, context }) => {
    const login = await page.goto('/admin/login', { waitUntil: 'domcontentloaded' })
    expect(login?.headers()['x-robots-tag']).toContain('noindex')
    await page.getByLabel('Username').fill('integration-admin')
    await page.getByLabel('Password').fill(process.env.PUFF_TEST_ADMIN_PASSWORD ?? '')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/admin$/)
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    await expect(page.getByText('Protected staging workflow')).toBeVisible()

    const cookie = (await context.cookies()).find((item) =>
      item.name === '__Host-puff_admin_session')
    expect(cookie).toMatchObject({
      httpOnly: true,
      path: '/',
      sameSite: 'Strict',
      secure: true,
    })

    const plan = buildWordpressSeedPlan()
    await page.goto(adminContentHref(plan.contents[0].input.id ?? ''))
    await expect(page.getByText('Staging mode is locked.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Publish', exact: true })).toHaveCount(0)

    const publicResponse = await page.goto('/', { waitUntil: 'domcontentloaded' })
    expect(publicResponse?.headers()['x-robots-tag']).toBeUndefined()
    await expect(page.locator('meta[name=robots]')).not.toHaveAttribute('content', /noindex/)
  })
})
