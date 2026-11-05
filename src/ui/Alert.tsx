import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon, type IconName } from './Icon'
import styles from './Alert.module.css'

/*
A replica of the old console's `showAlert` (common.js:202-217): a type, a bold
title, the text after it and a "×" to dismiss it.

The "×" is not decoration: in upstream the alert can be closed, so removing it
would be removing behaviour. It was caught by comparing side by side against the
reference instance.

And **success alerts dismiss themselves after five seconds**, as they do there
(`common.js:213-217`, `success` only). It was missing: it was a real behavioural
difference, and a noticeable one, because a "Settings Saved!" that never goes away
ends up covering the next alert.

## Two looks, one component (redrawn 2026-11-05)

What tells them apart is whether the alert can be closed, because that is what
already separates the two jobs it does:

  · **the result** (`onDismiss`, which is the `Notifier`'s: "Zone Enabled!",
    "Error!"): a card on the panel surface, its title on a line of its own and its
    text in the secondary ink, a tinted badge with the type's icon, and, when it
    is a success that will go by itself, a thin bar that drains over the same five
    seconds the timer counts. It slides in when it arrives.
  · **the notice** (no `onDismiss`: the forms' `Note!` and `Warning!`, the stale
    data strip): a soft wash of the type's colour with a hairline of it, the same
    badge, and the title running into the text as upstream's `<b>` does.

Neither paints the text in the type's colour any more: the badge carries the type,
the text stays in ink, and a long paragraph no longer reads as a link.

The bar is a picture of the timer, not a second one: it does not pause under the
pointer because upstream's timer does not, and it restarts with the same props
that restart the timer.
*/
export type AlertType = 'success' | 'info' | 'warning' | 'danger'

/*
The icon, by TYPE and not by the title.

The dense-form design asked for the difference between `Note!` and `Warning!` to be visible, and
measuring showed that today **it is not**: the two `dev/uniformity.js` signatures
came out identical (`filled | no-icon | 8px | 15px from the panel`) because only
the tone told them apart, and the signature does not look at that.

It goes here and not in `PanelForm` because the two notices are drawn by TWO
routes: 42 through the form kit's `Note`/`Warning`, and 36 with `<Alert>` directly
in the Zones modals and the Settings dialogs. Handling it only in the kit would
have made the same `Note!` weigh differently in a panel and in a modal, which is
exactly the defect `Alert.module.css`'s header records having fixed.

`Icon` already comes out `aria-hidden` and `focusable="false"`, so the icon is
decorative by construction: the word `Note!`/`Warning!` is still in the text and
the icon neither repeats nor replaces it.
*/
const ICON_BY_TYPE: Record<AlertType, IconName> = {
  success: 'check',
  info: 'about',
  warning: 'warning',
  danger: 'warning',
}

const AUTO_DISMISS_MS = 5000

export function Alert({
  type,
  title,
  children,
  action,
  onDismiss,
}: {
  type: AlertType
  title: string
  children?: ReactNode
  /** A control that answers the alert (the stale strip's `Retry`), drawn at its end. */
  action?: ReactNode
  onDismiss?: () => void
}) {
  // The dismiss callback is kept in a ref: the places that pass it write a new
  // function on every render, and as a dependency it would restart the timer
  // forever and never fire.
  const dismiss = useRef(onDismiss)
  dismiss.current = onDismiss

  useEffect(() => {
    if (type !== 'success' || onDismiss == null) return
    const t = setTimeout(() => dismiss.current?.(), AUTO_DISMISS_MS)
    return () => clearTimeout(t)
    // The timer restarts with each new alert, even if the previous one was also
    // a success: that is what upstream does, since it rebuilds the whole node.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, title, children])

  const result = onDismiss != null
  const timed = result && type === 'success'

  /* A new result in the same place draws itself again: the entrance and the bar
     start over with the same three props that restart the timer. Adjusted while
     rendering, as React advises for state that follows a prop.

     Only a result: its text is the `Notifier`'s string. A notice's children are
     often markup written anew on every render of its screen, and redrawing on that
     would rebuild the notice (and drop the focus from a link inside it) at every
     keystroke in the form around it. */
  const [shown, setShown] = useState({ type, title, children, run: 0 })
  if (result && (shown.type !== type || shown.title !== title || shown.children !== children)) {
    setShown({ type, title, children, run: shown.run + 1 })
  }

  return (
    <div
      key={shown.run}
      className={`${styles.alert} ${styles[type]}${result ? ` ${styles.result}` : ''}`}
      role="alert"
    >
      <span className={styles.badge}>
        <Icon name={ICON_BY_TYPE[type]} size={14} />
      </span>
      <div className={styles.body}>
        <b className={styles.title}>{title}</b> {children}
      </div>
      {action != null && <div className={styles.action}>{action}</div>}
      {onDismiss && (
        <button type="button" className={styles.close} aria-label="Close" onClick={onDismiss}>
          <Icon name="close" size={14} />
        </button>
      )}
      {timed && <span className={styles.timer} style={{ animationDuration: `${AUTO_DISMISS_MS}ms` }} />}
    </div>
  )
}
