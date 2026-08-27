import type { ContentRecord } from '../../../../lib/content'
import styles from '../../admin.module.css'

type Props = { action: (data: FormData) => void | Promise<void>; record?: ContentRecord; submitLabel: string }

function CmsTextFields({ record }: Pick<Props, 'record'>) {
  return <>
    <label className={styles.field}>Excerpt<textarea className={styles.textareaSmall} defaultValue={record?.excerpt ?? ''} name="excerpt" /></label>
    <label className={styles.field}>Body HTML<textarea className={styles.codeTextarea} defaultValue={record?.bodyHtml ?? ''} name="bodyHtml" spellCheck={false} /></label>
    <div className={styles.splitFields}><label className={styles.field}>SEO title<input className={styles.input} defaultValue={record?.seo.title ?? ''} name="seoTitle" /></label><label className={styles.field}>Robots<input className={styles.input} defaultValue={record?.seo.robots ?? ''} name="robots" /></label></div>
    <label className={styles.field}>SEO description<textarea className={styles.textareaSmall} defaultValue={record?.seo.description ?? ''} name="seoDescription" /></label>
    <label className={styles.field}>Canonical URL<input className={styles.input} defaultValue={record?.seo.canonical ?? ''} name="canonical" type="url" /></label>
  </>
}

function CmsJsonFields({ record }: Pick<Props, 'record'>) {
  const fields = [['data', 'Content data', record?.data ?? {}], ['openGraph', 'Open Graph', record?.seo.openGraph ?? {}], ['twitter', 'Twitter metadata', record?.seo.twitter ?? {}], ['structuredData', 'Structured data', record?.seo.structuredData ?? []]] as const
  return <div className={styles.splitFields}>{fields.map(([name, label, value]) => <label className={styles.field} key={name}>{label} (JSON)<textarea className={styles.codeTextareaSmall} defaultValue={JSON.stringify(value, null, 2)} name={name} spellCheck={false} /></label>)}</div>
}

export function ContentForm({ action, record, submitLabel }: Props) {
  return <form action={action} className={styles.form}>
    {record ? <><input name="id" type="hidden" value={record.id} /><input name="revision" type="hidden" value={record.revision} /></> : null}
    <label className={styles.field}>Type<select className={styles.select} defaultValue={record?.type ?? 'page'} name="type"><option value="page">Page</option><option value="product">Product</option><option value="post">Post</option><option value="category">Category</option><option value="global">Global</option></select></label>
    <label className={styles.field}>Title<input className={styles.input} defaultValue={record?.title} name="title" required /></label>
    <label className={styles.field}>Staged route path (not live)<input className={styles.input} defaultValue={record?.path} name="path" required /></label>
    <label className={styles.field}>Slug<input className={styles.input} defaultValue={record?.slug} name="slug" required /></label>
    <CmsTextFields record={record} /><CmsJsonFields record={record} />
    <label className={styles.field}>Change summary<input className={styles.input} name="changeSummary" /></label>
    <button className={styles.button} type="submit">{submitLabel}</button>
  </form>
}
