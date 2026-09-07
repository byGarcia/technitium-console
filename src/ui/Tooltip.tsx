import { cloneElement, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { place, type Placed, type Placement } from './tooltip-place'
import styles from './Tooltip.module.css'

/*
The label that appears beside something that already has a name.

Phase 2.2 justified it because TWO phase-1 rules depend on it and there was
nothing in `ui/`: the 60 px rail shows only icons, and without the label on hover
it is twelve pictures with no names; and the padlock on a disabled control has to
say WHICH permission is missing —`Requires Cache: Delete`— and not merely that one
is.

## The three conditions, which are not decoration

`DESIGN.md` states them and they are what the tests below hold:

  · **It never replaces the accessible name.** What it adds is
    `aria-describedby`, which DESCRIBES; the name goes on the trigger and stays
    there. A tooltip that carried the name would make the control nameless the
    moment the pointer left — and for anyone who never uses a pointer, always.
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
    CONCATENATES —that attribute is a space-separated id list, and always was—
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
this console there are two on the way —the actions group, which hides its corners,
and the table wrapper, which scrolls horizontally—. Measured from the trigger's
rect and painted fixed, nothing can clip it.

It closes on Escape, on blur and on pointer-out; it does not need to close on an
outside click, because it never takes the pointer.
*/
export function Tooltip({
  text,
  placement = 'right',
  children,
}: {
  /** The text that already exists somewhere else: the icon's label, the missing permission. */
  text: ReactNode
  /** Which side of the trigger it hangs from. The rail wants `right`. */
  placement?: Placement
  /** The trigger, which keeps its own accessible name. */
  children: ReactElement<{ 'aria-describedby'?: string }>
}) {
  const id = useId()
  /* Two causes, not one: the pointer and the focus leave independently. */
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const open = hovered || focused
  const [box, setBox] = useState<Placed | null>(null)
  const wrap = useRef<HTMLSpanElement>(null)
  const bubble = useRef<HTMLSpanElement>(null)

  /* What the trigger already carried, plus ours. If it carried nothing, only
     ours; and its own is never lost. */
  const previo = children.props['aria-describedby']
  const describedBy = [previo, id].filter(Boolean).join(' ')

  /*
  Two passes, and they are needed: to place the bubble you have to know how big it
  is, and to measure it you have to have drawn it. It is drawn with no position
  —invisible, so it does not jump— and placed as soon as it is measured.
  */
  useLayoutEffect(() => {
    if (!open || !wrap.current || !bubble.current) return
    const t = wrap.current.getBoundingClientRect()
    const b = bubble.current.getBoundingClientRect()
    setBox(
      place({
        trigger: { top: t.top, left: t.left, width: t.width, height: t.height },
        bubble: { top: 0, left: 0, width: b.width, height: b.height },
        viewport: { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight },
        placement,
      }),
    )
  }, [open, placement])

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

  return (
    <span
      ref={wrap}
      className={styles.wrap}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      {/*
        `aria-describedby` is a LIST of ids separated by spaces, and always was:
        that is why it is concatenated rather than assigned. A control already
        described by its own help lost that description the moment you pointed at
        it.

        And only while the bubble exists: pointing at a node that is not in the DOM
        describes nothing, and some readers announce the dangling id. On closing
        nothing is cloned, so the original attribute comes back intact.
      */}
      {open ? cloneElement(children, { 'aria-describedby': describedBy }) : children}
      {open && (
        <span
          ref={bubble}
          id={id}
          role="tooltip"
          className={styles.bubble}
          data-placement={box?.placement ?? placement}
          style={box ? { top: box.top, left: box.left } : { visibility: 'hidden' }}
        >
          {text}
        </span>
      )}
    </span>
  )
}
