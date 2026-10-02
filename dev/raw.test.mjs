/*
The raw-output rules that live only in the CSS.

jsdom does not apply CSS modules, so no render test can see `white-space` or
`max-height`, and those are the two decisions this primitive exists to take. It
lives in `dev/` and not under `src/` for the same reason as
`master-switch-signal.test.mjs`: reading files needs `node:fs`, and everything
under `src/` compiles without node's types. A `node:fs` there passes the suite and
breaks the build.
*/
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const css = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../src/ui/Raw.module.css'),
  'utf8',
)
const rule = (n) => /* that class's declaration block */ new RegExp(`\\.${n}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? ''

describe('raw output does not wrap', () => {
  const text = rule('text')

  /*
  THE decision of this pattern. The two places where it was written before used
  `pre-wrap` with `word-break`, and that breaks the one thing that makes a long
  JSON readable: the indentation. The price is a horizontal scroll bar.
  */
  it('it uses `pre` and not `pre-wrap`', () => {
    expect(text).toMatch(/white-space:\s*pre\s*;/)
    expect(text).not.toMatch(/pre-wrap/)
    expect(text).not.toMatch(/word-break/)
  })

  it('it scrolls on both axes and does not drag the page', () => {
    expect(text).toMatch(/overflow:\s*auto/)
    expect(text).toMatch(/overscroll-behavior:\s*contain/)
  })

  /* The panel does not grow with the content: measured, the viewer once loaded
     1,073,928 characters. */
  it('has a height cap, set through a variable so each use can fix its own', () => {
    expect(text).toMatch(/max-height:\s*var\(--raw-height/)
  })

  /* The border goes on the box: on the element that scrolls, it would move with
     the horizontal scroll. */
  it('the border lives on the box and not on the text', () => {
    expect(rule('box')).toMatch(/border:/)
    expect(text).not.toMatch(/border:/)
  })
})
