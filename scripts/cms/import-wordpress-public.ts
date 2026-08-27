import { createDatabase } from '../../src/lib/db/client'
import { createDrizzleContentRepository } from '../../src/lib/db/repository'
import type { ContentRecord, MediaRecord, SaveContentInput, UpsertMediaInput } from '../../src/lib/content'
import { assertWordpressSeedPlan, buildWordpressSeedPlan } from './wordpress-seed'

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function contentMatches(record: ContentRecord, input: SaveContentInput): boolean {
  return record.type === input.type
    && record.path === input.path
    && record.slug === input.slug
    && record.title === input.title
    && record.excerpt === (input.excerpt ?? null)
    && record.bodyHtml === (input.bodyHtml ?? null)
    && record.status === (input.status ?? 'draft')
    && record.publishedAt === (input.publishedAt ?? null)
    && record.provenanceId === (input.provenanceId ?? null)
    && stable(record.data) === stable(input.data ?? {})
    && stable(record.seo) === stable(input.seo)
}

function mediaMatches(record: MediaRecord, input: UpsertMediaInput): boolean {
  return record.provider === input.provider
    && record.storageKey === (input.storageKey ?? null)
    && record.publicUrl === input.publicUrl
    && record.mimeType === input.mimeType
    && record.fileName === input.fileName
    && record.altText === (input.altText ?? '')
    && record.caption === (input.caption ?? null)
    && record.width === (input.width ?? null)
    && record.height === (input.height ?? null)
    && record.sha256 === (input.sha256 ?? null)
    && record.bytes === (input.bytes ?? null)
    && record.provenanceId === (input.provenanceId ?? null)
    && stable(record.metadata) === stable(input.metadata ?? {})
}

async function main() {
  const plan = buildWordpressSeedPlan()
  assertWordpressSeedPlan(plan)
  const apply = process.argv.includes('--apply')
  const summary = {
    mode: apply ? 'apply' : 'dry-run',
    archiveSha256: plan.archiveSha256,
    importBatch: plan.importBatch,
    content: plan.contents.length,
    media: plan.media.length,
    knownLiveDeltas: plan.knownLiveDeltas,
  }
  if (!apply) {
    console.log(JSON.stringify(summary, null, 2))
    return
  }

  const connectionString = process.env.DATABASE_URL?.trim()
  const actorId = process.env.PUFF_CMS_IMPORT_ACTOR?.trim()
  const confirmation = process.argv
    .find((argument) => argument.startsWith('--confirm='))
    ?.slice('--confirm='.length)
  if (!connectionString) throw new Error('DATABASE_URL is required with --apply.')
  if (!actorId) throw new Error('PUFF_CMS_IMPORT_ACTOR is required with --apply.')
  if (confirmation !== plan.archiveSha256) {
    throw new Error(
      'Apply requires --confirm=<archiveSha256> matching the reviewed dry-run plan.',
    )
  }

  const handle = createDatabase(connectionString)
  const repository = createDrizzleContentRepository(handle.db)
  const result = { created: 0, updated: 0, unchanged: 0, mediaCreated: 0, mediaUpdated: 0, mediaUnchanged: 0 }

  try {
    await repository.transaction(async (transaction) => {
      for (const item of plan.contents) {
        await transaction.recordMigrationProvenance(
          item.provenance,
          { actorId, reason: 'wordpress-public-import' },
        )
        const id = item.input.id
        if (!id) throw new Error('Every migration content ID must be deterministic.')
        const existing = await transaction.getContent({
          id,
          includeArchived: true,
          includeDrafts: true,
        })
        if (existing && contentMatches(existing, item.input)) {
          result.unchanged += 1
          continue
        }
        await transaction.saveContent({
          ...item.input,
          expectedRevision: existing?.revision,
        }, { actorId, reason: 'wordpress-public-import' })
        if (existing) result.updated += 1
        else result.created += 1
      }

      for (const item of plan.media) {
        await transaction.recordMigrationProvenance(
          item.provenance,
          { actorId, reason: 'wordpress-public-import' },
        )
        const id = item.input.id
        if (!id) throw new Error('Every migration media ID must be deterministic.')
        const existing = await transaction.getMedia(id)
        if (existing && mediaMatches(existing, item.input)) {
          result.mediaUnchanged += 1
          continue
        }
        await transaction.upsertMedia({
          ...item.input,
          expectedRevision: existing?.revision,
        }, { actorId, reason: 'wordpress-public-import' })
        if (existing) result.mediaUpdated += 1
        else result.mediaCreated += 1
      }
    })
    console.log(JSON.stringify({ ...summary, result }, null, 2))
  } finally {
    await handle.close()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
