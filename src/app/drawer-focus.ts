import { useEffect, useRef, type RefObject } from 'react'

/*
The keyboard in the side panel when it is a drawer (below 900 px).

Opened, it covers the page like a dialog, so it behaves as one: the focus moves
into it, Tab and Shift+Tab go round inside it, and Escape closes it. Closed, the
focus goes back to the Menu button that opened it, unless something else already
took it (the command palette, opened from inside the drawer, gives it back to its
own trigger). Before this, the focus stayed on the Menu button behind the veil,
Tab walked the page underneath, and Escape did nothing.

Escape is left to whatever is open inside the drawer first: the account menu at
its foot closes on Escape too, and one key should close one thing. A key pressed
in something drawn outside it (a dialog in a portal) is not the drawer's either.
*/

const TABBABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]'

function tabbable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(TABBABLE)).filter(
    (el) => el.tabIndex >= 0 && el.closest('[hidden], [inert]') == null,
  )
}

export function useDrawerFocus(
  open: boolean,
  close: () => void,
  drawer: RefObject<HTMLElement | null>,
  trigger: RefObject<HTMLElement | null>,
) {
  const wasOpen = useRef(false)

  useEffect(() => {
    const panel = drawer.current
    if (!open || panel == null) return

    tabbable(panel)[0]?.focus()

    function onKey(e: KeyboardEvent) {
      if (panel == null) return
      const t = e.target as Node | null
      const ours = t == null || t === document.body || panel.contains(t)
      if (!ours) return
      if (e.key === 'Escape') {
        if (panel.querySelector('[aria-haspopup="menu"][aria-expanded="true"]') != null) return
        close()
        return
      }
      if (e.key !== 'Tab') return
      const els = tabbable(panel)
      if (els.length === 0) return
      const first = els[0]
      const last = els[els.length - 1]
      const here = document.activeElement
      if (!panel.contains(here)) {
        e.preventDefault()
        ;(e.shiftKey ? last : first).focus()
      } else if (e.shiftKey && here === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && here === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, close, drawer])

  useEffect(() => {
    if (open) {
      wasOpen.current = true
      return
    }
    if (!wasOpen.current) return
    wasOpen.current = false
    const here = document.activeElement
    const lost = here == null || here === document.body || drawer.current?.contains(here) === true
    if (lost) trigger.current?.focus()
  }, [open, drawer, trigger])
}
