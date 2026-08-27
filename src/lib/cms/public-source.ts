export const CMS_PUBLIC_SOURCE_ENABLED = false as const

export const CMS_PUBLIC_SOURCE_STATUS = Object.freeze({
  enabled: CMS_PUBLIC_SOURCE_ENABLED,
  source: 'protected-static',
  reason: 'CMS records are staged only; the certified public renderer remains bound to protected static content.',
})

export class CmsPublicSourceLockedError extends Error {
  readonly code = 'CMS_PUBLIC_SOURCE_LOCKED'

  constructor() {
    super(CMS_PUBLIC_SOURCE_STATUS.reason)
    this.name = 'CmsPublicSourceLockedError'
  }
}

export function assertCmsPublicSourceEnabled(): void {
  if (!CMS_PUBLIC_SOURCE_ENABLED) throw new CmsPublicSourceLockedError()
}
