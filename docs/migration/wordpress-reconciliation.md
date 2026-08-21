# WordPress public-data reconciliation

Status: **ACCEPTED**

This is a read-only Phase 4 audit. The normalized WordPress data is not connected to public rendering, so the protected React/Vite-to-Next visual and SEO output remains unchanged.

## Authority and snapshot boundary

- Live production remains authoritative for URLs, status codes, canonicals, metadata, schema-facing SEO behavior, and rendered image alt text.
- The protected React/Vite implementation remains authoritative for visual output and currently rendered content.
- The WordPress backup remains authoritative for record IDs, relations, dates, and attachment metadata.
- Archive database snapshot: **2026-08-12T22:29:58.000Z**.
- Live crawl evidence: **2026-08-22**.
- The production delta `custom-puffy-stickers-guide` (post 19341) was published at **2026-08-20T20:39:34**. Published-after-snapshot absence is explicitly explained, not treated as archive data loss.

## Deterministic inventory

| Check | Expected | Found/matched |
| --- | ---: | ---: |
| Public pages (including the posts index) | 9 | 9 |
| Products | 21 | 21 |
| Baseline + Aug 20 posts | 12 | 11 archive + 1 live delta |
| Protected variation rows | 15 | 15 |
| Public taxonomy archive terms | 45 | 45 |
| Live referenced first-party upload keys | 157 | 151 archive verified + 6 live delta |
| Live referenced external media URLs | 16 | Preserved as explained dependencies |
| SEO records with comparable backup fields | - | 44 |

## Cutover blockers

The gate fails only for unexplained published-public mismatches or a privacy-boundary violation. Explained source-age differences and authority overrides remain visible below but do not fail the gate.

| Code | Scope | Identity | Required resolution |
| --- | --- | --- | --- |
| None | - | - | Phase 4 reconciliation gate passed. |

## Explained mismatches and precedence decisions

| Code | Scope | Identity | Authority |
| --- | --- | --- | --- |
| ATTACHMENT_ALT_DIFFERS_FROM_RENDERED_ALT | media-alt | `/wp-content/uploads/2022/02/dot-278-white-2.png` | wordpress-backup-for-media-metadata; live-production-for-rendered-seo |
| ATTACHMENT_ALT_DIFFERS_FROM_RENDERED_ALT | media-alt | `/wp-content/uploads/2022/02/ellipse-166-white-2.png` | wordpress-backup-for-media-metadata; live-production-for-rendered-seo |
| ATTACHMENT_ALT_DIFFERS_FROM_RENDERED_ALT | media-alt | `/wp-content/uploads/2022/02/ellipse-400-white-2.png` | wordpress-backup-for-media-metadata; live-production-for-rendered-seo |
| ATTACHMENT_ALT_DIFFERS_FROM_RENDERED_ALT | media-alt | `/wp-content/uploads/2022/03/dot-21-2.jpg` | wordpress-backup-for-media-metadata; live-production-for-rendered-seo |
| ATTACHMENT_ALT_DIFFERS_FROM_RENDERED_ALT | media-alt | `/wp-content/uploads/2022/03/dot-22-2.png` | wordpress-backup-for-media-metadata; live-production-for-rendered-seo |
| ATTACHMENT_ALT_DIFFERS_FROM_RENDERED_ALT | media-alt | `/wp-content/uploads/2022/03/eclipse-23-2.png` | wordpress-backup-for-media-metadata; live-production-for-rendered-seo |
| ATTACHMENT_ALT_DIFFERS_FROM_RENDERED_ALT | media-alt | `/wp-content/uploads/2022/03/eclipse-24-2.png` | wordpress-backup-for-media-metadata; live-production-for-rendered-seo |
| ATTACHMENT_ALT_DIFFERS_FROM_RENDERED_ALT | media-alt | `/wp-content/uploads/2022/03/elip-sale-31-2.png` | wordpress-backup-for-media-metadata; live-production-for-rendered-seo |
| ATTACHMENT_ALT_DIFFERS_FROM_RENDERED_ALT | media-alt | `/wp-content/uploads/2022/04/ellipse-484-white-1.png` | wordpress-backup-for-media-metadata; live-production-for-rendered-seo |
| ATTACHMENT_ALT_DIFFERS_FROM_RENDERED_ALT | media-alt | `/wp-content/uploads/2022/04/ellipse-banner-3-1.png` | wordpress-backup-for-media-metadata; live-production-for-rendered-seo |
| ATTACHMENT_ALT_DIFFERS_FROM_RENDERED_ALT | media-alt | `/wp-content/uploads/2022/11/banner-faqs-1.png` | wordpress-backup-for-media-metadata; live-production-for-rendered-seo |
| ATTACHMENT_ALT_DIFFERS_FROM_RENDERED_ALT | media-alt | `/wp-content/uploads/2025/08/chatgpt-image-aug-16-2025-06_04_36-am.webp` | wordpress-backup-for-media-metadata; live-production-for-rendered-seo |
| ATTACHMENT_ALT_DIFFERS_FROM_RENDERED_ALT | media-alt | `/wp-content/uploads/2025/08/chatgpt-image-aug-16-2025-06_20_33-am.webp` | wordpress-backup-for-media-metadata; live-production-for-rendered-seo |
| ATTACHMENT_ALT_DIFFERS_FROM_RENDERED_ALT | media-alt | `/wp-content/uploads/2025/08/chatgpt-image-aug-16-2025-06_44_34-am.webp` | wordpress-backup-for-media-metadata; live-production-for-rendered-seo |
| ATTACHMENT_ALT_DIFFERS_FROM_RENDERED_ALT | media-alt | `/wp-content/uploads/2025/08/choose-kindness-yellow-canvas-tote-bag.webp` | wordpress-backup-for-media-metadata; live-production-for-rendered-seo |
| ATTACHMENT_ALT_DIFFERS_FROM_RENDERED_ALT | media-alt | `/wp-content/uploads/2025/08/custom-jute-tote-bag-your-logo-tag-eco-friendly-promotional-merchandise.webp` | wordpress-backup-for-media-metadata; live-production-for-rendered-seo |
| ATTACHMENT_ALT_DIFFERS_FROM_RENDERED_ALT | media-alt | `/wp-content/uploads/2025/08/follow-your-dreams-rainbow-puffy-sticker-sheet.webp` | wordpress-backup-for-media-metadata; live-production-for-rendered-seo |
| ATTACHMENT_ALT_DIFFERS_FROM_RENDERED_ALT | media-alt | `/wp-content/uploads/2025/08/fred-lisa-leonardo-cartoon-stickers-flintstones-simpsons-tmnt-brown-background-e1755042146422.webp` | wordpress-backup-for-media-metadata; live-production-for-rendered-seo |
| ATTACHMENT_ALT_DIFFERS_FROM_RENDERED_ALT | media-alt | `/wp-content/uploads/2025/08/funny-shark-wearing-blue-sneakers-sticker.webp` | wordpress-backup-for-media-metadata; live-production-for-rendered-seo |
| ATTACHMENT_ALT_DIFFERS_FROM_RENDERED_ALT | media-alt | `/wp-content/uploads/2025/08/jute-tote-bag-biodegradable-reusable-durable-eco-friendly-icons-e1756241366595.webp` | wordpress-backup-for-media-metadata; live-production-for-rendered-seo |
| ATTACHMENT_ALT_DIFFERS_FROM_RENDERED_ALT | media-alt | `/wp-content/uploads/2025/08/love-themed-cinematic-puffy-sticker-sheet-e1756241823275.webp` | wordpress-backup-for-media-metadata; live-production-for-rendered-seo |
| ATTACHMENT_ALT_DIFFERS_FROM_RENDERED_ALT | media-alt | `/wp-content/uploads/2025/08/mini-jute-tote-bag-eco-tag-sustainable-natural-materials.webp` | wordpress-backup-for-media-metadata; live-production-for-rendered-seo |
| ATTACHMENT_ALT_DIFFERS_FROM_RENDERED_ALT | media-alt | `/wp-content/uploads/2025/08/minimalist-flat-icon-sticker-set-leaf-bottle-heart.webp` | wordpress-backup-for-media-metadata; live-production-for-rendered-seo |
| ATTACHMENT_ALT_DIFFERS_FROM_RENDERED_ALT | media-alt | `/wp-content/uploads/2025/08/motivational-no-pain-no-gain-sticker-design.webp` | wordpress-backup-for-media-metadata; live-production-for-rendered-seo |
| ATTACHMENT_ALT_DIFFERS_FROM_RENDERED_ALT | media-alt | `/wp-content/uploads/2025/08/pastel-custom-puffy-sticker-sheets-with-clouds-and-stars.webp` | wordpress-backup-for-media-metadata; live-production-for-rendered-seo |
| ATTACHMENT_ALT_DIFFERS_FROM_RENDERED_ALT | media-alt | `/wp-content/uploads/2025/08/puffy-sticker-sheet-cozy-creatures-pink-bunny-bear-cat-fox-cute-designs-e1755559028512.webp` | wordpress-backup-for-media-metadata; live-production-for-rendered-seo |
| ATTACHMENT_ALT_DIFFERS_FROM_RENDERED_ALT | media-alt | `/wp-content/uploads/2025/08/rainbow-print-canvas-tote-bag-with-stars-e1755904757571.webp` | wordpress-backup-for-media-metadata; live-production-for-rendered-seo |
| ATTACHMENT_ALT_DIFFERS_FROM_RENDERED_ALT | media-alt | `/wp-content/uploads/2025/08/rainbow-themed-puffy-sticker-sheet-kawaii-design.webp` | wordpress-backup-for-media-metadata; live-production-for-rendered-seo |
| ATTACHMENT_ALT_DIFFERS_FROM_RENDERED_ALT | media-alt | `/wp-content/uploads/2025/08/stronger-together-feminist-symbol-sticker.webp` | wordpress-backup-for-media-metadata; live-production-for-rendered-seo |
| ATTACHMENT_ALT_DIFFERS_FROM_RENDERED_ALT | media-alt | `/wp-content/uploads/2025/08/sustainable-bag-comparison-plastic-paper-vs-reusable-jute-eco-choice.webp` | wordpress-backup-for-media-metadata; live-production-for-rendered-seo |
| ATTACHMENT_ALT_DIFFERS_FROM_RENDERED_ALT | media-alt | `/wp-content/uploads/2025/08/woven-brown-jute-tote-bag-transparent-e1755903818900.webp` | wordpress-backup-for-media-metadata; live-production-for-rendered-seo |
| ATTACHMENT_ALT_DIFFERS_FROM_RENDERED_ALT | media-alt | `/wp-content/uploads/2026/03/packaging-innovation-and-compliance-showcase-scaled.webp` | wordpress-backup-for-media-metadata; live-production-for-rendered-seo |
| ATTACHMENT_ALT_DIFFERS_FROM_RENDERED_ALT | media-alt | `/wp-content/uploads/2026/03/sticker-therapy-in-a-futuristic-world.webp` | wordpress-backup-for-media-metadata; live-production-for-rendered-seo |
| ATTACHMENT_ALT_DIFFERS_FROM_RENDERED_ALT | media-alt | `/wp-content/uploads/2026/04/banner-care-scaled.webp` | wordpress-backup-for-media-metadata; live-production-for-rendered-seo |
| ATTACHMENT_ALT_DIFFERS_FROM_RENDERED_ALT | media-alt | `/wp-content/uploads/2026/04/banner-scaled.webp` | wordpress-backup-for-media-metadata; live-production-for-rendered-seo |
| ATTACHMENT_ALT_DIFFERS_FROM_RENDERED_ALT | media-alt | `/wp-content/uploads/2026/05/soft-depth-vx-smooth-depth.webp` | wordpress-backup-for-media-metadata; live-production-for-rendered-seo |
| ATTACHMENT_ALT_DIFFERS_FROM_RENDERED_ALT | media-alt | `/wp-content/uploads/2026/06/banner-scaled.png` | wordpress-backup-for-media-metadata; live-production-for-rendered-seo |
| LIVE_MEDIA_VERIFIED_AS_UNINDEXED_ARCHIVE_FILE | media | `/wp-content/uploads/2022/02/payment-method-2.png` | wordpress-backup-for-binary-presence; live-production-for-rendered-alt |
| LIVE_MEDIA_VERIFIED_AS_UNINDEXED_ARCHIVE_FILE | media | `/wp-content/uploads/2022/04/about-1-video-1.png` | wordpress-backup-for-binary-presence; live-production-for-rendered-alt |
| LIVE_MEDIA_VERIFIED_AS_UNINDEXED_ARCHIVE_FILE | media | `/wp-content/uploads/2022/05/top-banner-img-1.svg` | wordpress-backup-for-binary-presence; live-production-for-rendered-alt |
| LIVE_MEDIA_VERIFIED_AS_UNINDEXED_ARCHIVE_FILE | media | `/wp-content/uploads/2022/11/video-bg-9-1.jpg` | wordpress-backup-for-binary-presence; live-production-for-rendered-alt |
| LIVE_MEDIA_VERIFIED_AS_UNINDEXED_ARCHIVE_FILE | media | `/wp-content/uploads/2023/02/puff-logo-cloud-background-blue-yellow-text-soft-branding-e1754688317309.webp` | wordpress-backup-for-binary-presence; live-production-for-rendered-alt |
| LIVE_MEDIA_VERIFIED_AS_UNINDEXED_ARCHIVE_FILE | media | `/wp-content/uploads/2025/08/chef-illustration-okay-gesture-light-green.webp` | wordpress-backup-for-binary-presence; live-production-for-rendered-alt |
| LIVE_MEDIA_VERIFIED_AS_UNINDEXED_ARCHIVE_FILE | media | `/wp-content/uploads/2025/08/eco-jute-handbag-rounded-handles.webp` | wordpress-backup-for-binary-presence; live-production-for-rendered-alt |
| LIVE_MEDIA_VERIFIED_AS_UNINDEXED_ARCHIVE_FILE | media | `/wp-content/uploads/2025/08/johnny-bravo-cartoon-muscle-pose-sticker-mint-bg.webp` | wordpress-backup-for-binary-presence; live-production-for-rendered-alt |
| LIVE_MEDIA_AFTER_ARCHIVE_SNAPSHOT | media | `/wp-content/uploads/2026/08/custom-puffy-sticker-flat-vs-domed-proof-scaled.webp` | live-production-after-archive |
| LIVE_MEDIA_AFTER_ARCHIVE_SNAPSHOT | media | `/wp-content/uploads/2026/08/custom-puffy-sticker-packaging-insert-unboxing.webp` | live-production-after-archive |
| LIVE_MEDIA_AFTER_ARCHIVE_SNAPSHOT | media | `/wp-content/uploads/2026/08/die-cut-vs-kiss-cut-sticker-diagram.webp` | live-production-after-archive |
| LIVE_MEDIA_AFTER_ARCHIVE_SNAPSHOT | media | `/wp-content/uploads/2026/08/fingertip-on-raised-puffy-sticker-dome.webp` | live-production-after-archive |
| LIVE_MEDIA_AFTER_ARCHIVE_SNAPSHOT | media | `/wp-content/uploads/2026/08/puffy-sticker-domed-edge-macro-closeup.webp` | live-production-after-archive |
| LIVE_MEDIA_AFTER_ARCHIVE_SNAPSHOT | media | `/wp-content/uploads/2026/08/puffy-sticker-vs-epoxy-sticker-water-bottle-laptop.webp` | live-production-after-archive |
| LIVE_MEDIA_VERIFIED_AS_UNINDEXED_ARCHIVE_FILE | media | `/wp-content/uploads/revslider/home-6/decor-slide-61.svg` | wordpress-backup-for-binary-presence; live-production-for-rendered-alt |
| LIVE_MEDIA_VERIFIED_AS_UNINDEXED_ARCHIVE_FILE | media | `/wp-content/uploads/revslider/home-6/decor-slide-62.svg` | wordpress-backup-for-binary-presence; live-production-for-rendered-alt |
| LIVE_MEDIA_VERIFIED_AS_UNINDEXED_ARCHIVE_FILE | media | `/wp-content/uploads/revslider/home-6/decor-slide-63.svg` | wordpress-backup-for-binary-presence; live-production-for-rendered-alt |
| LIVE_MEDIA_VERIFIED_AS_UNINDEXED_ARCHIVE_FILE | media | `/wp-content/uploads/revslider/home-6/decor-slide-64.svg` | wordpress-backup-for-binary-presence; live-production-for-rendered-alt |
| LIVE_MEDIA_VERIFIED_AS_UNINDEXED_ARCHIVE_FILE | media | `/wp-content/uploads/revslider/home-6/product-slide-63.png` | wordpress-backup-for-binary-presence; live-production-for-rendered-alt |
| EXTERNAL_LIVE_MEDIA_REFERENCE | media | `https://pricom.harutheme.com/creative/wp-content/uploads/2022/02/testi-avatar-1.jpg` | live-production-for-rendered-content; outside-wordpress-backup-boundary |
| EXTERNAL_LIVE_MEDIA_REFERENCE | media | `https://pricom.harutheme.com/creative/wp-content/uploads/2022/02/testi-avatar-2.jpg` | live-production-for-rendered-content; outside-wordpress-backup-boundary |
| EXTERNAL_LIVE_MEDIA_REFERENCE | media | `https://pricom.harutheme.com/creative/wp-content/uploads/2022/02/testi-avatar-4.jpg` | live-production-for-rendered-content; outside-wordpress-backup-boundary |
| EXTERNAL_LIVE_MEDIA_REFERENCE | media | `https://pricom.harutheme.com/creative/wp-content/uploads/2022/02/testi-avatar-5.jpg` | live-production-for-rendered-content; outside-wordpress-backup-boundary |
| EXTERNAL_LIVE_MEDIA_REFERENCE | media | `https://pricom.harutheme.com/creative/wp-content/uploads/2022/03/logo-company.png` | live-production-for-rendered-content; outside-wordpress-backup-boundary |
| EXTERNAL_LIVE_MEDIA_REFERENCE | media | `https://pricom.harutheme.com/creative/wp-content/uploads/2022/03/logo-cosmic.png` | live-production-for-rendered-content; outside-wordpress-backup-boundary |
| EXTERNAL_LIVE_MEDIA_REFERENCE | media | `https://pricom.harutheme.com/creative/wp-content/uploads/2022/03/logo-cougar.png` | live-production-for-rendered-content; outside-wordpress-backup-boundary |
| EXTERNAL_LIVE_MEDIA_REFERENCE | media | `https://pricom.harutheme.com/creative/wp-content/uploads/2022/03/logo-design.png` | live-production-for-rendered-content; outside-wordpress-backup-boundary |
| EXTERNAL_LIVE_MEDIA_REFERENCE | media | `https://pricom.harutheme.com/creative/wp-content/uploads/2022/03/logo-findr.png` | live-production-for-rendered-content; outside-wordpress-backup-boundary |
| EXTERNAL_LIVE_MEDIA_REFERENCE | media | `https://pricom.harutheme.com/creative/wp-content/uploads/2022/03/logo-intdeco.png` | live-production-for-rendered-content; outside-wordpress-backup-boundary |
| EXTERNAL_LIVE_MEDIA_REFERENCE | media | `https://pricom.harutheme.com/creative/wp-content/uploads/2022/03/member-21.png` | live-production-for-rendered-content; outside-wordpress-backup-boundary |
| EXTERNAL_LIVE_MEDIA_REFERENCE | media | `https://pricom.harutheme.com/creative/wp-content/uploads/2022/03/member-22.png` | live-production-for-rendered-content; outside-wordpress-backup-boundary |
| EXTERNAL_LIVE_MEDIA_REFERENCE | media | `https://pricom.harutheme.com/creative/wp-content/uploads/2022/03/member-23.png` | live-production-for-rendered-content; outside-wordpress-backup-boundary |
| EXTERNAL_LIVE_MEDIA_REFERENCE | media | `https://pricom.harutheme.com/creative/wp-content/uploads/2022/03/member-24.png` | live-production-for-rendered-content; outside-wordpress-backup-boundary |
| EXTERNAL_LIVE_MEDIA_REFERENCE | media | `https://pricom.harutheme.com/creative/wp-content/uploads/2022/04/banner-about-1.png` | live-production-for-rendered-content; outside-wordpress-backup-boundary |
| EXTERNAL_LIVE_MEDIA_REFERENCE | media | `https://pricom.harutheme.com/creative/wp-content/uploads/2022/04/banner-about-2.png` | live-production-for-rendered-content; outside-wordpress-backup-boundary |
| LIVE_POST_AFTER_ARCHIVE_SNAPSHOT | post | `custom-puffy-stickers-guide` | live-production-after-archive |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/about-us` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/blog` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/blog` | live-production-for-seo |
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
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/faqs` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/flat-labels-stickers/holographic-stickers` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/flat-labels-stickers/holographic-stickers` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/privacy-policy` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/promotional-items/eco-friendly-kraft-mylar-bags` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/promotional-items/eco-friendly-kraft-mylar-bags` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/promotional-items/eco-friendly-kraft-mylar-bags` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/promotional-items/jute-bag` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/promotional-items/non-woven-bag` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/promotional-items/nylon-bag` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/promotional-items/paper-bag` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/promotional-items/washable-paper-bags` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/promotional-items/woven-bags` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/puffy-labels-stickers/epoxy-stickers` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/puffy-labels-stickers/pu-embossed-stickers` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/puffy-labels-stickers/pu-embossed-stickers` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/puffy-labels-stickers/puffy-sticker-sheets` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/puffy-labels-stickers/puffy-stickers` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/puffy-labels-stickers/puffy-stickers` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/puffy-labels-stickers/puffy-stickers` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/reprint-policy` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/request-a-quote` | live-production-for-seo |
| BACKUP_SEO_DIFFERS_FROM_LIVE | seo | `/terms-of-service` | live-production-for-seo |

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
