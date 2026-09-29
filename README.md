# Puff Sticker — Next.js migration release candidate

This migration release candidate implements the public site with the Next.js App Router. The protected React/Vite implementation remains in the repository as the visual and functional baseline for migration certification; it is not the production deployment target.

The CMS/admin persistence foundation is private and fails closed. Public routes still render the protected static content source, and the CMS public-source switch remains intentionally disabled.

## Pinned toolchain

- Node.js `24.16.0` (also recorded in `.nvmrc` and `package.json`)
- npm `11.13.0`
- Playwright `1.62.1` with its bundled Chromium build

Use the exact versions above and run `npm ci`.

Local certification and GitHub Actions enforce the exact Node and npm versions. Vercel selects the latest supported Node `24.x` patch at build/runtime rather than guaranteeing a requested patch release, so the production-like Vercel preview must pass the same build, SEO, CMS, and browser gates before cutover. The committed `packageManager` field pins npm for compatible tooling; verify the npm version in the Vercel build log as part of that preview gate.

## Run the Next.js application locally

```bash
npm run dev
```

Open `http://127.0.0.1:3000/`. Build and serve with `npm run build` then `npm run start`. Vercel is the production target and supplies `VERCEL_ENV`; previews receive the repository’s global `noindex` response header. Local and CI production-mode gates use `VERCEL_ENV=production`; a production-like Vercel preview must still pass the same gates before cutover.

## Protected Vite baseline

The Vite build exists only to protect the approved appearance, geometry, interactions, and original 54-route prerender contract:

```bash
npm run build:vite
npm run preview:vite
```

Vite preview defaults to `http://127.0.0.1:4173/`. Do not remove or redesign this baseline during parity certification.

## Release verification

Install Chromium once with `npm run test:regression:install`. Static and fast gates are:

```bash
npm run test:seo
npm run test:wordpress-data
npm run migration:reconcile-wordpress
npm run db:check
npm run test:cms
```

After `npm run build:vite`, `npm run test:regression` runs the Vite profile. To run Next in PowerShell after `npm run build`:

```powershell
$env:PUFF_REGRESSION_PROFILE = 'next'
$env:PUFF_REGRESSION_BASE_URL = 'http://127.0.0.1:43074'
$env:VERCEL_ENV = 'production'
npm.cmd run test:regression
Remove-Item Env:\PUFF_REGRESSION_PROFILE, Env:\PUFF_REGRESSION_BASE_URL, Env:\VERCEL_ENV
```

`npm run test:cms:postgres` requires Docker and tests the migration against an ephemeral PostgreSQL image pinned by digest. GitHub Actions runs the build, SEO, data reconciliation, CMS, database, and both Playwright profiles. Pixel comparisons use pinned Playwright Chromium serially on `windows-2022`, matching the protected local baseline; the Linux PostgreSQL job never compares screenshots across operating systems. Geometry snapshots and immutable migration JSON are checked out with canonical LF endings on every operating system.

## Server configuration

Public routes require no secrets. Functional private admin requires `DATABASE_URL`, `PUFF_ADMIN_USERNAME`, `PUFF_ADMIN_PASSWORD_HASH`, `PUFF_ADMIN_SESSION_SECRET`, and explicit `PUFF_ADMIN_ROLE`. Media persistence uses `BLOB_READ_WRITE_TOKEN`, although media upload and CMS public-source switching remain disabled.

See `docs/migration/cms-admin-persistence.md` for credential formats, optional rotation variables, roles, database controls, and the guarded WordPress import. Never commit environments, credentials, dumps, WordPress archives, build output, logs, caches, or test artifacts.

Public content is served from committed protected sources captured and reconciled against `puffsticker.com` through the approved 2026-09-02 evidence cutoff; there is no runtime dependency on live WordPress, an audit workspace, or temporary files. React/Vite remains the visual source of truth and the live site remains the SEO source of truth. The post-cutoff production replacement detected on 2026-09-28 must be separately reconciled before cutover and does not silently rewrite this branch's approved frozen contract.
