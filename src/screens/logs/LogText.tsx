import { useLayoutEffect, useRef } from 'react'
import styles from './Logs.module.css'

/*
The server log as the viewer draws it: the same characters, with two things the
browser cannot see on its own.

1. **Where an entry's time ends.** Every line the server writes starts with
   `[yyyy-MM-dd HH:mm:ss UTC] ` or `[… Local] ` (LogManager.cs:605-614). That prefix
   goes in a `<span>` drawn in `--faint`, the console's colour for a timestamp
   (tokens.css; on `--field` it measures 5.64:1 in light and 5.78:1 in dark), so the
   eye runs down the messages and still finds the time. Its length is also the hanging
   indent `ui/Raw` gives the continuation lines (`stampWidth`), so they line up
   under the message and not under the bracket. Lines without it (the frames of a
   stack trace) are drawn as they are.
2. **Where a long word may end a line.** A list URL, a zone file path or a stack
   frame has no spaces, so on a narrow box the browser would either overflow or,
   with `break-word`, cut it wherever the edge falls (`raw.githubuser` /
   `content.com`). A `<wbr>` goes after each run of `/`, `\`, `.`, `?`, `&` and
   `=`: the separators of `ui/UrlText`, plus the backslash of the Windows paths
   .NET writes into a stack trace. Only words longer than `LONG` get them: a
   shorter one fits a continuation line even on a phone, and every `<wbr>` is a
   node to lay out.

Neither adds a character. `<span>` and `<wbr>` carry no text, so the DOM's text,
what is copied and what a screen reader reads are the file byte for byte, `\r\n`
included. Measured in Chromium on the showcase's log of 2026-10-15 (86,809
characters, 13 of its line ends `\r\n`) and on a 2 MB file made of it: selecting
the viewer and copying gives what it gave before this change, the response
without its final newline, which a browser never copies out of a `<pre>`.
*/

const STAMP = /^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} (?:UTC|Local)\] /

/* A word this short fits a continuation line down to a 320 px phone (33
   characters, 2 of them indent), so it never needs a break of its own. */
const LONG = 31
const SEPARATOR = /(?<=[/\\.?&=])(?![/\\.?&=])/

/* Lines per chunk; see LogText below. */
const CHUNK = 100

/** The width of the log's timestamp prefix in characters, 0 if it has none. */
export function stampWidth(text: string): number {
  return STAMP.exec(text)?.[0].length ?? 0
}

/*
The nodes for `text`. Plain text is gathered into one text node between elements,
so a line with nothing to mark costs one node and not one per word. Only text
nodes, `<span>` and `<wbr>` are created, never HTML parsed from the file.
*/
export function logNodes(
  text: string,
  { stamp: stampClass, chunk: chunkClass }: { stamp: string; chunk: string },
): DocumentFragment {
  const doc = document.createDocumentFragment()
  let out: HTMLElement | DocumentFragment = doc
  let plain = ''
  const flush = () => {
    if (plain) out.append(plain)
    plain = ''
  }

  const lines = text.split(/(?<=\n)/)
  for (const [n, line] of lines.entries()) {
    if (n % CHUNK === 0) {
      flush()
      out = document.createElement('span')
      out.className = chunkClass
      doc.append(out)
    }
    let rest = line
    const stamp = STAMP.exec(line)?.[0]
    if (stamp) {
      flush()
      const span = document.createElement('span')
      span.className = stampClass
      span.textContent = stamp
      out.append(span)
      rest = line.slice(stamp.length)
    }
    for (const word of rest.split(/(\s+)/)) {
      if (word.length <= LONG || /\s/.test(word)) {
        plain += word
        continue
      }
      const pieces = word.split(SEPARATOR)
      pieces.forEach((piece, i) => {
        plain += piece
        if (i < pieces.length - 1) {
          flush()
          out.append(document.createElement('wbr'))
        }
      })
    }
  }
  flush()
  return doc
}

/*
Built outside React, and laid out a hundred lines at a time, on purpose.

The viewer asks for up to 2 MB. A 2 MB file made of the showcase's own log is
13,809 lines, 6,013 timestamps and about 61,000 break points. Measured on the
production build at 1440, opening it took 0.25 s before this change (one text
node); as React elements it took 1.2 s, and appended as one fragment still 1.0 s,
because laying out that many inline nodes is the cost and not React.

So the lines go in blocks of `CHUNK`, each `content-visibility: auto`
(`Logs.module.css`, `.logChunk`): a block far from the visible part is not laid out at
all, and opening the 2 MB file takes 0.3 s, layout under 10 ms. The text is still
all in the DOM, so selecting, copying, find-in-page and a screen reader see every
line. Each block ends with its line's own newline and the copy is the same as
without blocks (measured, see above). Until a block has been shown its height is
an estimate, a hundred unwrapped lines (`100lh`), so the scrollbar can shift a
little the first time a far part is reached.

React owns the `<span>` and never its children.
*/
export function LogText({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    ref.current?.replaceChildren(logNodes(text, { stamp: styles.logStamp, chunk: styles.logChunk }))
  }, [text])
  return <span ref={ref} />
}
