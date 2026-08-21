import { registerHooks } from 'node:module'

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context)
    } catch (error) {
      if (
        error?.code === 'ERR_MODULE_NOT_FOUND'
        && (specifier.startsWith('./') || specifier.startsWith('../'))
        && !/\.[cm]?[jt]sx?$/.test(specifier)
      ) return nextResolve(`${specifier}.ts`, context)
      throw error
    }
  },
})

const {
  PHASE_2_SEO_EVIDENCE_BLOCKERS,
  PHASE_2_SEO_EVIDENCE_READY,
} = await import('../src/lib/seo/index.ts')

const counts = Object.fromEntries(
  [...new Set(PHASE_2_SEO_EVIDENCE_BLOCKERS.map((blocker) => blocker.signal))]
    .map((signal) => [signal, PHASE_2_SEO_EVIDENCE_BLOCKERS.filter((blocker) => blocker.signal === signal).length]),
)

console.log(JSON.stringify({
  ready: PHASE_2_SEO_EVIDENCE_READY,
  blockerCount: PHASE_2_SEO_EVIDENCE_BLOCKERS.length,
  counts,
  sample: PHASE_2_SEO_EVIDENCE_BLOCKERS.slice(0, 10),
}, null, 2))

if (!PHASE_2_SEO_EVIDENCE_READY) process.exitCode = 1
