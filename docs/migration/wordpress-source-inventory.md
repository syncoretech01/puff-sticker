# WordPress migration source inventory

This document records the read-only provenance and handling boundary for the supplied All-in-One WP Migration backup. It does not make the backup a runtime dependency, and it does not authorize importing private WordPress data.

## Source identity

The completed source pair supplied on 2026-08-12 is:

| Source | Bytes | SHA-256 |
| --- | ---: | --- |
| `puffsticker-com-20260812-222847-hhp32j67bohd (1).wpress` | 1,429,597,664 | `9FAAE116D4723390636A53BB0834879AA998C21BA2C42BC3C466647A9108B21D` |
| `puffsticker-com-20260812-222847-hhp32j67bohd (1).zip` | 619,909,721 | `B93E4E1097A2B2FEAC229F3BFD7601791DF039469A88FED17DBC54F1B2DBB860` |

The ZIP contains exactly one deflated WPress member. Its declared uncompressed size is 1,429,597,664 bytes, its ZIP CRC-32 is `4021AF79`, and its expanded SHA-256 exactly matches the standalone WPress file. Partial `.crdownload` files are not migration sources and were ignored.

The machine-readable, sanitized evidence is in [`reports/migration/wordpress-source-inventory.json`](../../reports/migration/wordpress-source-inventory.json). It intentionally records source filenames rather than workstation-specific absolute paths.

## Structural verification

The WPress stream contains 44,424 logical file entries followed by one 4,377-byte footer. The validated header layout is 255 filename bytes, 14 file-size bytes, 12 modified-time bytes, and 4,096 prefix bytes. The footer starts at byte 1,429,593,287, points to that same offset, and ends exactly at the source length.

The inspector rejected unsafe paths while scanning and verified all of the following:

- every header and payload stays inside the source bounds;
- the final offset equals the source size;
- the footer pointer and signature shape are valid;
- there are no duplicate logical paths;
- there are no absolute, drive-qualified, backslash, or parent-traversal paths;
- the root `package.json` and `database.sql` exist and match their declared lengths;
- expanded ZIP bytes and standalone WPress bytes have the same SHA-256.

The payload aggregates to 1,235,149,439 bytes; headers plus the footer account for the remaining 194,448,225 bytes. The main logical buckets are:

| Bucket | Entries | Payload bytes |
| --- | ---: | ---: |
| Plugins | 39,193 | 621,977,292 |
| Uploads | 4,226 | 396,589,817 |
| Themes | 496 | 46,353,978 |
| Caches, logs, and backup material | 489 | 53,684,941 |
| Root database | 1 | 116,230,481 |
| All other entries | 19 | 312,930 |

The 4,226 upload entries are only archive inventory. The 3,854 entries with image, video, audio, or PDF extensions are candidates, not proof that an asset is public or currently referenced. A media item can enter normalized public data only after it is linked to a published record and reconciled with production evidence.

## Raw-data boundary

Raw backup material must remain outside the repository. The inspection utility can place only these reference files in a fresh OS temporary directory:

- root `package.json`;
- root `database.sql`;
- upload candidate paths, sizes, and modified times in `uploads-metadata.json` (no upload payloads).

The root database is 116,230,481 bytes with archive-entry modified time `2026-08-12T22:29:58.000Z` and SHA-256 `C23D278A02A591D91E14CE77C82B9A878503F104E05901C11572866ED85DBC3D`. The root package is 10,751 bytes with archive-entry modified time `2026-08-12T22:28:51.000Z` and SHA-256 `53A2369F04D5D9FD03C48E5AC5B07E4DDC66468BA7282CAA9281895B13FB654E`. These raw files are temporary migration inputs, not commit candidates.

All database table identifiers in the migration dump use All-in-One WP Migration's literal `SERVMASK_PREFIX_` placeholder. Parsers should preserve that placeholder in provenance and treat it only as a logical table-prefix token; they must not infer or publish an installation-specific prefix.

Do not commit, serve, or expose SQL, WordPress/PHP/plugin/theme executables, uploads or customer artwork, users, password hashes, credentials, secret keys, orders, customer records, form submissions, logs, caches, or other personal data. The archive contains file extensions associated with credentials and keys; their contents and paths were deliberately not included in the sanitized manifest.

The extraction directory is ephemeral. Downstream normalization must read it locally, produce only public and sanitized normalized records, verify those records against the live SEO contract, and then remove the temp directory after all consumers finish.

## Reproduction

Pass the immutable source paths explicitly. The utility uses only Node.js standard-library APIs, performs no network access, and never executes PHP, WordPress, plugins, or themes.

```powershell
node scripts/migration/archive-inspect.mjs `
  --wpress '<absolute-source-path>.wpress' `
  --zip '<absolute-source-path>.zip' `
  --manifest reports/migration/wordpress-source-inventory.json `
  --extract-approved
```

`--extract-approved` creates a uniquely named directory beneath the OS temp directory and refuses a raw extraction target inside the repository. Omit it for a read-only verification pass. The sanitized manifest has no generation timestamp, temp path, absolute source path, raw row, upload filename, secret value, or personal field, so the same source produces stable evidence across runs.

For a bounded reconciliation of production-confirmed upload paths that have no WordPress attachment row, use `archive-public-media-evidence.mjs`. It scans the verified WPress source, hashes only the exact requested entry payloads, extracts no binary, and refuses to write its result inside the repository:

```powershell
node scripts/migration/archive-public-media-evidence.mjs `
  --wpress '<absolute-source-path>.wpress' `
  --source-manifest reports/migration/wordpress-source-inventory.json `
  --output '<absolute-temp-path>\public-media-evidence.json' `
  --path '<uploads-relative-production-path>'
```

Repeat `--path` for each production-confirmed reference. The temp JSON contains only the verified archive SHA-256 and the requested path, presence flag, byte length, and SHA-256. A present result proves backup payload availability; it does not itself authorize publication or commit the asset.

## Source precedence

This backup is a read-only migration and data reference. Production crawl evidence remains the source of truth for current SEO behavior, while the protected React/Vite implementation remains the source of truth for visuals and interaction. Backup records can supply IDs, relationships, dates, media metadata, and structural evidence, but cannot override verified public behavior without an explicit reconciliation decision.
