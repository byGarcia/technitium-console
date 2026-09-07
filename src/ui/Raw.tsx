import type { ReactNode } from 'react'
import styles from './Raw.module.css'

/*
Raw output: a block of text that is NOT interpreted.

It is pattern 1 of the tool archetype. The two surfaces that show what the server
returned verbatim use it —`DNS Client`'s JSON response and `View Logs`'s file—
and it exists as a primitive because it was written TWICE, in
`dnsclient/DnsClient.module.css` and in `logs/Logs.module.css`, and had already
drifted: one capped at `460px` and the other at `60vh`.

## Why it does not wrap

Both said `white-space: pre-wrap; word-break: break-word`, and that is what this
primitive comes to remove. A wrapped JSON line **stops being indented**, which is
the only thing that makes a two-thousand-character JSON readable; and a wrapped
log line stops being one entry. It is paid for with a horizontal scrollbar, and
that is the right price: not one character is lost and nothing lies about the
structure.

No wrap toggle is offered because **that would be adding a control**, and design
does not get to decide that.

## Why the height is fixed

The panel does not grow with the content: the content scrolls inside it. Measured
in the harness, the `View Logs` viewer loaded **1,073,928 characters**; a panel
that grows with that stops being a panel and turns the screen into the file.

## Why it is focusable, and why it carries a name

A region that scrolls and cannot be focused **cannot be read with a keyboard**:
without `tabIndex` there is no way to get the cursor inside to use the arrows. And
a tab stop that announces nothing is worse than none, so the name is compulsory:
`text` ends up in `aria-label`.

`overscroll-behavior: contain` so that reaching the end of the block does not drag
the whole page, which is the classic defect of a scrolling box inside another.
*/
export function Raw({
  children,
  text,
  height = 440,
  tono = 'normal',
}: {
  children: ReactNode
  /** What this is, for whoever hears it instead of seeing it. Compulsory on purpose. */
  text: string
  /** The cap in pixels. The block never grows past it. */
  height?: number
  /*
  `error` only for the case where **the server returns the error as text** and
  there is nowhere else to put it —the `View Logs` viewer, `logs.js:170-172`. The
  frame turns `--dan`: the error is framed, not disguised as data. It is the one
  exception to phase 1's "solid = error", and that is why the frame IS solid.
  */
  tono?: 'normal' | 'error'
}) {
  return (
    <div className={`${styles.box}${tono === 'error' ? ` ${styles.error}` : ''}`}>
      <pre
        className={styles.text}
        style={{ '--raw-height': `${height}px` } as React.CSSProperties}
        tabIndex={0}
        aria-label={text}
      >
        {children}
      </pre>
    </div>
  )
}
