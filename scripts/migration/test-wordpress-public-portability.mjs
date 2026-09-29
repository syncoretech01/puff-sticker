#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const sourceDirectory = resolve(repositoryRoot, 'data/migration/wordpress-public')
const validator = resolve(repositoryRoot, 'scripts/migration/validate-wordpress-public.mjs')
const temporaryDirectory = await mkdtemp(resolve(tmpdir(), 'puff-wordpress-portability-'))

try {
  for (const name of ['manifest.json', 'content.json', 'exclusions.json']) {
    const source = await readFile(resolve(sourceDirectory, name), 'utf8')
    const materialized = name === 'manifest.json' ? source : source.replace(/\r\n?|\n/g, '\r\n')
    await writeFile(resolve(temporaryDirectory, name), materialized, 'utf8')
  }

  const result = spawnSync(process.execPath, [validator, temporaryDirectory], {
    encoding: 'utf8',
    windowsHide: true,
  })

  if (result.status !== 0) {
    throw new Error(`CRLF portability validation failed:\n${result.stderr || result.stdout}`)
  }

  console.log(JSON.stringify({ valid: true, lineEndings: 'CRLF', integrity: 'LF-canonical SHA-256' }, null, 2))
} finally {
  await rm(temporaryDirectory, { force: true, recursive: true })
}
