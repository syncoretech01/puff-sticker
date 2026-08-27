import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import styles from './admin.module.css'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export const metadata: Metadata = {
  title: 'Puff Sticker Admin',
  description: 'Private Puff Sticker content administration.',
  referrer: 'no-referrer',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
}

export default function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <div className={styles.surface}>{children}</div>
}
