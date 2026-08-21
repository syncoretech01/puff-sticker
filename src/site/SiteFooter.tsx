import { ArrowUpRight } from 'lucide-react'

import { BackToTop } from '../components/BackToTop'
import { categories, type CategorySlug } from '../content/catalog'
import { SiteLink } from '../router'

const categoryOrder: CategorySlug[] = ['puffy-labels-stickers', 'flat-labels-stickers', 'promotional-items']

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="page-shell site-footer__lead">
        <SiteLink to="/" className="site-footer__logo" aria-label="Puff Sticker home">
          <img src="/assets/puff-logo.webp" alt="Puff Sticker" />
        </SiteLink>
        <h2>Make the next touchpoint <em>feel</em> different.</h2>
        <SiteLink to="/request-a-quote" className="site-footer__project" data-cursor="START">
          Start a project <ArrowUpRight />
        </SiteLink>
      </div>
      <div className="page-shell site-footer__grid">
        <div>
          <span>Products</span>
          <SiteLink to="/shop">All products</SiteLink>
          {categoryOrder.map((slug) => <SiteLink to={categories[slug].href} key={slug}>{categories[slug].shortName}</SiteLink>)}
        </div>
        <div>
          <span>Company</span>
          <SiteLink to="/about-us">About Puff</SiteLink>
          <SiteLink to="/blog">The Puff Blog</SiteLink>
          <SiteLink to="/contact-us">Contact</SiteLink>
          <SiteLink to="/request-a-quote">Request a quote</SiteLink>
        </div>
        <div>
          <span>Resources</span>
          <SiteLink to="/faqs">Frequently asked</SiteLink>
          <SiteLink to="/shipping-delivery">Shipping & delivery</SiteLink>
          <SiteLink to="/reprint-policy">Refund & reprint</SiteLink>
          <SiteLink to="/privacy-policy">Privacy</SiteLink>
          <SiteLink to="/terms-of-service">Terms</SiteLink>
        </div>
        <div>
          <span>Sales & support</span>
          <a href="mailto:sales@puffsticker.com">sales@puffsticker.com</a>
          <a href="tel:+14079234382">(407) 923-4382</a>
          <p>Mon–Fri · 09:00–17:00 EST<br />Orlando, Florida</p>
        </div>
      </div>
      <div className="page-shell site-footer__bottom">
        <span>A Project by ATZ Technology INC. © 2026 PuffSticker.com</span>
        <span>Custom made · Shipped worldwide</span>
        <BackToTop />
      </div>
    </footer>
  )
}
