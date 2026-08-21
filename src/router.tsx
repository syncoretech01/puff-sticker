import { createContext, forwardRef, type FocusEvent, type MouseEvent, type PointerEvent, type ReactNode, useContext, useEffect, useMemo, useState } from 'react'

export type LocationState = {
  pathname: string
  search: string
  hash: string
}

type RouterValue = LocationState & {
  revision: number
  renderPathname: string
  nextMode: boolean
  navigate: (to: string, options?: { replace?: boolean }) => void
}

type RouterProviderProps = {
  children: ReactNode
  initialLocation?: Partial<LocationState>
  renderPathname?: string
  nextMode?: boolean
}

function normalizePathname(pathname: string | undefined): string {
  if (!pathname) return '/'
  return pathname.replace(/\/+$/, '') || '/'
}

function normalizeLocation(location: Partial<LocationState> | undefined): LocationState {
  return {
    pathname: normalizePathname(location?.pathname),
    search: location?.search ?? '',
    hash: location?.hash ?? '',
  }
}

const currentLocation = (fallback?: Partial<LocationState>): LocationState => {
  if (typeof window === 'undefined') return normalizeLocation(fallback)
  return {
    pathname: normalizePathname(window.location.pathname),
    search: window.location.search,
    hash: window.location.hash,
  }
}

const RouterContext = createContext<RouterValue | null>(null)

export function RouterProvider({ children, initialLocation, renderPathname, nextMode = false }: RouterProviderProps) {
  const initialPathname = initialLocation?.pathname
  const initialSearch = initialLocation?.search
  const initialHash = initialLocation?.hash
  const hasInitialLocation = initialLocation !== undefined
  const [location, setLocation] = useState<LocationState>(() => initialLocation
    ? normalizeLocation(initialLocation)
    : currentLocation())
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    const update = () => {
      setLocation(currentLocation())
      setRevision((value) => value + 1)
    }
    // Next supplies a deterministic path to the server and the first client
    // render. Query/hash state is then reconciled from the real browser URL.
    if (hasInitialLocation) {
      const initial = normalizeLocation({ pathname: initialPathname, search: initialSearch, hash: initialHash })
      const browser = currentLocation()
      if (browser.pathname !== initial.pathname || browser.search !== initial.search || browser.hash !== initial.hash) update()
    }
    window.addEventListener('popstate', update)
    window.addEventListener('hashchange', update)
    window.addEventListener('puff:navigate', update)
    return () => {
      window.removeEventListener('popstate', update)
      window.removeEventListener('hashchange', update)
      window.removeEventListener('puff:navigate', update)
    }
  }, [hasInitialLocation, initialHash, initialPathname, initialSearch])

  const value = useMemo<RouterValue>(
    () => ({
      ...location,
      revision,
      renderPathname: normalizePathname(renderPathname ?? location.pathname),
      nextMode,
      navigate: (to, options) => {
        if (nextMode) {
          if (options?.replace) window.location.replace(to)
          else window.location.assign(to)
          return
        }
        const target = new URL(to, window.location.origin)
        const next = `${target.pathname}${target.search}${target.hash}`
        const current = `${window.location.pathname}${window.location.search}${window.location.hash}`
        if (options?.replace || next === current) window.history.replaceState({}, '', next)
        else window.history.pushState({}, '', next)
        window.dispatchEvent(new Event('puff:navigate'))
      },
    }),
    [location, nextMode, renderPathname, revision],
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
  if (typeof window === 'undefined') return
  if (!to.startsWith('/') || to.startsWith('/#')) return
  const parts = new URL(to, window.location.origin).pathname.split('/').filter(Boolean)
  if (!parts.length) return
  sitePagesPrefetch ??= import('./site/SitePages')
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
  const { navigate, nextMode } = useRouter()
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    if (nextMode) {
      onClick?.()
      return
    }
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
