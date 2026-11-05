import { useContext, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { InDialog } from './Dialog'
import { Alert } from './Alert'
import type { Notice } from '../lib/notice'
import { useMedia } from '../lib/use-media'
import styles from './Alert.module.css'

/*
The alert slot of a screen or a modal: if there is an alert, it is painted; if
not, there is nothing. And always with the same air beneath it.

It existed as a component inside Administration and ONE screen used it; the other
fifty wrote the same `{notice && (<Alert …>{notice.text}</Alert>)}` by hand. Out of
that came three different distances for the same thing, measured in the browser by
forcing a server failure:

  · 24 px in Zones, its twelve modals, the lists screens, Administration, the
    Dashboard, DNS Client and Apps, which wrapped the alert in a `div` with a
    margin;
  · 14 px in DHCP and in Logs, where the alert sat loose inside the screen's
    `flex` container and kept its `gap`;
  · 12 px in the four account modals, for the same reason inside the dialog.

It settles at 24, which is `--gap-block` (the token that names the distance
between independent blocks) and the one three quarters of them already had.

## The way out (2026-11-05)

Closed, the alert is gone at once, as before: the slot is empty and the next
query for it finds nothing. What stays for 180 ms is a COPY of it, `inert` and
`aria-hidden`, so it can fade and close its slot instead of vanishing and making
the screen jump. Only for those who want motion: with `prefers-reduced-motion`,
and wherever `matchMedia` is missing (the tests), there is no copy at all.
*/
/*
## Where it appears (2026-11-05, Adrián's decision)

A screen's result ("Zone Enabled!", "Zone Deleted!", the error of an action on
the page) FLOATS in the bottom right corner, over the page, instead of opening a
slot at the top of the screen that pushed everything under it down. Bottom right
and not top right: the top right is where every screen keeps its main actions
(Add Zone, Options, Delete Zone), the ones just pressed. Several results stack.
The same texts, the same five seconds for a success (the screens own that timer),
the same close button.

Two kinds stay where they are: a result inside a dialog (`InDialog`, set by
`ui/Dialog`), because it is about the form you are filling in; and a caller that
asks for `inline` (the login form, whose error is about the form).
*/
function region(): HTMLElement {
  let el = document.getElementById('notice-region')
  if (el == null) {
    el = document.createElement('div')
    el.id = 'notice-region'
    el.className = styles.region
    document.body.appendChild(el)
  }
  return el
}

export function Notifier({ notice, onClose, inline = false }: { notice: Notice | null; onClose: () => void; inline?: boolean }) {
  const inDialog = useContext(InDialog)
  const float = !inline && !inDialog && typeof document !== 'undefined'
  const place = (node: ReactNode) => (float ? createPortal(node, region()) : node)
  const motion = useMedia('(prefers-reduced-motion: no-preference)')
  const [shown, setShown] = useState(notice)
  const [leaving, setLeaving] = useState<Notice | null>(null)
  if (shown !== notice) {
    setShown(notice)
    setLeaving(notice == null && motion ? shown : null)
  }

  if (notice == null) {
    if (leaving == null) return null
    return place(
      <div
        className={`${float ? styles.floating : styles.gap} ${styles.leaving}`}
        aria-hidden="true"
        inert
        onAnimationEnd={(e) => {
          if (e.target === e.currentTarget) setLeaving(null)
        }}
      >
        <Alert type={leaving.type} title={leaving.title} onDismiss={() => {}}>
          {leaving.text}
        </Alert>
      </div>
    )
  }
  return place(
    <div className={float ? styles.floating : styles.gap}>
      <Alert type={notice.type} title={notice.title} onDismiss={onClose}>
        {notice.text}
      </Alert>
    </div>
  )
}
