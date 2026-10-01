# WordPress public-data reconciliation

Status: **ACCEPTED**

This is a read-only Phase 4 audit. The normalized WordPress data is not connected to public rendering, so the protected React/Vite-to-Next visual and SEO output remains unchanged.

## Authority and snapshot boundary

- Live production remains authoritative for URLs, status codes, canonicals, metadata, schema-facing SEO behavior, and rendered image alt text.
- The protected React/Vite implementation remains authoritative for visual output and currently rendered content.
- The WordPress backup remains authoritative for record IDs, relations, dates, and attachment metadata.
- Archive database snapshot: **2026-08-12T22:29:58.000Z**.
- Live crawl evidence through: **2026-10-01**.
- Production deltas newer than the backup: `custom-puffy-stickers-guide` (post 19341, published 2026-08-20T20:39:34); `why-custom-stickers-feel-like-objects` (post 19368, published 2026-08-31T21:21:35). Published-after-snapshot absence is explicitly explained, not treated as archive data loss.

## Deterministic inventory

| Check | Expected | Found/matched |
| --- | ---: | ---: |
| Public pages (including the posts index) | 14 | 9 |
| Products | 31 | 21 |
| Baseline + live-delta posts | 24 | 11 archive + 13 live deltas |
| Protected variation rows | 15 | 15 |
| Public taxonomy archive terms | 6 | 5 |
| Live referenced first-party upload keys | 2 | 2 archive verified + 0 live delta |
| Live referenced external media URLs | 0 | Preserved as explained dependencies |
| SEO records with comparable backup fields | - | 44 |

## Cutover blockers

The gate fails only for unexplained published-public mismatches or a privacy-boundary violation. Explained source-age differences and authority overrides remain visible below but do not fail the gate.

| Code | Scope | Identity | Required resolution |
| --- | --- | --- | --- |
| None | - | - | Phase 4 reconciliation gate passed. |

## Explained mismatches and precedence decisions

| Code | Scope | Identity | Authority |
| --- | --- | --- | --- |
| LEGACY_PUBLIC_MEDIA_RETAINED_FROM_ARCHIVE | media | `/wp-content/uploads/2022/02/payment-method-2.png` | wordpress-backup-for-legacy-public-binary; current-production-for-active-assets |
| LEGACY_PUBLIC_MEDIA_RETAINED_FROM_ARCHIVE | media | `/wp-content/uploads/2022/04/about-1-video-1.png` | wordpress-backup-for-legacy-public-binary; current-production-for-active-assets |
| LEGACY_PUBLIC_MEDIA_RETAINED_FROM_ARCHIVE | media | `/wp-content/uploads/2022/05/top-banner-img-1.svg` | wordpress-backup-for-legacy-public-binary; current-production-for-active-assets |
| LEGACY_PUBLIC_MEDIA_RETAINED_FROM_ARCHIVE | media | `/wp-content/uploads/2022/11/video-bg-9-1.jpg` | wordpress-backup-for-legacy-public-binary; current-production-for-active-assets |
| LEGACY_PUBLIC_MEDIA_RETAINED_FROM_ARCHIVE | media | `/wp-content/uploads/2023/02/puff-logo-cloud-background-blue-yellow-text-soft-branding-e1754688317309.webp` | wordpress-backup-for-legacy-public-binary; current-production-for-active-assets |
| LEGACY_PUBLIC_MEDIA_RETAINED_FROM_ARCHIVE | media | `/wp-content/uploads/2025/08/chef-illustration-okay-gesture-light-green.webp` | wordpress-backup-for-legacy-public-binary; current-production-for-active-assets |
| LEGACY_PUBLIC_MEDIA_RETAINED_FROM_ARCHIVE | media | `/wp-content/uploads/2025/08/eco-jute-handbag-rounded-handles.webp` | wordpress-backup-for-legacy-public-binary; current-production-for-active-assets |
| LEGACY_PUBLIC_MEDIA_RETAINED_FROM_ARCHIVE | media | `/wp-content/uploads/2025/08/johnny-bravo-cartoon-muscle-pose-sticker-mint-bg.webp` | wordpress-backup-for-legacy-public-binary; current-production-for-active-assets |
| LEGACY_PUBLIC_MEDIA_RETAINED_FROM_ARCHIVE | media | `/wp-content/uploads/revslider/home-6/decor-slide-61.svg` | wordpress-backup-for-legacy-public-binary; current-production-for-active-assets |
| LEGACY_PUBLIC_MEDIA_RETAINED_FROM_ARCHIVE | media | `/wp-content/uploads/revslider/home-6/decor-slide-62.svg` | wordpress-backup-for-legacy-public-binary; current-production-for-active-assets |
| LEGACY_PUBLIC_MEDIA_RETAINED_FROM_ARCHIVE | media | `/wp-content/uploads/revslider/home-6/decor-slide-63.svg` | wordpress-backup-for-legacy-public-binary; current-production-for-active-assets |
| LEGACY_PUBLIC_MEDIA_RETAINED_FROM_ARCHIVE | media | `/wp-content/uploads/revslider/home-6/decor-slide-64.svg` | wordpress-backup-for-legacy-public-binary; current-production-for-active-assets |
| LEGACY_PUBLIC_MEDIA_RETAINED_FROM_ARCHIVE | media | `/wp-content/uploads/revslider/home-6/product-slide-63.png` | wordpress-backup-for-legacy-public-binary; current-production-for-active-assets |
| CURRENT_PRODUCTION_PAGE_OUTSIDE_WORDPRESS_BACKUP | page | `/checkout` | live-production |
| CURRENT_PRODUCTION_PAGE_OUTSIDE_WORDPRESS_BACKUP | page | `/industries` | live-production |
| CURRENT_PRODUCTION_PAGE_OUTSIDE_WORDPRESS_BACKUP | page | `/payment-terms` | live-production |
| CURRENT_PRODUCTION_PAGE_OUTSIDE_WORDPRESS_BACKUP | page | `/shipping-policy` | live-production |
| CURRENT_PRODUCTION_PAGE_OUTSIDE_WORDPRESS_BACKUP | page | `/shop` | live-production |
| LIVE_POST_AFTER_ARCHIVE_SNAPSHOT | post | `cbd-box-styles-tuck-end-sleeve-rigid` | dated-live-production-and-protected-static-content |
| LIVE_POST_AFTER_ARCHIVE_SNAPSHOT | post | `cbd-packaging-on-a-dispensary-shelf` | dated-live-production-and-protected-static-content |
| LIVE_POST_AFTER_ARCHIVE_SNAPSHOT | post | `child-resistant-cbd-boxes-how-they-work` | dated-live-production-and-protected-static-content |
| LIVE_POST_AFTER_ARCHIVE_SNAPSHOT | post | `custom-mylar-bags-guide` | dated-live-production-and-protected-static-content |
| LIVE_POST_AFTER_ARCHIVE_SNAPSHOT | post | `custom-puffy-stickers-christmas` | dated-live-production-and-protected-static-content |
| LIVE_POST_AFTER_ARCHIVE_SNAPSHOT | post | `custom-puffy-stickers-guide` | dated-live-production-and-protected-static-content |
| LIVE_POST_AFTER_ARCHIVE_SNAPSHOT | post | `kraft-look-packaging` | dated-live-production-and-protected-static-content |
| LIVE_POST_AFTER_ARCHIVE_SNAPSHOT | post | `recyclable-compostable-biodegradable` | dated-live-production-and-protected-static-content |
| LIVE_POST_AFTER_ARCHIVE_SNAPSHOT | post | `reflex-to-touch-raised-surface` | dated-live-production-and-protected-static-content |
| LIVE_POST_AFTER_ARCHIVE_SNAPSHOT | post | `sticker-stops-feeling-flat` | dated-live-production-and-protected-static-content |
| LIVE_POST_AFTER_ARCHIVE_SNAPSHOT | post | `sticker-thickness-personality` | dated-live-production-and-protected-static-content |
| LIVE_POST_AFTER_ARCHIVE_SNAPSHOT | post | `why-custom-stickers-feel-like-objects` | dated-live-production-and-protected-static-content |
| LIVE_POST_AFTER_ARCHIVE_SNAPSHOT | post | `why-paper-is-better-isnt-a-complete-packaging-argument` | dated-live-production-and-protected-static-content |
| CURRENT_PRODUCTION_PRODUCT_OUTSIDE_WORDPRESS_BACKUP | product | `cbd-bottle-boxes` | dated-live-production-and-protected-static-content |
| CURRENT_PRODUCTION_PRODUCT_OUTSIDE_WORDPRESS_BACKUP | product | `cbd-display-boxes` | dated-live-production-and-protected-static-content |
| CURRENT_PRODUCTION_PRODUCT_OUTSIDE_WORDPRESS_BACKUP | product | `cbd-gummy-boxes` | dated-live-production-and-protected-static-content |
| CURRENT_PRODUCTION_PRODUCT_OUTSIDE_WORDPRESS_BACKUP | product | `cbd-kraft-boxes` | dated-live-production-and-protected-static-content |
| CURRENT_PRODUCTION_PRODUCT_OUTSIDE_WORDPRESS_BACKUP | product | `cbd-oil-packaging` | dated-live-production-and-protected-static-content |
| CURRENT_PRODUCTION_PRODUCT_OUTSIDE_WORDPRESS_BACKUP | product | `cbd-sleeve-tray-boxes` | dated-live-production-and-protected-static-content |
| CURRENT_PRODUCTION_PRODUCT_OUTSIDE_WORDPRESS_BACKUP | product | `cbd-tincture-boxes` | dated-live-production-and-protected-static-content |
| CURRENT_PRODUCTION_PRODUCT_OUTSIDE_WORDPRESS_BACKUP | product | `child-resistant-boxes` | dated-live-production-and-protected-static-content |
| CURRENT_PRODUCTION_PRODUCT_OUTSIDE_WORDPRESS_BACKUP | product | `custom-cbd-boxes` | dated-live-production-and-protected-static-content |
| CURRENT_PRODUCTION_PRODUCT_OUTSIDE_WORDPRESS_BACKUP | product | `custom-hemp-boxes` | dated-live-production-and-protected-static-content |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/about-us` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/about-us` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/blog` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/blog` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/blog/custom-jute-tote-bags-the-perfect-blend-of-sustainability` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/blog/custom-jute-tote-bags-the-perfect-blend-of-sustainability` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/blog/custom-jute-tote-bags-the-perfect-blend-of-sustainability` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/blog/custom-puffy-stickers-became-the-new-therapy` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/blog/holographic-stickers-color-perception` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/blog/holographic-stickers-color-perception` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/blog/matte-vs-gloss-psychology` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/blog/puffy-stickers-are-trending-2025` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/blog/puffy-stickers-are-trending-2025` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/blog/soft-depth-vs-smooth-depth` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/blog/sound-of-packaging-mylar-bags` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/blog/why-foil-stickers-feel-valuable` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/blog/why-sticker-books-never-really-disappeared` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/blog/why-we-save-stickers-we-never-use` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/contact-us` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/contact-us` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/faqs` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/flat-labels-stickers` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/flat-labels-stickers/custom-stickers` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/flat-labels-stickers/holographic-stickers` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/flat-labels-stickers/holographic-stickers` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/flat-labels-stickers/metallic-foil-stickers` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/privacy-policy` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/promotional-items` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/promotional-items` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/promotional-items/eco-friendly-kraft-mylar-bags` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/promotional-items/eco-friendly-kraft-mylar-bags` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/promotional-items/eco-friendly-kraft-mylar-bags` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/promotional-items/jute-bag` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/promotional-items/jute-bag` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/promotional-items/non-woven-bag` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/promotional-items/non-woven-bag` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/promotional-items/non-woven-bag` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/promotional-items/nylon-bag` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/promotional-items/paper-bag` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/promotional-items/paper-bag` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/promotional-items/paper-bag` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/promotional-items/washable-paper-bags` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/promotional-items/washable-paper-bags` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/promotional-items/woven-bags` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/puffy-labels-stickers/epoxy-stickers` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/puffy-labels-stickers/pu-embossed-stickers` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/puffy-labels-stickers/pu-embossed-stickers` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/puffy-labels-stickers/puffy-sticker-sheets` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/puffy-labels-stickers/puffy-sticker-sheets` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/puffy-labels-stickers/puffy-stickers` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/puffy-labels-stickers/puffy-stickers` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/puffy-labels-stickers/puffy-stickers` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/reprint-policy` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/request-a-quote` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/terms-of-service` | live-production-for-seo |
| LIVE_TAXONOMY_AFTER_ARCHIVE_SNAPSHOT | taxonomy | `product_cat:cbd-packaging-boxes` | live-production-for-public-route; wordpress-backup-for-term-identity |

## Private/system exclusions

Only aggregate types and counts are reported. No customer, order, form, credential, session, or other private values are present in this report.

| Excluded type | Count | Disposition |
| --- | ---: | --- |
| commerce-and-customers | not parsed | never-parsed |
| forms-and-messages | not parsed | never-parsed |
| identity-and-authentication | not parsed | never-parsed |
| indexablesOutsidePublicGraph | 162 | excluded |
| logs-and-analytics | not parsed | never-parsed |
| orphanOrUnpublishedVariations | 46 | excluded |
| postMetaNotAllowlisted | 14888 | excluded |
| postMetaOutsidePublicGraph | 3880 | excluded |
| private-content | not parsed | never-parsed |
| redirectRowsNotActivePublicRules | 0 | excluded |
| secrets-and-configuration | not parsed | never-parsed |
| selectedAllowlistedPostMetaRows | 1388 | excluded |
| taxonomyRowsOutsidePublicGraph | 45 | excluded |
| termMetaNotAllowlisted | 10 | excluded |
| termMetaOutsidePublicGraph | 5 | excluded |
| unpublishedOrPasswordProtectedContent | 74 | excluded |
| unreferenced-media | not parsed | never-parsed |
| unreferencedAttachments | 191 | excluded |
| unsupportedPostType | 1480 | excluded |

## Acceptance

- Passed: **yes**.
- Public runtime wired to normalized data: **no**.
- The public-only dataset is reconciled for Phase 4. Keep the runtime on protected sources until the separately gated persistence/CMS phase.
- Search Console exports, backlink data, and access-log URL evidence remain required pre-cutover inputs when available; this archive reconciliation does not claim those sources were supplied.
