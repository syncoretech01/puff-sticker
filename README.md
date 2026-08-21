# Puff Sticker — immersive brand experience

A premium interactive rebuild for PuffSticker.com, created with React, TypeScript, Three.js, GSAP, ScrollTrigger, Lenis and Vite.

## Run locally

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173/`.

## Production build

```bash
npm run build:vite
npm run preview:vite
```

The build prerenders 51 canonical routes plus the local shop, resources and shipping pages, then verifies route HTML, metadata, exact source content and mirrored assets.

## Refresh published content

```bash
node scripts/import-live-content.mjs
npm run optimize:live-blog-images
```

The importer reads only `puffsticker.com`, sanitizes the published semantic HTML, localizes source images and regenerates the exact product, article, page and SEO content modules.

All product details, business facts, links and product photography in the experience are sourced from PuffSticker.com. The supplied Puff Sticker logo is used throughout the loader, navigation, material lab, layer story and footer.
