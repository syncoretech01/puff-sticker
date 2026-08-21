import { type FormEvent, type PointerEvent, useEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Clock3,
  FileCheck2,
  Globe2,
  Layers3,
  Mail,
  MapPin,
  Minus,
  PackageCheck,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
} from 'lucide-react'
import {
  catalogProducts,
  categories,
  formatProductCount,
  getProduct,
  getProductsByCategory,
  type CatalogProduct,
  type CategorySlug,
} from '../content/catalog'
import { getProductDetails } from '../content/productDetails'
import { liveProductContent } from '../content/liveProductContent'
import { liveBlogContent } from '../content/liveBlogContent'
import { livePageContent } from '../content/livePageContent'
import { exactFaqByPath } from '../content/liveFaqSchema'
import { getArchiveContent } from '../content/archiveContent'
import { productionDeltaBlogContent, productionDeltaFeaturedImage } from '../content/productionDeltaContent'
import { extractPublishedFaqs, splitPublishedProductFaqs as splitProductFaqsWithoutDom, stripPricomDemoImages } from '../content/publishedHtml'
import { faqs as homeFaqs } from '../data'
import { SiteLink, useRouter } from '../router'
import { NotFoundPage } from './NotFoundPage'
import { SiteFooter } from './SiteFooter'

export { NotFoundPage, SiteFooter }

const categoryOrder: CategorySlug[] = ['puffy-labels-stickers', 'flat-labels-stickers', 'promotional-items']
const categoryProductOrder: Record<CategorySlug, string[]> = {
  'puffy-labels-stickers': ['puffy-stickers', 'dome-decals', 'epoxy-stickers', 'pu-embossed-stickers', 'puffy-sticker-sheets', '3d-labels', 'foam-stickers'],
  'flat-labels-stickers': ['holographic-stickers', 'bottle-labels', 'bumper-stickers', 'cheap-stickers', 'clear-vinyl-labels', 'custom-stickers', 'metallic-foil-stickers'],
  'promotional-items': ['nylon-bag', 'washable-paper-bags', 'woven-bags', 'paper-bag', 'non-woven-bag', 'jute-bag', 'eco-friendly-kraft-mylar-bags'],
}

const categoryGuides: Record<CategorySlug, { title: string; body: string[]; points: string[] }> = {
  'puffy-labels-stickers': {
    title: 'Custom Puffy Stickers & 3D Foam Labels – Stand Out with Style',
    body: ['Design vibrant, customizable puffy stickers and 3D foam labels for personal or business use—unique, durable, and always eye-catching.'],
    points: ['Puffy sticker sheets', '3D foam and resin formats', 'Custom artwork and shape', 'Business or personal use'],
  },
  'flat-labels-stickers': {
    title: 'Custom Flat Stickers & Labels – Lightweight, Versatile & Impactful',
    body: [
      'Flat stickers and labels are decals printed on sheets or individually cut—often die-cut for easy peeling. Lightweight and compact, they’re ideal for global shipping, easy storage, and bulk orders.',
      'At PuffSticker.com, we offer extensive customization options for flat sticker labels tailored to your business. Choose from a wide range of sizes, shapes, materials, and finishes to match your branding or personal style. Whether it’s a logo, slogan, image, or custom message, we print it with precision and vibrant color.',
    ],
    points: ['Individual or sheet formats', 'Die-cut peeling', 'Lightweight storage and shipping', 'Bulk customization'],
  },
  'promotional-items': {
    title: 'Custom Promotional Bags – Unique, Eco-Friendly & Brand-Forward',
    body: ['Custom promotional bags printed on eco-friendly materials like kraft paper, jute, and nylon. Fully customizable, durable, and ideal for giveaways, events, and marketing. Boost your brand visibility with high-quality prints from PuffSticker.com.'],
    points: ['Paper, jute and nylon options', 'Event and giveaway programs', 'Retail and gifting', 'Custom print and construction'],
  },
}

function getLiveProductEntry(slug: string) {
  return liveProductContent[slug as keyof typeof liveProductContent] ?? null
}

function getLiveBlogEntry(slug: string) {
  return liveBlogContent[slug as keyof typeof liveBlogContent]
    ?? productionDeltaBlogContent[slug as keyof typeof productionDeltaBlogContent]
    ?? null
}

function getLivePageEntry(slug: string) {
  return livePageContent[slug as keyof typeof livePageContent] ?? null
}

function OfficialPageSection({ slug, label }: { slug: string; label: string }) {
  const { nextMode } = useRouter()
  const page = getLivePageEntry(slug)
  const publishedHtml = page && nextMode && slug === 'about-us' ? stripPricomDemoImages(page.html) : page?.html
  return (
    <section className="official-page-source">
      <div className="page-shell official-page-source__grid">
        <aside className="reveal-block">
          <span className="eyebrow">Complete guide</span>
          <h2>{label}</h2>
          <p>Explore the full story, practical details and ordering information in one place.</p>
        </aside>
        {page
          ? <details className="official-page-source__disclosure reveal-block" data-live-loaded={`page-${slug}`}>
            <summary><span><small>More information</small><strong>Open the complete guide</strong></span><i><ChevronDown /></i></summary>
            <div className="official-page-source__content" dangerouslySetInnerHTML={{ __html: publishedHtml ?? '' }} />
          </details>
          : <div className="official-page-source__pending" data-live-pending={`page-${slug}`} aria-label={`Loading ${label} copy`}><span /></div>}
      </div>
    </section>
  )
}

const blogPosts = [
  { slug: 'custom-puffy-stickers-guide', title: 'The Complete Guide to Custom Puffy Stickers', date: 'August 20, 2026', category: 'Custom Puffy Stickers', categories: ['Custom Puffy Stickers', 'Sticker Psychology'], excerpt: 'A complete guide to custom puffy stickers, covering material choice, ideal dome thickness, waterproof versus water resistant, die cut versus kiss cut, and printing methods.', image: productionDeltaFeaturedImage, imageAlt: 'Flat sticker proof beside a raised puffy sticker proof on a light table, showing the difference in profile' },
  { slug: 'when-3d-stickers-become-collectibles', title: 'When 3D Stickers Become Collectibles', date: 'July 29, 2026', category: 'Custom Puffy Stickers', categories: ['Custom Puffy Stickers', 'Sticker Psychology'], excerpt: 'How texture, context and the feeling of an object can move a sticker from decoration into something people keep.', image: '/assets/blog-collectibles.webp' },
  { slug: 'why-sticker-books-never-really-disappeared', title: 'Why Sticker Books Never Really Disappeared', date: 'July 3, 2026', category: 'Custom Puffy Stickers', categories: ['Custom Puffy Stickers', 'Sticker Psychology'], excerpt: 'Why collecting, arranging and saving stickers continues to feel personal across generations.', image: '/assets/blog-sticker-books.webp' },
  { slug: 'why-we-save-stickers-we-never-use', title: 'Why We Save Stickers We Never Use: The Psychology Behind Unused Stickers', date: 'June 23, 2026', category: 'Custom Puffy Stickers', categories: ['Custom Puffy Stickers', 'Sticker Psychology'], excerpt: 'The psychology behind keeping the perfect sticker untouched—and what that says about attachment, identity and value.', image: '/assets/blog-unused-stickers.png' },
  { slug: 'matte-vs-gloss-psychology', title: 'The Psychology of Quiet Surfaces', date: 'June 16, 2026', category: 'Custom Puffy Stickers', categories: ['Custom Puffy Stickers'], excerpt: 'How restrained reflection can make an object feel more composed, material and trustworthy.', image: '/assets/blog-quiet-surfaces.png' },
  { slug: 'soft-depth-vs-smooth-depth', title: 'Soft Depth vs Smooth Depth: Puffy and Epoxy Stickers Compared', date: 'May 7, 2026', category: 'Custom Epoxy Stickers', categories: ['Custom Epoxy Stickers'], excerpt: 'A material comparison of compressible foam depth and the fixed polish of a clear resin surface.', image: '/assets/blog-depth.webp' },
  { slug: 'why-foil-stickers-feel-valuable', title: 'Why Shine Feels Valuable: The Psychology Behind Foil Stickers', date: 'April 30, 2026', category: 'Custom Foil Stickers', categories: ['Custom Foil Stickers'], excerpt: 'Why selective reflection has long been associated with intention, ceremony and perceived value.', image: '/assets/blog-foil.webp' },
  { slug: 'holographic-stickers-color-perception', title: 'Color That Doesn’t Exist Until You Move: Understanding Holographic Stickers', date: 'April 3, 2026', category: 'Custom Holographic Stickers', categories: ['Custom Holographic Stickers'], excerpt: 'Why a field of color completed by movement commands attention differently from a fixed printed surface.', image: '/assets/blog-holographic.webp' },
  { slug: 'sound-of-packaging-mylar-bags', title: 'The Sound of Packaging: Why a Mylar Bag Is Recognizable With Eyes Closed', date: 'March 25, 2026', category: 'Custom Mylar Bags', categories: ['Custom Mylar Bags'], excerpt: 'The overlooked role of material sound in product anticipation, protection and brand memory.', image: '/assets/blog-mylar.webp' },
  { slug: 'custom-puffy-stickers-became-the-new-therapy', title: 'Small Joys, Big Impact: How Custom Puffy Stickers Became the New Therapy for Gen Z and Millennials in 2026', date: 'March 4, 2026', category: 'Custom Puffy Stickers', categories: ['Custom Puffy Stickers'], excerpt: 'How small tactile objects can create moments of play, grounding and low-pressure creative expression.', image: '/assets/blog-small-joys.webp' },
  { slug: 'custom-jute-tote-bags-the-perfect-blend-of-sustainability', title: 'Custom Jute Tote Bags – The Perfect Blend of Sustainability and Style', date: 'August 26, 2025', category: 'Custom Jute Tote Bags', categories: ['Custom Jute Tote Bags'], excerpt: 'A practical material guide to natural woven carry, repeated use and visible everyday branding.', image: '/assets/blog-jute.webp' },
  { slug: 'puffy-stickers-are-trending-2025', title: 'Why Puffy Stickers Are Trending in 2025 (And Why You Shouldn’t Settle for Flat)', date: 'August 22, 2025', category: 'Custom Puffy Stickers', categories: ['Custom Puffy Stickers'], excerpt: 'Why dimensional print re-emerged across packaging, personal expression, merchandise and brand campaigns.', image: '/assets/blog-trending.webp' },
]

// The new production-delta article has its own canonical route and captured
// archive relationships. The protected framework-migration baseline keeps the
// existing blog index composition until content-source reconciliation.
const baselineBlogPosts = blogPosts.filter((post) => post.slug !== 'custom-puffy-stickers-guide')

const articleSections: Record<string, Array<{ title: string; body: string }>> = {
  'when-3d-stickers-become-collectibles': [
    { title: 'Placement turns a sticker into a decision.', body: 'An unused sticker still contains every possible future surface. That possibility can make placement feel unusually consequential: once it is used, all of the other imagined placements disappear.' },
    { title: 'Context creates value.', body: 'A manufactured object does not need a high price to become important. A particular trip, person, era or place can give an ordinary sticker a private history that no replacement can reproduce.' },
    { title: 'Depth makes the object feel more present.', body: 'Raised surfaces catch light, invite touch and occupy physical space. That makes a 3D sticker feel closer to a small object than a printed mark, strengthening the urge to hold onto it.' },
    { title: 'A collection records earlier choices.', body: 'Missing spaces, worn sheets and carefully saved pieces become evidence of past decisions. Adult sticker-covered luggage, bottles and laptops often continue the same collecting instinct in a more public form.' },
  ],
  'why-sticker-books-never-really-disappeared': [
    { title: 'A small archive with no fixed rules.', body: 'Sticker books belong to a wider habit of preserving small personal objects. Blank pages invite authorship: every collector invents an order, a hierarchy and a private way of making the collection legible.' },
    { title: 'Meaning changes through arrangement.', body: 'The same sticker can tell a different story beside a different neighbor. Repositioning, grouping and spacing become acts of composition, turning a product into a record of individual taste.' },
    { title: 'Physical cues help memory return.', body: 'Paper texture, page weight and dimensional surfaces give memories something concrete to attach to. Handling the collection can bring back a time or place more readily than viewing a flat digital archive.' },
    { title: 'The book simply changed surfaces.', body: 'For adults, laptops, journals, cases and travel bottles can operate as portable sticker books. The collection stays editable and continues to change alongside identity.' },
  ],
  'why-we-save-stickers-we-never-use': [
    { title: 'The perfect spot creates paralysis.', body: 'Emotional meaning raises the stakes of a simple placement. Waiting for the ideal surface protects the sticker from regret, but it also keeps the decision permanently open.' },
    { title: 'Ownership can be satisfying on its own.', body: 'Scarcity, nostalgia and personal identity can make preservation feel more rewarding than use. The object becomes proof of a taste, memory or version of the person who chose it.' },
    { title: 'Tactility strengthens attachment.', body: 'A puffy sticker has weight, reflected depth and an anticipated feel. Those object-like qualities encourage handling and safekeeping in a way that a purely flat image may not.' },
    { title: 'A kept sticker can keep a brand present.', body: 'For a business, the useful insight is not that every sticker must be applied. A piece worth saving can remain a durable brand touchpoint precisely because the customer does not want to discard it.' },
  ],
  'matte-vs-gloss-psychology': [
    { title: 'Gloss creates energy.', body: 'A reflective surface changes as the viewer moves. That movement increases contrast and can make color feel more immediate, bright and attention-seeking.' },
    { title: 'Matte slows the interaction down.', body: 'Reduced reflection lowers visual noise and allows form, typography and texture to read with more composure. Soft-touch surfaces can communicate material care and calm confidence.' },
    { title: 'Quiet and shine work better together.', body: 'Matte does not have to exclude gloss. A restrained surface can make selective foil, spot shine or a polished detail feel more intentional because contrast gives the highlight a clear role.' },
    { title: 'Physical texture answers digital fatigue.', body: 'After long stretches of frictionless screens, grounded physical experiences feel distinct. Soft packaging and tactile stickers provide the small sensory cues that a flat display cannot reproduce.' },
  ],
  'soft-depth-vs-smooth-depth': [
    { title: 'Two materials, two kinds of depth.', body: 'Puffy construction creates compressible depth with a foam center. A clear resin surface produces fixed, smooth depth that holds its shape and concentrates reflected light.' },
    { title: 'Light reveals the difference.', body: 'Soft surfaces tend to diffuse highlights across the form, while resin gathers them into glass-like reflections. The result changes how polished, playful or controlled the same artwork appears.' },
    { title: 'Each finish suggests a different behavior.', body: 'Puffy softness invites interaction and can feel expressive or approachable. The sealed look of resin suggests preservation, precision and permanence, encouraging observation before touch.' },
    { title: 'Choose the response, not only the appearance.', body: 'The useful question is what the label should ask a person to do. Choose soft depth for tactile participation and smooth depth when the job calls for formal polish and a protected visual surface.' },
  ],
  'why-foil-stickers-feel-valuable': [
    { title: 'Shine is noticed before it is read.', body: 'Metallic reflection creates contrast that changes with light and position. The eye registers that movement quickly, often before it has processed the printed message.' },
    { title: 'Restraint signals intention.', body: 'Selective foil can feel more considered than an entirely reflective surface. A small controlled highlight suggests that someone decided exactly where attention should land.' },
    { title: 'History gives metallic surfaces meaning.', body: 'Jewelry, currency, gifts and ceremonial objects have long connected shine with rarity and significance. Foil borrows those associations even when the material addition is physically thin.' },
    { title: 'Perceived value can shift through one detail.', body: 'Because reflection creates movement and apparent depth, a small foil area can make a printed object feel more responsive, more finished and more likely to be kept.' },
  ],
  'holographic-stickers-color-perception': [
    { title: 'The color is produced by an encounter.', body: 'Holographic color is not fixed like ordinary ink. Microscopic surface behavior separates and redirects light, so the visible palette depends on illumination and viewing angle.' },
    { title: 'A flat surface can appear layered.', body: 'Changing reflections create the impression that color occupies several depths at once. The effect gives a thin material a sense of volume and visual instability.' },
    { title: 'Movement completes the artwork.', body: 'The designer controls the printed image and the holographic field, but the viewer and environment determine the final state. Tilting the piece becomes part of reading it.' },
    { title: 'One photograph cannot contain the material.', body: 'A still image records only one moment in a continuous transformation. The identity of a holographic sticker comes from change itself, which is why the real object feels more surprising than its preview.' },
  ],
  'sound-of-packaging-mylar-bags': [
    { title: 'A package can identify itself with sound.', body: 'The crisp crinkle of a Mylar bag can be recognizable before its artwork is visible. That acoustic cue becomes part of the product experience, not merely a side effect of handling.' },
    { title: 'Tension becomes audible feedback.', body: 'Thin barrier layers flex under the hand and convert movement into sound. The response can make the material feel protective and stronger than its light weight suggests.' },
    { title: 'Opening sounds reinforce preservation.', body: 'Seal resistance and a crisp first opening can support expectations of freshness and protection. Those cues give the act of opening a clear beginning and make it more memorable.' },
    { title: 'Material behavior can carry brand meaning.', body: 'The sound is largely a result of barrier construction, yet customers can come to associate it with a product category or quality level. Packaging communicates through the ear and hand as well as the eye.' },
  ],
  'custom-puffy-stickers-became-the-new-therapy': [
    { title: 'Small objects allow private expression.', body: 'Personalized stickers offer a way to shape a desk, planner or device without algorithms, public metrics or outside approval. The choice can remain personal and low stakes.' },
    { title: 'Texture creates a small sensory reward.', body: 'Raised foam and changing reflections interrupt a screen-heavy routine with a physical cue. Touch, peeling and placement turn attention toward a simple object in the present moment.' },
    { title: 'Creativity without a blank-page demand.', body: 'Arranging stickers in a journal or scrapbook offers structure without requiring a perfect drawing or a finished composition. It supports experimentation through small reversible choices.' },
    { title: 'The ritual matters more than the label.', body: 'Stickers are not clinical treatment. The meaningful part is the creative pause: a repeatable moment of play, personalization and grounding that can make an ordinary routine feel more human.' },
  ],
  'custom-jute-tote-bags-the-perfect-blend-of-sustainability': [
    { title: 'Repeated use extends the message.', body: 'A jute bag can replace some disposable carry while keeping branding visible across many trips. Its value comes from durability and repeat exposure rather than a single handoff.' },
    { title: 'The material communicates before the print.', body: 'Natural woven texture gives the surface an immediately recognizable character. Custom artwork, color and handle choices can add brand specificity without removing that material identity.' },
    { title: 'A flexible format for many programs.', body: 'Retail, corporate gifting, events, food hampers and household reuse all ask different things of the same basic bag. Size, lining, compartments and print method should follow the intended job.' },
    { title: 'Evaluate impact across the useful life.', body: 'A reusable item may cost more at the beginning, but longevity can increase both utility and brand impressions. Sustainability claims should still account for the exact construction, reinforcements and local end-of-life options.' },
  ],
  'puffy-stickers-are-trending-2025': [
    { title: 'Dimension stands apart from a flat environment.', body: 'Foam-backed, die-cut stickers change under light and reward touch. In a screen-heavy visual culture, that physical response creates a simple but noticeable difference.' },
    { title: 'A sheet can become a small collection.', body: 'Multiple raised designs on one sheet support classroom rewards, crafts, journals, merchandise and branded inserts. The format encourages choosing, arranging and sharing rather than treating every piece as identical.' },
    { title: 'Raised logos add physical weight.', body: 'On packaging or merchandise, a dimensional mark can make a logo feel more substantial. The tactile cue adds emphasis without requiring a larger printed footprint.' },
    { title: 'The result starts with a clear specification.', body: 'Artwork, sheet composition, finish and run size shape the final object. Puffy stickers, dome decals and resin-coated labels should be selected as distinct constructions rather than treated as interchangeable names.' },
  ],
}

function PageHero({
  eyebrow,
  title,
  text,
  meta,
  dark = false,
}: {
  eyebrow: string
  title: React.ReactNode
  text: string
  meta?: string
  dark?: boolean
}) {
  return (
    <section className={`page-hero ${dark ? 'page-hero--dark' : ''}`}>
      <div className="page-hero__grid" />
      <div className="page-shell page-hero__content">
        <div className="eyebrow reveal-block">{eyebrow}</div>
        <h1 className="reveal-block">{title}</h1>
        <div className="page-hero__bottom reveal-block">
          <p>{text}</p>
          {meta && <span>{meta}</span>}
        </div>
      </div>
    </section>
  )
}

function ProductGridCard({ product, index }: { product: CatalogProduct; index: number }) {
  const card = useRef<HTMLElement>(null)
  const media = useRef<HTMLAnchorElement>(null)
  const bounds = useRef<DOMRect | null>(null)
  const motion = useRef<Array<ReturnType<typeof gsap.quickTo>>>([])
  const enter = () => {
    if (!card.current || !media.current || !window.matchMedia('(pointer: fine)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    bounds.current = card.current.getBoundingClientRect()
    if (!motion.current.length) motion.current = [
      gsap.quickTo(media.current, 'rotationY', { duration: .34, ease: 'power2.out' }),
      gsap.quickTo(media.current, 'rotationX', { duration: .34, ease: 'power2.out' }),
      gsap.quickTo(media.current, 'x', { duration: .34, ease: 'power2.out' }),
      gsap.quickTo(media.current, 'y', { duration: .34, ease: 'power2.out' }),
    ]
  }
  const onMove = (event: PointerEvent<HTMLElement>) => {
    if (!card.current || !window.matchMedia('(pointer: fine)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (!bounds.current) enter()
    const rect = bounds.current ?? card.current.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width - 0.5
    const y = (event.clientY - rect.top) / rect.height - 0.5
    motion.current[0]?.(x * 7)
    motion.current[1]?.(y * -6)
    motion.current[2]?.(x * 8)
    motion.current[3]?.(y * 8)
  }
  const leave = () => {
    motion.current.forEach((setter) => setter(0))
    bounds.current = null
  }
  return (
    <article className="catalog-card reveal-block" ref={card} onPointerEnter={enter} onPointerMove={onMove} onPointerLeave={leave} style={{ '--product-accent': product.accent, '--product-soft': product.accentSoft } as React.CSSProperties}>
      <SiteLink ref={media} to={`/${product.category}/${product.slug}`} className="catalog-card__media" data-cursor="VIEW">
        <span className="catalog-card__index">{String(index + 1).padStart(2, '0')}</span>
        <img src={product.image} alt={product.name} loading="lazy" decoding="async" />
        <span className="catalog-card__view"><ArrowUpRight /></span>
      </SiteLink>
      <div className="catalog-card__copy">
        <div><span>{categories[product.category].shortName}</span><span>{product.price}</span></div>
        <SiteLink to={`/${product.category}/${product.slug}`}><h3>{product.name}</h3></SiteLink>
        <p>{product.summary}</p>
      </div>
    </article>
  )
}

function CategoryNav({ active }: { active?: CategorySlug | 'all' }) {
  return (
    <nav className="category-nav" aria-label="Product categories">
      <SiteLink to="/shop" className={!active || active === 'all' ? 'is-active' : ''}>All <span>{catalogProducts.length}</span></SiteLink>
      {categoryOrder.map((slug) => (
        <SiteLink to={categories[slug].href} className={active === slug ? 'is-active' : ''} key={slug}>
          {categories[slug].shortName}<span>{getProductsByCategory(slug).length}</span>
        </SiteLink>
      ))}
    </nav>
  )
}

function ProcurementBand() {
  return (
    <section className="procurement-band">
      <div className="page-shell procurement-band__grid">
        <div className="reveal-block"><span className="eyebrow eyebrow--light">Built for custom orders</span><h2>From one artwork file to a production-ready run.</h2></div>
        <div className="procurement-band__steps">
          {[
            ['01', 'Share the brief', 'Product, size, quantity, colors and artwork.'],
            ['02', 'Review the proof', 'The team checks print compatibility before production.'],
            ['03', 'Produce & deliver', 'Orders are packed with care and shipped worldwide.'],
          ].map(([number, title, text]) => <div key={number} className="reveal-block"><span>{number}</span><h3>{title}</h3><p>{text}</p></div>)}
        </div>
      </div>
    </section>
  )
}

export function ShopPage() {
  const [query, setQuery] = useState('')
  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return catalogProducts
    return catalogProducts.filter((product) => `${product.name} ${product.summary} ${categories[product.category].name}`.toLowerCase().includes(normalized))
  }, [query])

  return (
    <>
      <PageHero
        eyebrow="Manufacturer-direct catalog"
        title={<>Custom products,<br /><em>clearly organized.</em></>}
        text="Explore the complete PuffSticker range across tactile labels, flat formats and custom promotional packaging. Base prices are shown; final B2B pricing depends on quantity and specification."
        meta={formatProductCount()}
      />
      <section className="catalog-section">
        <div className="page-shell catalog-tools">
          <CategoryNav active="all" />
          <label className="catalog-search"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products" aria-label="Search products" /><span>{String(results.length).padStart(2, '0')}</span></label>
        </div>
        <div className="page-shell catalog-grid">
          {results.map((product, index) => <ProductGridCard product={product} index={index} key={product.slug} />)}
        </div>
        {!results.length && <div className="page-shell catalog-empty"><CircleHelp /><h2>No products match “{query}”.</h2><button type="button" onClick={() => setQuery('')}>Clear search</button></div>}
      </section>
      <ProcurementBand />
      <SiteFooter />
    </>
  )
}

export function CategoryPage({ slug }: { slug: string }) {
  const category = categories[slug as CategorySlug]
  if (!category) return <NotFoundPage />
  const productOrder = categoryProductOrder[slug as CategorySlug]
  const products = [...getProductsByCategory(slug as CategorySlug)].sort((left, right) => productOrder.indexOf(left.slug) - productOrder.indexOf(right.slug))
  const guide = categoryGuides[slug as CategorySlug]
  return (
    <>
      <section className="category-hero" style={{ '--category-accent': category.accent } as React.CSSProperties}>
        <div className="page-shell category-hero__grid">
          <div className="category-hero__copy reveal-block">
            <span className="eyebrow">{category.kicker}</span>
            <h1>{category.name}</h1>
            <p>{category.description}</p>
            <span className="category-hero__count">{formatProductCount(slug as CategorySlug)}</span>
          </div>
          <div className="category-hero__media reveal-block"><img src={category.image} alt={category.name} /><i /><i /></div>
        </div>
      </section>
      <section className="category-guide">
        <div className="page-shell category-guide__grid">
          <div className="reveal-block"><span className="eyebrow">Category guide</span><h2>{guide.title}</h2></div>
          <div className="reveal-block">{guide.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}<ul>{guide.points.map((point) => <li key={point}><Check size={14} />{point}</li>)}</ul></div>
        </div>
      </section>
      <section className="catalog-section catalog-section--category">
        <div className="page-shell catalog-tools"><CategoryNav active={slug as CategorySlug} /></div>
        <div className="page-shell catalog-grid">{products.map((product, index) => <ProductGridCard product={product} index={index} key={product.slug} />)}</div>
      </section>
      <ProcurementBand />
      <SiteFooter />
    </>
  )
}

export function ProductPage({ slug, category }: { slug: string; category?: string }) {
  const product = getProduct(slug)
  const details = getProductDetails(slug)
  const liveProduct = getLiveProductEntry(slug)
  const media = useRef<HTMLDivElement>(null)
  const mediaImage = useRef<HTMLImageElement>(null)
  const mediaBounds = useRef<DOMRect | null>(null)
  const mediaMotion = useRef<Array<ReturnType<typeof gsap.quickTo>>>([])
  const [openFaq, setOpenFaq] = useState(0)
  const publishedProductContent = useMemo(() => splitProductFaqsWithoutDom(liveProduct?.descriptionHtml), [liveProduct?.descriptionHtml])
  if (!product || !details || (category && product.category !== category)) return <NotFoundPage />
  const related = catalogProducts.filter((item) => item.category === product.category && item.slug !== product.slug).slice(0, 3)
  const heroImage = liveProduct?.gallery[0]?.src ?? product.image
  const productFaqs = publishedProductContent.faqs.length
    ? publishedProductContent.faqs
    : details.faq.map((item) => ({ question: item.question, answerHtml: `<p>${item.answer}</p>` }))

  const enterMedia = () => {
    if (!media.current || !mediaImage.current || !window.matchMedia('(pointer: fine)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    mediaBounds.current = media.current.getBoundingClientRect()
    if (!mediaMotion.current.length) mediaMotion.current = [
      gsap.quickTo(mediaImage.current, 'rotationY', { duration: .32, ease: 'power2.out' }),
      gsap.quickTo(mediaImage.current, 'rotationX', { duration: .32, ease: 'power2.out' }),
      gsap.quickTo(mediaImage.current, 'x', { duration: .32, ease: 'power2.out' }),
      gsap.quickTo(mediaImage.current, 'y', { duration: .32, ease: 'power2.out' }),
    ]
  }

  const moveMedia = (event: PointerEvent<HTMLDivElement>) => {
    if (!media.current || !window.matchMedia('(pointer: fine)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (!mediaBounds.current) enterMedia()
    const rect = mediaBounds.current ?? media.current.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width - 0.5
    const y = (event.clientY - rect.top) / rect.height - 0.5
    media.current.style.setProperty('--detail-x', `${(x + 0.5) * 100}%`)
    media.current.style.setProperty('--detail-y', `${(y + 0.5) * 100}%`)
    mediaMotion.current[0]?.(x * 10)
    mediaMotion.current[1]?.(y * -8)
    mediaMotion.current[2]?.(x * 16)
    mediaMotion.current[3]?.(y * 12)
  }
  const leaveMedia = () => {
    mediaMotion.current.forEach((setter) => setter(0))
    mediaBounds.current = null
  }

  return (
    <>
      <section className="product-detail" style={{ '--product-accent': product.accent, '--product-soft': product.accentSoft } as React.CSSProperties}>
        <div className="page-shell product-detail__crumbs reveal-block">
          <SiteLink to="/shop">Shop</SiteLink><span>/</span><SiteLink to={categories[product.category].href}>{categories[product.category].shortName}</SiteLink><span>/</span><strong>{product.name}</strong>
        </div>
        <div className="page-shell product-detail__grid">
          <div className="product-detail__media reveal-block" ref={media} onPointerEnter={enterMedia} onPointerMove={moveMedia} onPointerLeave={leaveMedia} data-cursor="TILT">
            <div className="product-detail__glow" />
            <img ref={mediaImage} src={heroImage} alt={liveProduct?.gallery[0]?.alt ?? product.name} decoding="async" fetchPriority="high" />
            <span className="product-detail__material">Custom made</span>
            <span className="product-detail__rotate">Move to inspect</span>
          </div>
          <div className="product-detail__copy reveal-block">
            <span className="eyebrow">{product.eyebrow}</span>
            <h1>{product.name}</h1>
            <p className="product-detail__tagline">{product.tagline}</p>
            <div className="product-detail__price"><strong>{product.price}</strong><span>Base price · final quote varies by quantity and specification</span></div>
            <p className="product-detail__summary">{product.overview}</p>
            <div className="product-detail__actions">
              <SiteLink to={`/request-a-quote?product=${product.slug}`} className="page-button page-button--dark" data-cursor="QUOTE">Configure a quote <ArrowRight /></SiteLink>
              <a href="#product-specifications" className="page-text-link">Review specifications <ArrowRight /></a>
            </div>
            <div className="product-detail__trust">
              <span><FileCheck2 />Artwork review</span><span><Globe2 />Worldwide delivery</span><span><PackageCheck />Custom production</span>
            </div>
          </div>
        </div>
        {liveProduct && <div className="page-shell product-gallery reveal-block" data-live-loaded="product-gallery">
          <div className="product-gallery__heading"><span>Product gallery</span><small>{String(liveProduct.gallery.length).padStart(2, '0')} images</small></div>
          <div>{liveProduct.gallery.map((image, index) => <figure key={image.src}><img src={image.src} alt={image.alt || `${product.name} gallery image ${index + 1}`} loading={index < 2 ? 'eager' : 'lazy'} decoding="async" fetchPriority={index === 0 ? 'high' : 'auto'} /><figcaption>{image.name || `${product.name} · ${String(index + 1).padStart(2, '0')}`}</figcaption></figure>)}</div>
        </div>}
      </section>

      <section className="product-proof">
        <div className="page-shell product-proof__heading reveal-block"><span className="eyebrow">Why this format</span><h2>Built around the job,<br />not off the shelf.</h2></div>
        <div className="page-shell product-feature-grid">
          {product.features.map((feature, index) => (
            <article className="product-feature reveal-block" key={feature.title}>
              <span>0{index + 1}</span><i><Sparkles /></i><h3>{feature.title}</h3><p>{feature.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="product-content">
        <div className="page-shell product-content__grid">
          <aside className="reveal-block">
            <span className="eyebrow">Product guide</span>
            <h2>Everything to know about {product.name.toLowerCase()}.</h2>
            <p>Materials, construction, applications, care and ordering details for planning the right custom run.</p>
          </aside>
          {liveProduct ? <div className="product-live-copy reveal-block" data-live-loaded="product-description">
            <div className="product-live-copy__short" dangerouslySetInnerHTML={{ __html: liveProduct.shortDescriptionHtml }} />
            <div className="product-live-copy__long" dangerouslySetInnerHTML={{ __html: publishedProductContent.guideHtml }} />
          </div> : <div className="product-content__sections" data-live-pending="product-description">
            {details.contentSections.map((section, index) => <article key={section.title}><span>{String(index + 1).padStart(2, '0')}</span><h3>{section.title}</h3><p>{section.body}</p>{section.bullets && <ul>{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>}</article>)}
          </div>}
        </div>
      </section>

      <section className="product-specs" id="product-specifications">
        <div className="page-shell product-specs__grid">
          <div className="product-specs__intro reveal-block">
            <span className="eyebrow eyebrow--light">Specification snapshot</span>
            <h2>The details that shape the result.</h2>
            <p>Final materials, dimensions, finishing and quantity are confirmed during quoting and proofing.</p>
          </div>
          <div className="product-specs__table reveal-block">
            {product.specifications.map((spec) => <div key={spec.label}><span>{spec.label}</span><strong>{spec.value}</strong></div>)}
            {details.commerce.attributes.map((attribute) => <div key={attribute.name}><span>{attribute.name}</span><strong>{attribute.values.join(' / ')}</strong></div>)}
            {details.commerce.variations?.map((variation) => <div key={variation.id} className="product-specs__variation"><span>{variation.label}</span><strong>{variation.price}</strong></div>)}
          </div>
          <div className="product-specs__options reveal-block">
            <span>Available directions</span>
            <div>{product.options.map((option) => <i key={option}><Check size={14} />{option}</i>)}</div>
            <div className="product-specs__notes">
              <span>Procurement notes</span>
              {details.commerce.notes.map((note) => <p key={note}>{note}</p>)}
            </div>
          </div>
        </div>
      </section>

      <section className="product-applications">
        <div className="page-shell product-applications__grid">
          <div className="product-applications__media reveal-block"><img src={product.image} alt="" loading="lazy" /><div /><div /></div>
          <div className="product-applications__copy reveal-block">
            <span className="eyebrow">Where it works</span>
            <h2>Made to live in the real world.</h2>
            <div>{product.applications.map((application, index) => <p key={application}><span>{String(index + 1).padStart(2, '0')}</span>{application}</p>)}</div>
          </div>
        </div>
      </section>

      <section className="faq product-page-faq">
        <div className="page-shell faq__grid">
          <div className="faq__heading reveal-block">
            <span className="eyebrow">Product questions</span>
            <h2>Useful answers,<br /><em>before you order.</em></h2>
            <p>Material, use, artwork and production guidance specific to {product.name.toLowerCase()}.</p>
            <SiteLink to="/faqs" className="text-link text-link--dark">Explore every FAQ <ArrowRight /></SiteLink>
          </div>
          <div className="faq-list">
            {productFaqs.map((item, index) => {
              const isOpen = openFaq === index
              return (
                <article className={`faq-item ${isOpen ? 'faq-item--open' : ''}`} key={item.question}>
                  <button type="button" onClick={() => setOpenFaq(isOpen ? -1 : index)} aria-expanded={isOpen} aria-controls={`product-faq-${product.slug}-${index}`}>
                    <span><small>{String(index + 1).padStart(2, '0')}</small>{item.question}</span>
                    <i>{isOpen ? <Minus /> : <Plus />}</i>
                  </button>
                  <div className="faq-item__answer" id={`product-faq-${product.slug}-${index}`} aria-hidden={!isOpen}><div><div className="faq-answer-rich" dangerouslySetInnerHTML={{ __html: item.answerHtml }} /></div></div>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <section className="related-products">
        <div className="page-shell related-products__heading"><div><span className="eyebrow">Keep comparing</span><h2>Related formats</h2></div><SiteLink to={categories[product.category].href}>View category <ArrowRight /></SiteLink></div>
        <div className="page-shell catalog-grid catalog-grid--related">{related.map((item, index) => <ProductGridCard key={item.slug} product={item} index={index} />)}</div>
      </section>

      <section className="inline-quote">
        <div className="page-shell inline-quote__content reveal-block">
          <span>{product.name}</span><h2>Ready to turn the artwork into an object?</h2><SiteLink to={`/request-a-quote?product=${product.slug}`} className="page-button page-button--yellow">Build your quote <ArrowUpRight /></SiteLink>
        </div>
      </section>
      <SiteFooter />
    </>
  )
}

export function AboutPage() {
  const milestones = [
    ['2007', 'The offline beginning', 'PuffSticker started as a small creative business, handcrafting raised stickers for local shops and custom clients.'],
    ['Then', 'A format before the trend', 'The team focused on tactile, dimensional stickers while most of the market remained flat.'],
    ['Now', 'A wider production catalog', 'The online range spans puffy and flat labels, Mylar packaging, jute bags and custom promotional carry.'],
  ]
  return (
    <>
      <PageHero
        dark
        eyebrow="About PuffSticker"
        title={<>We make a sticker something you can <em>feel.</em></>}
        text="PuffSticker began offline in 2007 with a simple belief: a label could carry physical character, not just printed color."
        meta="Orlando · Worldwide"
      />
      <section className="about-origin">
        <div className="page-shell about-origin__grid">
          <div className="about-origin__copy reveal-block"><span className="eyebrow">From 2007 to now</span><h2>Built by makers,<br />shaped by touch.</h2><p>From custom logos and original characters to full branding sets, PuffSticker helps businesses and individuals turn ideas into tactile, high-impact products.</p></div>
          <div className="about-origin__media reveal-block"><img src="/assets/catalog/puffy-sticker-sheets.webp" alt="Custom puffy sticker sheet" /><span>Raised / printed / precision cut</span></div>
        </div>
      </section>
      <section className="about-timeline">
        <div className="page-shell">
          {milestones.map(([year, title, text], index) => (
            <article className="about-milestone reveal-block" key={year}><span>{String(index + 1).padStart(2, '0')}</span><strong>{year}</strong><div><h3>{title}</h3><p>{text}</p></div></article>
          ))}
        </div>
      </section>
      <section className="about-principles">
        <div className="page-shell about-principles__heading reveal-block"><span className="eyebrow eyebrow--light">What stays constant</span><h2>Personal attention at production scale.</h2></div>
        <div className="page-shell about-principles__grid">
          {[
            ['Pioneering spirit', 'The brand was built around raised stickers before the format became widely familiar.', <Sparkles />],
            ['Material quality', 'Premium vinyl, protective finishes and strong adhesive are selected around the intended use.', <ShieldCheck />],
            ['Customization', 'Artwork, shape, size, color, finish and construction are configured around the brief.', <Layers3 />],
            ['Small-business care', 'Every custom order is handled with the attention and pride that shaped the original offline studio.', <CheckCircle2 />],
          ].map(([title, text, icon]) => <article className="reveal-block" key={String(title)}><i>{icon}</i><h3>{title}</h3><p>{text}</p></article>)}
        </div>
      </section>
      <section className="about-global">
        <div className="page-shell about-global__grid">
          <div className="about-global__orb reveal-block"><Globe2 /><span>30+</span><small>countries</small></div>
          <div className="about-global__copy reveal-block"><span className="eyebrow">Manufacturer direct</span><h2>Made in-house.<br />Sent worldwide.</h2><p>PuffSticker ships with tracked delivery to the USA, Canada, Australia and more than 30 countries.</p><SiteLink to="/shipping-delivery" className="page-text-link">Shipping details <ArrowRight /></SiteLink></div>
        </div>
      </section>
      <OfficialPageSection slug="about-us" label="Our complete story" />
      <ProcurementBand />
      <SiteFooter />
    </>
  )
}

const extendedFaqs = [
  { question: homeFaqs[0].question, answer: homeFaqs[0].answer, group: 'Product formats' },
  { question: 'What is the difference between flat and puffy stickers?', answer: 'Flat stickers use a slim paper or vinyl layer. Puffy stickers add a soft foam layer for raised texture and stronger tactile impact.', group: 'Product formats' },
  { question: 'Why choose puffy stickers?', answer: 'Their dimensional texture, vivid print and adhesive backing make them useful for packaging, merchandise, giveaways and collections.', group: 'Product formats' },
  { question: 'Which puffy formats are available?', answer: 'The live range includes individual custom stickers, sheets containing up to 40 designs, holographic directions and die-cut shapes that follow the artwork.', group: 'Product formats' },
  { question: 'What is a dome decal?', answer: 'A dome decal is a printed decal topped with clear polyurethane-style resin, creating a rigid, glossy raised surface with added scratch and UV resistance.', group: 'Product formats' },
  { question: 'What is an epoxy sticker?', answer: 'An epoxy sticker uses a clear, glass-like raised resin coating that adds shine and helps protect the print from scratches and moisture.', group: 'Product formats' },
  { question: 'How do puffy, dome and epoxy formats differ?', answer: 'Puffy construction uses a soft foam core. Dome decals use a rigid clear coating, while epoxy stickers use a glass-like raised resin surface. Ask the team to match the feel and finish to the intended use.', group: 'Product formats' },
  { question: homeFaqs[1].question, answer: homeFaqs[1].answer, group: 'Artwork & ordering' },
  { question: homeFaqs[2].question, answer: homeFaqs[2].answer, group: 'Artwork & ordering' },
  { question: 'How should artwork be prepared?', answer: 'Use artwork at 300 DPI or higher, choose bold colors and avoid extremely thin lines. AI or PDF files are preferred, and the team can review or optimize files before production.', group: 'Artwork & ordering' },
  { question: 'Do I receive a proof before production?', answer: 'Custom puffy sticker orders include a digital proof so shape, cut line and artwork can be reviewed before production starts.', group: 'Artwork & ordering' },
  { question: homeFaqs[3].question, answer: homeFaqs[3].answer, group: 'Artwork & ordering' },
  { question: 'Can puffy stickers be ordered in bulk?', answer: 'Yes. Larger runs are available for campaigns, events, retail and other volume programs. Quantity breaks depend on the selected product.', group: 'Artwork & ordering' },
  { question: 'Do you offer wholesale or reseller pricing?', answer: 'Yes. Bulk and wholesale discounts are available. Email sales@puffsticker.com with the product, quantities and project details.', group: 'Artwork & ordering' },
  { question: 'Are puffy stickers fully waterproof?', answer: 'Treat them as water-resistant. They can handle splashes and light moisture, while laminated or UV-resistant options are better for longer outdoor exposure.', group: 'Materials & use' },
  { question: 'Which surfaces work best?', answer: 'Smooth, clean, non-porous surfaces such as glass, plastic, metal and coated paper generally provide the most reliable adhesion.', group: 'Materials & use' },
  { question: 'How long do puffy stickers last?', answer: 'The live FAQ says premium materials and adhesive can keep stickers vibrant and secure for months under normal handling. Actual life depends on surface, moisture, abrasion and exposure.', group: 'Materials & use' },
  { question: 'Should I choose gloss or matte?', answer: 'Gloss creates stronger reflection and more intense-looking color. Matte gives a smoother, restrained and non-reflective presentation.', group: 'Materials & use' },
  { question: 'Can puffy stickers be used outdoors?', answer: 'They are suitable for short-term exposure. Ask about UV-resistant or laminated finishes when the job needs longer outdoor use.', group: 'Materials & use' },
  { question: 'How long will a custom order take?', answer: 'The general live FAQ estimates about 24–26 business days for production and delivery. Product, quantity, destination and shipping method can change the final schedule, so ask sales to confirm it.', group: 'Production & delivery' },
  { question: 'Do you ship internationally?', answer: 'Yes. PuffSticker ships internationally, with tracked delivery available across the USA, Canada, Australia and more than 30 countries. Timing and rates depend on destination.', group: 'Production & delivery' },
  { question: 'Can I change or cancel an order?', answer: 'Changes or cancellation may be possible before production starts. Contact the team as quickly as possible with the order details.', group: 'Orders & policies' },
  { question: 'What if the delivered product has a production issue?', answer: 'Eligible material, print, item, size, quantity or transit issues may qualify for a reprint. Send the order number, issue description and clear photos within seven days of delivery for review.', group: 'Orders & policies' },
]

export function FullFaqPage() {
  const [open, setOpen] = useState(0)
  const liveFaq = getLivePageEntry('faqs')
  const publishedFaqs = useMemo(() => extractPublishedFaqs(liveFaq?.html), [liveFaq?.html])
  const faqEntries = publishedFaqs.length
    ? publishedFaqs
    : (exactFaqByPath['/faqs'] ?? extendedFaqs).map(({ question, answer }) => ({ question, answerHtml: `<p>${answer}</p>` }))
  return (
    <>
      <PageHero eyebrow="Printing made easy" title={<>Frequently asked<br /><em>questions.</em></>} text="Artwork, materials, quantities, proofing, delivery and aftercare—organized for an easier B2B decision." meta={`${faqEntries.length} answers`} />

      <section className="faq-page-visuals" aria-label="PuffSticker FAQ gallery">
        <div className="page-shell faq-page-visuals__grid">
          <figure className="reveal-block"><img src="/assets/live/pages/faqs/01-video-bg-9-1.jpg" alt="PuffSticker production and materials" loading="lazy" /><figcaption>Printing made easy</figcaption></figure>
          <figure className="reveal-block"><img src="/assets/live/pages/faqs/02-banner-faqs-1.png" alt="Custom sticker questions and answers" loading="lazy" /><figcaption>Check out our frequently asked questions</figcaption></figure>
        </div>
      </section>

      <section className="faq faq-page">
        <div className="page-shell faq__grid">
          <div className="faq__heading reveal-block">
            <span className="eyebrow">Clear production guidance</span>
            <h2>Answers that make<br /><em>ordering easier.</em></h2>
            <p>From artwork files and order quantities to sticker construction, finishes, shipping and aftercare.</p>
            <SiteLink to="/contact-us" className="text-link text-link--dark">Ask the team <ArrowRight /></SiteLink>
          </div>
          <div className="faq-list" data-live-loaded={liveFaq ? 'page-faqs' : undefined} data-live-pending={liveFaq ? undefined : 'page-faqs'}>
            {faqEntries.map((item, index) => {
              const isOpen = open === index
              return (
                <article className={`faq-item ${isOpen ? 'faq-item--open' : ''}`} key={item.question}>
                  <button type="button" onClick={() => setOpen(isOpen ? -1 : index)} aria-expanded={isOpen} aria-controls={`faq-answer-${index}`}>
                    <span><small>{String(index + 1).padStart(2, '0')}</small>{item.question}</span>
                    <i>{isOpen ? <Minus /> : <Plus />}</i>
                  </button>
                  <div className="faq-item__answer" id={`faq-answer-${index}`} aria-hidden={!isOpen}>
                    <div><div className="faq-answer-rich" dangerouslySetInnerHTML={{ __html: item.answerHtml }} /></div>
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <section className="faq-page-contact">
        <div className="page-shell faq-page-contact__grid">
          <div className="faq-page-contact__media reveal-block"><img src="/assets/live/pages/faqs/03-custom-rainbow-clouds-stars-puffy-sticker-sheet-e1755904603752.webp" alt="Custom rainbow, cloud and star puffy sticker sheets" loading="lazy" /></div>
          <div className="faq-page-contact__copy reveal-block">
            <span className="eyebrow">Any questions</span>
            <h2>Ready to get started?</h2>
            <p>Printed and shipped on demand! Speak directly with the PuffSticker team about the product, artwork and quantity you need.</p>
            <div className="faq-page-contact__channels"><a href="tel:+14079234382"><small>Phone</small>(407) 923-4382</a><a href="mailto:sales@puffsticker.com"><small>Email</small>sales@puffsticker.com</a></div>
            <div className="faq-page-contact__actions"><SiteLink to="/puffy-labels-stickers" className="page-button page-button--dark">Shop now <ArrowUpRight /></SiteLink><SiteLink to="/contact-us" className="page-text-link">Contact us <ArrowRight /></SiteLink></div>
          </div>
        </div>
      </section>
      <SiteFooter />
    </>
  )
}

function buildMailto(subject: string, fields: Record<string, string>) {
  const body = Object.entries(fields).filter(([, value]) => value.trim()).map(([label, value]) => `${label}: ${value}`).join('\n')
  return `mailto:sales@puffsticker.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

export function ContactPage() {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', subject: '', message: '' })
  const submit = (event: FormEvent) => {
    event.preventDefault()
    window.location.href = buildMailto(`PuffSticker enquiry — ${form.subject}`, { 'First name': form.firstName, 'Last name': form.lastName, Email: form.email, Phone: form.phone, Subject: form.subject, Message: form.message })
  }
  return (
    <>
      <PageHero dark eyebrow="Contact PuffSticker" title={<>A direct line to the people who <em>make it.</em></>} text="Ask about materials, artwork, quantities, samples or an existing order. PuffSticker publishes weekday sales and support hours." meta="Mon–Fri · 09:00–17:00 EST" />
      <section className="contact-page">
        <div className="page-shell contact-page__grid">
          <div className="contact-details reveal-block">
            <span className="eyebrow">Sales & support</span>
            <a href="mailto:sales@puffsticker.com"><i><Mail /></i><span><small>Custom orders</small>sales@puffsticker.com</span><ArrowUpRight /></a>
            <a href="mailto:info@puffsticker.com"><i><Mail /></i><span><small>General enquiries</small>info@puffsticker.com</span><ArrowUpRight /></a>
            <a href="tel:+14079234382"><i><Phone /></i><span><small>Hotline</small>(407) 923-4382</span><ArrowUpRight /></a>
            <div className="contact-details__location"><i><MapPin /></i><p><strong>United States</strong><br />Apt 325, 3433 Mission Bay Boulevard<br />Orlando, FL 32817</p></div>
            <div className="contact-details__location"><i><MapPin /></i><p><strong>Canada</strong><br />1306 Meath Dr.<br />Oshawa, ON L1K 0M7</p></div>
            <div className="contact-details__hours"><i><Clock3 /></i><p>Monday–Friday <strong>09:00–17:00 EST</strong><br />Saturday & Sunday <strong>Closed</strong></p></div>
          </div>
          <form className="contact-form reveal-block" onSubmit={submit}>
            <div className="contact-form__heading"><span>Send an enquiry</span><small>Opens in your email client</small></div>
            <div className="field-row"><label><span>First name *</span><input required maxLength={400} autoComplete="given-name" value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} /></label><label><span>Last name *</span><input required maxLength={400} autoComplete="family-name" value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} /></label></div>
            <div className="field-row"><label><span>Email *</span><input required maxLength={400} autoComplete="email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label><span>Phone *</span><input required maxLength={400} autoComplete="tel" type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label></div>
            <label><span>Subject *</span><input required maxLength={400} value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} /></label>
            <label><span>Message * <small>{form.message.length}/2000</small></span><textarea required rows={10} maxLength={2000} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} /></label>
            <button className="page-button page-button--yellow" type="submit">Prepare email <ArrowUpRight /></button>
          </form>
        </div>
      </section>
      <OfficialPageSection slug="contact-us" label="Contact and ordering information" />
      <section className="sample-band"><div className="page-shell sample-band__grid"><div><span className="eyebrow eyebrow--light">Feel before the full run</span><h2>Puffy sticker sample pack</h2><p>Compare raised textures, finishes and adhesive quality before committing to a custom order.</p></div><strong>$45</strong><SiteLink to="/request-a-quote?product=sample-pack" className="page-button page-button--yellow">Ask for a sample <ArrowRight /></SiteLink></div></section>
      <SiteFooter />
    </>
  )
}

type QuoteState = {
  firstName: string
  lastName: string
  email: string
  phone: string
  product: string
  width: string
  height: string
  length: string
  unit: string
  quantity: string
  quantity2: string
  quantity3: string
  colors: string
  coating: string
  addon: string
  stock: string
  comments: string
}

export function QuotePage() {
  const { search } = useRouter()
  const preselectedSlug = new URLSearchParams(search).get('product') ?? ''
  const preselected = getProduct(preselectedSlug)?.name ?? (preselectedSlug === 'sample-pack' ? 'Puffy sticker sample pack' : preselectedSlug)
  const [step, setStep] = useState(0)
  const [artwork, setArtwork] = useState<File | null>(null)
  const formElement = useRef<HTMLFormElement>(null)
  const [form, setForm] = useState<QuoteState>({
    firstName: '', lastName: '', email: '', phone: '', product: preselected,
    width: '', height: '', length: '', unit: 'Inches', quantity: '', quantity2: '', quantity3: '',
    colors: '4 color', coating: 'None', addon: 'None', stock: 'None', comments: '',
  })
  const selected = getProduct(form.product) ?? catalogProducts.find((product) => product.name.toLowerCase() === form.product.trim().toLowerCase())
  const fileName = artwork?.name ?? ''
  const isPackaging = selected?.category === 'promotional-items'
  const steps = ['Contact', 'Product', 'Quantity & artwork', 'Finishing']
  const update = (key: keyof QuoteState, value: string) => setForm((current) => ({ ...current, [key]: value }))
  const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)
  const canContinue = step === 0
    ? Boolean(form.firstName && form.lastName && emailIsValid && form.phone)
    : step === 1
      ? Boolean(form.product)
      : step === 2
        ? Boolean(form.quantity && fileName)
        : true

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const showInvalidStep = (invalidStep: number) => {
      setStep(invalidStep)
      window.requestAnimationFrame(() => formElement.current?.reportValidity())
    }
    if (!form.firstName || !form.lastName || !form.phone || !emailIsValid) return showInvalidStep(0)
    if (!form.product) return showInvalidStep(1)
    if (!form.quantity || Number(form.quantity) < 1 || !artwork) return showInvalidStep(2)
    const mailto = buildMailto('PuffSticker custom quote request', {
      'First name': form.firstName,
      'Last name': form.lastName,
      Email: form.email,
      Phone: form.phone,
      Product: selected?.name ?? form.product,
      Dimensions: [form.width && `W ${form.width}`, form.height && `H ${form.height}`, form.length && `L ${form.length}`].filter(Boolean).join(' × ') + (form.width || form.height || form.length ? ` ${form.unit}` : ''),
      'Primary quantity': form.quantity,
      'Quantity 2': form.quantity2,
      'Quantity 3': form.quantity3,
      Colors: form.colors,
      Coating: form.coating,
      'Finishing add-on': form.addon,
      Stock: isPackaging ? form.stock : 'Not applicable',
      Artwork: `${fileName} — please attach this file to the email before sending`,
      Comments: form.comments,
    })
    window.location.href = mailto
  }

  return (
    <>
      <section className="quote-page">
        <div className="quote-page__backdrop" />
        <div className="page-shell quote-page__heading reveal-block">
          <span className="eyebrow eyebrow--light">Free custom quote</span>
          <h1>A clear brief makes a better <em>puff.</em></h1>
          <p>Four focused steps. Final pricing and lead time are confirmed by the PuffSticker team.</p>
        </div>
        <div className="page-shell quote-layout">
          <aside className="quote-progress">
            {steps.map((label, index) => (
              <button type="button" key={label} className={`${index === step ? 'is-active' : ''} ${index < step ? 'is-complete' : ''}`} onClick={() => index <= step && setStep(index)} disabled={index > step}>
                <i>{index < step ? <Check size={14} /> : index + 1}</i><span>{label}</span>
              </button>
            ))}
            <div className="quote-progress__help"><CircleHelp /><span>Need help choosing?</span><a href="mailto:sales@puffsticker.com">sales@puffsticker.com</a></div>
          </aside>

          <form className="quote-form" ref={formElement} onSubmit={submit}>
            {step === 0 && (
              <fieldset className="quote-step">
                <legend><small>Step 01</small>Who should we send the quote to?</legend>
                <div className="field-row"><label><span>First name *</span><input autoFocus required maxLength={400} autoComplete="given-name" value={form.firstName} onChange={(event) => update('firstName', event.target.value)} /></label><label><span>Last name *</span><input required maxLength={400} autoComplete="family-name" value={form.lastName} onChange={(event) => update('lastName', event.target.value)} /></label></div>
                <div className="field-row"><label><span>Email *</span><input required maxLength={400} autoComplete="email" type="email" value={form.email} onChange={(event) => update('email', event.target.value)} /></label><label><span>Phone *</span><input required maxLength={400} autoComplete="tel" type="tel" value={form.phone} onChange={(event) => update('phone', event.target.value)} /></label></div>
              </fieldset>
            )}
            {step === 1 && (
              <fieldset className="quote-step">
                <legend><small>Step 02</small>What are we making?</legend>
                <label><span>Product *</span><input autoFocus required maxLength={400} list="quote-product-options" placeholder="Type or choose a product" value={form.product} onChange={(event) => update('product', event.target.value)} /><datalist id="quote-product-options"><option value="Puffy sticker sample pack" />{catalogProducts.map((product) => <option value={product.name} key={product.slug} />)}</datalist></label>
                <div className="dimension-fields"><label><span>Width</span><input type="number" min="0" step="0.1" inputMode="decimal" value={form.width} onChange={(event) => update('width', event.target.value)} /></label><label><span>Height</span><input type="number" min="0" step="0.1" inputMode="decimal" value={form.height} onChange={(event) => update('height', event.target.value)} /></label><label><span>Length</span><input type="number" min="0" step="0.1" inputMode="decimal" value={form.length} onChange={(event) => update('length', event.target.value)} /></label><label><span>Unit</span><select value={form.unit} onChange={(event) => update('unit', event.target.value)}><option>Inches</option><option>Cm</option><option>Mm</option><option>Feet</option></select></label></div>
                {selected && <div className="quote-product-preview"><img src={selected.image} alt="" /><span><small>Selected product</small><strong>{selected.name}</strong><em>{selected.price} base</em></span></div>}
              </fieldset>
            )}
            {step === 2 && (
              <fieldset className="quote-step">
                <legend><small>Step 03</small>Quantity and artwork</legend>
                <div className="field-row field-row--three"><label><span>Primary quantity *</span><input autoFocus required type="number" min="1" step="1" inputMode="numeric" value={form.quantity} onChange={(event) => update('quantity', event.target.value)} /></label><label><span>Quantity 2</span><input type="number" min="1" step="1" inputMode="numeric" value={form.quantity2} onChange={(event) => update('quantity2', event.target.value)} /></label><label><span>Quantity 3</span><input type="number" min="1" step="1" inputMode="numeric" value={form.quantity3} onChange={(event) => update('quantity3', event.target.value)} /></label></div>
                <p className="quote-step__hint">Add optional quantities to compare price breaks. Minimums vary by product and are confirmed with the quote.</p>
                <label className={`file-drop ${fileName ? 'has-file' : ''}`}>
                  <input type="file" required accept=".pdf,.png,.jpg,.jpeg,.ai,.psd" onChange={(event) => setArtwork(event.target.files?.[0] ?? null)} />
                  {fileName ? <><CheckCircle2 /><span><strong>{fileName}</strong><small>Selected · attach it again when your email opens</small></span></> : <><Upload /><span><strong>Choose artwork *</strong><small>PDF, PNG, JPG/JPEG, AI or PSD · 300 DPI+ recommended</small></span></>}
                </label>
              </fieldset>
            )}
            {step === 3 && (
              <fieldset className="quote-step">
                <legend><small>Step 04</small>Finish the specification</legend>
                <div className="field-row"><label><span>Color specification</span><select value={form.colors} onChange={(event) => update('colors', event.target.value)}>{['1 color','2 color','3 color','4 color','4/1 color','4/2 color','4/3 color','4/4 color'].map((value) => <option key={value}>{value}</option>)}</select></label><label><span>Coating</span><select value={form.coating} onChange={(event) => update('coating', event.target.value)}>{['None','Gloss Lamination','Matte Lamination','Gloss Varnish','Matte Varnish','Soft Touch Lamination'].map((value) => <option key={value}>{value}</option>)}</select></label></div>
                <div className="field-row"><label><span>Add-on</span><select value={form.addon} onChange={(event) => update('addon', event.target.value)}>{['None','Gold Foiling','Silver Foiling','Embossing','Spot UV','Raised Ink','Window Patching'].map((value) => <option key={value}>{value}</option>)}</select></label>{isPackaging && <label><span>Stock</span><select value={form.stock} onChange={(event) => update('stock', event.target.value)}>{['None','12pt','14pt','16pt','18pt','Kraft','Corrugated','Custom'].map((value) => <option key={value}>{value}</option>)}</select></label>}</div>
                <label><span>Comments <small>{form.comments.length}/2000</small></span><textarea rows={6} maxLength={2000} value={form.comments} onChange={(event) => update('comments', event.target.value)} placeholder="Surface, intended use, deadline, packing or anything else the team should know." /></label>
                <div className="quote-review"><CheckCircle2 /><span><strong>Ready for review</strong><small>Your email client will open with the specification prepared. Attach {fileName || 'your artwork'} before sending.</small></span></div>
              </fieldset>
            )}
            <div className="quote-form__actions">
              {step > 0 && <button type="button" className="page-text-button" onClick={() => setStep((current) => current - 1)}><ArrowLeft />Back</button>}
              {step < steps.length - 1 ? <button type="button" className="page-button page-button--yellow" disabled={!canContinue} onClick={() => canContinue && setStep((current) => current + 1)}>Continue <ArrowRight /></button> : <button type="submit" className="page-button page-button--yellow">Prepare free quote <ArrowUpRight /></button>}
            </div>
          </form>

          <aside className="quote-summary">
            <span>Brief summary</span>
            <div><small>Contact</small><strong>{form.firstName || '—'} {form.lastName}</strong><p>{form.email || 'Add your work email'}</p></div>
            <div><small>Product</small><strong>{selected?.name ?? (form.product || '—')}</strong><p>{[form.width, form.height, form.length].filter(Boolean).length ? `${[form.width, form.height, form.length].filter(Boolean).join(' × ')} ${form.unit}` : 'Dimensions not set'}</p></div>
            <div><small>Quantity</small><strong>{form.quantity || '—'}</strong><p>{fileName || 'Artwork not added'}</p></div>
            <p className="quote-summary__note"><ShieldCheck />Details are shared with PuffSticker sales through your email client.</p>
          </aside>
        </div>
      </section>
      <OfficialPageSection slug="request-a-quote" label="Quote preparation guide" />
      <SiteFooter />
    </>
  )
}

export function BlogPage({ categorySlug }: { categorySlug?: string } = {}) {
  const filters = ['All', ...Array.from(new Set(baselineBlogPosts.flatMap((post) => post.categories)))]
  const requestedFilter = filters.find((filter) => filter.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-') === categorySlug) ?? 'All'
  const [active, setActive] = useState(requestedFilter)
  const visible = active === 'All' ? baselineBlogPosts : baselineBlogPosts.filter((post) => post.categories.includes(active))
  return (
    <>
      <PageHero eyebrow="The Puff Blog" title={<>Material, memory<br />and <em>things that stick.</em></>} text="Field notes on tactile design, sticker psychology, packaging and the small material choices that change how a brand is perceived." meta={`${baselineBlogPosts.length} stories`} />
      <section className="blog-page">
        <div className="page-shell blog-filter" role="group" aria-label="Filter stories">{filters.map((filter) => <button type="button" onClick={() => setActive(filter)} className={active === filter ? 'is-active' : ''} key={filter}>{filter}</button>)}</div>
        {active === 'All' && (
          <article className="page-shell blog-feature reveal-block">
            <SiteLink to={`/blog/${baselineBlogPosts[0].slug}`} className="blog-feature__media"><img src={baselineBlogPosts[0].image} alt={baselineBlogPosts[0].imageAlt ?? ''} /></SiteLink>
            <div className="blog-feature__copy"><span>{baselineBlogPosts[0].categories.join(' · ')} · {baselineBlogPosts[0].date}</span><SiteLink to={`/blog/${baselineBlogPosts[0].slug}`}><h2>{baselineBlogPosts[0].title}</h2></SiteLink><p>{baselineBlogPosts[0].excerpt}</p><SiteLink to={`/blog/${baselineBlogPosts[0].slug}`} className="page-text-link">Read the field note <ArrowRight /></SiteLink></div>
          </article>
        )}
        <div className="page-shell blog-grid">
          {visible.slice(active === 'All' ? 1 : 0).map((post) => (
            <article className="blog-card reveal-block" key={post.slug}>
              <SiteLink to={`/blog/${post.slug}`} className="blog-card__media" data-cursor="READ"><img src={post.image} alt={post.imageAlt ?? ''} loading="lazy" /><i><ArrowUpRight /></i></SiteLink>
              <div><span>{post.categories.join(' · ')} · {post.date}</span><SiteLink to={`/blog/${post.slug}`}><h3>{post.title}</h3></SiteLink><p>{post.excerpt}</p></div>
            </article>
          ))}
        </div>
      </section>
      <SiteFooter />
    </>
  )
}

export function ArchivePage({ pathname }: { pathname: string }) {
  const archive = getArchiveContent(pathname)
  if (!archive) return <NotFoundPage />
  const articles = archive.articleSlugs.flatMap((slug) => {
    const post = blogPosts.find((item) => item.slug === slug)
    return post ? [post] : []
  })
  const archiveProducts = archive.productSlugs.flatMap((slug) => {
    const product = getProduct(slug)
    return product ? [product] : []
  })
  const resultCount = articles.length + archiveProducts.length

  return (
    <>
      <PageHero
        eyebrow={pathname === '/blog/page/2' ? 'The Puff Blog' : 'Published archive'}
        title={<>{archive.label}<br /><em>archive.</em></>}
        text="Published PuffSticker articles and products grouped by their original archive relationship."
        meta={`${resultCount} ${resultCount === 1 ? 'result' : 'results'}`}
      />
      {articles.length > 0 && (
        <section className="blog-page">
          <div className="page-shell blog-grid">
            {articles.map((post) => (
              <article className="blog-card reveal-block" key={post.slug}>
                <SiteLink to={`/blog/${post.slug}`} className="blog-card__media" data-cursor="READ"><img src={post.image} alt={post.imageAlt ?? post.title} loading="lazy" /><i><ArrowUpRight /></i></SiteLink>
                <div><span>{post.categories.join(' · ')} · {post.date}</span><SiteLink to={`/blog/${post.slug}`}><h2>{post.title}</h2></SiteLink><p>{post.excerpt}</p></div>
              </article>
            ))}
          </div>
        </section>
      )}
      {archiveProducts.length > 0 && (
        <section className="catalog-section catalog-section--category">
          <div className="page-shell catalog-grid">
            {archiveProducts.map((product, index) => <ProductGridCard product={product} index={index} key={product.slug} />)}
          </div>
        </section>
      )}
      <SiteFooter />
    </>
  )
}

export function BlogArticlePage({ slug }: { slug: string }) {
  const post = blogPosts.find((item) => item.slug === slug)
  const liveArticle = getLiveBlogEntry(slug)
  if (!post) return <NotFoundPage />
  const related = baselineBlogPosts.filter((item) => item.slug !== slug).slice(0, 3)
  const fallbackSections = articleSections[post.slug] ?? []
  return (
    <>
      <article className="article-page">
        <header className="article-page__header page-shell reveal-block"><SiteLink to="/blog" className="article-page__back"><ArrowLeft />All field notes</SiteLink><span>{post.categories.join(' · ')} · {post.date}</span><h1>{post.title}</h1><p>{post.excerpt}</p></header>
        <div className="article-page__hero page-shell reveal-block"><img src={post.image} alt={post.imageAlt ?? ''} /><span>From the PuffSticker journal</span></div>
        <div className="article-page__body page-shell">
          <aside><span>In this note</span><p>{post.categories.join(' · ')}</p><SiteLink to="/blog">All field notes <ArrowLeft /></SiteLink></aside>
          <div className="reveal-block">
            <p className="article-page__lead">{post.excerpt}</p>
            {liveArticle
              ? <div className="article-page__source-html" data-live-loaded="blog-article" dangerouslySetInnerHTML={{ __html: liveArticle.html }} />
              : <div data-live-pending="blog-article">{fallbackSections.map((section, index) => <section className="article-page__section" key={section.title}><span>{String(index + 1).padStart(2, '0')}</span><h2>{section.title}</h2><p>{section.body}</p></section>)}</div>}
          </div>
        </div>
      </article>
      <section className="more-notes"><div className="page-shell related-products__heading"><div><span className="eyebrow">Continue reading</span><h2>More field notes</h2></div></div><div className="page-shell blog-grid">{related.map((item) => <article className="blog-card" key={item.slug}><SiteLink to={`/blog/${item.slug}`} className="blog-card__media"><img src={item.image} alt={item.imageAlt ?? ''} /><i><ArrowUpRight /></i></SiteLink><div><span>{item.categories.join(' · ')} · {item.date}</span><SiteLink to={`/blog/${item.slug}`}><h3>{item.title}</h3></SiteLink></div></article>)}</div></section>
      <SiteFooter />
    </>
  )
}

const policyPages: Record<string, { eyebrow: string; title: string; intro: string; sections: Array<{ title: string; body: string; bullets?: string[] }> }> = {
  'reprint-policy': {
    eyebrow: 'Refund & return policy',
    title: 'A clear path when production is not right.',
    intro: 'Because products are custom-made, orders are generally non-returnable. Verified production or delivery issues may qualify for a free reprint.',
    sections: [
      { title: 'Eligible reprint issues', body: 'PuffSticker reviews claims when the finished product differs materially from the approved design, uploaded artwork or agreed production specification.', bullets: ['Printing or material defects', 'Wrong product, size or quantity', 'Damage during transit'] },
      { title: 'How to submit a claim', body: 'Use the contact form to send the order number, a description of the issue and clear photographs within seven days of confirmed delivery. The published policy targets a response within one to two business days.' },
      { title: 'What is not covered', body: 'Issues originating in customer-supplied files or submitted fulfillment details are excluded.', bullets: ['Low-resolution or unsupported artwork formats', 'Spelling mistakes, design errors or other incorrect submitted details', 'Normal screen-to-CMYK color variation', 'Incorrect shipping address supplied by the customer'] },
      { title: 'Approved reprint', body: 'When a claim is approved, PuffSticker confirms the no-cost reprint by email and provides an estimated dispatch date. Standard production timing and the original delivery address and method generally apply.' },
      { title: 'Exceptional resolution', body: 'If an approved reprint cannot be fulfilled, the published policy allows an exceptional resolution such as store credit, a partial refund or a full refund, depending on the reviewed circumstances.' },
    ],
  },
  'privacy-policy': {
    eyebrow: 'Privacy policy',
    title: 'How customer and order information is handled.',
    intro: 'The policy covers personal details, order and artwork information, payment data, device information, cookies and browsing activity.',
    sections: [
      { title: 'Scope and consent', body: 'The policy applies when visitors use PuffSticker.com, place an order, upload artwork or contact the business. Using the service indicates consent to the practices described in the published policy, subject to available withdrawal and objection rights.' },
      { title: 'Information collected', body: 'PuffSticker may collect names, contact details, order and artwork data, payment-related information, device data, cookies and browsing activity.' },
      { title: 'How information is used', body: 'Information supports order fulfillment, customer service, personalization, site improvement, communications and fraud prevention.' },
      { title: 'Cookies and browsing data', body: 'Cookies and similar technologies support core functionality, preferences and site analysis. Disabling cookies can affect how parts of the service work.' },
      { title: 'Sharing and sale of data', body: 'PuffSticker states that it does not sell or rent personal data. Information may be shared with service providers, when legally required or as part of a business transfer.' },
      { title: 'Security', body: 'The policy references SSL and reasonable safeguards intended to protect information. No internet transmission or storage method can be guaranteed completely secure.' },
      { title: 'Access, correction and deletion', body: 'Customers may request access to personal information and ask for inaccurate data to be corrected or, where applicable, deleted.' },
      { title: 'Withdrawal and objections', body: 'The published policy describes rights to withdraw consent or object to certain processing. A request may affect services that depend on the relevant information.' },
      { title: 'Third parties and children', body: 'Third-party sites maintain their own privacy practices, and PuffSticker is not responsible for them. The service is not directed to children under 13.' },
      { title: 'Updates and contact', body: 'The privacy policy may be updated as practices change. Questions or privacy requests can be directed to PuffSticker through the published contact details.' },
    ],
  },
  'terms-of-service': {
    eyebrow: 'Terms & conditions',
    title: 'The terms governing site use and custom orders.',
    intro: 'These terms cover lawful site use, custom product sales, payment, intellectual property, order changes and the relationship to the reprint policy.',
    sections: [
      { title: 'Eligibility and lawful use', body: 'Customers must meet the age requirement in their jurisdiction and may use the service only for lawful purposes.' },
      { title: 'Service information and accuracy', body: 'PuffSticker may correct errors, update information or change the service. Product descriptions, imagery and other site information may not always be complete or current.' },
      { title: 'Products and geographic availability', body: 'Products or services may be available only in certain locations or quantities. PuffSticker may limit sales by person, region or jurisdiction.' },
      { title: 'Pricing, orders and payment', body: 'Prices may change without notice. PuffSticker may refuse, limit or cancel an order, and payment is required at the time of purchase under the published terms.' },
      { title: 'Custom products and final sale', body: 'Custom sticker and shopping-bag orders are generally final sale. Verified production issues are handled under the published reprint policy.' },
      { title: 'Intellectual property', body: 'Site copy, graphics, branding and other content are protected. The terms restrict copying, reproducing, reselling or exploiting service content without permission.' },
      { title: 'Customer-provided content', body: 'Customers are responsible for the artwork and information they submit and must have the rights needed for PuffSticker to use those materials to fulfill the order.' },
      { title: 'Third-party tools and links', body: 'Third-party services and links may be provided for convenience and remain subject to their own terms. PuffSticker does not control those external services.' },
      { title: 'Disclaimers and liability', body: 'The terms include service disclaimers and limits on liability to the extent allowed by law. Customers should review the complete live terms for the governing language.' },
      { title: 'Termination, updates and contact', body: 'PuffSticker may terminate access for a terms violation and may revise the terms over time. Questions can be directed through the published contact information.' },
    ],
  },
  'shipping-delivery': {
    eyebrow: 'Shipping & delivery',
    title: 'Production first. Tracked delivery after.',
    intro: 'Custom work follows a production schedule before shipping. Timing varies by product, quantity, specification and destination.',
    sections: [
      { title: 'Typical planning window', body: 'The general FAQ estimates approximately 24–26 business days to produce and deliver. This is guidance rather than a universal promise; ask sales to confirm the product-specific schedule.' },
      { title: 'United States delivery', body: 'The live site advertises free shipping on U.S. orders. Final delivery details are confirmed during ordering.' },
      { title: 'International delivery', body: 'Worldwide delivery is available, with the site specifically mentioning the USA, Canada, Australia and more than 30 countries. Rates and timing vary by destination.' },
      { title: 'Changes and transit issues', body: 'Order changes may only be possible before production starts. Transit damage should be reported with photos and order details within seven days of delivery.' },
    ],
  },
}

export function ResourcesPage() {
  const resourceCards = [
    ['/faqs', 'FAQs', 'Artwork, materials, quantities and product comparisons.', <CircleHelp />],
    ['/shipping-delivery', 'Shipping & delivery', 'Production windows, tracking and international delivery.', <Globe2 />],
    ['/reprint-policy', 'Refund & reprint', 'Eligibility, evidence, timing and resolution.', <ShieldCheck />],
    ['/privacy-policy', 'Privacy', 'How customer, order and artwork data is handled.', <FileCheck2 />],
    ['/terms-of-service', 'Terms', 'Site use, orders, payment and custom-product terms.', <Layers3 />],
  ]
  return (
    <>
      <PageHero eyebrow="Resources" title={<>Everything needed<br />to move a job <em>forward.</em></>} text="Practical guidance for preparing artwork, comparing materials, planning delivery and understanding custom-order policies." meta="B2B production support" />
      <section className="resources-page">
        <div className="page-shell resource-grid">{resourceCards.map(([href, title, text, icon]) => <SiteLink to={String(href)} className="resource-card reveal-block" key={String(title)}><i>{icon}</i><span>Open resource <ArrowUpRight /></span><h2>{title}</h2><p>{text}</p></SiteLink>)}</div>
      </section>
      <section className="artwork-guide">
        <div className="page-shell artwork-guide__grid">
          <div className="reveal-block"><span className="eyebrow eyebrow--light">Artwork checklist</span><h2>Cleaner files.<br />Cleaner production.</h2><p>The team can help with minor cleanup, sizing and line-thickness guidance.</p></div>
          <div className="artwork-guide__list reveal-block">
            {[['Resolution','300 DPI or higher'],['Preferred files','AI or PDF'],['Accepted uploads','PDF, PNG, JPG/JPEG, AI, PSD'],['Before production','Artwork and cut line reviewed'],['Color','Bold color and clear line work reproduce best']].map(([label, value], index) => <p key={label}><span>0{index + 1} · {label}</span><strong>{value}</strong></p>)}
          </div>
        </div>
      </section>
      <SiteFooter />
    </>
  )
}

export function PolicyPage({ slug }: { slug: string }) {
  const policy = policyPages[slug]
  const livePage = getLivePageEntry(slug)
  if (!policy) return <NotFoundPage />
  return (
    <>
      <PageHero eyebrow={policy.eyebrow} title={policy.title} text={policy.intro} meta="PuffSticker resource" />
      <section className="policy-page">
        <div className="page-shell policy-page__grid">
          <aside><span>{livePage ? 'Policy details' : 'On this page'}</span>{!livePage && policy.sections.map((section, index) => <a href={`#policy-${index}`} key={section.title}>{String(index + 1).padStart(2, '0')} · {section.title}</a>)}<a href="mailto:sales@puffsticker.com">Questions <ArrowUpRight /></a></aside>
          {livePage
            ? <div className="policy-live-copy reveal-block" data-live-loaded="policy" dangerouslySetInnerHTML={{ __html: livePage.html }} />
            : <div data-live-pending={slug === 'shipping-delivery' ? undefined : 'policy'}>{policy.sections.map((section, index) => <section id={`policy-${index}`} className="reveal-block" key={section.title}><span>{String(index + 1).padStart(2, '0')}</span><h2>{section.title}</h2><p>{section.body}</p>{section.bullets && <ul>{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>}</section>)}</div>}
        </div>
      </section>
      <SiteFooter />
    </>
  )
}
