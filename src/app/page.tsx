import { coreRouteMetadata, PublicRoute } from '../next/PublicRoute'

export const metadata = coreRouteMetadata('/')

export default function HomePage() {
  return <PublicRoute pathname="/" />
}
