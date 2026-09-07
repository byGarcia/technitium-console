/*
Where the bubble goes. A pure function on purpose.

It lived inside `Tooltip` as four lines of arithmetic plus a CSS `transform`, and
that combination could not be tested: jsdom has no layout, so every rect is zeros,
and the half that decided the real position was a `translate()` in a stylesheet.
The result was a tooltip that walked off the screen at 390 px and near any edge,
with nothing to catch it.

So the arithmetic comes out here, takes numbers and returns numbers, and the
stylesheet no longer decides anything: **there is no `transform`**. The component
just paints `top` and `left`.

Three jobs, in this order, and the order matters:

  1. **Place** it on the asked-for side.
  2. **Flip** it to the opposite side if that side does not fit. Flipping beats
     clamping here: a bubble squashed against the right edge covers the very
     control it describes.
  3. **Clamp** whatever is left into the viewport, with a margin. After a flip
     there can still be overflow on the other axis —a tall bubble beside a
     control at the top of the screen— and that is what clamping is for.

`margin` is not decoration: at 390 px a bubble flush against the edge reads as
cut off, and the console's own gutter is 8.
*/

export interface Rect {
  top: number
  left: number
  width: number
  height: number
}

export type Placement = 'right' | 'left' | 'top' | 'bottom'

export interface Placed {
  top: number
  left: number
  /** Where it ACTUALLY ended up. It may not be what was asked for. */
  placement: Placement
}

const opposite: Record<Placement, Placement> = {
  right: 'left',
  left: 'right',
  top: 'bottom',
  bottom: 'top',
}

/** Top-left corner of the bubble for a given side, with no clamping yet. */
function corner(t: Rect, b: Rect, side: Placement, gap: number): { top: number; left: number } {
  switch (side) {
    case 'right':
      return { left: t.left + t.width + gap, top: t.top + t.height / 2 - b.height / 2 }
    case 'left':
      return { left: t.left - gap - b.width, top: t.top + t.height / 2 - b.height / 2 }
    case 'top':
      return { left: t.left + t.width / 2 - b.width / 2, top: t.top - gap - b.height }
    case 'bottom':
      return { left: t.left + t.width / 2 - b.width / 2, top: t.top + t.height + gap }
  }
}

/** Does this corner keep the bubble fully inside, on the axis the side moves along? */
function fits(c: { top: number; left: number }, b: Rect, v: Rect, side: Placement, margin: number) {
  return side === 'right' || side === 'left'
    ? c.left >= margin && c.left + b.width <= v.width - margin
    : c.top >= margin && c.top + b.height <= v.height - margin
}

export function place({
  trigger,
  bubble,
  viewport,
  placement = 'right',
  gap = 8,
  margin = 8,
}: {
  trigger: Rect
  bubble: Rect
  viewport: Rect
  placement?: Placement
  gap?: number
  margin?: number
}): Placed {
  let side = placement
  let c = corner(trigger, bubble, side, gap)

  /* Flip only if the other side is genuinely better: flipping into an equally bad
     spot just moves the problem and makes the bubble jump around as you scroll. */
  if (!fits(c, bubble, viewport, side, margin)) {
    const other = opposite[side]
    const alt = corner(trigger, bubble, other, gap)
    if (fits(alt, bubble, viewport, other, margin)) {
      side = other
      c = alt
    }
  }

  /* And clamp both axes regardless. `Math.max` last so that a bubble taller than
     the viewport starts at the margin instead of at a negative offset: better cut
     off at the bottom, where there is scroll, than at the top, where there is not. */
  const left = Math.max(margin, Math.min(c.left, viewport.width - margin - bubble.width))
  const top = Math.max(margin, Math.min(c.top, viewport.height - margin - bubble.height))

  return { top, left, placement: side }
}
