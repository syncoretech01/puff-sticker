import { createAdminPasswordHash } from '../../src/lib/admin/crypto-core'

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks).toString('utf8').replace(/[\r\n]+$/, '')
}

const password = await readStdin()
if (!password) throw new Error('Provide the password on standard input.')
console.log(await createAdminPasswordHash(password))
