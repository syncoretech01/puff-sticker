# PuffSticker regression contract

The Playwright suite protects the current React/Vite redesign while its implementation moves to Next.js. The public appearance, responsive geometry, runtime interactions, canonical route inventory, and SEO-critical document signals are treated as contracts.

## Environments

- `PUFF_REGRESSION_BASE_URL` selects the implementation under test. It defaults to `http://127.0.0.1:4173`.
- `PUFF_REGRESSION_SERVER_COMMAND` selects the managed server command. It defaults to `npm run preview:vite -- --host 127.0.0.1 --port 4173`.
- `PUFF_REGRESSION_EXTERNAL_SERVER=1` disables Playwright server management for an already-running Vite or Next server.
- `PUFF_REGRESSION_PROFILE=vite|next` selects documented SEO expectations for the three local extension routes. It defaults to `vite` while recording the protected baseline.
- Canonicals are deliberately fixed to `https://puffsticker.com`; the target server URL never changes the expected public origin.

## Commands

1. Build the implementation to test.
2. Run `npm run test:regression` for route, runtime, geometry, motion, and visual checks.
3. Run `npm run test:regression:update` only when intentionally recording the protected Vite baseline or after an explicitly approved visual change.
4. Run `npm run test:regression:headed` to diagnose full-motion interaction failures.

Chromium and `@playwright/test` are pinned to 1.62.1. `baseline-environment.json` makes same-OS, architecture, browser-build, viewport-scale enforcement executable rather than advisory. CI must use `npm ci` followed by `npm run test:regression:install` so the pinned Chromium build is used rather than a system browser.

The npm regression commands use `scripts/run-regression.mjs` to own the preview-server lifecycle explicitly. This avoids a Playwright-managed web-server teardown hang observed on Windows while retaining the same pinned browser and configuration. Set `PUFF_REGRESSION_EXTERNAL_SERVER=1` only when a reviewed external server is already running.

Stable screenshot checks use reduced motion and a maximum differing-pixel ratio of 0.001. Full-motion behavior is tested separately through semantic state and transform assertions because animation-frame screenshots are not deterministic.
