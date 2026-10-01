# Next.js migration certification

Date: 2026-10-01

Application revision under test: the `migration/nextjs` release commit containing this record

Status: locally certified against the current production SEO/content contract captured on 2026-09-30 with the 2026-10-01 checkout supplement. The immutable 2026-09-02 evidence remains preserved. Production cutover is still blocked by the explicit items at the end of this record.

## Reproducible environment

- Windows x64 visual baselines only; no cross-OS pixel comparison. GitHub runs both visual profiles serially on one `windows-2022` runner.
- Node.js `24.16.0` and npm `11.13.0`.
- Next.js `16.3.6`.
- Playwright `1.62.1`, Chromium `151.0.7922.34`, device scale factor `1`, one serial worker.
- Screenshot animations are disabled and the committed strict geometry and pixel tolerances are unchanged.
- Vite and Next servers use isolated, preflight-checked local ports.
- PostgreSQL integration uses PostgreSQL `16.14` from the immutable image digest in `scripts/cms/run-postgres-integration.mjs`.
- Geometry snapshots and immutable migration JSON use repository-enforced LF endings, with separate CRLF portability coverage for the WordPress data validator.

## Evidence contract

- Frozen 2026-09-02 evidence: 128 observations, retained unchanged as the legacy contract.
- Current evidence: 154 observations, comprising 128 current `200` responses and 26 current `404` responses.
- Effective contract: all 154 routes remain protected; current `200` observations are authoritative and the 26 current `404` routes retain their frozen legacy behavior.
- Current diff: 102 changed-current routes, 26 added-current routes, and 26 current-404/preserve-frozen routes.
- Current sitemap: 72 URLs, with 28 additions and zero removals relative to the frozen 44-URL sitemap.
- Current published-content evidence: 73 semantic page bodies and 230 localized first-party assets.
- The checkout supplement is separately dated and composed at runtime; neither dated evidence set overwrites the frozen fixture.

## Passing gates

- Production Next build: 168 generated static outputs plus private dynamic admin routes.
- Protected Vite build: 54 prerendered routes, comprising 51 canonical routes and the intentional 3 local extensions; 21 protected products, 11 protected articles, 8 exact pages, and 118 verified baseline assets.
- SEO contract: 77 primary routes, 74 indexable primary routes, 72 canonical sitemap routes, 79 canonicalizing aliases, 26 preserved legacy routes, 155 exact slash redirects, 13 explicit negative routes, 9 discovery endpoints, and zero evidence blockers.
- Exact sitemap inventory: 25 posts, 12 pages, 31 products, and 4 product categories.
- Published content: complete current bodies for 24 articles, 31 products, 12 sitemap pages, 4 product-category pages, the noindex checkout page, all captured FAQ content, and every captured internal link, schema graph, image alt, and localized asset hash.
- WordPress snapshot validation: 11 posts, 9 pages, 21 products, 15 variations, 143 attachments, 52 terms, 114 term relationships, and 13 unindexed public-media records.
- WordPress artifact integrity: LF-canonical SHA-256 plus a dedicated CRLF materialization test.
- WordPress reconciliation: accepted with zero blockers and 99 explicitly classified source-age or authority mismatches. The normalized data remains detached from public rendering.
- Fast CMS suite: 21 passed.
- Real PostgreSQL suite: 7 passed, covering migration execution, constraints, rollback, immutable versions/audits, provenance refresh, redirect concurrency, global identity throttling, WordPress importer rollback/idempotency, configured admin cookies, and production public indexability.
- Protected Vite regression: 306 executed cases passed, including isolated unchanged reruns of the two late-run browser-exhaustion cases; 269 Next-only cases skipped. The subsequently tightened Vite route/state subset passed 62 with one Next-only skip.
- Next regression: all 575 cases accounted for, with 523 passed and 52 Vite-only skips. This includes 260 exact SEO/content/status tests, 162 route-smoke geometry tests, 30 visual tests, and all functional, motion, navigation, responsive, state, and admin-boundary tests.
- Protected visual regions match the immutable Vite baseline at desktop, tablet, and mobile. FAQ/blog content-only changes use separate strict same-browser current-production baselines and do not replace Vite design fixtures.
- Drizzle check and TypeScript checks passed in both build pipelines.
- Production dependency audit: zero vulnerabilities.

The Next 16 production server writes `Internal: NoFallbackError` to stderr while returning some intentional finite-route 404s. The regression suite verifies those responses are correct noindex 404 documents; this is a known framework diagnostic, not a failed route contract.

## Protected boundaries

- CMS public-source switching remains code-locked off.
- Admin records are staged only; public publish, unpublish, and archive actions remain blocked.
- No DNS change, WordPress replacement, production database write, or production deployment occurred during certification.
- `/sitemap.xml` returns the exact current flat `200` XML response. The legacy sitemap-index endpoints preserve their current one-hop `301` behavior to `/sitemap.xml`.
- `/shop/` preserves the current self-canonical behavior and sitemap membership.
- Current `200` content is served from committed dated sources. Frozen content continues to cover legacy URLs that now return `404` in current production.
- The public application has no runtime dependency on live WordPress, an audit workspace, or temporary files.

## Remaining cutover blockers

1. The live checkout transaction still posts to the legacy `/api/order.php` workflow. The migration preserves the checkout URL, metadata, noindex directive, schema, content, and query variants, but it does not implement that order endpoint or an approved replacement transaction flow.
2. Search Console exports, backlink data, and access-log URL evidence have not been supplied. These sources must be reconciled into the legacy URL manifest when access is available; crawler evidence alone cannot prove complete historical coverage.
3. The exact pushed commit must pass GitHub Actions and a production-like Vercel preview using the pinned gates. The preview must also verify Vercel's actual Node/npm selection, headers, redirects, static assets, environment isolation, and rollback procedure.
4. A final read-only live crawl must be taken after the production content freeze and compared with the 2026-09-30/2026-10-01 contract before DNS cutover, so later WordPress edits cannot introduce unreviewed drift.
5. If the private admin is required at launch, production must provision least-privilege `DATABASE_URL`, `PUFF_ADMIN_USERNAME`, `PUFF_ADMIN_PASSWORD_HASH`, `PUFF_ADMIN_SESSION_SECRET`, explicit `PUFF_ADMIN_ROLE`, backups, monitoring, and `BLOB_READ_WRITE_TOKEN`. Public-source switching must remain disabled unless separately approved.
