import { cloneElement, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { ReactElement, ReactNode, RefObject } from 'react'
import { place, type Placed, type Placement } from './tooltip-place'
import styles from './Tooltip.module.css'

/*
The label that appears beside something that already has a name.

It exists because TWO of the console's design rules depend on it and there was
nothing in `ui/`: the 60 px rail shows only icons, and without the label on hover
it is twelve pictures with no names; and the padlock on a disabled control has to
say WHICH permission is missing (`Requires Cache: Delete`) and not merely that one
is.

## The three conditions, which are not decoration

They are design rules, and they are what the tests below hold:

  · **It never replaces the accessible name.** What it adds is
    `aria-describedby`, which DESCRIBES; the name goes on the trigger and stays
    there. A tooltip that carried the name would make the control nameless the
    moment the pointer left (and, for anyone who never uses a pointer, always).
  · **Focus and pointer, not just pointer.** A rail that only answers the mouse is
    a rail that does not work with a keyboard. `onFocus`/`onBlur` are React
    synthetic events and they BUBBLE, so putting them on the wrapper catches the
    trigger's focus without the trigger having to cooperate.
  · **The text already exists.** This component does not compose sentences: it
    repeats the icon's label, or the permission the button needs. Two wordings for
    one control is how a console ends up with two truths.

## Three defects it shipped with, and what each one taught

They were found in review, before this was wired to anything:

  · **It clobbered an existing `aria-describedby`.** Cloning with the bubble's id
    threw away whatever the trigger already had; a control described by its own
    help text lost that description the moment you pointed at it. It now
    CONCATENATES (that attribute is a space-separated id list, and always was)
    and the original comes back untouched on close.
  · **Pointer and focus did not compose.** They were one boolean, so leaving with
    the mouse closed a bubble the keyboard still had open, and blurring closed one
    the pointer was still over. They are two independent causes now: it stays open
    while EITHER holds. Anything else is a bubble that vanishes under your cursor.
  · **It walked off the screen**, especially at 390 and near any edge. The
    arithmetic is out in `tooltip-place.ts` as a pure function that flips and then
    clamps, and it is tested with numbers instead of with a DOM that has no
    layout.

## Why it is `position: fixed`

The same reason as `ui/Menu` and `ui/Select`, and it is not a preference: an
absolutely positioned bubble gets clipped by any ancestor with `overflow`, and in
this console there are two on the way (the actions group, which hides its corners,
and the table wrapper, which scrolls horizontally). Measured from the trigger's
rect and painted fixed, nothing can clip it.

It closes on Escape, on blur and on pointer-out; it does not need to close on an
outside click, because it never takes the pointer.
*/
/*
## The hook, for a trigger that cannot take a wrapper

`useTooltip` is the same machine without the `<span>`, for the three places where
one more element would be wrong: the `⋮` menu trigger, whose group styles reach
exactly one level down (`ui/Table.module.css`, `.actions > * > button`); a stacked
bar's segment, which is a flex item sized by its own `flex-grow`; and a fact in a
`<dl>`, where a `<span>` between the `div` and its `dt`/`dd` is not valid HTML.
The caller puts `events` on the trigger, `describedBy()` on whatever is described,
and `bubble` anywhere inside the trigger's own tree (it is `position: fixed`, so
where it sits in the DOM does not move it). The two-cause rule, Escape, scroll and
the placement are this one code path for both.

## `describe`, and when it is false

By default the bubble DESCRIBES its trigger. When its text is the trigger's own
name (an icon's label: `Edit Record`, `Next`), describing it would make a screen
reader say the name twice, "Edit Record, button, Edit Record", on every row. Then
`describe={false}`: the bubble is drawn for the eye only (`aria-hidden`) and the
name stays where it already was, in `aria-label`.
*/
export function useTooltip({
  text,
  placement = 'right',
  anchor,
  describe = true,
  off = false,
}: {
  text: ReactNode
  placement?: Placement
  /** What the bubble is measured against: the trigger's box. */
  anchor: RefObject<HTMLElement | null>
  /** False when the text is the trigger's own name: see above. */
  describe?: boolean
  /** Kept shut while true: a menu trigger while its menu is open. */
  off?: boolean
}) {
  const id = useId()
  /* Two causes, not one: the pointer and the focus leave independently. */
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const open = (hovered || focused) && !off
  const [box, setBox] = useState<Placed | null>(null)
  const bubble = useRef<HTMLSpanElement>(null)

  /*
  Two passes, and they are needed: to place the bubble you have to know how big it
  is, and to measure it you have to have drawn it. It is drawn with no position
  (invisible, so it does not jump) and placed as soon as it is measured. The text
  is a dependency because it can change while open (`Disable Record` becomes
  `Enable Record` under the pointer) and a longer text is a wider bubble.

  It is measured at the viewport's corner, never where it happens to be. A fixed
  box shrinks to the room between its left edge and the window's, so measured
  beside a row's last action (`Actions for 0.30.172.in-addr.arpa`) it came out
  102 px wide and three lines tall, and was then placed with that shape.
  */
  useLayoutEffect(() => {
    if (!open || !anchor.current || !bubble.current) return
    const t = anchor.current.getBoundingClientRect()
    bubble.current.style.top = '0px'
    bubble.current.style.left = '0px'
    const b = bubble.current.getBoundingClientRect()
    const placed = place({
      trigger: { top: t.top, left: t.left, width: t.width, height: t.height },
      bubble: { top: 0, left: 0, width: b.width, height: b.height },
      viewport: { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight },
      placement,
    })
    /* Put back by hand as well: if the place is the one it already had, React
       sees no change in `style` and would leave it at the corner. */
    bubble.current.style.top = `${placed.top}px`
    bubble.current.style.left = `${placed.left}px`
    setBox(placed)
  }, [open, placement, anchor, text])

  /* On closing it forgets the position: if it were kept, the next opening would
     draw one frame in last time's place. */
  useEffect(() => {
    if (!open) setBox(null)
  }, [open])

  useEffect(() => {
    if (!open) return
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setHovered(false); setFocused(false) }
    }
    /* Scroll moves the trigger and the bubble would stay behind, exactly as in
       `ui/Menu`. Capture, so it also catches a scrolling container. */
    const away = () => { setHovered(false); setFocused(false) }
    document.addEventListener('keydown', escape)
    window.addEventListener('scroll', away, true)
    window.addEventListener('resize', away)
    return () => {
      document.removeEventListener('keydown', escape)
      window.removeEventListener('scroll', away, true)
      window.removeEventListener('resize', away)
    }
  }, [open])

  return {
    open,
    /** For the trigger (or the wrapper that is its box). */
    events: {
      onMouseEnter: () => setHovered(true),
      onMouseLeave: () => setHovered(false),
      onFocus: () => setFocused(true),
      onBlur: () => setFocused(false),
    },
    /*
    `aria-describedby` is a LIST of ids separated by spaces, and always was: that
    is why it is concatenated rather than assigned. A control already described by
    its own help lost that description the moment you pointed at it.

    And only while the bubble exists: pointing at a node that is not in the DOM
    describes nothing, and some readers announce the dangling id. Closed, the
    original comes back intact.
    */
    describedBy: (previous?: string): string | undefined =>
      open && describe ? [previous, id].filter(Boolean).join(' ') : previous,
    bubble: open ? (
      <span
        ref={bubble}
        id={id}
        role="tooltip"
        aria-hidden={describe ? undefined : true}
        className={styles.bubble}
        data-placement={box?.placement ?? placement}
        style={box ? { top: box.top, left: box.left } : { top: 0, left: 0, visibility: 'hidden' }}
      >
        {text}
      </span>
    ) : null,
  }
}

export function Tooltip({
  text,
  placement = 'right',
  describe = true,
  children,
}: {
  /** The text that already exists somewhere else: the icon's label, the missing permission. */
  text: ReactNode
  /** Which side of the trigger it hangs from. The rail wants `right`. */
  placement?: Placement
  /** False when `text` is the trigger's own name (see `useTooltip`). */
  describe?: boolean
  /** The trigger, which keeps its own accessible name. */
  children: ReactElement<{ 'aria-describedby'?: string }>
}) {
  const wrap = useRef<HTMLSpanElement>(null)
  const tip = useTooltip({
    text,
    placement,
    anchor: wrap,
    describe,
  })
  const previous = children.props['aria-describedby']
  const describedBy = tip.describedBy(previous)

  return (
    <span ref={wrap} className={styles.wrap} {...tip.events}>
      {/* On closing nothing is cloned, so the original attribute comes back intact. */}
      {describedBy !== previous ? cloneElement(children, { 'aria-describedby': describedBy }) : children}
      {tip.bubble}
    </span>
  )
}
