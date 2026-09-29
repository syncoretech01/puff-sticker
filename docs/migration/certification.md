# Next.js migration certification

Date: 2026-09-29

Application revision under test: the `migration/nextjs` release commit containing this record

Status: certified against the explicitly approved SEO contract frozen through 2026-09-02. Production cutover remains blocked until the post-cutoff production replacement is re-audited and explicitly reconciled.

## Reproducible environment

- Windows x64 visual baseline only; no cross-OS pixel comparison.
- Node.js `24.16.0` and npm `11.13.0`.
- Next.js `16.3.6`.
- Playwright `1.62.1`, Chromium `151.0.7922.34`, device scale factor `1`, one serial worker for identical local/CI rendering load.
- Geometry snapshots and immutable migration JSON use repository-enforced LF endings, with separate CRLF portability coverage for the WordPress data validator.
- Screenshot animations disabled with the committed strict geometry and pixel tolerances.
- Vite and Next servers used isolated, preflight-checked local ports.
- PostgreSQL integration used PostgreSQL `16.14` from the immutable image digest in `scripts/cms/run-postgres-integration.mjs`.

## Passing gates

- Production Next build: 140 static pages plus private dynamic admin routes.
- Protected Vite build: 54 prerendered routes, comprising 51 canonical routes and the intentional 3 local extensions; 21 products, 11 protected-baseline articles, 8 exact pages, and 118 verified live assets.
- SEO evidence and mutation gates: 128 finite production pages/aliases, 96 primary routes, 94 indexable primary routes, 44 canonical sitemap routes, 34 canonicalizing aliases, 129 exact slash redirects, 40 route-owned legacy archives, 180 sitemap images, 2 immutable live-after-backup post deltas, and zero evidence blockers.
- Published-content gates: complete committed bodies for all 13 articles; short/long copy, FAQ, and gallery sources for all 21 products; complete sources for 6 business/legal pages; and every committed FAQ question and answer.
- WordPress snapshot validation: 11 posts, 9 pages, 21 products, 15 variations, 143 attachments, 52 terms, 114 term relationships, and 13 unindexed public-media records.
- WordPress artifact integrity is verified with LF-canonical SHA-256 and a dedicated CRLF materialization test, so the same immutable JSON identity is enforced across Windows and Linux checkouts.
- WordPress reconciliation: accepted with zero blockers; 125 known mismatches are explicitly classified and documented.
- Fast CMS suite: 21 passed.
- Real PostgreSQL suite: 7 passed, covering migration execution, constraints, rollback, immutable versions/audits, provenance refresh, redirect concurrency, global identity throttling, WordPress importer rollback/idempotency, configured admin cookies, and production public indexability.
- Vite visual/SEO/interaction regression: 306 passed and 210 profile-specific skips.
- Next visual/SEO/interaction/navigation regression: 464 passed and 52 profile-specific skips.
- Drizzle check passed, and TypeScript checks passed in both build pipelines.
- Strict UTF-8, forbidden-artifact, credential-signature, and Git whitespace checks passed.
- Production dependency audit: zero vulnerabilities after the compatible `undici` patch. The full audit reports four moderate development-only advisories through Drizzle Kit's legacy esbuild toolchain; its offered forced fix is a breaking Drizzle downgrade and was not applied.

The Next 16 production server writes `Internal: NoFallbackError` to stderr while returning some intentional finite-route 404s. The regression suite verifies those responses are correct noindex 404 documents; this is a known framework diagnostic, not a failed route contract.

## Protected boundaries

The CMS public source is code-locked off. Admin records are staged only, public publish/unpublish/archive actions are blocked, and every public route remains bound to the protected committed content and exact SEO contract. No DNS, WordPress replacement, production database write, or production deployment occurred during certification.

`/sitemap.xml` is locked to the approved production-equivalent empty-body `301` to `https://puffsticker.com/sitemap_index.xml`. `/shop/` keeps its approved captured canonical behavior. Those migration rules were not silently changed after the production site changed.

## Merge and cutover status

The branch is code-review and merge ready against the approved frozen contract. It is not production-cutover ready: a read-only check on 2026-09-28 found that production had been replaced after the approved cutoff, including a flat `200` `/sitemap.xml`, redirects from the former sitemap-index endpoints, changed `/shop/` behavior, and a changed published URL inventory. If merging to `main` triggers a production deployment, that merge must wait for an explicit decision and fresh parity certification against the new live state.

Before a later production cutover, the operator must still:

1. Re-audit and explicitly approve reconciliation of the post-2026-09-02 production replacement; do not overwrite the immutable approved evidence fixtures.
2. Add Search Console, backlink, and access-log URL evidence to the legacy URL manifest when access is available.
3. Keep WordPress media available or migrate every referenced asset to durable object storage and validate URLs, hashes, dimensions, metadata stripping, and alt text.
4. Provision least-privilege production database roles, backups, encrypted Vercel settings, object storage, and operational monitoring.
5. Certify the production-like Vercel preview with this same pinned browser environment, then execute the separately approved cutover and rollback runbook.
