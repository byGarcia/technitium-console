import { useState } from 'react'
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
export function Notifier({ notice, onClose }: { notice: Notice | null; onClose: () => void }) {
  const motion = useMedia('(prefers-reduced-motion: no-preference)')
  const [shown, setShown] = useState(notice)
  const [leaving, setLeaving] = useState<Notice | null>(null)
  if (shown !== notice) {
    setShown(notice)
    setLeaving(notice == null && motion ? shown : null)
  }

  if (notice == null) {
    if (leaving == null) return null
    return (
      <div
        className={`${styles.gap} ${styles.leaving}`}
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
  return (
    <div className={styles.gap}>
      <Alert type={notice.type} title={notice.title} onDismiss={onClose}>
        {notice.text}
      </Alert>
    </div>
  )
}
