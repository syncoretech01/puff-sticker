export type Breakpoint = {
  name: 'desktop' | 'tablet' | 'mobile'
  width: number
  height: number
}

export const breakpoints: readonly Breakpoint[] = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
]

export const localExtensionRoutes = [
  '/shop/',
  '/resources/',
  '/shipping-delivery/',
] as const

export const representativeRoutes = [
  { name: 'home', path: '/', selectors: ['.hero', '.core-categories', '.collection', '.finish-lab', '.home-journal', '.faq'] },
  { name: 'category', path: '/puffy-labels-stickers/', selectors: ['.category-hero', '.catalog-section--category'] },
  { name: 'product', path: '/puffy-labels-stickers/puffy-stickers/', selectors: ['.product-detail', '.product-content', '.product-specs', '.product-page-faq'] },
  { name: 'shop', path: '/shop/', selectors: ['.page-hero', '.catalog-section'] },
  { name: 'about', path: '/about-us/', selectors: ['.page-hero', '.about-origin', '.about-principles'] },
  { name: 'faq', path: '/faqs/', selectors: ['.page-hero', '.faq-page'] },
  { name: 'quote', path: '/request-a-quote/', selectors: ['.quote-page'] },
  { name: 'blog', path: '/blog/', selectors: ['.page-hero', '.blog-page'] },
  { name: 'article', path: '/blog/when-3d-stickers-become-collectibles/', selectors: ['.article-page__header', '.article-page__hero', '.article-page__body'] },
  { name: 'policy', path: '/privacy-policy/', selectors: ['.page-hero', '.policy-page'] },
] as const

export const visualCases = [
  { name: 'home-hero', path: '/', selector: '.hero' },
  { name: 'home-categories', path: '/', selector: '.core-categories' },
  { name: 'home-featured', path: '/', selector: '.collection' },
  { name: 'home-finish-lab', path: '/', selector: '.finish-lab' },
  { name: 'category-hero', path: '/puffy-labels-stickers/', selector: '.category-hero' },
  { name: 'product-hero', path: '/puffy-labels-stickers/puffy-stickers/', selector: '.product-detail' },
  { name: 'faq', path: '/faqs/', selector: '.faq-page' },
  { name: 'quote', path: '/request-a-quote/', selector: '.quote-page' },
  { name: 'blog', path: '/blog/', selector: '.blog-page' },
  { name: 'article-hero', path: '/blog/when-3d-stickers-become-collectibles/', selector: '.article-page__header' },
] as const
