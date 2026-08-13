import { createContext, forwardRef, type FocusEvent, type MouseEvent, type PointerEvent, type ReactNode, useContext, useEffect, useMemo, useState } from 'react'

export type LocationState = {
  pathname: string
  search: string
  hash: string
}

type RouterValue = LocationState & {
  revision: number
  navigate: (to: string, options?: { replace?: boolean }) => void
}

const currentLocation = (): LocationState => ({
  pathname: window.location.pathname.replace(/\/+$/, '') || '/',
  search: window.location.search,
  hash: window.location.hash,
})

const RouterContext = createContext<RouterValue | null>(null)

export function RouterProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<LocationState>(currentLocation)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    const update = () => {
      setLocation(currentLocation())
      setRevision((value) => value + 1)
    }
    window.addEventListener('popstate', update)
    window.addEventListener('hashchange', update)
    window.addEventListener('puff:navigate', update)
    return () => {
      window.removeEventListener('popstate', update)
      window.removeEventListener('hashchange', update)
      window.removeEventListener('puff:navigate', update)
    }
  }, [])

  const value = useMemo<RouterValue>(
    () => ({
      ...location,
      revision,
      navigate: (to, options) => {
        const target = new URL(to, window.location.origin)
        const next = `${target.pathname}${target.search}${target.hash}`
        const current = `${window.location.pathname}${window.location.search}${window.location.hash}`
        if (options?.replace || next === current) window.history.replaceState({}, '', next)
        else window.history.pushState({}, '', next)
        window.dispatchEvent(new Event('puff:navigate'))
      },
    }),
    [location, revision],
  )

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
}

export function useRouter() {
  const context = useContext(RouterContext)
  if (!context) throw new Error('useRouter must be used inside RouterProvider')
  return context
}

let sitePagesPrefetch: Promise<unknown> | null = null
let liveProductPrefetch: Promise<unknown> | null = null
let liveBlogPrefetch: Promise<unknown> | null = null
let livePagePrefetch: Promise<unknown> | null = null

function prefetchRoute(to: string) {
  if (!to.startsWith('/') || to.startsWith('/#')) return
  const parts = new URL(to, window.location.origin).pathname.split('/').filter(Boolean)
  if (!parts.length) return
  sitePagesPrefetch ??= import('./pages/SitePages')
  if ((parts.length === 2 && ['puffy-labels-stickers', 'flat-labels-stickers', 'promotional-items', 'product'].includes(parts[0])) || parts[0] === 'product') {
    liveProductPrefetch ??= import('./content/liveProductContent')
  } else if (parts[0] === 'blog' && parts.length === 2) {
    liveBlogPrefetch ??= import('./content/liveBlogContent')
  } else if (['privacy-policy', 'reprint-policy', 'terms-of-service'].includes(parts[0])) {
    livePagePrefetch ??= import('./content/livePageContent')
  }
}

export const SiteLink = forwardRef<HTMLAnchorElement, {
  to: string
  children: ReactNode
  className?: string
  onClick?: () => void
  onPointerEnter?: (event: PointerEvent<HTMLAnchorElement>) => void
  onFocus?: (event: FocusEvent<HTMLAnchorElement>) => void
  'aria-label'?: string
  'data-cursor'?: string
}>(function SiteLink({
  to,
  children,
  className,
  onClick,
  onPointerEnter,
  onFocus,
  'aria-label': ariaLabel,
  'data-cursor': cursor,
}, ref) {
  const { navigate } = useRouter()
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    onClick?.()
    navigate(to)
  }

  return (
    <a
      ref={ref}
      href={to}
      className={className}
      onClick={handleClick}
      onPointerEnter={(event) => { prefetchRoute(to); onPointerEnter?.(event) }}
      onFocus={(event) => { prefetchRoute(to); onFocus?.(event) }}
      aria-label={ariaLabel}
      data-cursor={cursor}
    >
      {children}
    </a>
  )
})
