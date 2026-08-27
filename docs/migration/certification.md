# Next.js migration certification

Date: 2026-08-27
Application commit under test: `4ea152e1ba132fb5d5f4b91d50f6cefe74e84ae0`
Status: certified for branch review and a production-like Vercel preview; production cutover was not executed.

## Reproducible environment

- Windows x64 baseline only; no cross-OS pixel comparison.
- Playwright `1.62.1`, Chromium `151.0.7922.34`, device scale factor `1`.
- Screenshot animations disabled with the committed geometry and pixel tolerances.
- Vite and Next servers used isolated, preflight-checked local ports.
- PostgreSQL integration used PostgreSQL `16.14` from the immutable image digest in `scripts/cms/run-postgres-integration.mjs`.

## Passing gates

- Production Next build: 136 static public pages plus private dynamic admin routes.
- Protected Vite build: 54 prerendered routes, comprising 51 canonical routes and the intentional 3 local extensions; 21 products, 11 articles, and 118 verified live assets.
- Fast CMS suite: 21 passed.
- Real PostgreSQL suite: 7 passed, covering migration execution, constraints, rollback, immutable versions/audits, provenance refresh, redirect concurrency, global identity throttling, WordPress importer rollback/idempotency, configured admin cookies, and production public indexability.
- Vite visual/SEO/interaction regression: 306 passed and 160 profile-specific skips.
- Next visual/SEO/interaction/navigation regression: 414 passed and 52 profile-specific skips.
- Drizzle check passed, and schema generation reported no pending changes.
- Strict UTF-8, forbidden-artifact, credential-signature, and Git whitespace checks passed.
- Production dependency audit: zero vulnerabilities. The full audit reports four moderate development-only advisories through Drizzle Kit's legacy esbuild toolchain; its offered forced fix is a breaking downgrade and was not applied.

The Next 16 production server writes `Internal: NoFallbackError` to stderr while returning some intentional finite-route 404s. The regression suite verifies those responses are correct noindex 404 documents; this is a known framework diagnostic, not a failed route contract.

## Protected cutover boundary

The CMS public source is code-locked off. Admin records are staged only, public publish/unpublish/archive actions are blocked, and every public route remains bound to the protected static content and exact SEO contract. No DNS, WordPress replacement, production database write, or production deployment occurred during certification.

Before a later production cutover, the operator must still:

1. Add Search Console, backlink, and access-log URL evidence to the legacy URL manifest when access is available.
2. Capture and reconcile current WordPress data, including the explicit `custom-puffy-stickers-guide` live-after-backup delta.
3. Keep WordPress media available or migrate every referenced asset to durable object storage and validate URLs, hashes, dimensions, metadata stripping, and alt text.
4. Provision least-privilege production database roles, backups, encrypted Vercel settings, object storage, and operational monitoring.
5. Certify the production-like Vercel preview with this same pinned browser environment, then execute the separately approved cutover and rollback runbook.
