import contentFixture from './fixtures/production-content-2026-09-30.json' with { type: 'json' }
import checkoutContentFixture from './fixtures/production-content-2026-10-01-checkout.json' with { type: 'json' }

export type CurrentProductionContentPayload = {
  path: string
  sourcePath: string
  semanticHtml: string
  semanticHtmlHash: string
}

type ContentPage = { semanticHtml: string; semanticHtmlHash: string }
const pages: Readonly<Record<string, ContentPage>> = {
  ...(contentFixture.pages as Readonly<Record<string, ContentPage>>),
  ...(checkoutContentFixture.pages as Readonly<Record<string, ContentPage>>),
}

export function currentProductionContent(path: string, canonicalPath: string): CurrentProductionContentPayload | null {
  const sourcePath = pages[path] ? path : pages[canonicalPath] ? canonicalPath : null
  if (!sourcePath) return null
  return { path, sourcePath, ...pages[sourcePath] }
}

export const CURRENT_PRODUCTION_CONTENT_ROUTE_COUNT = contentFixture.routeCount + checkoutContentFixture.routeCount
export const CURRENT_PRODUCTION_CONTENT_ASSET_COUNT = contentFixture.assetCount + checkoutContentFixture.assetCount
