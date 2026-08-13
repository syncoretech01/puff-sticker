export type Product = {
  name: string
  type: string
  description: string
  image: string
  href: string
  accent: string
  foreground: string
}

export const products: Product[] = [
  {
    name: 'Puffy Stickers',
    type: 'Signature soft feel',
    description:
      'Soft foam-core stickers with vivid print and tactile raised depth for packaging, gifts and promotions.',
    image: '/assets/puffy-monster.webp',
    href: '/puffy-labels-stickers/puffy-stickers',
    accent: '#ffcf3f',
    foreground: '#071f49',
  },
  {
    name: '3D Labels',
    type: 'Built in layers',
    description:
      'Layered adhesive, printed vinyl and a protected top surface create durable, lightweight depth.',
    image: '/assets/rainbow-label.webp',
    href: '/puffy-labels-stickers/3d-labels',
    accent: '#8de5da',
    foreground: '#071f49',
  },
  {
    name: 'Epoxy Stickers',
    type: 'Glass-like depth',
    description:
      'Printed vinyl with a clear raised resin surface for polished, dimensional brand detail.',
    image: '/assets/epoxy-bunny.webp',
    href: '/puffy-labels-stickers/epoxy-stickers',
    accent: '#4ec8e8',
    foreground: '#071f49',
  },
  {
    name: 'Holographic',
    type: 'Light in motion',
    description:
      'Color-shifting reflective stock made for packaging, gadgets, launches and limited editions.',
    image: '/assets/holographic-skeleton.webp',
    href: '/flat-labels-stickers/holographic-stickers',
    accent: '#8b83ff',
    foreground: '#ffffff',
  },
  {
    name: 'Dome Decals',
    type: 'Gloss, raised',
    description:
      'A clear rounded resin surface gives printed vinyl professional shine and water resistance.',
    image: '/assets/dome-donut.webp',
    href: '/puffy-labels-stickers/dome-decals',
    accent: '#ff8fa7',
    foreground: '#071f49',
  },
  {
    name: 'Foam Stickers',
    type: 'Soft, flexible, fun',
    description:
      'Custom EVA foam labels with strong adhesive, flexible depth and a soft-touch finish.',
    image: '/assets/foam-sheep.webp',
    href: '/puffy-labels-stickers/foam-stickers',
    accent: '#ffd8cd',
    foreground: '#071f49',
  },
  {
    name: 'Metallic Foil',
    type: 'A luxury signal',
    description:
      'Gold, silver or rose-gold metallic detail for premium packaging, labels and event pieces.',
    image: '/assets/foil-unicorn.webp',
    href: '/flat-labels-stickers/metallic-foil-stickers',
    accent: '#c7864c',
    foreground: '#fff8e9',
  },
]

export const faqs = [
  {
    question: 'What makes puffy stickers different?',
    answer:
      'They use a durable vinyl or high-quality adhesive film with a soft foam layer, creating the raised, textured 3D feel that separates them from standard flat stickers.',
  },
  {
    question: 'Can I use my own design?',
    answer:
      'Yes. Upload your artwork or logo during the ordering process. PuffSticker reviews the design for print compatibility before production.',
  },
  {
    question: 'Which artwork files work best?',
    answer:
      'High-resolution artwork at a minimum of 300 dpi is recommended, ideally supplied as an AI or PDF file. The team can help with cleanup or small adjustments.',
  },
  {
    question: 'What is the minimum custom order?',
    answer:
      'Minimum quantities vary by product and specification. Share the product and quantities you are considering so the team can confirm the available price breaks.',
  },
  {
    question: 'Are the puffy stickers waterproof?',
    answer:
      'They are water-resistant and handle splashes or light moisture well. For longer outdoor exposure, ask about laminated or UV-resistant options.',
  },
]

export const finishOptions = [
  {
    id: 'matte',
    label: 'Matte',
    detail: 'Quiet, smooth, low-glare',
    headline: 'Controlled reflection keeps the artwork easy to read.',
    description: 'A matte surface softens highlights and lets typography, fine lines and material texture stay visually calm. It is a useful direction when the brief calls for restraint rather than shine.',
    bestFor: ['Premium packaging', 'Small type', 'Soft-touch direction'],
    note: 'Available on selected puffy, foam, vinyl and label configurations.',
    href: '/puffy-labels-stickers/puffy-stickers',
    product: 'Explore puffy stickers',
  },
  {
    id: 'gloss',
    label: 'Gloss',
    detail: 'Bright, reflective, color-rich',
    headline: 'More reflected light gives color extra lift.',
    description: 'Gloss creates sharper highlights and stronger apparent contrast. It suits bold artwork, colorful merchandise and packaging that needs to register quickly at a glance.',
    bestFor: ['Bold brand color', 'Merchandise', 'High-impact labels'],
    note: 'A common finish across puffy stickers, foam stickers and printed vinyl formats.',
    href: '/puffy-labels-stickers/puffy-stickers',
    product: 'Explore puffy stickers',
  },
  {
    id: 'holo',
    label: 'Holographic',
    detail: 'Iridescent, movement-led color',
    headline: 'The surface changes as the viewer and light move.',
    description: 'Holographic stock is a distinct reflective material—not simply a gloss coating. It produces shifting rainbow color that works especially well for launches, collectibles and limited-edition packaging.',
    bestFor: ['Limited editions', 'Collectibles', 'Launch packaging'],
    note: 'Specify this as a holographic sticker material and confirm the printed coverage during proofing.',
    href: '/flat-labels-stickers/holographic-stickers',
    product: 'Explore holographic stickers',
  },
]

export const sourceLinks = {
  shop: 'https://puffsticker.com/shop/',
  quote: 'https://puffsticker.com/request-a-quote',
  sample: 'https://puffsticker.com/',
  about: 'https://puffsticker.com/about-us/',
  faq: 'https://puffsticker.com/faqs/',
  contact: 'https://puffsticker.com/contact-us/',
  blog: 'https://puffsticker.com/blog/',
}
