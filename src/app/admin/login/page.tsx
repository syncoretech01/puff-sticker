import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getAdminConfigurationStatus, getAdminSession } from '../../../lib/admin'
import { loginAction } from '../auth-actions'
import styles from '../admin.module.css'

type LoginPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>
}>

const errorMessages: Readonly<Record<string, string>> = {
  invalid: 'The username or password was not accepted.',
  'rate-limited': 'Too many sign-in attempts. Wait 15 minutes before trying again.',
  session: 'Your session is missing or expired. Sign in again.',
  unconfigured: 'Admin access is not configured for this deployment.',
  unavailable: 'Admin sign-in is temporarily unavailable. No access was granted.',
}

function queryValue(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value : ''
}

export default async function AdminLoginPage({ searchParams }: LoginPageProps) {
  if (await getAdminSession()) redirect('/admin')
  const params = await searchParams
  const error = queryValue(params.error)
  const status = queryValue(params.status)
  const next = queryValue(params.next)
  const configuration = getAdminConfigurationStatus()

  return (
    <main className={styles.loginStage}>
      <section className={styles.loginCard} aria-labelledby="admin-login-title">
        <p className={styles.eyebrow}>Private workspace</p>
        <h1 className={styles.title} id="admin-login-title">Puff Sticker Admin</h1>
        <p className={styles.lede}>
          Sign in to stage drafts and review revisions. Public publishing remains locked until
          source reconciliation and cutover certification are complete.
        </p>

        {status === 'signed-out' ? (
          <p className={styles.notice} role="status">You have been signed out.</p>
        ) : null}
        {errorMessages[error] ? (
          <p className={styles.error} role="alert">{errorMessages[error]}</p>
        ) : null}
        {!configuration.configured ? (
          <div className={styles.error} role="alert">
            <strong>Secure setup required.</strong>
            <p>
              This deployment has no usable admin credentials. Access remains locked until the
              required server environment variables are configured.
            </p>
          </div>
        ) : (
          <form action={loginAction} className={styles.form}>
            <input name="next" type="hidden" value={next} />
            <label className={styles.field}>
              Username
              <input
                autoComplete="username"
                autoFocus
                className={styles.input}
                maxLength={128}
                name="username"
                required
                type="text"
              />
            </label>
            <label className={styles.field}>
              Password
              <input
                autoComplete="current-password"
                className={styles.input}
                maxLength={1024}
                minLength={14}
                name="password"
                required
                type="password"
              />
            </label>
            <button className={styles.button} type="submit">Sign in</button>
          </form>
        )}

        <p className={styles.help}>
          <Link href="/">Return to the public website</Link>
        </p>
      </section>
    </main>
  )
}
