# Sanitized WordPress reconciliation snapshot

This directory contains the deterministic, public-only Phase 4 view of the
supplied WordPress backup. It is a reconciliation input, not a runtime content
source.

- `content.json` contains published posts, pages, products, published public
  variations, their taxonomy graph, referenced attachment metadata and active
  public redirect evidence.
- `exclusions.json` records the strict allowlist, prohibited data classes and
  exclusion counts.
- `manifest.json` records immutable source hashes, the logical ServMask prefix,
  the archive-entry database timestamp, output hashes, counts and known gaps.

Raw SQL, uploads, users, credentials, orders, customers, forms, submissions,
logs, sessions, secrets, private content and unreferenced media are not stored
in the repository.

To reproduce the artifacts, first extract `database.sql` into an isolated
temporary directory outside this repository without executing WordPress or
PHP. Then run:

```powershell
npm.cmd run migration:normalize-wordpress -- --input <isolated-database.sql> --archive-sha256 <archive-sha256> --database-snapshot-at <archive-entry-iso-time> --table-prefix SERVMASK_PREFIX_ --public-media-evidence <isolated-exact-live-media-evidence.json>
npm.cmd run migration:validate-wordpress
```

The normalizer rejects a raw SQL input located inside the repository. Current
production crawl evidence remains the SEO authority; this snapshot preserves
historical IDs, dates, relationships and public media evidence for comparison.
