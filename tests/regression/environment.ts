const CANONICAL_ORIGIN = 'https://puffsticker.com'
const DEFAULT_TARGET_ORIGIN = 'http://127.0.0.1:4173'
const DEFAULT_SERVER_COMMAND = 'npm run preview:vite -- --host 127.0.0.1 --port 4173'

export type RegressionProfile = 'vite' | 'next'

function parseOrigin(value: string, variable: string) {
  const url = new URL(value)
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error(`${variable} must be an origin without a path, query, or hash: ${value}`)
  }
  return url.origin
}

function parsePixelEnvironment(value: string | undefined) {
  if (!value) return null
  if (!/^[a-z0-9][a-z0-9.-]*$/.test(value)) {
    throw new Error(`PUFF_REGRESSION_PIXEL_ENV must be a lowercase environment slug, received: ${value}`)
  }
  return value
}

const profile = process.env.PUFF_REGRESSION_PROFILE ?? 'vite'
if (profile !== 'vite' && profile !== 'next') {
  throw new Error(`PUFF_REGRESSION_PROFILE must be "vite" or "next", received: ${profile}`)
}

export const regressionEnvironment = Object.freeze({
  canonicalOrigin: parseOrigin(CANONICAL_ORIGIN, 'canonical origin'),
  targetOrigin: parseOrigin(
    process.env.PUFF_REGRESSION_BASE_URL ?? DEFAULT_TARGET_ORIGIN,
    'PUFF_REGRESSION_BASE_URL',
  ),
  serverCommand: process.env.PUFF_REGRESSION_SERVER_COMMAND ?? DEFAULT_SERVER_COMMAND,
  manageServer: process.env.PUFF_REGRESSION_EXTERNAL_SERVER !== '1',
  pixelEnvironment: parsePixelEnvironment(process.env.PUFF_REGRESSION_PIXEL_ENV),
  profile: profile as RegressionProfile,
})
