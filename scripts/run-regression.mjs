import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const targetOrigin = process.env.PUFF_REGRESSION_BASE_URL ?? 'http://127.0.0.1:4173'
const profile = process.env.PUFF_REGRESSION_PROFILE ?? 'vite'
const external = process.env.PUFF_REGRESSION_EXTERNAL_SERVER === '1'
const playwrightCli = resolve(root, 'node_modules/@playwright/test/cli.js')

if (!existsSync(playwrightCli)) {
  throw new Error('Playwright is not installed. Run npm install first.')
}

function startServer() {
  const customCommand = process.env.PUFF_REGRESSION_SERVER_COMMAND
  if (customCommand) {
    return spawn(customCommand, {
      cwd: root,
      detached: process.platform !== 'win32',
      env: process.env,
      shell: true,
      stdio: 'inherit',
    })
  }

  const target = new URL(targetOrigin)
  if (profile === 'next') {
    return spawn(process.execPath, [
      resolve(root, 'node_modules/next/dist/bin/next'),
      'start',
      '--hostname', target.hostname,
      '--port', target.port || '3000',
    ], { cwd: root, env: process.env, stdio: 'inherit' })
  }

  return spawn(process.execPath, [
    resolve(root, 'node_modules/vite/bin/vite.js'),
    'preview',
    '--host', target.hostname,
    '--port', target.port || '4173',
  ], { cwd: root, env: process.env, stdio: 'inherit' })
}

async function waitForServer(server) {
  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Regression server exited before becoming ready (code ${server.exitCode}).`)
    }
    try {
      const response = await fetch(targetOrigin, { signal: AbortSignal.timeout(2_000) })
      if (response.status < 500) return
    } catch {
      // The server is still starting.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250))
  }
  throw new Error(`Regression server did not become ready at ${targetOrigin}.`)
}

function runPlaywright() {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [playwrightCli, 'test', ...process.argv.slice(2)], {
      cwd: root,
      env: { ...process.env, PUFF_REGRESSION_EXTERNAL_SERVER: '1' },
      stdio: 'inherit',
    })
    child.once('error', rejectRun)
    child.once('exit', (code, signal) => {
      if (signal) rejectRun(new Error(`Playwright terminated by ${signal}.`))
      else resolveRun(code ?? 1)
    })
  })
}

async function stopServer(server) {
  if (!server || server.exitCode !== null) return
  server.kill('SIGTERM')
  const exited = await Promise.race([
    new Promise((resolveExit) => server.once('exit', () => resolveExit(true))),
    new Promise((resolveTimeout) => setTimeout(() => resolveTimeout(false), 5_000)),
  ])
  if (exited || server.exitCode !== null) return

  if (process.platform === 'win32') {
    spawnSync('taskkill.exe', ['/PID', String(server.pid), '/T', '/F'], { stdio: 'ignore' })
  } else if (server.pid) {
    try { process.kill(-server.pid, 'SIGKILL') } catch { server.kill('SIGKILL') }
  }
}

let server
let exitCode = 1
try {
  if (!external) {
    server = startServer()
    await waitForServer(server)
  }
  exitCode = await runPlaywright()
} finally {
  await stopServer(server)
}

process.exitCode = exitCode
