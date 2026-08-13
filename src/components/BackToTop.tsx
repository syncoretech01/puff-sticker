import { ArrowUp } from 'lucide-react'
import gsap from 'gsap'

export function BackToTop({ className = '' }: { className?: string }) {
  const scrollToTop = () => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const focusMain = () => document.getElementById('main-content')?.focus({ preventScroll: true })
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}`)
    if (reduced || window.scrollY < 2) {
      window.scrollTo(0, 0)
      focusMain()
      return
    }
    const position = { y: window.scrollY }
    gsap.to(position, {
      y: 0,
      duration: .82,
      ease: 'power3.inOut',
      overwrite: true,
      onUpdate: () => window.scrollTo(0, position.y),
      onComplete: focusMain,
    })
  }

  return (
    <button type="button" className={`back-to-top ${className}`.trim()} onClick={scrollToTop} aria-label="Back to top">
      <span>Back to top</span>
      <i><ArrowUp aria-hidden="true" /></i>
    </button>
  )
}
