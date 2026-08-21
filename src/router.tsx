import { createContext, forwardRef, type FocusEvent, type MouseEvent, type PointerEvent, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

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
  prefetch: (to: string) => void
}

export type ClientNavigationAdapter = {
  push: (to: string) => void
  replace: (to: string) => void
  prefetch?: (to: string) => void
}

type RouterProviderProps = {
  children: ReactNode
  initialLocation?: Partial<LocationState>
  renderPathname?: string
  nextMode?: boolean
  clientNavigation?: ClientNavigationAdapter
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

function locationsMatch(left: LocationState, right: LocationState): boolean {
  return left.pathname === right.pathname && left.search === right.search && left.hash === right.hash
}

function localNavigationTarget(to: string): { href: string; location: LocationState } | null {
  if (typeof window === 'undefined') return null
  let target: URL
  try {
    target = new URL(to, window.location.href)
  } catch {
    return null
  }
  if (target.origin !== window.location.origin || !['http:', 'https:'].includes(target.protocol)) return null
  return {
    href: `${target.pathname}${target.search}${target.hash}`,
    location: normalizeLocation({ pathname: target.pathname, search: target.search, hash: target.hash }),
  }
}

const RouterContext = createContext<RouterValue | null>(null)

export function RouterProvider({ children, initialLocation, renderPathname, nextMode = false, clientNavigation }: RouterProviderProps) {
  const initialPathname = initialLocation?.pathname
  const initialSearch = initialLocation?.search
  const initialHash = initialLocation?.hash
  const hasInitialLocation = initialLocation !== undefined
  const [location, setLocation] = useState<LocationState>(() => initialLocation
    ? normalizeLocation(initialLocation)
    : currentLocation())
  const [revision, setRevision] = useState(0)
  const locationRef = useRef(location)

  const commitLocation = useCallback((nextLocation: LocationState, forceRevision = false) => {
    const normalized = normalizeLocation(nextLocation)
    const changed = !locationsMatch(locationRef.current, normalized)
    if (!changed && !forceRevision) return
    locationRef.current = normalized
    if (changed) setLocation(normalized)
    setRevision((value) => value + 1)
  }, [])

  useEffect(() => {
    const update = () => {
      const browser = currentLocation()
      // Next owns pathname history. Its new server route supplies the matching
      // renderPathname, so wait for that prop before swapping route content.
      // Same-page query/hash history remains safe to reconcile immediately.
      if (clientNavigation && browser.pathname !== locationRef.current.pathname) return
      commitLocation(browser, true)
    }
    // Next supplies a deterministic path to the server and the first client
    // render. Reconcile every changed server path (not only hydration-time URL
    // mismatches), then take query/hash from the browser when it is on that path.
    if (hasInitialLocation) {
      const initial = normalizeLocation({ pathname: initialPathname, search: initialSearch, hash: initialHash })
      const browser = currentLocation(initial)
      commitLocation(browser.pathname === initial.pathname ? browser : initial)
    }
    window.addEventListener('popstate', update)
    window.addEventListener('hashchange', update)
    window.addEventListener('puff:navigate', update)
    return () => {
      window.removeEventListener('popstate', update)
      window.removeEventListener('hashchange', update)
      window.removeEventListener('puff:navigate', update)
    }
  }, [clientNavigation, commitLocation, hasInitialLocation, initialHash, initialPathname, initialSearch])

  useEffect(() => {
    if (!clientNavigation || !location.hash) return

    let id = location.hash.slice(1)
    try { id = decodeURIComponent(id) } catch { /* retain the literal hash */ }
    const startingScrollY = window.scrollY
    let cancelled = false

    const alignHashIfStalled = (onlyWhenStalled: boolean) => {
      if (cancelled) return
      const target = document.getElementById(id)
      if (!target) return
      const top = target.getBoundingClientRect().top
      if (top >= 0 && top <= 160) return
      if (onlyWhenStalled && Math.abs(window.scrollY - startingScrollY) > 1) return
      // App starts the protected smooth hash reveal first. Lenis can suppress
      // native smooth scrolling while a new Next page segment is mounting, so
      // correct only a stalled or still-misaligned handoff.
      target.scrollIntoView({ behavior: 'auto', block: 'start' })
    }

    const stalled = window.setTimeout(() => alignHashIfStalled(true), 160)
    const settled = window.setTimeout(() => alignHashIfStalled(false), 1_200)
    return () => {
      cancelled = true
      window.clearTimeout(stalled)
      window.clearTimeout(settled)
    }
  }, [clientNavigation, location.hash, location.pathname, revision])

  const value = useMemo<RouterValue>(
    () => ({
      ...location,
      revision,
      renderPathname: normalizePathname(renderPathname ?? location.pathname),
      nextMode,
      navigate: (to, options) => {
        const target = localNavigationTarget(to)
        if (!target) {
          if (options?.replace) window.location.replace(to)
          else window.location.assign(to)
          return
        }
        const next = target.href
        const current = `${window.location.pathname}${window.location.search}${window.location.hash}`
        const replace = options?.replace
          || next === current
          || Boolean(clientNavigation && locationsMatch(target.location, currentLocation()))
        if (clientNavigation) {
          if (replace) clientNavigation.replace(next)
          else clientNavigation.push(next)
          // Route content must change with the server-provided renderPathname.
          // Query/hash-only transitions can update without waiting for a route.
          if (target.location.pathname === locationRef.current.pathname) {
            commitLocation(target.location, true)
          }
          return
        }
        if (replace) window.history.replaceState({}, '', next)
        else window.history.pushState({}, '', next)
        window.dispatchEvent(new Event('puff:navigate'))
      },
      prefetch: (to) => {
        const target = localNavigationTarget(to)
        if (!target || !clientNavigation?.prefetch) return
        clientNavigation.prefetch(`${target.location.pathname}${target.location.search}`)
      },
    }),
    [clientNavigation, commitLocation, location, nextMode, renderPathname, revision],
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
  const { navigate, prefetch } = useRouter()
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const target = localNavigationTarget(to)
    if (!target || event.currentTarget.target === '_blank' || event.currentTarget.hasAttribute('download')) {
      onClick?.()
      return
    }
    event.preventDefault()
    onClick?.()
    navigate(to)
  }

  const handlePrefetch = () => {
    prefetchRoute(to)
    prefetch(to)
  }

  return (
    <a
      ref={ref}
      href={to}
      className={className}
      onClick={handleClick}
      onPointerEnter={(event) => { handlePrefetch(); onPointerEnter?.(event) }}
      onFocus={(event) => { handlePrefetch(); onFocus?.(event) }}
      aria-label={ariaLabel}
      data-cursor={cursor}
    >
      {children}
    </a>
  )
})
