import { exactSeoEndpointResponse } from '../../lib/seo/endpoint-response'

export const dynamic = 'force-static'

export function GET() {
  return exactSeoEndpointResponse('/sitemap.xml')
}
