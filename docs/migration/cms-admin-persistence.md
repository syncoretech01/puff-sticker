# CMS, admin and persistence boundary

Status: implementation foundation complete; public source switch disabled.

## Safety boundary

The public Next.js routes still render the protected static TypeScript content and exact production SEO contract. No public component imports the database repository or the normalized WordPress dataset. CMS records are staging-only: admin publish, unpublish, and archive transitions are blocked in server actions and omitted from the UI until a separately approved parity-certified source switch.

Production media uses Vercel Blob through an object-storage interface. There is no local-filesystem persistence fallback.

## Required server configuration

The private admin fails closed unless all credential variables are present:

- `PUFF_ADMIN_USERNAME`
- `PUFF_ADMIN_PASSWORD_HASH` (versioned scrypt format)
- `PUFF_ADMIN_SESSION_SECRET` (at least 32 characters)
- `PUFF_ADMIN_ROLE` (`editor`, `publisher`, or `admin`; explicit, with no default)

Optional rotation and policy variables:

- `PUFF_ADMIN_SESSION_SECRET_PREVIOUS`
- `PUFF_ADMIN_SESSION_VERSION`
- `PUFF_ADMIN_SESSION_TTL_SECONDS` (clamped to 15 minutes to 12 hours)

Persistence and media require `DATABASE_URL` and `BLOB_READ_WRITE_TOKEN`. Values belong only in encrypted deployment settings, never Git.

Generate a password hash without placing the password in command history:

```powershell
$credential = Get-Credential -UserName 'admin' -Message 'Choose the CMS password'
$plainPassword = $credential.GetNetworkCredential().Password
$plainPassword | npm.cmd run admin:hash-password
$plainPassword = $null
$credential = $null
```

The helper reads standard input, emits only the scrypt hash, and enforces a 14-character minimum.
Do not save the plaintext value. The database-backed sign-in throttle stores only HMAC-derived
IP and identity keys, permits eight attempts per global identity and 30 per IP in 15 minutes,
prunes rows inactive for 24 hours, and fails closed if persistence is unavailable.

## Database and roles

The additive migration creates:

- `content_records` and immutable `content_versions`;
- finite `redirects` with one-hop graph validation;
- object-storage/external `media_assets` metadata;
- HMAC-keyed `admin_login_throttles` without raw usernames or IP addresses;
- `migration_provenance`;
- immutable `audit_events`.

Run `npm run db:migrate` only against the intended database after reviewing `DATABASE_URL`. Editors create and revise staged drafts. Public status transitions remain code-locked for every role during this phase. Every enabled mutation requires an expected revision and records its actor/reason.

## WordPress seed

`npm run cms:import-wordpress` is dry-run by default. It validates a deterministic plan of 41 archive content records and 156 public media records. Applying is one database transaction and requires `--apply`, `PUFF_CMS_IMPORT_ACTOR`, and the exact archive SHA-256 printed by the reviewed dry run:

```powershell
npm.cmd run cms:import-wordpress -- --apply --confirm=<archiveSha256>
```

The import is idempotent, records archive and per-record payload SHA-256 provenance, and keeps `custom-puffy-stickers-guide` and `why-custom-stickers-feel-like-objects` as explicit live-after-backup deltas. A fresh production capture must reconcile both deltas and every later production change before any public source switch.

## Verification

- `npm run test:cms` validates auth crypto, media signatures/storage, repository rules, workflow transitions, schema safety, revalidation and seed determinism.
- `npm run build` proves admin routes and public routes compile together.
- `npm run test:cms:postgres` performs a production build, starts the immutable PostgreSQL 16.14 image digest declared in the runner, applies the committed migration, and verifies real transaction rollback, append-only triggers, redirect concurrency, provenance refresh, throttling, importer rollback/idempotency, configured login cookies, and public indexability. Docker is required; the container is disposable and removed by the runner.
- The Next regression admin contract proves unconfigured deployments remain noindex and locked while public output remains indexable and unchanged.

Ordinary builds and fast tests perform no database or object-storage write. The PostgreSQL integration gate writes only to its isolated disposable database. No test writes to production object storage.

## Deferred source-switch controls

There is intentionally no admin media-upload route in this phase. The storage adapter remains
closed until uploads are decoded, dimension-limited, re-encoded and stripped of embedded
metadata. Imported public media are metadata references only; private customer artwork is out
of scope.

CMS `bodyHtml` is stored as untrusted migration/editorial input and is never rendered by the
protected public site in this phase. A later source switch requires strict HTML allowlist
sanitization, malicious-payload tests, Content Security Policy validation, and a fresh visual
and SEO parity certification.
