export type RevalidationTarget =
  | { kind: 'path'; value: string }
  | { kind: 'tag'; value: string }

export type RevalidationFailure = RevalidationTarget & {
  message: string
}

export type RevalidationResult = {
  completed: RevalidationTarget[]
  failed: RevalidationFailure[]
  ok: boolean
}

export interface RevalidationPort {
  path(pathname: string): Promise<void> | void
  tag(tag: string): Promise<void> | void
}

export interface RevalidationBoundary {
  refresh(targets: readonly RevalidationTarget[]): Promise<RevalidationResult>
}

function validateTarget(target: RevalidationTarget) {
  if (target.kind === 'path') {
    if (!target.value.startsWith('/') || target.value.startsWith('//')) {
      throw new TypeError(`Revalidation paths must be site-relative: ${target.value}`)
    }
    return
  }
  if (!/^[a-z0-9][a-z0-9:_/-]{0,255}$/i.test(target.value)) {
    throw new TypeError(`Invalid revalidation tag: ${target.value}`)
  }
}

function uniqueTargets(targets: readonly RevalidationTarget[]) {
  const seen = new Set<string>()
  const unique: RevalidationTarget[] = []
  for (const target of targets) {
    validateTarget(target)
    const key = `${target.kind}:${target.value}`
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(target)
  }
  return unique
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Framework code supplies the real Next.js `revalidatePath`/`revalidateTag`
 * calls at the authenticated mutation boundary. This module intentionally has
 * no `next/cache` import, keeping the protected static runtime untouched.
 */
export function createRevalidationBoundary(port: RevalidationPort): RevalidationBoundary {
  return {
    async refresh(targets) {
      const completed: RevalidationTarget[] = []
      const failed: RevalidationFailure[] = []
      for (const target of uniqueTargets(targets)) {
        try {
          if (target.kind === 'path') await port.path(target.value)
          else await port.tag(target.value)
          completed.push(target)
        } catch (error) {
          failed.push({ ...target, message: errorMessage(error) })
        }
      }
      return { completed, failed, ok: failed.length === 0 }
    },
  }
}

export function noOpRevalidationBoundary(): RevalidationBoundary {
  return {
    async refresh() {
      return { completed: [], failed: [], ok: true }
    },
  }
}

function normalizePath(pathname: string) {
  if (!pathname.startsWith('/') || pathname.startsWith('//')) {
    throw new TypeError(`Content paths must be site-relative: ${pathname}`)
  }
  const withoutQueryOrHash = pathname.split(/[?#]/, 1)[0]
  return withoutQueryOrHash === '/' ? '/' : withoutQueryOrHash.replace(/\/+$/, '')
}

function tagPath(pathname: string) {
  return pathname === '/' ? 'home' : pathname.slice(1).replace(/[^a-z0-9]+/gi, ':')
}

export function publicContentRevalidationTargets(input: {
  path: string
  type: string
}): RevalidationTarget[] {
  const path = normalizePath(input.path)
  const type = input.type.toLowerCase()
  const paths = new Set([path, '/sitemap_index.xml'])

  if (type === 'post') {
    paths.add('/blog')
    paths.add('/post-sitemap.xml')
  } else if (type === 'product') {
    paths.add('/')
    paths.add('/shop')
    paths.add('/product-sitemap.xml')
  } else if (type === 'category' || type === 'taxonomy') {
    paths.add('/')
    paths.add('/product_cat-sitemap.xml')
  } else {
    paths.add('/page-sitemap.xml')
  }

  return [
    ...[...paths].map((value): RevalidationTarget => ({ kind: 'path', value })),
    { kind: 'tag', value: 'content' },
    { kind: 'tag', value: `content:${type}` },
    { kind: 'tag', value: `content:path:${tagPath(path)}` },
  ]
}
