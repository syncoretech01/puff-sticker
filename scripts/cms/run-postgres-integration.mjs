import { randomUUID, scryptSync } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { createServer } from 'node:net'

const POSTGRES_IMAGE = 'postgres@sha256:57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777'
const POSTGRES_PASSWORD = 'puff-integration-database-only'
const ADMIN_PASSWORD = 'PuffSticker-Test-Only-2026!'
const ROOT = process.cwd()
const npmCli = process.env.npm_execpath
if (!npmCli) throw new Error('Run this integration gate through npm so npm_execpath is available.')

function adminPasswordHash() {
  const salt = Buffer.from('00112233445566778899aabbccddeeff', 'hex')
  const digest = scryptSync(ADMIN_PASSWORD, salt, 64, {
    N: 16_384,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  })
  return ['scrypt', '1', '16384', '8', '1', salt.toString('base64url'), digest.toString('base64url')].join('$')
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    env: options.env ?? process.env,
    stdio: options.capture ? 'pipe' : 'inherit',
    timeout: options.timeout,
  })
  if (result.error && !options.allowFailure) throw result.error
  if (result.status !== 0 && !options.allowFailure) {
    if (options.capture) {
      if (result.stdout) process.stdout.write(result.stdout)
      if (result.stderr) process.stderr.write(result.stderr)
    }
    throw new Error(`${command} ${args.join(' ')} exited with status ${result.status}.`)
  }
  return options.capture ? (result.stdout ?? '').trim() : ''
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function waitForPostgres(containerName) {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const state = run('docker', [
      'inspect',
      '--format={{.State.Health.Status}}',
      containerName,
    ], { allowFailure: true, capture: true })
    if (state === 'healthy') return
    if (state === 'unhealthy') throw new Error('Pinned PostgreSQL container became unhealthy.')
    await delay(500)
  }
  throw new Error('Timed out waiting for pinned PostgreSQL container health.')
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close()
        reject(new Error('Could not allocate a local Next.js integration port.'))
        return
      }
      server.close((error) => error ? reject(error) : resolve(address.port))
    })
  })
}

async function main() {
  const containerName = `puff-cms-test-${process.pid}-${randomUUID().slice(0, 8)}`
  const baseEnvironment = {
    ...process.env,
    PUFF_ADMIN_PASSWORD_HASH: adminPasswordHash(),
    PUFF_ADMIN_ROLE: 'admin',
    PUFF_ADMIN_SESSION_SECRET: 'puff-integration-session-secret-2026-only-do-not-deploy',
    PUFF_ADMIN_SESSION_VERSION: 'integration-1',
    PUFF_ADMIN_USERNAME: 'integration-admin',
    PUFF_TEST_ADMIN_PASSWORD: ADMIN_PASSWORD,
    VERCEL_ENV: 'production',
  }

  console.log('Building the production Next.js artifact with production indexability settings...')
  run(process.execPath, [npmCli, 'run', 'build'], {
    env: baseEnvironment,
    timeout: 10 * 60 * 1_000,
  })

  let containerCreated = false
  try {
    console.log(`Starting pinned PostgreSQL 16.14 integration container ${containerName}...`)
    run('docker', [
      'run',
      '--detach',
      '--rm',
      '--name', containerName,
      '--label', 'com.puffsticker.test=postgres-integration',
      '--env', 'POSTGRES_DB=puff_test',
      '--env', `POSTGRES_PASSWORD=${POSTGRES_PASSWORD}`,
      '--env', 'POSTGRES_USER=puff',
      '--publish', '127.0.0.1::5432',
      '--health-cmd', 'pg_isready -U puff -d puff_test',
      '--health-interval', '1s',
      '--health-timeout', '5s',
      '--health-retries', '60',
      POSTGRES_IMAGE,
    ], { capture: true })
    containerCreated = true
    await waitForPostgres(containerName)

    const mapping = run('docker', ['port', containerName, '5432/tcp'], { capture: true })
    const match = /:(\d+)\s*$/.exec(mapping)
    if (!match) throw new Error(`Could not resolve the PostgreSQL host port from: ${mapping}`)
    const databaseUrl = `postgresql://puff:${encodeURIComponent(POSTGRES_PASSWORD)}@127.0.0.1:${match[1]}/puff_test`
    const nextPort = await freePort()
    const integrationEnvironment = {
      ...baseEnvironment,
      DATABASE_URL: databaseUrl,
      PUFF_CMS_IMPORT_ACTOR: 'integration-importer',
      PUFF_TEST_DATABASE_URL: databaseUrl,
      PUFF_TEST_NEXT_PORT: String(nextPort),
    }

    console.log('Applying the committed Drizzle migration to the ephemeral database...')
    run(process.execPath, [npmCli, 'run', 'db:migrate'], {
      env: integrationEnvironment,
      timeout: 2 * 60 * 1_000,
    })
    console.log('Running repository, importer, throttle, trigger, and configured-admin browser gates...')
    run(process.execPath, [
      'node_modules/@playwright/test/cli.js',
      'test',
      '-c',
      'tests/cms/postgres.playwright.config.ts',
    ], { env: integrationEnvironment, timeout: 8 * 60 * 1_000 })
  } finally {
    if (containerCreated) {
      if (!/^puff-cms-test-\d+-[0-9a-f]{8}$/.test(containerName)) {
        throw new Error('Refusing to clean up an unexpected container name.')
      }
      run('docker', ['rm', '--force', containerName], { allowFailure: true, capture: true })
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
