# Phase 1 SEO route contract

This contract is the migration gate between the production WordPress behavior and the future Next.js implementation. It does not change the current Vite application or any public SEO endpoint.

## Locked route surface

- 91 primary page contracts: 89 indexable and 2 local `noindex` pages.
- 43 canonical HTML URLs in the live XML sitemap: 11 posts, 8 pages, 21 products, and 3 product categories.
- 36 crawl-discovered, self-canonical archive URLs preserved as `200/index` and intentionally omitted from the live sitemap.
- 34 observed `200/index` canonicalizing aliases: 21 `/product/{slug}` aliases, 7 misspelled `/puff-labels-stickers/{slug}` aliases, 3 tag aliases, and 3 `/product-category/{category}` aliases.
- 124 explicit one-hop trailing-slash `301` contracts. These are policy-derived from observed production behavior; they are not presented as 124 individually observed Search Console URLs.
- 8 explicitly observed `404` aliases. Arbitrary prefix, product, and tag probes remain synthetic negative tests and do not create wildcard routes.

`/shop/` remains `200/index`, off-sitemap, with its production canonical `https://puffsticker.com/?page_id=9`. A query-sensitive production capture records that canonical target's existing one-hop behavior: `/?page_id=9` returns `301` to `/puffy-labels-stickers/puffy-stickers/`, which returns `200` and self-canonicalizes. This observation documents the preserve-first behavior; it does not authorize a `/shop/` canonical cleanup during framework migration.

`/resources/` and `/shipping-delivery/` are explicit approved target overrides. Production returned `404` for both slashless and trailing-slash forms when rechecked on 2026-08-14; the approved migration target intentionally serves the trailing-slash pages as `200/noindex`, off-sitemap, with a target-only one-hop slash policy. Their evidence is therefore `approved-target-override`, never `observed-live`.

## Evidence provenance

Every page, alias, redirect, and explicit negative contract records its evidence channels:

- `crawl`: direct live observation, policy-derived behavior, or a synthetic negative probe.
- `sitemap`: listed in the live sitemap, confirmed off-sitemap, or not applicable.
- `liveStatus` and `targetStatus`: explicitly separate observed production behavior from the approved migration target, including approved overrides.
- `searchConsole`, `backlinks`, and `accessLogs`: `not-provided` because no export or log set was supplied for Phase 1.

This distinction prevents the route manifest from implying that crawl discovery is equivalent to Search Console, backlink, or traffic-log coverage. Those sources can extend the explicit manifest later without introducing wildcard routing.

## Structured-data boundary

The 2026-08-22 reviewed fixture contains exact stable-key-normalized JSON-LD graphs and SHA-256 graph hashes for every finite production route and alias in the contract. It also contains exact, DOM-ordered Open Graph and Twitter tag observations, normalized public meaningful text plus its hash/count, heading inventories/hashes, image source/alt inventories/hashes, and first-party internal-link inventories/details/hashes. Raw page HTML is intentionally excluded.

The 36 legacy archive routes remain `legacy-static-required` because capture evidence is not an implementation content source. Their exact production graphs and fingerprints are now fixture-backed, so approximate generated graphs must not replace them.

## Post-baseline production delta

The live post sitemap changed after the protected Vite baseline and now includes `/blog/custom-puffy-stickers-guide/`, published/modified on 2026-08-20. It is an explicit 37th `legacy-static-required` route and the 43rd sitemap URL. It must not be described as content already present in the protected Vite design baseline.

The public WordPress REST `context=view` record is retained separately in `production-post-delta-custom-puffy-stickers-guide-2026-08-21.json`, including its rendered article/excerpt HTML, Yoast head data, public taxonomy identifiers, media identifier, links, and integrity hashes. This narrow delta fixture supports later isolated content reconciliation without extracting or executing the supplied WordPress backup during the framework-parity phases.

## Gates

Run the framework-independent checks directly:

```powershell
node scripts/validate-seo-contract.mjs
node scripts/validate-production-seo-evidence.mjs
node scripts/check-seo-evidence-gate.mjs
node scripts/test-seo-contract-mutations.mjs
npx.cmd tsc -p tsconfig.app.json --noEmit
```

The production-evidence validator recomputes all normalized graph/content/heading/image/link and endpoint-body hashes, checks exact fixture-to-route integration, proves all 123 finite production pages/aliases are covered, verifies all sitemap image rows/KML/robots bodies, checks exact OG/Twitter-to-Next metadata mapping, and locks the post-baseline delta and `/shop/` canonical-target behavior. The mutation suite proves the observation validator rejects changed status, canonical, robots, title, schema, meaningful-content collapse, missing non-decorative image alt text, changed sitemap membership, and unresolved first-party internal links.

## Deferred atomic cutover

The existing `public/robots.txt` and `public/sitemap.xml` remain untouched. Exact fixture-backed sitemap/XML/KML/robots builders are present, but Next route handlers and replacement of those public files are deferred until the Vite parity fixtures and Next foundation pass Phase 1. At cutover, `/sitemap.xml` and `/sitemap_index.xml` must both expose the five-child live index; the four HTML child maps, local map, KML, and live robots directives must move together to avoid conflicting endpoints.
