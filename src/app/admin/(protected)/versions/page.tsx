import Link from 'next/link'
import { adminContentHref } from '../../../../lib/admin/content-route'

import { getCmsContentRepository, getCmsPersistenceStatus } from '../../../../lib/db/content-repository'
import styles from '../../admin.module.css'

export default async function VersionsPage() {
  const status = getCmsPersistenceStatus()
  const events = status.configured ? await getCmsContentRepository().listAuditEvents({ limit: 200 }) : []
  return <>
    <header className={styles.pageHeader}><div><p className={styles.eyebrow}>Immutable history</p><h1 className={styles.pageTitle}>Audit events</h1></div></header>
    <section className={styles.panel}>
      {events.length ? <div className={styles.tableWrap}><table className={styles.table}>
        <thead><tr><th>When</th><th>Action</th><th>Entity</th><th>Actor</th></tr></thead>
        <tbody>{events.map((event) => <tr key={event.id}>
          <td><time dateTime={event.occurredAt}>{event.occurredAt}</time></td>
          <td>{event.action}</td>
          <td>{event.entityType === 'content' ? <Link href={adminContentHref(event.entityId)}>{event.entityId}</Link> : event.entityId}</td>
          <td>{event.actorId}</td>
        </tr>)}</tbody>
      </table></div> : <p className={styles.empty}>No audit events are available.</p>}
    </section>
  </>
}
