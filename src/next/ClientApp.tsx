'use client'

import App, { type AppPageComponents } from '../App'
import { RouterProvider } from '../router'
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
  return (
    <RouterProvider
      initialLocation={{ pathname: initialPathname, search: initialSearch, hash: initialHash }}
      renderPathname={renderPathname}
      nextMode={nextMode}
    >
      <App pageComponents={nextPageComponents} />
    </RouterProvider>
  )
}
