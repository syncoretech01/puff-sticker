import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'

import '@fontsource-variable/manrope'
import '@fontsource-variable/archivo'
import '../styles.css'
import '../site-pages.css'

export const metadata: Metadata = {
  icons: {
    icon: [{ url: '/assets/puff-logo.webp', type: 'image/webp' }],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#081d45',
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div id="root">{children}</div>
      </body>
    </html>
  )
}
