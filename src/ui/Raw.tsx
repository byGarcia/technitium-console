import type { ReactNode } from 'react'
import styles from './Raw.module.css'

/*
Raw output: a block of text that is NOT interpreted.

It is the first pattern of the tool screens. The two surfaces that show what the server
returned verbatim use it (`DNS Client`'s JSON response and `View Logs`'s file),
and it exists as a primitive because it was written TWICE, in
`dnsclient/DnsClient.module.css` and in `logs/Logs.module.css`, and had already
drifted: one capped at `460px` and the other at `60vh`.

## Why it does not wrap, unless the caller asks

Both said `white-space: pre-wrap; word-break: break-word`, and that is what this
primitive comes to remove. A wrapped JSON line **stops being indented**, which is
the only thing that makes a two-thousand-character JSON readable. It is paid for
with a horizontal scrollbar, and for JSON that is the right price: not one
character is lost and nothing lies about the structure. DNS Client keeps it.

`wrap` is the other answer, and it is for a log (`View Logs`). There the end of a
line is the part that says something (the list URL, the zone file, the exception),
and on the showcase's server log of 2026-10-15 **365 of its 572 lines (64 %) ran
past the box at 1440 (122 characters) and 570 at 390 (43)**: their ends sat behind a scrollbar
that moves every line at once and takes the timestamps with it. So `wrap`
soft-wraps and keeps each line ONE entry with a hanging indent: an entry's first
line starts at the edge and only its continuations are pushed in, by `hang`
characters, the width of the log's `[yyyy-MM-dd HH:mm:ss UTC] ` prefix. The
messages read as a column of their own, and a line at the edge is a new entry.

It is `text-indent: … hanging each-line` on the `<pre>` itself, with no element per
line, so the text in the DOM, the copied text and what a screen reader reads are
the file as it came. Below 560 px (`--bp-stack`) the indent drops to `2ch`: 26 of
the 43 characters a phone gets would leave 17 for each continuation. A line breaks
at its spaces and wherever the caller put a `<wbr>` (`View Logs` puts one after the
separators of a long path or URL, as `ui/UrlText` does); `overflow-wrap:
break-word` only cuts a piece that alone is wider than the box.

No wrap toggle is offered because **that would be adding a control**, and design
does not get to decide that: each surface gets the one that serves its text.

## Why the height is capped, or handed down

The panel does not grow with the content: the content scrolls inside it. Measured
in the harness, the `View Logs` viewer loaded **1,073,928 characters**; a panel
that grows with that stops being a panel and turns the screen into the file.

By default `height` is that cap. With `fill`, the box takes the height its parent
gives it instead (the parent is a flex column that has been handed the rest of the
window), and `height` becomes the floor under which it does not shrink. The text is
then laid out of flow (`position: absolute`), so however long the file is it adds
nothing to the height of the page: the box is as tall as the window allows, never
as tall as the log.

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
  tone = 'normal',
  wrap = false,
  hang = 0,
  fill = false,
}: {
  children: ReactNode
  /** What this is, for whoever hears it instead of seeing it. Compulsory on purpose. */
  text: string
  /** The cap in pixels: the block never grows past it. With `fill`, the floor. */
  height?: number
  /*
  `error` only for the case where **the server returns the error as text** and
  there is nowhere else to put it (the `View Logs` viewer, `logs.js:170-172`). The
  frame turns `--dan`: the error is framed, not disguised as data. It is the one
  exception to the design rule "solid = error", and that is why the frame IS solid.
  */
  tone?: 'normal' | 'error'
  /** Soft-wrap with a hanging indent instead of scrolling sideways. See above. */
  wrap?: boolean
  /** With `wrap`, how many characters a continuation line is pushed in. */
  hang?: number
  /** Take the height the parent (a flex column) hands down. See above. */
  fill?: boolean
}) {
  const box = [styles.box, tone === 'error' ? styles.error : null, fill ? styles.fill : null]
  const pre = [styles.text, wrap ? styles.wrap : null]
  return (
    <div
      className={box.filter(Boolean).join(' ')}
      style={{ '--raw-height': `${height}px` } as React.CSSProperties}
    >
      <pre
        className={pre.filter(Boolean).join(' ')}
        style={wrap ? ({ '--raw-hang': `${hang}ch` } as React.CSSProperties) : undefined}
        tabIndex={0}
        aria-label={text}
      >
        {children}
      </pre>
    </div>
  )
}
