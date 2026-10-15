import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type Ref } from 'react'
import { Icon } from './Icon'
import { PermissionButton } from './PermissionButton'
import styles from './Toast.module.css'

/*
The passing notice with one action: "done, and you can take it back". OURS: upstream
has nothing like it, nor its close button's name, `Dismiss`. So far it has a single
user, the deletion of rules in the table of Blocking › Rules (CONVENTIONS.md,
deviation 2). Every other destructive action of the console still asks first
(`ui/Confirm`).

What it owes, and why:

- **The message is a live region that is always in the page** (`role="status"`),
  empty while closed. A region born together with its text is often not announced.
- **The action is a real button**, reached with Tab and named by its text. When it
  needs a permission the session lacks it is drawn with the padlock and says which,
  as every `PermissionButton` does.
- **It goes by itself after `duration`, but not while it is being used**: the
  pointer over it or the focus inside it holds the clock (WCAG 2.2.1), and the
  clock starts again whole when they leave. `timerKey` restarts it too, for a
  notice that gained something. Escape and the close button dismiss it.
- **The focus is not lost with it.** If it closes, or loses its action, while the
  focus was inside it, the focus goes to `returnFocus`: the element that held it is
  gone, and the browser would leave it on the page's body.
- **It moves only for those who want motion**: it rises into place, and with
  `prefers-reduced-motion` it simply appears.
*/

export interface ToastAction {
  label: string
  onClick: () => void
  disabled?: boolean
  /** The missing permission, as `PermissionButton` takes it. */
  permission?: string
}

const DEFAULT_MS = 8000

export function Toast({
  message,
  action,
  onDismiss,
  duration = DEFAULT_MS,
  timerKey,
  hold = false,
  returnFocus,
  actionRef,
}: {
  /** `null` while closed. */
  message: ReactNode | null
  action?: ToastAction
  onDismiss: () => void
  duration?: number
  /** A new value restarts the clock. */
  timerKey?: unknown
  /** Keeps it open regardless of the clock: while its action is running, say. */
  hold?: boolean
  returnFocus?: () => void
  actionRef?: Ref<HTMLButtonElement>
}) {
  const open = message != null
  const box = useRef<HTMLDivElement>(null)
  const [pointer, setPointer] = useState(false)
  const [focused, setFocused] = useState(false)
  /* Whether the focus was inside when the content changed. A focused button that is
     removed leaves no blur with a destination, so only a blur to somewhere real
     clears it. */
  const hadFocus = useRef(false)
  const dismiss = useRef(onDismiss)
  const back = useRef(returnFocus)
  useEffect(() => {
    dismiss.current = onDismiss
    back.current = returnFocus
  })

  /* Closing forgets the pointer and the focus: the box under them is gone, and no
     leave or blur may come to say so. Adjusted while rendering, as React advises
     for state that follows a prop. */
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (!open) {
      setPointer(false)
      setFocused(false)
    }
  }

  const paused = pointer || focused || hold
  useEffect(() => {
    if (!open || paused) return
    const t = setTimeout(() => dismiss.current(), duration)
    return () => clearTimeout(t)
  }, [open, paused, duration, timerKey])

  /* Once it is closed, or has lost its action, the button the focus was on is gone. */
  const hasAction = open && action != null
  useLayoutEffect(() => {
    if (hasAction) return
    const active = document.activeElement
    if (hadFocus.current && (active == null || active === document.body || !document.contains(active))) {
      hadFocus.current = false
      back.current?.()
    }
  }, [hasAction])

  return (
    <div
      ref={box}
      className={open ? styles.toast : styles.closed}
      onMouseEnter={() => setPointer(true)}
      onMouseLeave={() => setPointer(false)}
      onFocus={() => {
        hadFocus.current = true
        setFocused(true)
      }}
      onBlur={(e) => {
        const to = e.relatedTarget as Node | null
        if (to != null && box.current?.contains(to)) return
        setFocused(false)
        if (to != null) hadFocus.current = false
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.preventDefault()
          dismiss.current()
        }
      }}
    >
      <p className={styles.text} role="status">
        {message}
      </p>
      {open && action != null && (
        <PermissionButton
          ref={actionRef}
          size="sm"
          variant="primary"
          disabled={action.disabled}
          permission={action.permission}
          onClick={action.onClick}
        >
          {action.label}
        </PermissionButton>
      )}
      {open && (
        <button type="button" className={styles.close} aria-label="Dismiss" title="Dismiss" onClick={() => dismiss.current()}>
          <Icon name="close" size={14} />
        </button>
      )}
    </div>
  )
}
