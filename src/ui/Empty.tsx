import type { ReactNode } from 'react'
import styles from './Empty.module.css'

/*
An empty state is painted in two ways and no more:

  · `Empty` — a REGION's empty state, the one that takes the place of the table or
    grid that has no rows. Dotted box, centred, with a title and, if the user can
    do something about it, the button that does it.
  · `Empty compact` — the empty state INSIDE a panel, a muted line that does not
    compete with the panel containing it.

And `Loading` and `Failure` are the same slot before the data: one while it travels
and the other when it never arrived. Same place and same weight as the empty state
they replace, so the screen does not jump when it resolves.

`Failure` was written by hand in four modules —`.fail` in Settings, DHCP, Logs and
Administration— with the same four values `.loading` already had here.
*/

export function Empty({
  title,
  children,
  actions,
  compact = false,
}: {
  /** What it is that is not there. Region empty state only. */
  title?: string
  /** Why it is not there, or what to do so that it is. */
  children?: ReactNode
  actions?: ReactNode
  compact?: boolean
}) {
  if (compact) return <div className={styles.line}>{children}</div>

  return (
    <div className={styles.box}>
      {title != null && <span className={styles.title}>{title}</span>}
      {children}
      {actions != null && <div className={styles.actions}>{actions}</div>}
    </div>
  )
}

export function Loading({
  children = 'Loading…',
  compact = false,
  announce = true,
}: {
  /** What is loading, when saying so helps: "Loading DS records…". */
  children?: ReactNode
  compact?: boolean
  /**
   * `false` for the SECOND placeholder of the same wait. See below: one request
   * is one announcement, however many holes it leaves on screen.
   */
  announce?: boolean
}) {
  /*
  `role="status"` because a screen that is busy has to say so: without it the only
  signal is a grey line nobody hears, and the wait is exactly when a screen reader
  user has least to go on. It is polite by definition —it does not interrupt— and
  it announces once, when the text appears.

  Measured on 2026-09-07 with the state matrix: not one of the twenty-nine call
  sites had an announced busy state.

  ## Why one of them can keep quiet

  "It announces once" stopped being true the moment a screen had two holes for the
  same request: the domain tree and its records both wait on the same call, and
  two `role="status"` regions saying "Loading…" is the same wait read out twice.
  The eye needs a placeholder in each hole —that is what says the content is
  coming and not gone— but the ear needs one.

  So the rule is per REQUEST, not per hole: the first placeholder announces, any
  further placeholder for the same wait passes `announce={false}` and is drawn
  without the role. It is not a way to skip the announcement; a screen with a
  single hole has no reason to touch this.
  */
  return (
    <div
      role={announce ? 'status' : undefined}
      className={`${styles.loading}${compact ? ` ${styles.line}` : ''}`}
    >
      {children}
    </div>
  )
}

/*
The data never arrived. It fills the same slot as the `Loading` it replaces — and
until phase 2 it also wore the same clothes, which was the defect: a muted centred
line with no border said "on its way" and "it failed" with the same picture.

Phase 1's rule, verbatim: **dashed = empty, continuous = error, never swapped.**
So this is the one with the solid `--dan` border.

What is NOT here yet, and belongs to whoever redesigns the screen: the rule also
asks for the cause, the time of the last good data and a single `Retry`. The cause
already arrives as `children`; the other two are the screen's to supply, and the
one call site —`Settings.tsx:149`— has neither. Adding an `actions` prop that
nothing passes would be inventing API ahead of its use.
*/
export function Failure({ children }: { children: ReactNode }) {
  return <div className={styles.failure}>{children}</div>
}
