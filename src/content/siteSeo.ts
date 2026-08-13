import { catalogProducts, categories, getProduct, type CategorySlug } from './catalog'
import { getEditorialArticle, getProductIndependentRouteSeo, type RouteSeo } from './editorial'
import { exactFaqByPath } from './liveFaqSchema'
import { liveSeo } from './liveSeo'
import { getProductDetails } from './productDetails'

export type ResolvedSiteSeo = RouteSeo & {
  pathname: string
  structuredData: readonly Record<string, unknown>[]
}

const siteUrl = 'https://puffsticker.com'
const logoUrl = `${siteUrl}/assets/puff-logo.webp`

const categorySeo: Record<CategorySlug, RouteSeo> = {
  'puffy-labels-stickers': {
    title: 'Custom Made Puffy Stickers & 3d Labels | PuffSticker.com',
    metaDescription: 'Explore customizable puffy sticker sheets and dimensional 3D foam labels for business branding, packaging, merchandise and personal projects.',
    canonical: `${siteUrl}/puffy-labels-stickers/`,
    robots: 'follow,index,max-image-preview:large',
    openGraphTitle: 'Custom Made Puffy Stickers & 3d Labels | PuffSticker.com',
    openGraphDescription: 'Explore customizable puffy sticker sheets and dimensional labels for branding, packaging and merchandise.',
    openGraphImage: `${siteUrl}/assets/catalog/puffy-stickers.webp`,
    openGraphType: 'website',
  },
  'flat-labels-stickers': {
    title: 'Buy Custom Stickers & Flat Labels Online | PuffSticker.com',
    metaDescription: 'Explore customizable flat labels and stickers for packaging, product branding, promotions and giveaways across clear, foil and holographic finishes.',
    canonical: `${siteUrl}/flat-labels-stickers/`,
    robots: 'follow,index,max-image-preview:large',
    openGraphTitle: 'Buy Custom Stickers & Flat Labels Online | PuffSticker.com',
    openGraphDescription: 'Custom flat labels and stickers for packaging, promotion and branded giveaways.',
    openGraphImage: `${siteUrl}/assets/catalog/holographic-stickers.webp`,
    openGraphType: 'website',
  },
  'promotional-items': {
    title: 'Custom Promotional Bags | Eco-Friendly Bags at PuffSticker.com',
    metaDescription: 'Explore custom paper, jute, nylon, woven and reusable promotional bags designed for retail, events, gifting and repeat brand visibility.',
    canonical: `${siteUrl}/promotional-items/`,
    robots: 'follow,index,max-image-preview:large',
    openGraphTitle: 'Custom Promotional Bags | Eco-Friendly Bags at PuffSticker.com',
    openGraphDescription: 'Custom promotional bags for retail, events, gifting and repeat brand visibility.',
    openGraphImage: `${siteUrl}/assets/catalog/woven-bags.webp`,
    openGraphType: 'website',
  },
}

const aliases: Record<string, string> = {
  '/about': '/about-us',
  '/faq': '/faqs',
  '/contact': '/contact-us',
  '/quote': '/request-a-quote',
}

const localRouteSeo: Record<string, RouteSeo> = {
  '/shop': {
    title: 'All Custom Products | PuffSticker.com',
    metaDescription: 'Browse all 21 PuffSticker product formats across puffy stickers, flat labels and custom promotional packaging.',
    canonical: `${siteUrl}/shop/`, robots: 'follow,index,max-image-preview:large', openGraphTitle: null, openGraphDescription: null, openGraphImage: logoUrl, openGraphType: 'website',
  },
  '/resources': {
    title: 'Custom Printing Resources | PuffSticker.com',
    metaDescription: 'Artwork, material, production, delivery and policy guidance for custom PuffSticker orders.',
    canonical: `${siteUrl}/resources/`, robots: 'follow,index', openGraphTitle: null, openGraphDescription: null, openGraphImage: logoUrl, openGraphType: 'website',
  },
  '/shipping-delivery': {
    title: 'Shipping & Delivery | PuffSticker.com',
    metaDescription: 'Planning guidance for PuffSticker custom-production windows, tracked delivery and international shipping.',
    canonical: `${siteUrl}/shipping-delivery/`, robots: 'follow,index', openGraphTitle: null, openGraphDescription: null, openGraphImage: logoUrl, openGraphType: 'website',
  },
}

const blogCategoryNames: Record<string, string> = {
  'custom-epoxy-stickers': 'Custom Epoxy Stickers',
  'custom-foil-stickers': 'Custom Foil Stickers',
  'custom-holographic-stickers': 'Custom Holographic Stickers',
  'custom-jute-tote-bags': 'Custom Jute Tote Bags',
  'custom-mylar-bags': 'Custom Mylar Bags',
  'custom-puffy-stickers': 'Custom Puffy Stickers',
  'sticker-psychology': 'Sticker Psychology',
}

function normalize(pathname: string) {
  const value = `/${pathname.split(/[?#]/, 1)[0].split('/').filter(Boolean).join('/')}`
  return value === '/' ? '/' : value.replace(/\/$/, '')
}

function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${siteUrl}/#organization`,
    name: 'PuffSticker',
    url: `${siteUrl}/`,
    logo: logoUrl,
    email: 'sales@puffsticker.com',
    telephone: '+1-407-923-4382',
    address: [
      { '@type': 'PostalAddress', streetAddress: 'Apt 325, 3433 Mission Bay Boulevard', addressLocality: 'Orlando', addressRegion: 'FL', postalCode: '32817', addressCountry: 'US' },
      { '@type': 'PostalAddress', streetAddress: '1306 Meath Dr.', addressLocality: 'Oshawa', addressRegion: 'ON', postalCode: 'L1K 0M7', addressCountry: 'CA' },
    ],
  }
}

function webSiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${siteUrl}/#website`,
    url: `${siteUrl}/`,
    name: 'PuffSticker',
    publisher: { '@id': `${siteUrl}/#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: `${siteUrl}/?s={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  }
}

function breadcrumbSchema(pathname: string) {
  const parts = pathname.split('/').filter(Boolean)
  const items = [{ '@type': 'ListItem', position: 1, name: 'Home', item: `${siteUrl}/` }]
  let current = ''
  parts.forEach((part, index) => {
    current += `/${part}`
    items.push({
      '@type': 'ListItem',
      position: index + 2,
      name: part.split('-').map((word) => word === '3d' ? '3D' : word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
      item: `${siteUrl}${current}/`,
    })
  })
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items }
}

function faqSchema(pathname: string) {
  const items = exactFaqByPath[pathname]
  if (!items?.length) return undefined
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${siteUrl}${pathname === '/' ? '/' : `${pathname}/`}#faq`,
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  }
}

function pageSchema(pathname: string, seo: RouteSeo, isProduct: boolean) {
  const isCollection = pathname === '/shop'
    || pathname === '/blog'
    || pathname.slice(1) in categorySeo
    || pathname.startsWith('/blog/category/')
    || pathname.startsWith('/category/')
  const type = isProduct ? 'ItemPage' : isCollection ? 'CollectionPage' : 'WebPage'
  return {
    '@context': 'https://schema.org',
    '@type': type,
    '@id': `${seo.canonical}#webpage`,
    url: seo.canonical,
    name: seo.title,
    description: seo.metaDescription || undefined,
    isPartOf: { '@id': `${siteUrl}/#website` },
    ...(isProduct ? { mainEntity: { '@id': `${seo.canonical}#product` } } : {}),
  }
}

function productSchema(slug: string) {
  const product = getProduct(slug)
  const details = getProductDetails(slug)
  if (!product || !details) return []
  const numericPrice = details.commerce.displayedPrice.match(/[\d.]+/)?.[0] ?? product.price.match(/[\d.]+/)?.[0]
  const variations = details.commerce.variations ?? []
  const offers = numericPrice ? {
    '@type': 'Offer',
    url: details.canonicalUrl,
    priceCurrency: details.commerce.currency,
    price: numericPrice,
    availability: 'https://schema.org/InStock',
  } : undefined
  const sharedProduct = {
    '@id': `${details.canonicalUrl}#product`,
    name: product.name,
    description: details.seo.metaDescription,
    image: [`${siteUrl}${product.image}`],
    sku: String(details.productId),
    category: categories[product.category].name,
    brand: { '@type': 'Brand', name: 'PuffSticker' },
    url: details.canonicalUrl,
  }
  const productOrGroup = variations.length ? {
    '@context': 'https://schema.org',
    '@type': 'ProductGroup',
    ...sharedProduct,
    productGroupID: String(details.productId),
    hasVariant: variations.map((variation) => {
      const [attributeName, ...valueParts] = variation.label.split(':')
      const attributeValue = valueParts.join(':').trim()
      const parameter = `attribute_${attributeName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
      const variantUrl = `${details.canonicalUrl}?${new URLSearchParams({ [parameter]: attributeValue }).toString()}`
      return {
        '@type': 'Product',
        '@id': `${details.canonicalUrl}#variation-${variation.id}`,
        name: product.name,
        description: details.seo.metaDescription,
        image: [`${siteUrl}${product.image}`],
        sku: String(variation.id),
        category: categories[product.category].name,
        brand: { '@type': 'Brand', name: 'PuffSticker' },
        isVariantOf: { '@id': `${details.canonicalUrl}#product` },
        additionalProperty: {
          '@type': 'PropertyValue',
          name: attributeName.trim(),
          value: attributeValue,
        },
        offers: {
          '@type': 'Offer',
          url: variantUrl,
          priceCurrency: details.commerce.currency,
          price: variation.price.replace(/[^\d.]/g, ''),
          availability: 'https://schema.org/InStock',
          itemCondition: 'https://schema.org/NewCondition',
        },
      }
    }),
  } : {
      '@context': 'https://schema.org',
      '@type': 'Product',
      ...sharedProduct,
      offers,
    }
  const exactFaq = faqSchema(details.canonicalPath)
  return exactFaq ? [productOrGroup, exactFaq] : [productOrGroup]
}

function articleSchema(slug: string) {
  const article = getEditorialArticle(slug)
  if (!article) return []
  return [{
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: article.title,
    description: article.seo.metaDescription,
    datePublished: article.publishedAt,
    image: [article.featuredImage, ...article.inlineImages],
    articleSection: article.categories,
    mainEntityOfPage: article.seo.canonical,
    author: { '@type': 'Organization', name: 'PuffSticker' },
    publisher: { '@type': 'Organization', name: 'PuffSticker', logo: { '@type': 'ImageObject', url: logoUrl } },
  }]
}

function notFoundSeo(pathname: string): ResolvedSiteSeo {
  return {
    pathname,
    title: 'Page Not Found | PuffSticker.com',
    metaDescription: null,
    canonical: `${siteUrl}${pathname}/`,
    robots: 'noindex,follow',
    openGraphTitle: null,
    openGraphDescription: null,
    openGraphImage: logoUrl,
    openGraphType: 'website',
    structuredData: [],
  }
}

export function resolveRouteSeo(rawPathname: string): ResolvedSiteSeo {
  const originalPath = normalize(rawPathname)
  const pathname = aliases[originalPath] ?? originalPath
  const parts = pathname.split('/').filter(Boolean)
  let seo = getProductIndependentRouteSeo(pathname) ?? localRouteSeo[pathname]
  let extraStructuredData: Record<string, unknown>[] = []

  if (!seo && parts.length === 1 && parts[0] in categorySeo) seo = categorySeo[parts[0] as CategorySlug]

  const isProductAlias = parts[0] === 'product' && Boolean(parts[1])
  const candidateProductSlug = isProductAlias ? parts[1] : parts.length === 2 && parts[0] in categorySeo ? parts[1] : undefined
  if (candidateProductSlug) {
    const details = getProductDetails(candidateProductSlug)
    if (!details || (!isProductAlias && details.canonicalCategory !== parts[0])) return notFoundSeo(originalPath)
    const product = getProduct(candidateProductSlug)
    seo = {
      title: details.seo.title,
      metaDescription: details.seo.metaDescription,
      canonical: details.canonicalUrl,
      robots: 'follow,index,max-snippet:-1,max-image-preview:large',
      openGraphTitle: details.seo.title,
      openGraphDescription: details.seo.metaDescription,
      openGraphImage: product ? `${siteUrl}${product.image}` : logoUrl,
      openGraphType: 'website',
    }
    extraStructuredData = productSchema(candidateProductSlug)
  }

  if (!seo && parts[0] === 'category' && parts[1] in categorySeo) seo = categorySeo[parts[1] as CategorySlug]

  if (!seo && parts[0] === 'blog' && parts[1] === 'category' && blogCategoryNames[parts[2]]) {
    const label = blogCategoryNames[parts[2]]
    seo = {
      title: `${label} Articles | PuffSticker.com`,
      metaDescription: `Read PuffSticker articles about ${label.toLowerCase()}, materials, design and custom production.`,
      canonical: `${siteUrl}/blog/category/${parts[2]}/`, robots: 'follow,index,max-image-preview:large', openGraphTitle: null, openGraphDescription: null, openGraphImage: logoUrl, openGraphType: 'website',
    }
  }

  const exactLiveSeo = liveSeo[pathname as keyof typeof liveSeo]
  const exactCanonicalPath = exactLiveSeo ? normalize(new URL(exactLiveSeo.canonical).pathname) : null
  if (exactLiveSeo && exactCanonicalPath === pathname) {
    const resolvedDescription = exactLiveSeo.description || seo?.metaDescription || ''
    const fallback: RouteSeo = {
      title: exactLiveSeo.title,
      metaDescription: resolvedDescription,
      canonical: exactLiveSeo.canonical,
      robots: 'follow,index,max-image-preview:large',
      openGraphTitle: exactLiveSeo.title,
      openGraphDescription: resolvedDescription,
      openGraphImage: logoUrl,
      openGraphType: parts[0] === 'blog' && parts.length === 2 ? 'article' : 'website',
    }
    seo = {
      ...(seo ?? fallback),
      title: exactLiveSeo.title,
      metaDescription: resolvedDescription,
      canonical: exactLiveSeo.canonical,
      openGraphTitle: exactLiveSeo.title,
      openGraphDescription: resolvedDescription,
    }
  }

  if (!seo) return notFoundSeo(originalPath)
  if (parts[0] === 'blog' && parts.length === 2) extraStructuredData = articleSchema(parts[1])
  if (pathname === '/faqs') {
    const exactFaq = faqSchema('/faqs')
    if (exactFaq) extraStructuredData.push(exactFaq)
  }

  const isAlias = pathname !== originalPath || isProductAlias || originalPath.startsWith('/category/')
  const robots = isAlias ? 'noindex,follow' : seo.robots
  return {
    ...seo,
    pathname,
    robots,
    structuredData: [
      organizationSchema(),
      ...(pathname === '/' ? [webSiteSchema()] : []),
      breadcrumbSchema(pathname),
      pageSchema(pathname, seo, Boolean(candidateProductSlug)),
      ...extraStructuredData,
    ],
  }
}

export const canonicalRouteCount = 51
export const catalogRouteCount = catalogProducts.length + Object.keys(categorySeo).length
