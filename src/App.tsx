import {
  type PointerEvent as ReactPointerEvent,
  Suspense,
  lazy,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  Globe2,
  Layers3,
  Menu,
  Minus,
  PackageCheck,
  Plus,
  Sparkles,
  X,
} from 'lucide-react'
import { faqs, finishOptions, products, type Product } from './data'
import { SiteLink, useRouter } from './router'
import { BackToTop } from './components/BackToTop'

gsap.registerPlugin(ScrollTrigger, useGSAP)

const PuffWorld = lazy(() => import('./components/PuffWorld'))
const lazyPage = <T extends keyof typeof import('./pages/SitePages')>(name: T) => lazy(() => import('./pages/SitePages').then((module) => ({ default: module[name] as React.ComponentType<any> })))
const AboutPage = lazyPage('AboutPage')
const BlogArticlePage = lazyPage('BlogArticlePage')
const BlogPage = lazyPage('BlogPage')
const CategoryPage = lazyPage('CategoryPage')
const ContactPage = lazyPage('ContactPage')
const FullFaqPage = lazyPage('FullFaqPage')
const NotFoundPage = lazyPage('NotFoundPage')
const PolicyPage = lazyPage('PolicyPage')
const ProductPage = lazyPage('ProductPage')
const QuotePage = lazyPage('QuotePage')
const ResourcesPage = lazyPage('ResourcesPage')
const ShopPage = lazyPage('ShopPage')
const categoryPaths = new Set(['puffy-labels-stickers', 'flat-labels-stickers', 'promotional-items'])

const productTicker = [
  'Puffy Stickers',
  '3D Labels',
  'Epoxy Stickers',
  'Dome Decals',
  'Holographic',
  'Metallic Foil',
  'Foam Stickers',
]

const homeJournalPosts = [
  {
    title: 'When 3D Stickers Become Collectibles',
    date: 'July 29, 2026',
    category: 'Sticker psychology',
    excerpt: 'How texture, context and the feeling of an object can move a sticker from decoration into something people keep.',
    image: '/assets/blog-collectibles.webp',
    href: '/blog/when-3d-stickers-become-collectibles',
  },
  {
    title: 'Why Sticker Books Never Really Disappeared',
    date: 'July 3, 2026',
    category: 'Culture & collecting',
    excerpt: 'Why collecting, arranging and saving stickers continues to feel personal across generations.',
    image: '/assets/blog-sticker-books.webp',
    href: '/blog/why-sticker-books-never-really-disappeared',
  },
  {
    title: 'Why We Save Stickers We Never Use',
    date: 'June 23, 2026',
    category: 'Sticker psychology',
    excerpt: 'The psychology behind keeping the perfect sticker untouched—and what that says about attachment and value.',
    image: '/assets/live/blog/why-we-save-stickers-we-never-use/01-the-problem-with-perfect-spot-1024x701.webp',
    href: '/blog/why-we-save-stickers-we-never-use',
  },
  {
    title: 'The Psychology of Quiet Surfaces',
    date: 'June 16, 2026',
    category: 'Material intelligence',
    excerpt: 'How restrained reflection can make an object feel more composed, material and trustworthy.',
    image: '/assets/live/blog/matte-vs-gloss-psychology/01-gloss-behaves-movement-1024x466.webp',
    href: '/blog/matte-vs-gloss-psychology',
  },
] as const

const coreCategories = [
  {
    index: '01',
    name: 'Puffy Labels & Stickers',
    href: '/puffy-labels-stickers',
    count: '7 formats',
    text: 'Soft, raised stickers and dimensional labels that bring tactile impact to packaging, merchandise and promotions.',
    image: '/assets/catalog/puffy-stickers.webp',
  },
  {
    index: '02',
    name: 'Flat Labels & Stickers',
    href: '/flat-labels-stickers',
    count: '7 formats',
    text: 'Custom flat labels across vinyl, bottles, bumpers, foil and holographic finishes for clear everyday branding.',
    image: '/assets/catalog/holographic-stickers.webp',
  },
  {
    index: '03',
    name: 'Promotional Items',
    href: '/promotional-items',
    count: '7 formats',
    text: 'Custom bags and pouches for retail, events, food, gifting and repeated brand visibility.',
    image: '/assets/catalog/woven-bags.webp',
  },
]

function Loader({ onComplete }: { onComplete: () => void }) {
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!root.current) return onComplete()
    const timeline = gsap.timeline({ onComplete })
      .to(root.current.querySelector('.loader__logo'), { scale: 1.03, duration: 0.16, ease: 'power2.out' })
      .to(root.current.querySelector('.loader__content'), { autoAlpha: 0, y: -10, duration: 0.16, ease: 'power2.in' }, 0.18)
      .to(root.current.querySelector('.loader__curtain--left'), { xPercent: -102, duration: 0.42, ease: 'power4.inOut' }, 0.2)
      .to(root.current.querySelector('.loader__curtain--right'), { xPercent: 102, duration: 0.42, ease: 'power4.inOut' }, 0.2)
    const fallback = window.setTimeout(onComplete, 900)
    return () => {
      window.clearTimeout(fallback)
      timeline.kill()
    }
  }, [onComplete])

  return (
    <div className="loader" ref={root} aria-label="Loading Puff Sticker">
      <div className="loader__curtain loader__curtain--left" />
      <div className="loader__curtain loader__curtain--right" />
      <div className="loader__content">
        <div className="loader__logo-wrap">
          <img className="loader__logo" src="/assets/puff-logo.webp" alt="Puff Sticker" decoding="async" />
        </div>
        <div className="loader__meta">
          <span>Custom made · Since 2007</span>
          <strong>PUFF</strong>
        </div>
        <div className="loader__track">
          <span />
        </div>
      </div>
    </div>
  )
}

function Cursor() {
  const ring = useRef<HTMLDivElement>(null)
  const dot = useRef<HTMLDivElement>(null)
  const [label, setLabel] = useState('')

  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches || !ring.current || !dot.current) return
    const xRing = gsap.quickTo(ring.current, 'x', { duration: 0.45, ease: 'power3' })
    const yRing = gsap.quickTo(ring.current, 'y', { duration: 0.45, ease: 'power3' })
    const xDot = gsap.quickTo(dot.current, 'x', { duration: 0.12, ease: 'power2' })
    const yDot = gsap.quickTo(dot.current, 'y', { duration: 0.12, ease: 'power2' })
    const move = (event: PointerEvent) => {
      xRing(event.clientX)
      yRing(event.clientY)
      xDot(event.clientX)
      yDot(event.clientY)
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-cursor]')
      setLabel(target?.dataset.cursor ?? '')
    }
    window.addEventListener('pointermove', move)
    return () => window.removeEventListener('pointermove', move)
  }, [])

  return (
    <>
      <div ref={ring} className={`cursor-ring ${label ? 'cursor-ring--active' : ''}`} aria-hidden="true">
        <span>{label}</span>
      </div>
      <div ref={dot} className="cursor-dot" aria-hidden="true" />
    </>
  )
}

function MagneticLink({
  href,
  children,
  className = '',
  external = false,
}: {
  href: string
  children: React.ReactNode
  className?: string
  external?: boolean
}) {
  const ref = useRef<HTMLAnchorElement>(null)
  const { navigate } = useRouter()
  const move = (event: ReactPointerEvent<HTMLAnchorElement>) => {
    if (!ref.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const rect = ref.current.getBoundingClientRect()
    gsap.to(ref.current, {
      x: (event.clientX - rect.left - rect.width / 2) * 0.18,
      y: (event.clientY - rect.top - rect.height / 2) * 0.18,
      duration: 0.3,
      ease: 'power2.out',
    })
  }
  const leave = () => gsap.to(ref.current, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1, .35)' })
  return (
    <a
      ref={ref}
      className={`magnetic ${className}`}
      href={href}
      onPointerMove={move}
      onPointerLeave={leave}
      onClick={(event) => {
        if (!external && href.startsWith('/') && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
          event.preventDefault()
          navigate(href)
        }
      }}
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer' : undefined}
      data-cursor="GO"
    >
      {children}
    </a>
  )
}

function Header() {
  const [open, setOpen] = useState(false)
  const closeButton = useRef<HTMLButtonElement>(null)
  const menuButton = useRef<HTMLButtonElement>(null)
  const navItems = [
    ['Products', '/shop'],
    ['How it works', '/#process'],
    ['About', '/about-us'],
    ['Resources', '/resources'],
    ['Contact', '/contact-us'],
  ]
  useEffect(() => {
    if (!open) return
    const main = document.getElementById('main-content')
    const header = document.querySelector<HTMLElement>('.site-header')
    const handleKeys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        return
      }
      if (event.key !== 'Tab') return
      const panel = document.getElementById('mobile-menu')
      const focusable = Array.from(panel?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? [])
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable.at(-1)!
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.body.classList.add('menu-open')
    if (main) main.inert = true
    if (header) header.inert = true
    window.addEventListener('keydown', handleKeys)
    closeButton.current?.focus()
    return () => {
      document.body.classList.remove('menu-open')
      if (main) main.inert = false
      if (header) header.inert = false
      window.removeEventListener('keydown', handleKeys)
      menuButton.current?.focus()
    }
  }, [open])
  return (
    <>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="site-header">
        <SiteLink className="brand" to="/" aria-label="Puff Sticker home" data-cursor="TOP">
          <img src="/assets/puff-logo.webp" alt="Puff Sticker" decoding="async" />
        </SiteLink>
        <nav className="desktop-nav" aria-label="Main navigation">
          {navItems.map(([label, href]) => (
            <SiteLink to={href} key={href} data-cursor="VIEW">
              <span>{label}</span>
            </SiteLink>
          ))}
        </nav>
        <MagneticLink className="header-cta" href="/request-a-quote">
          <span>Start a project</span>
          <ArrowUpRight size={17} strokeWidth={2.2} />
        </MagneticLink>
        <button ref={menuButton} className="menu-toggle" type="button" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open} aria-controls="mobile-menu">
          <Menu size={22} />
        </button>
      </header>
      <div id="mobile-menu" className={`menu-panel ${open ? 'menu-panel--open' : ''}`} aria-hidden={!open} role="dialog" aria-modal="true" aria-label="Site menu">
        <button ref={closeButton} className="menu-close" type="button" onClick={() => setOpen(false)} aria-label="Close menu">
          <X size={24} />
        </button>
        <span className="eyebrow">Explore Puff</span>
        <nav>
          {navItems.map(([label, href], index) => (
            <SiteLink to={href} key={href} onClick={() => setOpen(false)}>
              <small>0{index + 1}</small>
              {label}
              <ArrowUpRight />
            </SiteLink>
          ))}
        </nav>
        <SiteLink to="/request-a-quote" className="button button--yellow" onClick={() => setOpen(false)}>
          Request a quote <ArrowUpRight size={18} />
        </SiteLink>
      </div>
    </>
  )
}

function Hero({ ready }: { ready: boolean }) {
  const root = useRef<HTMLElement>(null)
  const [mountWorld, setMountWorld] = useState(false)

  useEffect(() => {
    const lightweight = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      || Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData)
    if (lightweight) return
    const probe = document.createElement('canvas')
    if (!probe.getContext('webgl2') && !probe.getContext('webgl')) return
    const timer = window.setTimeout(() => setMountWorld(true), 140)
    return () => window.clearTimeout(timer)
  }, [])

  useGSAP(
    () => {
      if (!ready) return
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        gsap.set('.hero-title__line > span', { yPercent: 0 })
        gsap.set('.hero__eyebrow, .hero__lede, .hero__actions, .hero__aside, .hero-sticker', { autoAlpha: 1, x: 0, y: 0, scale: 1, rotation: 0 })
        return
      }
      const titleLines = gsap.utils.toArray<HTMLElement>('.hero-title__line > span')
      const intro = gsap.timeline({ defaults: { ease: 'power4.out' } })
      intro
        .fromTo(titleLines, { yPercent: 115 }, { yPercent: 0, duration: 1.15, stagger: 0.1 })
        .fromTo('.hero__eyebrow, .hero__lede, .hero__actions, .hero__aside', { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.8, stagger: 0.08 }, '-=.65')
        .fromTo('.hero-sticker', { scale: 0, rotation: -18 }, { scale: 1, rotation: 0, duration: 1.1, stagger: 0.12, ease: 'elastic.out(1, .55)' }, '-=.85')
    },
    { scope: root, dependencies: [ready] },
  )

  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        gsap.set('.hero__copy, .hero__world, .hero-sticker', { clearProps: 'transform,opacity' })
        return
      }
      gsap
        .timeline({
          scrollTrigger: {
            trigger: root.current,
            start: 'top top',
            end: 'bottom top',
            scrub: 1.1,
          },
        })
        .to('.hero__copy', { yPercent: 35, opacity: 0.18, ease: 'none' }, 0)
        .to('.hero__world', { scale: 1.24, yPercent: 12, rotate: 4, ease: 'none' }, 0)
        .to('.hero-sticker--one', { xPercent: -80, yPercent: 65, rotate: -24, ease: 'none' }, 0)
        .to('.hero-sticker--two', { xPercent: 85, yPercent: 85, rotate: 28, ease: 'none' }, 0)
    },
    { scope: root },
  )

  return (
    <section className="hero" id="top" ref={root}>
      <div className="hero__aurora hero__aurora--one" />
      <div className="hero__aurora hero__aurora--two" />
      <div className="hero__grid" />
      <div className="hero__world" aria-hidden="true">
        {mountWorld ? (
          <Suspense fallback={<div className="world-fallback"><img src="/assets/puff-logo.webp" alt="" decoding="async" /></div>}>
            <PuffWorld />
          </Suspense>
        ) : <div className="world-fallback"><img src="/assets/puff-logo.webp" alt="" decoding="async" /></div>}
      </div>
      <img className="hero-sticker hero-sticker--one" src="/assets/dome-donut.webp" alt="Pink dome decal" decoding="async" />
      <img className="hero-sticker hero-sticker--two" src="/assets/rainbow-label.webp" alt="Rainbow 3D label" decoding="async" />
      <div className="hero__copy page-shell">
        <div className="hero__eyebrow eyebrow eyebrow--light">
          <span className="pulse-dot" /> The home of puffy stickers — since 2007
        </div>
        <h1 className="hero-title" aria-label="Make your mark touchable">
          <span className="hero-title__line"><span>MAKE YOUR</span></span>
          <span className="hero-title__line hero-title__line--accent"><span>MARK</span></span>
          <span className="hero-title__line"><span>TOUCHABLE.</span></span>
        </h1>
        <div className="hero__bottom">
          <p className="hero__lede">
            Custom puffy stickers, dimensional labels and branded pieces made to stand out — visually and physically.
          </p>
          <div className="hero__actions">
            <MagneticLink href="/request-a-quote" className="button button--yellow">
              Bring your idea <ArrowUpRight size={19} />
            </MagneticLink>
            <a href="#categories" className="text-link" data-cursor="SCROLL">
              Explore categories <ArrowDown size={18} />
            </a>
          </div>
        </div>
      </div>
      <aside className="hero__aside">
        <span>Custom made</span>
        <span aria-hidden="true">•</span>
        <span>Shipped worldwide</span>
      </aside>
      <div className="hero__scroll" aria-hidden="true">
        <span>Scroll to feel</span>
        <i />
      </div>
    </section>
  )
}

function Marquee() {
  const items = [...productTicker, ...productTicker]
  return (
    <div className="marquee">
      <span className="sr-only">Product categories: {productTicker.join(', ')}</span>
      <div className="marquee__track" aria-hidden="true">
        {items.map((item, index) => (
          <span key={`${item}-${index}`}>
            {item}<Sparkles size={20} fill="currentColor" />
          </span>
        ))}
      </div>
    </div>
  )
}

function Story() {
  return (
    <section className="story" id="story">
      <div className="page-shell story__grid">
        <div className="story__intro reveal-block">
          <span className="eyebrow">Born to be felt</span>
          <h2>Flat was only the beginning.</h2>
        </div>
        <div className="story__body reveal-block">
          <p>
            PuffSticker began offline in 2007, handcrafting raised stickers for local shops and custom clients before bringing the collection online.
          </p>
          <p>
            Today the same idea remains at the center: turn a logo, character or full brand set into something people can see <em>and</em> feel.
          </p>
          <SiteLink className="round-link" to="/about-us" data-cursor="READ">
            <span>Our story</span><ArrowUpRight />
          </SiteLink>
        </div>
      </div>
      <div className="story-stage">
        <div className="story-stage__image clip-reveal">
          <img src="/assets/puffy-monster.webp" alt="Custom character puffy sticker" loading="lazy" decoding="async" />
          <span className="story-stage__tag">Raised / tactile / custom</span>
        </div>
        <div className="story-stage__orb parallax-orb"><span>Feel</span><span>the</span><strong>PUFF</strong></div>
        <div className="story-stage__note">
          <small>01 / OUR ORIGIN</small>
          <p>Creativity meets quality in every layer.</p>
        </div>
      </div>
      <div className="metrics page-shell">
        {[
          ['2007', 'The story begins'],
          ['21', 'Custom product formats'],
          ['3', 'Focused collections'],
          ['30+', 'Countries shipped to'],
        ].map(([value, label]) => (
          <div className="metric reveal-block" key={label}>
            <strong>{value}</strong><span>{label}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function CoreCategories() {
  return (
    <section className="core-categories" id="categories">
      <div className="page-shell core-categories__heading reveal-block">
        <div>
          <span className="eyebrow">Core product categories</span>
          <h2>Explore our core<br />custom printing categories.</h2>
        </div>
        <p>Browse our main product categories, including premium puffy stickers, flat labels, and eco-friendly promotional items. Find the perfect match for your branding, packaging, or giveaways.</p>
      </div>
      <div className="page-shell core-categories__grid">
        {coreCategories.map((category) => (
          <SiteLink className="core-category reveal-block" to={category.href} key={category.href} data-cursor="VIEW">
            <div className="core-category__meta"><span>{category.index}</span><span>{category.count}</span></div>
            <div className="core-category__image"><img src={category.image} alt={category.name} loading="lazy" decoding="async" /></div>
            <div className="core-category__copy"><h3>{category.name}</h3><p>{category.text}</p><i><ArrowUpRight /></i></div>
          </SiteLink>
        ))}
      </div>
    </section>
  )
}

function TiltProductCard({ product, index }: { product: Product; index: number }) {
  const card = useRef<HTMLElement>(null)
  const media = useRef<HTMLDivElement>(null)
  const bounds = useRef<DOMRect | null>(null)
  const rotateXTo = useRef<ReturnType<typeof gsap.quickTo> | null>(null)
  const rotateYTo = useRef<ReturnType<typeof gsap.quickTo> | null>(null)
  const enter = () => {
    if (!card.current || !media.current || !window.matchMedia('(pointer: fine)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    bounds.current = card.current.getBoundingClientRect()
    rotateXTo.current ??= gsap.quickTo(media.current, 'rotationX', { duration: 0.3, ease: 'power2.out' })
    rotateYTo.current ??= gsap.quickTo(media.current, 'rotationY', { duration: 0.3, ease: 'power2.out' })
  }
  const onMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (!card.current || !window.matchMedia('(pointer: fine)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (!bounds.current) enter()
    const rect = bounds.current ?? card.current.getBoundingClientRect()
    const rx = ((event.clientY - rect.top) / rect.height - 0.5) * -8
    const ry = ((event.clientX - rect.left) / rect.width - 0.5) * 10
    rotateXTo.current?.(rx)
    rotateYTo.current?.(ry)
    card.current.style.setProperty('--mouse-x', `${((event.clientX - rect.left) / rect.width) * 100}%`)
    card.current.style.setProperty('--mouse-y', `${((event.clientY - rect.top) / rect.height) * 100}%`)
  }
  const onLeave = () => {
    rotateXTo.current?.(0)
    rotateYTo.current?.(0)
    bounds.current = null
  }
  return (
    <article
      ref={card}
      className={`product-card product-card--${index % 3}`}
      onPointerEnter={enter}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      style={{ '--card-accent': product.accent, '--card-ink': product.foreground } as React.CSSProperties}
      data-cursor="OPEN"
    >
      <div className="product-card__shine" />
      <div className="product-card__top">
        <span>{String(index + 1).padStart(2, '0')}</span>
        <span>{product.type}</span>
      </div>
      <div className="product-card__image" ref={media}>
        <SiteLink to={product.href} aria-label={`View ${product.name}`}><img src={product.image} alt={product.name} loading="lazy" decoding="async" /></SiteLink>
      </div>
      <div className="product-card__copy">
        <h3>{product.name}</h3>
        <p>{product.description}</p>
        <span className="product-card__view-label">View product</span>
        <SiteLink to={product.href} aria-label={`Explore ${product.name}`}>
          <ArrowUpRight />
        </SiteLink>
      </div>
    </article>
  )
}

function Collection() {
  return (
    <section className="collection" id="collection">
      <div className="collection__heading page-shell">
        <div className="reveal-block">
          <span className="eyebrow">Featured products · 07 of 21</span>
          <h2>Featured Products – Best-Selling Custom Puffy Stickers & Branded Merchandise</h2>
        </div>
        <div className="collection__aside reveal-block">
          <p>Discover our handpicked collection of featured products, from premium puffy sticker sheets to custom promotional bags. Each item is designed to stand out and showcase your brand in style.</p>
          <SiteLink to="/shop">View all 21 products <ArrowUpRight /></SiteLink>
        </div>
      </div>
      <div className="rail-wrap">
        <div className="product-rail">
          {products.map((product, index) => (
            <TiltProductCard key={product.name} product={product} index={index} />
          ))}
          <SiteLink className="product-rail__end" to="/shop" data-cursor="SHOP">
            <span>There’s more<br />to discover.</span>
            <i><ArrowUpRight /></i>
          </SiteLink>
        </div>
      </div>
      <div className="rail-progress page-shell"><span /></div>
    </section>
  )
}

function Anatomy() {
  const root = useRef<HTMLElement>(null)
  const [exploded, setExploded] = useState(false)

  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        gsap.set('.anatomy-callout', { autoAlpha: 1, x: 0 })
        return
      }
      gsap.to('.anatomy-layer--top', { y: exploded ? -116 : 0, x: exploded ? 35 : 0, rotate: exploded ? 6 : 0, duration: 0.9, ease: 'power4.inOut' })
      gsap.to('.anatomy-layer--foam', { y: exploded ? -34 : 0, x: exploded ? 10 : 0, rotate: exploded ? -3 : 0, duration: 0.9, ease: 'power4.inOut' })
      gsap.to('.anatomy-layer--vinyl', { y: exploded ? 55 : 0, x: exploded ? -12 : 0, rotate: exploded ? 2 : 0, duration: 0.9, ease: 'power4.inOut' })
      gsap.to('.anatomy-layer--adhesive', { y: exploded ? 128 : 0, x: exploded ? -32 : 0, rotate: exploded ? -5 : 0, duration: 0.9, ease: 'power4.inOut' })
      gsap.to('.anatomy-callout', { autoAlpha: exploded ? 1 : 0, x: exploded ? 0 : -16, duration: 0.5, stagger: 0.08, delay: exploded ? 0.4 : 0 })
    },
    { scope: root, dependencies: [exploded], revertOnUpdate: true },
  )

  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      ScrollTrigger.create({
        trigger: root.current,
        start: 'top 48%',
        once: true,
        onEnter: () => setExploded(true),
      })
    },
    { scope: root },
  )

  return (
    <section className="anatomy" id="anatomy" ref={root}>
      <div className="page-shell anatomy__grid">
        <div className="anatomy__copy reveal-block">
          <span className="eyebrow">Inside the feeling</span>
          <h2>Not flat.<br /><em>Engineered.</em></h2>
          <p>
            The signature puffy build pairs printed vinyl with a soft foam center, a durable adhesive and a protective finish.
          </p>
          <button type="button" className="explode-button" onClick={() => setExploded((value) => !value)} data-cursor="POP">
            <span>{exploded ? 'Bring it together' : 'Explode the layers'}</span>
            <i>{exploded ? <Minus /> : <Plus />}</i>
          </button>
        </div>
        <div className={`anatomy-stack ${exploded ? 'anatomy-stack--open' : ''}`}>
          <div className="anatomy-halo" />
          <div className="anatomy-layer anatomy-layer--adhesive"><span>Adhesive</span></div>
          <div className="anatomy-layer anatomy-layer--vinyl"><span>Printed vinyl</span></div>
          <div className="anatomy-layer anatomy-layer--foam"><span>Soft foam</span></div>
          <div className="anatomy-layer anatomy-layer--top">
            <img src="/assets/puff-logo.webp" alt="Puff Sticker layered sample" loading="lazy" decoding="async" />
          </div>
          <div className="anatomy-callout anatomy-callout--one"><i />Protective gloss laminate</div>
          <div className="anatomy-callout anatomy-callout--two"><i />Soft foam core</div>
          <div className="anatomy-callout anatomy-callout--three"><i />Strong, durable adhesive</div>
        </div>
      </div>
    </section>
  )
}

function FinishLab() {
  const [finish, setFinish] = useState('gloss')
  const card = useRef<HTMLDivElement>(null)
  const bounds = useRef<DOMRect | null>(null)
  const rotation = useRef<Array<ReturnType<typeof gsap.quickTo>>>([])
  const current = finishOptions.find((option) => option.id === finish)!
  const enter = () => {
    if (!card.current || !window.matchMedia('(pointer: fine)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    bounds.current = card.current.getBoundingClientRect()
    if (!rotation.current.length) rotation.current = [
      gsap.quickTo(card.current, 'rotationY', { duration: .32, ease: 'power2.out' }),
      gsap.quickTo(card.current, 'rotationX', { duration: .32, ease: 'power2.out' }),
    ]
  }
  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!card.current || !window.matchMedia('(pointer: fine)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (!bounds.current) enter()
    const rect = bounds.current ?? card.current.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width - 0.5
    const y = (event.clientY - rect.top) / rect.height - 0.5
    card.current.style.setProperty('--lab-x', `${(x + 0.5) * 100}%`)
    card.current.style.setProperty('--lab-y', `${(y + 0.5) * 100}%`)
    rotation.current[0]?.(x * 13)
    rotation.current[1]?.(y * -11)
  }
  const leave = () => {
    rotation.current.forEach((setter) => setter(0))
    bounds.current = null
  }

  return (
    <section className="finish-lab" id="finish-lab">
      <div className="page-shell finish-lab__heading reveal-block">
        <span>Surface comparison</span>
        <p>Finish affects reflection, readability and perceived character. Holographic is shown separately because it is a reflective stock, not merely a coating.</p>
      </div>
      <div className="page-shell finish-lab__grid">
        <div className="finish-lab__visual reveal-block">
          <div ref={card} className={`finish-card finish-card--${finish}`} onPointerEnter={enter} onPointerMove={move} onPointerLeave={leave} data-cursor="TILT">
            <div className="finish-card__ambient" />
            <div className="finish-card__top"><span>Interactive sample</span><span>{String(finishOptions.findIndex((option) => option.id === finish) + 1).padStart(2, '0')} / {String(finishOptions.length).padStart(2, '0')}</span></div>
            <div className="finish-card__sticker">
              <img src="/assets/puff-logo.webp" alt="Puff Sticker finish preview" loading="lazy" decoding="async" />
              <div className="finish-card__sheen" />
            </div>
            <div className="finish-card__meta"><span>{current.detail}</span><strong>{current.label}</strong></div>
          </div>
        </div>
        <div className="finish-lab__copy reveal-block">
          <span className="eyebrow">The finish lab</span>
          <h2>Choose the response,<br />not only the shine.</h2>
          <p>Select a surface direction below to compare its visual behavior and best use. On pointer devices, the sample highlight follows your movement.</p>
          <div className="finish-tabs" role="tablist" aria-label="Compare sticker finishes and materials">
            {finishOptions.map((option, index) => (
              <button
                key={option.id}
                type="button"
                className={finish === option.id ? 'is-active' : ''}
                onClick={() => setFinish(option.id)}
                aria-pressed={finish === option.id}
                role="tab"
              >
                <em>{String(index + 1).padStart(2, '0')}</em><span>{option.label}</span><small>{option.detail}</small><i><Check size={16} /></i>
              </button>
            ))}
          </div>
          <div className="finish-profile" key={finish} aria-live="polite">
            <h3>{current.headline}</h3>
            <p>{current.description}</p>
            <div>{current.bestFor.map((item) => <span key={item}>{item}</span>)}</div>
            <small>{current.note}</small>
            <SiteLink to={current.href}>{current.product}<ArrowUpRight /></SiteLink>
          </div>
        </div>
      </div>
    </section>
  )
}

function SamplePack() {
  return (
    <section className="sample-pack" id="sample-pack">
      <div className="page-shell sample-pack__grid">
        <div className="sample-pack__visual reveal-block" data-cursor="FEEL">
          <div className="sample-pack__stage">
            <span className="sample-pack__label">Material sample set</span>
            <div className="sample-pack__specimen sample-pack__specimen--one"><img src="/assets/catalog/puffy-stickers.webp" alt="Puffy sticker sample" loading="lazy" decoding="async" /></div>
            <div className="sample-pack__specimen sample-pack__specimen--two"><img src="/assets/catalog/holographic-stickers.webp" alt="Holographic sticker sample" loading="lazy" decoding="async" /></div>
            <div className="sample-pack__specimen sample-pack__specimen--three"><img src="/assets/catalog/metallic-foil.webp" alt="Metallic foil sticker sample" loading="lazy" decoding="async" /></div>
            <div className="sample-pack__price"><small>Sample pack</small><strong>$45</strong></div>
          </div>
        </div>
        <div className="sample-pack__copy reveal-block">
          <span className="eyebrow">Puffy Sticker Sample Pack – Custom 3D Stickers in Multiple Finishes</span>
          <h2>Approve the material, not just the mockup.</h2>
          <p>Not sure which puffy sticker style will make the biggest impact? Dome Decal, Epoxy Sticker, or a Puffy Sticker Sheet? Our sample pack lets you try different types and finishes before committing to a full order. Feel the raised 3D texture, see the color vibrancy, and test the adhesive quality—so when you’re ready to order, you can choose with complete confidence.</p>
          <div className="sample-pack__checks">
            <span><Check />Compare tactile depth</span>
            <span><Check />Review color and reflection</span>
            <span><Check />Inspect finish quality</span>
            <span><Check />Test the adhesive</span>
          </div>
          <div className="sample-pack__action">
            <SiteLink to="/request-a-quote?product=sample-pack" className="button button--dark" data-cursor="SAMPLE"><span>Request the $45 pack</span><ArrowUpRight /></SiteLink>
            <small>A practical B2B approval step before volume production.</small>
          </div>
        </div>
      </div>
    </section>
  )
}

function ManufacturerDirect() {
  return (
    <section className="manufacturer-direct">
      <div className="page-shell manufacturer-direct__grid">
        <div className="reveal-block">
          <span className="eyebrow eyebrow--light">Direct production · global delivery</span>
          <h2>Manufacturer-Direct Custom Stickers, Mylar Bags & Totes — Shipped Worldwide</h2>
        </div>
        <div className="manufacturer-direct__proof reveal-block">
          <p>PuffSticker manufactures custom puffy stickers, 3D foam labels, mylar bags & pouches, and tote bags in-house. We ship to the USA, Canada, Australia, and 30+ countries with tracked delivery, clear lead times, and no surprise customs fees. Send us your design, and we’ll get you a free quote.</p>
          <div>
            <span><strong>In-house</strong><small>Custom production</small></span>
            <span><strong>30+</strong><small>Countries served</small></span>
            <span><strong>Tracked</strong><small>Worldwide delivery</small></span>
          </div>
          <SiteLink to="/request-a-quote" className="button button--yellow" data-cursor="QUOTE"><span>Send your design</span><ArrowUpRight /></SiteLink>
        </div>
      </div>
    </section>
  )
}

function Process() {
  const steps = [
    {
      number: '01',
      title: 'Find your perfect product',
      text: 'Browse customizable puffy stickers, specialty labels and promotional bags to find the right fit for your purpose and budget.',
      icon: <Sparkles />,
    },
    {
      number: '02',
      title: 'Make it print ready',
      text: 'Upload your design. The team checks the file so colors stay vivid, lines remain sharp and the result matches your vision.',
      icon: <Layers3 />,
    },
    {
      number: '03',
      title: 'Packed and shipped',
      text: 'Once ready, your order is packed with care and sent to your doorstep with tracked worldwide delivery.',
      icon: <PackageCheck />,
    },
  ]
  return (
    <section className="process" id="process">
      <div className="page-shell">
        <div className="section-heading reveal-block">
          <div><span className="eyebrow eyebrow--light">From art to object</span><h2>Three steps.<br />One satisfying result.</h2></div>
          <p>Custom printing made clear, considered and easy.</p>
        </div>
        <div className="process-grid">
          {steps.map((step) => (
            <article className="process-card reveal-block" key={step.number} data-cursor="STEP">
              <div className="process-card__top"><span>{step.number}</span><i>{step.icon}</i></div>
              <div><h3>{step.title}</h3><p>{step.text}</p></div>
              <span className="process-card__line" />
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function GalleryColumns() {
  const columns = useMemo(
    () => [
      ['/assets/epoxy-bunny.webp', '/assets/foam-sheep.webp', '/assets/rainbow-label.webp', '/assets/epoxy-bunny.webp'],
      ['/assets/foil-unicorn.webp', '/assets/dome-donut.webp', '/assets/holographic-skeleton.webp', '/assets/foil-unicorn.webp'],
      ['/assets/bottle-label.webp', '/assets/tote-rainbow.webp', '/assets/cozy-sheet.webp', '/assets/bottle-label.webp'],
    ],
    [],
  )
  return (
    <section className="gallery-columns">
      <div className="gallery-columns__copy">
        <span className="eyebrow eyebrow--light">Made to move people</span>
        <h2>A little depth<br />changes everything.</h2>
        <MagneticLink className="button button--cream" href="/shop">
          View all products <ArrowUpRight size={18} />
        </MagneticLink>
      </div>
      <div className="gallery-columns__mask" aria-hidden="true">
        {columns.map((column, columnIndex) => (
          <div className={`gallery-column gallery-column--${columnIndex + 1}`} key={columnIndex}>
            {column.map((image, imageIndex) => (
              <figure key={`${image}-${imageIndex}`}><img src={image} alt="" loading="lazy" decoding="async" /></figure>
            ))}
          </div>
        ))}
      </div>
      <div className="gallery-columns__wash" />
    </section>
  )
}

function HomeJournal() {
  const [featured, ...notes] = homeJournalPosts
  return (
    <section className="home-journal" id="journal">
      <div className="page-shell home-journal__heading reveal-block">
        <div><span className="eyebrow">The Puff journal</span><h2>Material intelligence.<br /><em>Culture that sticks.</em></h2></div>
        <div><p>Ideas on tactile design, collecting, packaging and the physical details that shape how people remember a brand.</p><SiteLink to="/blog" className="text-link text-link--dark">Explore all stories <ArrowRight /></SiteLink></div>
      </div>
      <div className="page-shell home-journal__grid">
        <article className="home-journal__feature reveal-block">
          <SiteLink to={featured.href} className="home-journal__feature-media" data-cursor="READ">
            <img src={featured.image} alt={featured.title} loading="lazy" decoding="async" />
            <span>Read story <ArrowUpRight /></span>
          </SiteLink>
          <div className="home-journal__feature-copy">
            <span>{featured.category} · {featured.date}</span>
            <SiteLink to={featured.href}><h3>{featured.title}</h3></SiteLink>
            <p>{featured.excerpt}</p>
          </div>
        </article>
        <div className="home-journal__notes">
          {notes.map((post, index) => (
            <article className="home-journal__note reveal-block" key={post.href}>
              <span className="home-journal__index">0{index + 2}</span>
              <SiteLink to={post.href} className="home-journal__note-media" data-cursor="READ"><img src={post.image} alt={post.title} loading="lazy" decoding="async" /></SiteLink>
              <div><span>{post.category} · {post.date}</span><SiteLink to={post.href}><h3>{post.title}</h3></SiteLink><p>{post.excerpt}</p></div>
              <SiteLink to={post.href} className="home-journal__arrow" aria-label={`Read ${post.title}`}><ArrowUpRight /></SiteLink>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function Faq() {
  const [openIndex, setOpenIndex] = useState(0)
  return (
    <section className="faq" id="faq">
      <div className="page-shell faq__grid">
        <div className="faq__heading reveal-block">
          <span className="eyebrow">Good to know</span>
          <h2>Your questions,<br /><em>unpeeled.</em></h2>
          <p>Still curious? The Puff team is happy to help with artwork, materials and custom orders.</p>
          <a href="mailto:info@puffsticker.com" className="text-link text-link--dark" data-cursor="MAIL">info@puffsticker.com <ArrowUpRight size={17} /></a>
        </div>
        <div className="faq-list">
          {faqs.map((item, index) => {
            const isOpen = index === openIndex
            return (
              <div className={`faq-item ${isOpen ? 'faq-item--open' : ''}`} key={item.question}>
                <button type="button" onClick={() => setOpenIndex(isOpen ? -1 : index)} aria-expanded={isOpen} aria-controls={`home-faq-${index}`}>
                  <span><small>0{index + 1}</small>{item.question}</span>
                  <i>{isOpen ? <Minus /> : <Plus />}</i>
                </button>
                <div className="faq-item__answer" id={`home-faq-${index}`} aria-hidden={!isOpen}><div><p>{item.answer}</p></div></div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

type LiveHomeEntry = (typeof import('./content/livePageContent'))['livePageContent']['home']

function PublishedHomeArchive() {
  const [page, setPage] = useState<LiveHomeEntry | null>(null)

  useEffect(() => {
    let active = true
    void import('./content/livePageContent').then(({ livePageContent }) => {
      if (active) setPage(livePageContent.home ?? null)
    })
    return () => { active = false }
  }, [])

  const publishedHtml = useMemo(() => {
    if (!page) return ''
    const documentCopy = new DOMParser().parseFromString(page.html, 'text/html')
    documentCopy.querySelectorAll('img').forEach((image) => image.remove())
    documentCopy.body.childNodes.forEach((node) => {
      if (node.nodeType !== Node.TEXT_NODE || !node.textContent?.trim()) return
      const paragraph = documentCopy.createElement('p')
      paragraph.textContent = node.textContent.replace(/\s+/g, ' ').trim()
      node.replaceWith(paragraph)
    })
    return documentCopy.body.innerHTML
  }, [page])

  return (
    <section className="official-page-source home-published-source">
      <div className="page-shell official-page-source__grid">
        <aside className="reveal-block">
          <span className="eyebrow">Product & ordering guide</span>
          <h2>Everything you need to plan your run.</h2>
          <p>Explore complete product, manufacturing, sample-pack, ordering and material information from PuffSticker.</p>
        </aside>
        {page
          ? <details className="official-page-source__disclosure reveal-block" data-live-loaded="page-home">
            <summary><span><small>Detailed information</small><strong>Open the complete PuffSticker guide</strong></span><i><ArrowDown /></i></summary>
            <div className="official-page-source__content" dangerouslySetInnerHTML={{ __html: publishedHtml }} />
          </details>
          : <div className="official-page-source__pending" data-live-pending="page-home" aria-label="Loading the complete homepage copy"><span /></div>}
      </div>
    </section>
  )
}

function Closing() {
  return (
    <>
      <section className="closing">
        <div className="closing__orbit closing__orbit--one"><img src="/assets/dome-donut.webp" alt="" loading="lazy" decoding="async" /></div>
        <div className="closing__orbit closing__orbit--two"><img src="/assets/rainbow-label.webp" alt="" loading="lazy" decoding="async" /></div>
        <div className="closing__orbit closing__orbit--three"><img src="/assets/foam-sheep.webp" alt="" loading="lazy" decoding="async" /></div>
        <div className="closing__content page-shell reveal-block">
          <span className="eyebrow eyebrow--light">Your idea, with dimension</span>
          <h2><span>READY TO</span><strong>GO PUFFY?</strong></h2>
          <p>Send your design and get a free quote from the team that has been making puffy stickers since 2007.</p>
          <MagneticLink className="closing__button" href="/request-a-quote">
            <span>Start your project</span><i><ArrowUpRight /></i>
          </MagneticLink>
        </div>
      </section>
      <footer className="footer">
        <div className="page-shell">
          <div className="footer__top">
            <SiteLink className="footer__brand" to="/"><img src="/assets/puff-logo.webp" alt="Puff Sticker" loading="lazy" decoding="async" /></SiteLink>
            <p>High-quality custom puffy stickers, flat labels and custom tote bags — crafted for durability and designed to stand out.</p>
            <a href="mailto:info@puffsticker.com" className="footer__mail">info@puffsticker.com <ArrowUpRight /></a>
          </div>
          <div className="footer__links">
            <div><span>Explore</span><SiteLink to="/shop">Shop</SiteLink><SiteLink to="/about-us">About</SiteLink><SiteLink to="/blog">The Puff Blog</SiteLink></div>
            <div><span>Help</span><SiteLink to="/faqs">FAQs</SiteLink><SiteLink to="/contact-us">Contact</SiteLink><SiteLink to="/request-a-quote">Request a quote</SiteLink></div>
            <div><span>Visit</span><p>Apt 325<br />3433 Mission Bay Boulevard<br />Orlando, FL 32817</p></div>
            <div><span>Hours</span><p>Mon — Fri<br />09:00 — 17:00 EST<br />Weekends closed</p></div>
          </div>
          <div className="footer__bottom"><span>A Project by ATZ Technology INC. © 2026 PuffSticker.com</span><span>Custom made. Shipped worldwide.</span><BackToTop /></div>
        </div>
      </footer>
    </>
  )
}

function HomePage() {
  return (
    <>
      <Hero ready />
      <Marquee />
      <Story />
      <CoreCategories />
      <Collection />
      <Anatomy />
      <FinishLab />
      <SamplePack />
      <ManufacturerDirect />
      <Process />
      <GalleryColumns />
      <HomeJournal />
      <Faq />
      <PublishedHomeArchive />
      <Closing />
    </>
  )
}

function RouteContent({ pathname }: { pathname: string }) {
  const parts = pathname.split('/').filter(Boolean)
  const first = parts[0]
  if (!first) return <HomePage />
  if (first === 'shop') return <ShopPage />
  if (first === 'category' && parts[1]) return <CategoryPage slug={parts[1]} />
  if (first === 'product' && parts[1]) return <ProductPage slug={parts[1]} />
  if (first && categoryPaths.has(first)) return parts[1] ? <ProductPage slug={parts[1]} category={first} /> : <CategoryPage slug={first} />
  if (first === 'about-us' || first === 'about') return <AboutPage />
  if (first === 'faqs' || first === 'faq') return <FullFaqPage />
  if (first === 'contact-us' || first === 'contact') return <ContactPage />
  if (first === 'request-a-quote' || first === 'quote') return <QuotePage />
  if (first === 'blog') return parts[1] === 'category' && parts[2]
    ? <BlogPage key={parts[2]} categorySlug={parts[2]} />
    : parts[1] ? <BlogArticlePage slug={parts[1]} /> : <BlogPage key="all" />
  if (first === 'resources') return <ResourcesPage />
  if (['reprint-policy', 'privacy-policy', 'terms-of-service', 'shipping-delivery'].includes(first)) return <PolicyPage slug={first} />
  return <NotFoundPage />
}

function App() {
  const app = useRef<HTMLDivElement>(null)
  const { pathname, search, hash, revision } = useRouter()
  const [saveData, setSaveData] = useState(() => Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData))
  const [showIntro, setShowIntro] = useState(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const seen = window.sessionStorage.getItem('puff-intro-seen') === '1'
    return !reduce && !seen
  })

  useEffect(() => {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; addEventListener?: (type: string, listener: () => void) => void; removeEventListener?: (type: string, listener: () => void) => void } }).connection
    const update = () => {
      const enabled = Boolean(connection?.saveData)
      setSaveData(enabled)
      document.documentElement.classList.toggle('save-data', enabled)
    }
    update()
    connection?.addEventListener?.('change', update)
    return () => {
      connection?.removeEventListener?.('change', update)
      document.documentElement.classList.remove('save-data')
    }
  }, [])

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const fine = window.matchMedia('(pointer: fine)').matches
    const saveData = Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData)
    if (reduce || !fine || saveData) return
    const lenis = new Lenis({
      duration: 0.95,
      smoothWheel: true,
      wheelMultiplier: 0.88,
    })
    lenis.on('scroll', ScrollTrigger.update)
    let frame = 0
    const raf = (time: number) => {
      lenis.raf(time)
      frame = requestAnimationFrame(raf)
    }
    const updateVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(frame)
        frame = 0
      } else if (!frame) {
        frame = requestAnimationFrame(raf)
      }
    }
    updateVisibility()
    document.addEventListener('visibilitychange', updateVisibility)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('visibilitychange', updateVisibility)
      lenis.destroy()
    }
  }, [pathname])

  useEffect(() => {
    if (showIntro) window.sessionStorage.setItem('puff-intro-seen', '1')
  }, [showIntro])

  useEffect(() => {
    let active = true
    void import('./content/siteSeo').then(({ resolveRouteSeo }) => {
      if (!active) return
      const seo = resolveRouteSeo(pathname)
      document.title = seo.title

      const setMeta = (attribute: 'name' | 'property', key: string, value: string | null) => {
        let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`)
        if (!value) {
          element?.remove()
          return
        }
        if (!element) {
          element = document.createElement('meta')
          element.setAttribute(attribute, key)
          document.head.appendChild(element)
        }
        element.content = value
      }

      let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
      if (!canonical) {
        canonical = document.createElement('link')
        canonical.rel = 'canonical'
        document.head.appendChild(canonical)
      }
      canonical.href = seo.canonical

      const image = seo.openGraphImage
      const description = seo.metaDescription
      setMeta('name', 'description', description)
      setMeta('name', 'robots', seo.robots)
      setMeta('property', 'og:title', seo.openGraphTitle ?? seo.title)
      setMeta('property', 'og:description', seo.openGraphDescription ?? description)
      setMeta('property', 'og:image', image)
      setMeta('property', 'og:url', seo.canonical)
      setMeta('property', 'og:type', seo.openGraphType ?? 'website')
      setMeta('name', 'twitter:card', image ? 'summary_large_image' : 'summary')
      setMeta('name', 'twitter:title', seo.openGraphTitle ?? seo.title)
      setMeta('name', 'twitter:description', seo.openGraphDescription ?? description)
      setMeta('name', 'twitter:image', image)

      document.getElementById('puff-structured-data')?.remove()
      if (seo.structuredData.length) {
        const script = document.createElement('script')
        script.id = 'puff-structured-data'
        script.type = 'application/ld+json'
        script.textContent = JSON.stringify(seo.structuredData)
        document.head.appendChild(script)
      }
    })

    const scroll = window.setTimeout(() => {
      if (hash) {
        let id = hash.slice(1)
        try { id = decodeURIComponent(id) } catch { /* retain the literal hash */ }
        const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
        document.getElementById(id)?.scrollIntoView({ behavior, block: 'start' })
      } else {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
        document.getElementById('main-content')?.focus({ preventScroll: true })
      }
      void document.fonts.ready.then(() => ScrollTrigger.refresh())
    }, 40)
    return () => {
      active = false
      window.clearTimeout(scroll)
    }
  }, [pathname, hash, revision])

  useGSAP(
    () => {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (reduced) {
        gsap.set('.reveal-block', { opacity: 1, y: 0 })
        return
      }

      gsap.fromTo('#main-content', { autoAlpha: 0.72 }, { autoAlpha: 1, duration: 0.36, ease: 'power2.out', clearProps: 'opacity,visibility' })

      gsap.to('.scroll-progress span', {
        scaleX: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: document.documentElement,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.2,
        },
      })

      ScrollTrigger.batch('.reveal-block', {
        start: 'top 90%',
        once: true,
        onEnter: (batch) => gsap.fromTo(batch, { y: 42, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.72, stagger: 0.06, ease: 'power3.out', overwrite: true }),
      })

      gsap.utils.toArray<HTMLElement>('.page-hero__shape, .category-hero__media i, .about-global__orb').forEach((shape, index) => {
        gsap.to(shape, {
          yPercent: index % 2 ? -18 : 16,
          rotate: index % 2 ? -12 : 10,
          ease: 'none',
          scrollTrigger: { trigger: shape.closest('section') ?? shape, start: 'top bottom', end: 'bottom top', scrub: 1.1 },
        })
      })

      gsap.utils.toArray<HTMLElement>('.catalog-card__media img, .blog-card__media img, .blog-feature__media img, .article-page__hero img, .product-applications__media img, .faq-page-visuals img, .faq-page-contact__media img').forEach((image) => {
        gsap.fromTo(image, { yPercent: -4, scale: 1.06 }, {
          yPercent: 4,
          scale: 1,
          ease: 'none',
          scrollTrigger: { trigger: image.parentElement ?? image, start: 'top bottom', end: 'bottom top', scrub: .9 },
        })
      })

      if (pathname !== '/') return

      const clipImage = document.querySelector('.clip-reveal img')
      if (clipImage) gsap.fromTo(clipImage, { scale: 1.18 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: '.clip-reveal', start: 'top bottom', end: 'bottom top', scrub: 1 } })
      if (document.querySelector('.parallax-orb')) gsap.to('.parallax-orb', { yPercent: -28, rotate: 14, ease: 'none', scrollTrigger: { trigger: '.story-stage', start: 'top bottom', end: 'bottom top', scrub: 1.2 } })

      const mm = gsap.matchMedia()
      mm.add('(min-width: 901px)', () => {
        const rail = document.querySelector<HTMLElement>('.product-rail')
        const wrap = document.querySelector<HTMLElement>('.rail-wrap')
        if (!rail || !wrap) return
        const distance = () => Math.max(0, rail.scrollWidth - window.innerWidth + window.innerWidth * 0.08)
        const railTween = gsap.to(rail, {
          x: () => -distance(),
          ease: 'none',
          scrollTrigger: {
            trigger: wrap,
            start: 'top top',
            end: () => `+=${Math.min(distance() + window.innerHeight * 0.45, window.innerWidth * 2.6)}`,
            scrub: 1,
            pin: true,
            invalidateOnRefresh: true,
            anticipatePin: 1,
            onUpdate: (self) => gsap.set('.rail-progress span', { scaleX: self.progress }),
          },
        })
        gsap.utils.toArray<HTMLElement>('.product-card').forEach((card) => {
          gsap.fromTo(card, { rotateY: 12, scale: 0.88 }, {
            rotateY: -8,
            scale: 1,
            ease: 'none',
            scrollTrigger: { trigger: card, containerAnimation: railTween, start: 'left right', end: 'right left', scrub: true },
          })
        })
      })

      const gallery = document.querySelector('.gallery-columns')
      if (gallery) {
        const galleryTimeline = gsap.timeline({ scrollTrigger: { trigger: gallery, start: 'top bottom', end: 'bottom top', scrub: 1 } })
        galleryTimeline.to('.gallery-column--1', { yPercent: -24, ease: 'none' }, 0).fromTo('.gallery-column--2', { yPercent: -20 }, { yPercent: 7, ease: 'none' }, 0).to('.gallery-column--3', { yPercent: -30, ease: 'none' }, 0)
      }

      if (document.querySelector('.closing')) {
        const closingTimeline = gsap.timeline({ scrollTrigger: { trigger: '.closing', start: 'top bottom', end: 'bottom top', scrub: 1 } })
        closingTimeline.to('.closing__orbit--one', { xPercent: -42, yPercent: 72, rotate: -44, ease: 'none' }, 0).to('.closing__orbit--two', { xPercent: 40, yPercent: -58, rotate: 52, ease: 'none' }, 0).to('.closing__orbit--three', { xPercent: -18, yPercent: -40, rotate: -26, ease: 'none' }, 0)
      }

      return () => mm.revert()
    },
    { scope: app, dependencies: [pathname], revertOnUpdate: true },
  )

  return (
    <div className="app" ref={app}>
      {showIntro && <Loader onComplete={() => setShowIntro(false)} />}
      {!saveData && !window.matchMedia('(prefers-reduced-motion: reduce)').matches && <Cursor />}
      <div className="scroll-progress" aria-hidden="true"><span /></div>
      <Header />
      <main id="main-content" tabIndex={-1}>
        <Suspense fallback={<div className="route-fallback" aria-label="Loading page"><span /></div>}>
          <RouteContent key={`${pathname}${search}`} pathname={pathname} />
        </Suspense>
      </main>
    </div>
  )
}

export default App
