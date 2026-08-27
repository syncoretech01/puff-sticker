import Link from 'next/link'
import type { ReactNode } from 'react'

import { requireAdminSession } from '../../../lib/admin'
import { logoutAction } from '../auth-actions'
import styles from '../admin.module.css'

export default async function ProtectedAdminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const session = await requireAdminSession('editor')

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/admin">Puff Sticker Admin</Link>
        <nav aria-label="Admin navigation" className={styles.nav}>
          <Link className={styles.navLink} href="/admin">Dashboard</Link>
          <Link className={styles.navLink} href="/admin/content">Content</Link>
          <Link className={styles.navLink} href="/admin/versions">Versions</Link>
        </nav>
        <div className={styles.account}>
          <div className={styles.accountCopy}>
            <strong>{session.subject}</strong>
            <span>{session.role}</span>
          </div>
          <form action={logoutAction}>
            <button className={styles.buttonSecondary} type="submit">Sign out</button>
          </form>
        </div>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  )
}
