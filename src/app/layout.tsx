import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'

import '@fontsource-variable/manrope'
import '@fontsource-variable/archivo'
import '../styles.css'
import '../site-pages.css'

const introPreferenceScript = `
try {
  if (
    sessionStorage.getItem('puff-intro-seen') === '1' ||
    matchMedia('(prefers-reduced-motion: reduce)').matches
  ) document.documentElement.classList.add('puff-intro-skip')
} catch {}
`

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
    <html lang="en" suppressHydrationWarning>
      <head>
        <style>{'.puff-intro-skip .loader { display: none !important; }'}</style>
        <script dangerouslySetInnerHTML={{ __html: introPreferenceScript }} />
        <noscript><style>{'.loader { display: none !important; }'}</style></noscript>
      </head>
      <body>
        <div id="root">{children}</div>
      </body>
    </html>
  )
}
