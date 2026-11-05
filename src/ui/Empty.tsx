import type { ReactNode } from 'react'
import styles from './Empty.module.css'

/*
An empty state is painted in two ways and no more:

  · `Empty`: a REGION's empty state, the one that takes the place of the table or
    grid that has no rows. Dotted box, centred, with a title and, if the user can
    do something about it, the button that does it.
  · `Empty compact`: the empty state INSIDE a panel, a muted line that does not
    compete with the panel containing it.

And `Loading` and `Failure` are the same slot before the data: one while it travels
and the other when it never arrived. Same place and same weight as the empty state
they replace, so the screen does not jump when it resolves.

`Failure` was written by hand in four modules (`.fail` in Settings, DHCP, Logs and
Administration) with the same four values `.loading` already had here.
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
  user has least to go on. It is polite by definition (it does not interrupt), and
  it announces once, when the text appears.

  Measured on 2026-09-07 with the state matrix: not one of the twenty-nine call
  sites had an announced busy state.

  ## Why one of them can keep quiet

  "It announces once" stopped being true the moment a screen had two holes for the
  same request: the domain tree and its records both wait on the same call, and
  two `role="status"` regions saying "Loading…" is the same wait read out twice.
  The eye needs a placeholder in each hole (that is what says the content is
  coming and not gone), but the ear needs one.

  So the rule is per REQUEST, not per hole: the first placeholder announces, any
  further placeholder for the same wait passes `announce={false}` and is drawn
  without the role. It is not a way to skip the announcement; a screen with a
  single hole has no reason to touch this.
  */
  /*
  ## What the eye gets: a skeleton (2026-11-05)

  The slot is drawn as bars where the content will be, with a soft light passing
  over them, instead of a grey "Loading…" in the middle of an empty space: a
  skeleton says the shape of what is coming, and a word in a void read as a page
  that had nothing to show. The text is still here, whole and unchanged, for the
  screen reader (and for the tests that read it); only its picture changed. The
  bars carry no text of their own and are hidden from the accessibility tree.

  Five bars where a table or a region will appear, two in the one-line slot of a
  panel (`compact`). Under `prefers-reduced-motion` the light does not pass.
  */
  const bars = compact ? 2 : 5
  return (
    <div
      role={announce ? 'status' : undefined}
      className={`${styles.loading}${compact ? ` ${styles.loadingCompact}` : ''}`}
    >
      <span className={styles.loadingText}>{children}</span>
      <span className={styles.skeleton} aria-hidden="true">
        {Array.from({ length: bars }, (_, i) => (
          <span key={i} className={styles.bar} />
        ))}
      </span>
    </div>
  )
}

/*
The data never arrived. It fills the same slot as the `Loading` it replaces, and
until the design pass it also wore the same clothes, which was the defect: a muted centred
line with no border said "on its way" and "it failed" with the same picture.

The design rule, verbatim: **dashed = empty, continuous = error, never swapped.**
So this is the one with the solid `--dan` border.

What is NOT here yet, and belongs to whoever redesigns the screen: the rule also
asks for the cause, the time of the last good data and a single `Retry`. The cause
already arrives as `children`; the other two are the screen's to supply, and the
one call site (`Settings.tsx:149`) has neither. Adding an `actions` prop that
nothing passes would be inventing API ahead of its use.
*/
export function Failure({ children }: { children: ReactNode }) {
  return <div className={styles.failure}>{children}</div>
}
