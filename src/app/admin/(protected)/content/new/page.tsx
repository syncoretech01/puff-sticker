import { redirect } from 'next/navigation'
import { getCmsPersistenceStatus } from '../../../../../lib/db/content-repository'
import styles from '../../../admin.module.css'
import { createDraftAction } from '../../content-actions'
import { ContentForm } from '../content-form'

export default function NewContentPage() {
  if (!getCmsPersistenceStatus().configured) redirect('/admin/content')
  return <section className={styles.panel}>
    <h1 className={styles.pageTitle}>New content</h1>
    <ContentForm action={createDraftAction} submitLabel="Create draft" />
  </section>
}
