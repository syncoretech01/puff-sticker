import Link from 'next/link'
import { adminContentHref } from '../../../../lib/admin/content-route'
import { getCmsContentRepository, getCmsPersistenceStatus } from '../../../../lib/db/content-repository'
import styles from '../../admin.module.css'

export default async function AdminContentPage() {
  const persistence = getCmsPersistenceStatus()
  const records = persistence.configured ? await getCmsContentRepository().listContent({ statuses: ['draft', 'published', 'archived'], limit: 500 }) : []
  return <>
    <header className={styles.pageHeader}><div><p className={styles.eyebrow}>Repository</p><h1 className={styles.pageTitle}>Content</h1></div>{persistence.configured ? <Link className={styles.button} href="/admin/content/new">New draft</Link> : null}</header>
    <section className={styles.notice} role="status">Staged repository only. CMS records are not connected to the protected public renderer.</section>
    {!persistence.configured ? <section className={styles.error} role="status"><strong>Persistence setup required.</strong><p>{persistence.reason} Public rendering remains on the protected static source.</p></section> : null}
    <section className={styles.panel}>{records.length ? <div className={styles.tableWrap}><table className={styles.table}>
      <thead><tr><th>Title</th><th>Type</th><th>Status</th><th>Revision</th><th>Path</th></tr></thead>
      <tbody>{records.map((record) => <tr key={record.id}><td><Link href={adminContentHref(record.id)}>{record.title}</Link></td><td>{record.type}</td><td><span className={styles.badge}>{record.status}</span></td><td>{record.revision}</td><td>{record.path}</td></tr>)}</tbody>
    </table></div> : <p className={styles.empty}>No CMS records are available.</p>}</section>
  </>
}
