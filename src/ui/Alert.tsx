import { useEffect, useRef, type ReactNode } from 'react'
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
*/
export type AlertType = 'success' | 'info' | 'warning' | 'danger'

/*
The icon, by TYPE and not by the title.

Pilot 3 asked for the difference between `Note!` and `Warning!` to be visible, and
measuring showed that today **it is not**: the two `dev/uniformity.js` signatures
came out identical —`filled | no-icon | 8px | 15px from the panel`— because only
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
const ICONO: Record<AlertType, IconName> = {
  success: 'check',
  info: 'about',
  warning: 'warning',
  danger: 'warning',
}

const AUTO_DESCARTE_MS = 5000

export function Alert({
  type,
  title,
  children,
  onDismiss,
}: {
  type: AlertType
  title: string
  children?: ReactNode
  onDismiss?: () => void
}) {
  // The dismiss callback is kept in a ref: the places that pass it write a new
  // function on every render, and as a dependency it would restart the timer
  // forever and never fire.
  const dismiss = useRef(onDismiss)
  dismiss.current = onDismiss

  useEffect(() => {
    if (type !== 'success' || onDismiss == null) return
    const t = setTimeout(() => dismiss.current?.(), AUTO_DESCARTE_MS)
    return () => clearTimeout(t)
    // The timer restarts with each new alert, even if the previous one was also
    // a success: that is what upstream does, since it rebuilds the whole node.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, title, children])

  return (
    <div className={`${styles.alert} ${styles[type]}`} role="alert">
      {onDismiss && (
        <button type="button" className={styles.close} aria-label="Close" onClick={onDismiss}>
          <Icon name="close" size={14} />
        </button>
      )}
      <Icon name={ICONO[type]} size={15} className={styles.icon} />
      <b>{title}</b> {children}
    </div>
  )
}
