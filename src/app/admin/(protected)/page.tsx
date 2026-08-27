import Link from 'next/link'

import { requireAdminSession } from '../../../lib/admin'
import { getCmsPersistenceStatus } from '../../../lib/db/content-repository'
import styles from '../admin.module.css'

type DashboardPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>
}>

export default async function AdminDashboardPage({ searchParams }: DashboardPageProps) {
  const session = await requireAdminSession('editor')
  const persistence = getCmsPersistenceStatus()
  const params = await searchParams
  const forbidden = params.error === 'forbidden'

  return (
    <>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Editorial control</p>
          <h1 className={styles.pageTitle}>Dashboard</h1>
        </div>
        <Link className={styles.button} href="/admin/content">Manage content</Link>
      </header>
      {forbidden ? (
        <p className={styles.error} role="alert">
          Your {session.role} role does not permit that operation.
        </p>
      ) : null}
      <section className={styles.grid} aria-label="Content overview">
        <article className={styles.statCard}>
          <p className={styles.statLabel}>Access role</p>
          <p className={styles.statValue}>{session.role}</p>
        </article>
        <article className={styles.statCard}>
          <p className={styles.statLabel}>Session security</p>
          <p className={styles.statValue}>Active</p>
        </article>
        <article className={styles.statCard}>
          <p className={styles.statLabel}>Persistence</p>
          <p className={styles.statValue}>{persistence.configured ? 'Ready' : 'Locked'}</p>
        </article>
      </section>
      {!persistence.configured ? (
        <section className={styles.error} role={'status'}>
          <strong>CMS persistence is not configured.</strong>
          <p>{persistence.reason} The protected public site is unaffected.</p>
        </section>
      ) : null}
      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Protected staging workflow</h2>
        <p className={styles.muted}>
          Draft changes are revision-checked and audited in the CMS repository. The public
          renderer is deliberately locked to the protected static source, so no CMS edit can
          publish, unpublish, archive, or otherwise change the live website during this phase.
        </p>
      </section>
    </>
  )
}
