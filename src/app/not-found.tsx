import type { Metadata } from 'next'

import ClientApp from '../next/ClientApp'

export const metadata: Metadata = {
  title: 'Page Not Found | PuffSticker.com',
  robots: 'noindex, follow',
}

export default function NotFound() {
  return (
    <ClientApp
      initialPathname="/__puff-not-found"
      renderPathname="/__puff-not-found"
      nextMode
    />
  )
}
