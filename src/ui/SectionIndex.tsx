import { useEffect, useRef } from 'react'
import styles from './SectionIndex.module.css'

/*
The section index of a long screen.

`Segmented` looks like it and **is not**, and confusing the two is what the design
itself warned against: "the same shape in the same place would be two
indistinguishable things". The difference is not one of appearance but of what
happens to the screen:

  · `Segmented` **chooses a value**: it changes what you see, and what was there
    stops being there. That is why it is announced with `aria-selected` or
    `aria-pressed`.
  · `SectionIndex` **changes nothing, it moves the wheel**. The ten sections of
    `Settings › General` are all still there before and after pressing; the only
    thing that moves is the point of the page you are looking at.

Everything else follows from that without having to be decided:

  · They are **links**, not buttons. An `href="#section"` navigates and scrolls,
    which is exactly what this does and nothing more. And it comes with focus, the
    keyboard, "open in another tab" and a copyable link already in place: there is
    nothing to reimplement and therefore nothing to reimplement badly.
  · The active one carries **`aria-current="location"`**, not `aria-selected`. It
    is the difference said out loud: `selected` asserts you have chosen one of
    several exclusive options; `location` says where you are inside something that
    is still whole.

## What it does NOT do, deliberately

**It does not watch the scroll.** `active` comes in as a prop. Who works it out (an
`IntersectionObserver`, the URL hash, the pane that draws it) is screen wiring and
belongs to the screen. Bringing it in here, the primitive would start having an
opinion about its caller's DOM, and would stop being testable without mounting the
whole screen.

**It does scroll ITSELF, sideways, and only itself.** As a strip wider than the
screen, the entry `active` names can be out of sight to the right; when `active`
changes, the strip rolls to bring it into view (centred), with `scrollTo` on the
strip and never `scrollIntoView`, which would move the page too. Instantly when the
reader asks for reduced motion. A column, or a strip that fits, does not move.

**It hides nothing and owns no content.** It takes no children, draws no panels and
marks nothing as `hidden`. If it ever did, it would be `Segmented` under another
name.
*/
export function SectionIndex({
  sections,
  active,
  label = 'On this page',
  strip = false,
}: {
  /** The sections, in the order they appear on the page. */
  sections: { id: string; label: string }[]
  /** The `id` of the section you are in. Without it, none is marked. */
  active?: string
  /** The index's name, for whoever cannot see the screen. */
  label?: string
  /*
  Always the strip, whatever the window. Without it the index is a column above
  `--bp-index` and a strip below, which suits a screen whose content does not care
  how wide the column is (Permissions). A dense form does care: its control column
  is what the index's column would come out of, so it decides by its own width and
  asks for the strip where the column does not fit (`ui/IndexedForm`).
  */
  strip?: boolean
}) {
  const box = useRef<HTMLElement>(null)
  useEffect(() => {
    const nav = box.current
    if (nav == null || active == null || nav.scrollWidth <= nav.clientWidth) return
    const link = nav.querySelector<HTMLElement>('[aria-current="location"]')
    if (link == null || typeof nav.scrollTo !== 'function') return
    const left = link.getBoundingClientRect().left - nav.getBoundingClientRect().left + nav.scrollLeft
    const right = left + link.offsetWidth
    if (left >= nav.scrollLeft && right <= nav.scrollLeft + nav.clientWidth) return
    nav.scrollTo({ left: left - (nav.clientWidth - link.offsetWidth) / 2, behavior: reducedMotion() ? 'auto' : 'smooth' })
  }, [active])

  return (
    <nav ref={box} className={strip ? `${styles.index} ${styles.strip}` : styles.index} aria-label={label}>
      <ul className={styles.list}>
        {sections.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              className={styles.item}
          /* Only on the active one: an `aria-current="false"` on the other nine
             is noise that some readers go as far as announcing. */
              aria-current={s.id === active ? 'location' : undefined}
            >
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/** `prefers-reduced-motion`, read when needed; no `matchMedia` (the tests) means no. */
function reducedMotion(): boolean {
  try {
    return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}
