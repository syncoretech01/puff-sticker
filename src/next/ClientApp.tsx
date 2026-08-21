'use client'

import { useRouter as useNextRouter } from 'next/navigation'
import { useMemo } from 'react'

import App, { type AppPageComponents } from '../App'
import { RouterProvider, type ClientNavigationAdapter } from '../router'
import {
  AboutPage,
  ArchivePage,
  BlogArticlePage,
  BlogPage,
  CategoryPage,
  ContactPage,
  FullFaqPage,
  PolicyPage,
  ProductPage,
  QuotePage,
  ResourcesPage,
  ShopPage,
} from '../site/SitePages'

const nextPageComponents: AppPageComponents = {
  AboutPage,
  ArchivePage,
  BlogArticlePage,
  BlogPage,
  CategoryPage,
  ContactPage,
  FullFaqPage,
  PolicyPage,
  ProductPage,
  QuotePage,
  ResourcesPage,
  ShopPage,
}

function publicNextHref(to: string): string {
  const target = new URL(to, 'https://puffsticker.local')
  const finalSegment = target.pathname.split('/').filter(Boolean).at(-1) ?? ''
  if (target.pathname !== '/' && !target.pathname.endsWith('/') && !finalSegment.includes('.')) {
    target.pathname = `${target.pathname}/`
  }
  return `${target.pathname}${target.search}${target.hash}`
}

export type ClientAppProps = {
  initialPathname: string
  initialSearch?: string
  initialHash?: string
  renderPathname?: string
  nextMode?: boolean
}

export default function ClientApp({
  initialPathname,
  initialSearch = '',
  initialHash = '',
  renderPathname,
  nextMode = true,
}: ClientAppProps) {
  const nextRouter = useNextRouter()
  const clientNavigation = useMemo<ClientNavigationAdapter>(() => ({
    push: (to) => nextRouter.push(publicNextHref(to), { scroll: false }),
    replace: (to) => nextRouter.replace(publicNextHref(to), { scroll: false }),
    prefetch: (to) => nextRouter.prefetch(publicNextHref(to)),
  }), [nextRouter])

  return (
    <RouterProvider
      initialLocation={{ pathname: initialPathname, search: initialSearch, hash: initialHash }}
      renderPathname={renderPathname}
      nextMode={nextMode}
      clientNavigation={clientNavigation}
    >
      <App pageComponents={nextPageComponents} />
    </RouterProvider>
  )
}
