import { Button } from './Button'
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import styles from './Menu.module.css'
import { Icon } from './Icon'

/*
The `⋮` menu on each row. Upstream solves it with the Bootstrap 3 dropdown; here
it is a button with a list that closes on an outside click or on Escape.

It used to live inside Zones and now belongs to everyone, because the rule that
orders row actions needs it on every table: **destructive things go in here**. A
row cannot have a loose "Delete" next to a "Disable" —there are two hundred and
forty rows and this console has no undo anywhere— so deleting costs you opening
the menu. On a detail screen it does go outside: there you act on an object you
are looking at.

It deliberately does not use Radix: `DropdownMenu` would bring a new dependency
into `package.json` for a twenty-line component, and the project's primitives are
deliberately few.

And it is the ONLY menu. There was another one written by hand in the sidebar
—the account one— with its own list, its own styles and its own state, and what
it had forgotten was everything you cannot see by looking at it open: it did not
close on an outside click, nor on Escape, nor on scroll. Three behaviours already
solved here. The difference that was real —it hangs upwards from the foot of the
sidebar, aligned left, and its trigger is a wide row instead of a button— is the
two parameters below.
*/

/*
This is a real menu, and that is a contract rather than a label.

`role="menu"` promises a keyboard: arrows that move between items, `Home`/`End`,
one tab stop for the whole menu rather than one per item, and `Escape` that
closes it from anywhere inside and gives the focus back to the trigger. It was
carrying the role without any of that until 2026-09-07 — twelve call sites
announcing a menu and handing over a pile of loose buttons.

The pattern is implemented **here**, once, and not at the call sites: items are
whatever the caller renders, so the menu finds them in the DOM when it opens and
gives them `role="menuitem"` and a roving `tabindex`. A call site that renders a
button gets a menu item for free, which is the only way twelve of them stay
consistent.

Disabled items keep their button role on purpose: they are announced, they are
not reachable, and skipping them in the arrow order is what the pattern asks for.

Upstream declares no menu roles at all —its Bootstrap dropdown is a `<ul>` of
links— so nothing here is owed to parity. It is owed to the role we chose.
*/
export function Menu({
  label,
  text,
  onOpen,
  anchor = 'right',
  asRow = false,
  children,
}: {
  /** Accessible name; it is all there is when it carries no visible label. */
  label: string
  /** Visible text. Without it, the button is the compact `⋮` of a row. */
  text?: string
  /**
   * Fired on open, for the menu that needs to know the server state right before
   * showing its options. Upstream does the same with the Dashboard's blocking
   * menu (`main.js:2429`): it asks on open, not on render, because between the
   * two the setting may have changed in another tab.
   */
  onOpen?: () => void
  /** Which edge the list aligns to against the trigger. */
  anchor?: 'right' | 'left'
  /** The trigger fills the width of its column, with the label on the left. */
  asRow?: boolean
  children: (close: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [box, setBox] = useState<
    { right?: number; left?: number; top?: number; bottom?: number; maxHeight: number } | null
  >(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLDivElement>(null)

  /*
  The list is `position: fixed`, measured from the trigger, and NOT absolute
  inside the row. Absolute did not work: two containers clipped it at once —the
  segmented actions group, which carries `overflow: hidden` for its corners, and
  the table wrapper, which carries `overflow-x: auto`— so the menu opened and was
  not visible. It is the same reason `ui/Select` takes its list out fixed, and the
  same reason it closes on scroll.
  */
  /*
  And it opens wherever it fits. A long menu hanging off a low trigger spilled
  out the bottom: the Dashboard's blocking menu is nine options over a panel
  halfway down the screen, and the last three fell outside the window. With no way
  out, on top of that, because this menu closes on scroll.

  So if it does not fit below and there is more room above, it anchors by its
  bottom edge; and either way the available height is set as a cap, with the list
  scrolling inside. The second part is the belt: even if it fits on neither side
  —a very short window— every option is still reachable.
  */
  useLayoutEffect(() => {
    if (!open) { setBox(null); return }
    const r = trigger.current?.getBoundingClientRect()
    if (r == null) return

    const MARGIN = 8
    const below = window.innerHeight - r.bottom - MARGIN
    const above = r.top - MARGIN
    const edge2 = anchor === 'left' ? { left: r.left } : { right: window.innerWidth - r.right }

    setBox(
      below < above && below < 240
        ? { ...edge2, bottom: window.innerHeight - r.top + 4, maxHeight: above }
        : { ...edge2, top: r.bottom + 4, maxHeight: below },
    )
  }, [open, anchor])

  useEffect(() => {
    if (!open) return

    function outside(e: MouseEvent) {
      const t = e.target as Node
      if (!trigger.current?.contains(t) && !list.current?.contains(t)) setOpen(false)
    }
    function escape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        trigger.current?.focus()
      }
    }
    /* Scrolling the page closes it, but scrolling the list itself does not: ever
       since the list can have a height cap, that scroll is its own.

       The `instanceof` is not redundant: this same handler serves `resize`, and
       there the `target` is `window`, which is not a node. Without the guard,
       `contains()` threw on every resize with a menu open. */
    const onScroll = (e: Event) => {
      if (e.target instanceof Node && list.current?.contains(e.target)) return
      setOpen(false)
    }

    document.addEventListener('mousedown', outside)
    document.addEventListener('keydown', escape)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      document.removeEventListener('mousedown', outside)
      document.removeEventListener('keydown', escape)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open])

  /*
  The items are found, not declared. `children` is a render function, so the menu
  cannot clone them: it reads the list once it is on screen.
  */
  const allItems = () =>
    Array.from(list.current?.querySelectorAll<HTMLElement>('button, a[href]') ?? [])
  const reachable = () => allItems().filter((el) => !el.hasAttribute('disabled'))

  const focusAt = (els: HTMLElement[], i: number) => {
    els.forEach((el, n) => { el.tabIndex = n === i ? 0 : -1 })
    els[i]?.focus()
  }

  useEffect(() => {
    if (!open || box == null) return
    allItems().forEach((el) => { if (!el.hasAttribute('disabled')) el.setAttribute('role', 'menuitem') })
    const els = reachable()
    els.forEach((el, i) => { el.tabIndex = i === 0 ? 0 : -1 })
    els[0]?.focus()
  }, [open, box])

  const onListKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const els = reachable()
    if (els.length === 0) return
    const here = els.indexOf(document.activeElement as HTMLElement)
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); focusAt(els, here < 0 ? 0 : (here + 1) % els.length); break
      case 'ArrowUp':   e.preventDefault(); focusAt(els, here < 0 ? els.length - 1 : (here - 1 + els.length) % els.length); break
      case 'Home':      e.preventDefault(); focusAt(els, 0); break
      case 'End':       e.preventDefault(); focusAt(els, els.length - 1); break
      /* A menu is one tab stop, so leaving by Tab leaves the menu, not the item. */
      case 'Tab':       setOpen(false); break
    }
  }

  /* Opening with the keyboard lands on the first item, which is what the arrow
     asked for. */
  const onTriggerKeyDown = (e: ReactKeyboardEvent<HTMLElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) { onOpen?.(); setOpen(true) }
    }
  }

  const toggleOpen = () => {
    if (!open) onOpen?.()
    setOpen((v) => !v)
  }

  return (
    <div className={asRow ? styles.menuWidth : styles.menu}>
      {asRow ? (
        <button
          ref={trigger}
          type="button"
          className={styles.row}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={toggleOpen}
          onKeyDown={onTriggerKeyDown}
        >
          {text}
          <Icon name="chevronDown" size={12} />
        </button>
      ) : (
        <Button
          ref={trigger}
          size="sm"
          icon={text == null}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={label}
          onClick={toggleOpen}
          onKeyDown={onTriggerKeyDown}
        >
          {text == null ? (
            <Icon name="plus" size={16} />
          ) : (
            <>
              {text}
              <Icon name="chevronDown" size={12} />
            </>
          )}
        </Button>
      )}
      {open && box && (
        <div
          className={styles.menuList}
          role="menu"
          aria-label={label}
          ref={list}
          style={box}
          onKeyDown={onListKeyDown}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

export function Separator() {
  return <div className={styles.sep} role="separator" />
}
