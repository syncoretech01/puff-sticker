'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireAdminSession } from '../../../lib/admin'
import { adminContentHref } from '../../../lib/admin/content-route'
import {
  assertCmsPublicSourceEnabled,
  createContentWorkflow,
  createRevalidationBoundary,
} from '../../../lib/cms'
import {
  CONTENT_TYPES,
  EMPTY_CONTENT_SEO,
  type ContentSeo,
  type ContentType,
  type JsonObject,
} from '../../../lib/content'
import { getCmsContentRepository } from '../../../lib/db/content-repository'

function value(formData: FormData, name: string, maximum = 500_000): string {
  const field = formData.get(name)
  return typeof field === 'string' ? field.slice(0, maximum) : ''
}

function required(formData: FormData, name: string, maximum?: number): string {
  const result = value(formData, name, maximum).trim()
  if (!result) throw new Error(`${name} is required.`)
  return result
}

function contentType(formData: FormData): ContentType {
  const type = value(formData, 'type', 32)
  if (!(CONTENT_TYPES as readonly string[]).includes(type)) throw new Error('Invalid content type.')
  return type as ContentType
}

function optional(raw: string): string | null {
  const result = raw.trim()
  return result || null
}

function jsonObject(raw: string, field: string): JsonObject {
  if (!raw.trim()) return {}
  const parsed: unknown = JSON.parse(raw)
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error(`${field} must be a JSON object.`)
  }
  return parsed as JsonObject
}

function structuredData(raw: string): readonly JsonObject[] {
  if (!raw.trim()) return []
  const parsed: unknown = JSON.parse(raw)
  if (!Array.isArray(parsed) || parsed.some((item) => !item || Array.isArray(item) || typeof item !== 'object')) {
    throw new Error('Structured data must be a JSON array of objects.')
  }
  return parsed as JsonObject[]
}

function seo(formData: FormData): ContentSeo {
  return {
    ...EMPTY_CONTENT_SEO,
    title: optional(value(formData, 'seoTitle', 1_000)),
    description: optional(value(formData, 'seoDescription', 4_000)),
    canonical: optional(value(formData, 'canonical', 2_000)),
    robots: optional(value(formData, 'robots', 500)),
    openGraph: jsonObject(value(formData, 'openGraph'), 'Open Graph'),
    twitter: jsonObject(value(formData, 'twitter'), 'Twitter metadata'),
    structuredData: structuredData(value(formData, 'structuredData')),
  }
}

function revision(formData: FormData): number {
  const parsed = Number.parseInt(value(formData, 'revision', 20), 10)
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error('A valid revision is required.')
  return parsed
}

function workflow() {
  return createContentWorkflow({
    repository: getCmsContentRepository(),
    revalidation: createRevalidationBoundary({
      path: (pathname) => revalidatePath(pathname),
      tag: (tag) => revalidateTag(tag, 'max'),
    }),
  })
}

export async function createDraftAction(formData: FormData): Promise<never> {
  const session = await requireAdminSession('editor')
  const draft = await workflow().createDraft({
    type: contentType(formData),
    path: required(formData, 'path', 2_000),
    slug: required(formData, 'slug', 500),
    title: required(formData, 'title', 2_000),
    excerpt: optional(value(formData, 'excerpt')),
    bodyHtml: optional(value(formData, 'bodyHtml')),
    data: jsonObject(value(formData, 'data'), 'Content data'),
    seo: seo(formData),
    changeSummary: optional(value(formData, 'changeSummary', 2_000)),
  }, { actorId: session.subject, reason: 'admin:create-draft' })
  redirect(`${adminContentHref(draft.id)}?status=created`)
}

export async function updateDraftAction(formData: FormData): Promise<never> {
  const session = await requireAdminSession('editor')
  const id = required(formData, 'id', 256)
  await workflow().updateDraft(id, revision(formData), {
    type: contentType(formData),
    path: required(formData, 'path', 2_000),
    slug: required(formData, 'slug', 500),
    title: required(formData, 'title', 2_000),
    excerpt: optional(value(formData, 'excerpt')),
    bodyHtml: optional(value(formData, 'bodyHtml')),
    data: jsonObject(value(formData, 'data'), 'Content data'),
    seo: seo(formData),
    changeSummary: optional(value(formData, 'changeSummary', 2_000)),
  }, { actorId: session.subject, reason: 'admin:update-draft' })
  redirect(`${adminContentHref(id)}?status=saved`)
}

export async function publishAction(formData: FormData): Promise<never> {
  const session = await requireAdminSession('publisher')
  assertCmsPublicSourceEnabled()
  const id = required(formData, 'id', 256)
  await workflow().publish(id, revision(formData), { actorId: session.subject, reason: 'admin:publish' })
  redirect(`${adminContentHref(id)}?status=published`)
}

export async function unpublishAction(formData: FormData): Promise<never> {
  const session = await requireAdminSession('publisher')
  assertCmsPublicSourceEnabled()
  const id = required(formData, 'id', 256)
  await workflow().unpublish(id, revision(formData), { actorId: session.subject, reason: 'admin:unpublish' })
  redirect(`${adminContentHref(id)}?status=unpublished`)
}

export async function archiveAction(formData: FormData): Promise<never> {
  const session = await requireAdminSession('publisher')
  assertCmsPublicSourceEnabled()
  const id = required(formData, 'id', 256)
  await workflow().archive(id, revision(formData), { actorId: session.subject, reason: 'admin:archive' })
  redirect('/admin/content?status=archived')
}
