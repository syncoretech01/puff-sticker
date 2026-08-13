# AGENTS.md — PuffSticker Project Guardrails

## Sources of truth
- Live SEO behavior: https://puffsticker.com/
- Visual/design behavior: current local React/Vite rebuild.

## Hard constraints
- Zero intentional visual redesign during framework/architecture migration.
- Preserve layout, spacing, typography, colors, imagery, responsive breakpoints, interactions, GSAP/ScrollTrigger, Lenis, and Three.js behavior unless explicitly authorized.
- Preserve SEO-critical production behavior: URLs, status codes, canonicals, metadata, headings, meaningful content, internal links, structured data, sitemap, robots, image alt text, and redirects.
- Existing production URLs should remain unchanged wherever possible.
- URL changes require server-side 301/308 redirects with no redirect chains/loops.
- Never delete legacy/static/WordPress-derived content until migration parity is verified.
- Never use the local filesystem for persistent production uploads.
- Target production architecture must remain Vercel-compatible.

## Working method
- Audit before refactoring.
- Make small coherent changes.
- Run typecheck/build/tests after each migration step.
- Use visual regression and SEO parity checks before marking a migration phase complete.
- Do not proceed to the next phase while the current phase has known regressions.
