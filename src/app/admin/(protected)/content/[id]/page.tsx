import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { requireAdminSession } from '../../../../../lib/admin'
import { decodeAdminContentRouteId } from '../../../../../lib/admin/content-route'
import { getCmsContentRepository, getCmsPersistenceStatus } from '../../../../../lib/db/content-repository'
import styles from '../../../admin.module.css'
import { updateDraftAction } from '../../content-actions'
import { ContentForm } from '../content-form'

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function EditContentPage({ params, searchParams }: Props) {
  if (!getCmsPersistenceStatus().configured) redirect('/admin/content')
  await requireAdminSession('editor')
  const { id: encodedId } = await params
  let id: string
  try {
    id = decodeAdminContentRouteId(encodedId)
  } catch {
    notFound()
  }
  const repository = getCmsContentRepository()
  const record = await repository.getContent({ id, includeArchived: true, includeDrafts: true })
  if (!record) notFound()
  const query = await searchParams
  const status = typeof query.status === 'string' ? query.status : ''
  const versions = await repository.listContentVersions(record.id)

  return <>
    <header className={styles.pageHeader}>
      <div><p className={styles.eyebrow}>{record.type} - revision {record.revision}</p><h1 className={styles.pageTitle}>{record.title}</h1></div>
      <Link className={styles.buttonSecondary} href="/admin/content">Back to content</Link>
    </header>
    {status ? <p className={styles.notice} role="status">Content {status}.</p> : null}
    <p className={styles.notice} role="status">
      Staging mode is locked. Draft changes do not alter the protected public website.
    </p>
    <div className={styles.split}>
      <section className={styles.panel}>
        {record.status === 'draft'
          ? <ContentForm action={updateDraftAction} record={record} submitLabel="Save new revision" />
          : <p className={styles.muted}>Published and archived records are read-only. Return published content to draft before editing.</p>}
      </section>
      <aside>
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Workflow</h2>
          <dl className={styles.definitionList}>
            <dt>Status</dt><dd><span className={styles.badge}>{record.status}</span></dd>
            <dt>Revision</dt><dd>{record.revision}</dd>
            <dt>Staged route path</dt><dd>{record.path}</dd>
          </dl>
          <p className={styles.muted}>
            Publish, unpublish, and archive transitions are disabled until public-source
            reconciliation and cutover certification are complete.
          </p>
        </section>
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Versions</h2>
          {versions.length ? <ol className={styles.versionList}>{versions.map((version) =>
            <li key={version.id}><strong>r{version.revision}</strong><span>{version.createdBy}</span><time dateTime={version.createdAt}>{new Date(version.createdAt).toISOString()}</time></li>)}</ol>
            : <p className={styles.muted}>No versions recorded.</p>}
        </section>
      </aside>
    </div>
  </>
}
