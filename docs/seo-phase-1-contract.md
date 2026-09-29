# SEO route and evidence contract

This contract gates the production WordPress behavior against the Next.js release candidate. The protected React/Vite implementation remains the visual source of truth, and the live site remains the SEO source of truth.

## Locked route surface

- 96 primary page contracts: 94 production/indexable pages and 2 approved local `noindex` pages.
- 44 canonical HTML URLs in the live XML sitemap: 12 posts, 8 pages, 21 products, and 3 product categories.
- 40 crawl-discovered, self-canonical archive URLs preserved as `200/index` and intentionally omitted from the live sitemap.
- 34 observed `200/index` canonicalizing aliases: 21 `/product/{slug}` aliases, 7 misspelled `/puff-labels-stickers/{slug}` aliases, 3 tag aliases, and 3 `/product-category/{category}` aliases.
- 129 explicit one-hop trailing-slash `301` contracts. These are policy-derived from observed production behavior; they are not presented as 129 individually observed Search Console URLs.
- 8 explicitly observed `404` aliases. Arbitrary prefix, product, and tag probes remain synthetic negative tests and do not create wildcard routes.

The finite production page-and-alias set contains 128 URLs. The 2 approved local `noindex` pages are target-only additions and are not counted as production pages.

`/shop/` remains `200/index`, off-sitemap, with its production canonical `https://puffsticker.com/?page_id=9`. A query-sensitive production capture records that canonical target's existing one-hop behavior: `/?page_id=9` returns `301` to `/puffy-labels-stickers/puffy-stickers/`, which returns `200` and self-canonicalizes. This preserve-first behavior does not authorize a `/shop/` canonical cleanup during framework migration.

`/resources/` and `/shipping-delivery/` are explicit approved target overrides. Production returned `404` for both slashless and trailing-slash forms when rechecked on 2026-08-14; the migration target serves the trailing-slash pages as `200/noindex`, off-sitemap, with a target-only one-hop slash policy. Their evidence is `approved-target-override`, never `observed-live`.

## Evidence provenance

Every page, alias, redirect, and explicit negative contract records crawl, sitemap, live-status, target-status, and capture provenance. Search Console, backlink, and access-log evidence remains `not-provided`; those sources must extend the finite legacy URL manifest before cutover when access is available.

The immutable 2026-08-22 fixture contains exact normalized JSON-LD, ordered Open Graph and Twitter tags, meaningful text, headings, image/alt inventories, and first-party internal-link inventories for the original 123 production pages and aliases. A separate pinned-Chromium, document-only 2026-09-01 capture adds the five newly indexable production URLs:

- `/blog/why-custom-stickers-feel-like-objects/`
- `/blog/tag/dimensional-stickers/`
- `/blog/tag/embossed-stickers/`
- `/blog/tag/product-design/`
- `/blog/tag/raised-stickers/`

The new post also changed existing blog, category, pagination, and tag relationships. Those relationships were reconciled from the public WordPress API on 2026-09-02 and are locked by route-owned archive tests; they are not falsely described as five additional full-page captures.

This approved contract is frozen at the 2026-09-02 cutoff. A read-only recheck on 2026-09-28 found that production had been replaced after the cutoff: `/sitemap.xml` now returned a flat `200 application/xml` document, while `/sitemap_index.xml` and `/post-sitemap.xml` returned `301` to `/sitemap.xml`, and the published URL inventory had changed. That later external state conflicts with the explicitly approved migration behavior below and is therefore a pre-cutover reconciliation blocker, not an implicit authorization to mutate this release candidate. The frozen evidence remains reproducible; current-live parity must be re-audited and approved separately.

## Published-content parity

All production routes have concrete Next renderers; the static gate requires zero `legacy-static-required` routes. Archive routes resolve only from named, committed article/product sources and fail closed when a relationship is missing. Tests require server-rendered route ownership, exact source identity, named local links/images, complete published excerpts or product copy, and no generic global parity appendix.

The two live-after-backup posts are retained as immutable REST fixtures:

- `custom-puffy-stickers-guide`, published 2026-08-20.
- `why-custom-stickers-feel-like-objects`, published 2026-08-31.

Their complete rendered article/excerpt HTML, public identifiers, taxonomy relations, links, and integrity hashes are committed. The newer article's 37 responsive image files are local assets; its exact full word-and-punctuation stream, headings, links, images, and alt text are asserted against server-rendered output. The live ten-post blog index, three-post page-two archive, and affected category/tag ordering are separately locked. The Vite route/content inventory remains unchanged.

Because the visible post inventory advanced after the protected visual snapshot, only the three affected blog surfaces use dedicated Next production-content screenshots/structure snapshots. They use the same pinned Windows Chromium and the unchanged strict pixel threshold. All other Next surfaces continue comparing directly with the Vite baseline.

## Discovery endpoints

The Next release candidate serves exact fixture-backed sitemap/XML/KML/robots responses. `/sitemap.xml` preserves the observed literal, empty-body `301` to `https://puffsticker.com/sitemap_index.xml`. The canonical index remains `200`, exposes the five production child sitemaps, and includes the current 2026-08-31 post-sitemap last-modified value. The post sitemap contains 12 URLs and the complete child-sitemap inventory contains 180 image rows.

Direct internal compatibility-handler URLs return `404/noindex`, including forged client markers. The compatibility redirect is not accepted by the reusable 200-body endpoint helper, preventing an accidental regression to a terminal XML response.

## Gates

Run:

```powershell
npm.cmd run test:seo
npm.cmd run test:wordpress-data
npm.cmd run migration:reconcile-wordpress
npm.cmd run build
npm.cmd run build:vite
npm.cmd run test:regression
```

The evidence validator recomputes all normalized content/schema/endpoint hashes, proves exact fixture-to-route coverage for all 128 production pages/aliases, verifies both post deltas, locks 44 sitemap URLs and 180 image rows, and preserves `/shop/`. The mutation suite proves the observation validator rejects status, canonical, robots, title, schema, meaningful-content, image-alt, sitemap-membership, and internal-link regressions.
