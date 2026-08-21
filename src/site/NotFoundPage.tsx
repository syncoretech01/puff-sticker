import { ArrowRight } from 'lucide-react'

import { SiteLink } from '../router'
import { SiteFooter } from './SiteFooter'

export function NotFoundPage() {
  return (
    <>
      <section className="not-found"><div className="not-found__sticker"><span>404</span></div><div><span className="eyebrow eyebrow--light">This one did not stick</span><h1>Page not found.</h1><p>The route may have moved. The full catalog and project tools are still close by.</p><div><SiteLink to="/shop" className="page-button page-button--yellow">Explore products <ArrowRight /></SiteLink><SiteLink to="/" className="page-text-link page-text-link--light">Back home</SiteLink></div></div></section>
      <SiteFooter />
    </>
  )
}
