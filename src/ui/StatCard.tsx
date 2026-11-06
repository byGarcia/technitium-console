import { useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useTooltip } from './Tooltip'
import { useCountUp } from './useCountUp'
import styles from './StatCard.module.css'

/*
CARDS THAT SAY WHAT A SCREEN HOLDS (2026-11-05, first drawn for Zones and shared
since 2026-11-06 by Cache, Apps, DNS Client and DHCP). A card carries its series
colour as a bar inside its left edge, a big figure that counts up once, and the
bar of segments that shows how the whole splits. `statStyles` are the classes the
content of such a card uses (the figure, the facts, the type chips, the meter), so
every screen draws the same object the same way.
*/
export { styles as statStyles }

/** A card with its series colour as a straight bar inside its left edge, the way
 *  the Dashboard's figures carry theirs. */
export function Card({
  title,
  colour,
  className,
  children,
}: {
  title: string
  colour: string
  /** The screen's own placing of the cell in its strip (the Clients page's wide one). */
  className?: string
  children: ReactNode
}) {
  return (
    <section className={className != null ? `${styles.card} ${className}` : styles.card} style={{ '--tc': colour } as CSSProperties}>
      <h2 className={styles.cardTitle}>
        {title}
      </h2>
      {children}
    </section>
  )
}

/** A big figure, which counts up once as its card comes in (`ui/useCountUp`). */
export function Count({ value }: { value: number }) {
  return <>{useCountUp(value)}</>
}

export interface Part {
  key: string
  /** The words the screen already writes for it: `A`, `Primary`, `Enabled`. */
  name: string
  value: number
  colour: string
}

/*
How a whole splits, as one bar of coloured segments.

Each segment shows its own words in the tooltip, `A 4` or `Enabled 12`: the same
text its chip or its fact already writes, and the bar's `aria-label` already
says, so nothing new is read. A segment is not a tab stop (the bar is one image to
a reader, and the chips beside it are the keyboard's way to the same types), so
its bubble is drawn for the pointer and the eye (`describe: false`).

`hot` is the type lit from outside, by hovering or focusing its chip; a segment
under the pointer lights itself. Either way the others dim a little, so the eye
goes from the chip to its share of the bar.
*/
export function StackBar({
  parts,
  label,
  hot = null,
  onHot,
}: {
  parts: Part[]
  label: string
  hot?: string | null
  onHot?: (key: string | null) => void
}) {
  const [own, setOwn] = useState<string | null>(null)
  const total = parts.reduce((n, p) => n + p.value, 0)
  if (total === 0) return null
  const lit = own ?? hot
  const light = (key: string | null) => {
    setOwn(key)
    onHot?.(key)
  }
  return (
    <div className={styles.stack} role="img" aria-label={label} data-hot={lit != null || undefined}>
      {parts
        .filter((p) => p.value > 0)
        .map((p) => (
          <Segment key={p.key} part={p} lit={lit === p.key} onHot={light} />
        ))}
    </div>
  )
}

function Segment({ part, lit, onHot }: { part: Part; lit: boolean; onHot: (key: string | null) => void }) {
  const ref = useRef<HTMLSpanElement>(null)
  const tip = useTooltip({ text: `${part.name} ${part.value}`, placement: 'top', anchor: ref, describe: false })
  return (
    <span
      ref={ref}
      className={styles.segment}
      data-hot={lit || undefined}
      style={{ flexGrow: part.value, background: part.colour }}
      onMouseEnter={() => { tip.events.onMouseEnter(); onHot(part.key) }}
      onMouseLeave={() => { tip.events.onMouseLeave(); onHot(null) }}
    >
      {tip.bubble}
    </span>
  )
}

/** The chips' side of `hot`: hovering or focusing a chip lights its segment. */
export function hotEvents(key: string, setHot: (key: string | null) => void) {
  return {
    onMouseEnter: () => setHot(key),
    onMouseLeave: () => setHot(null),
    onFocus: () => setHot(key),
    onBlur: () => setHot(null),
  }
}
