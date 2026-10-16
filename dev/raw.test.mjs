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

/*
The two modifiers View Logs asks for. Neither may leak into the default above, and
neither may cut a word letter by letter (`npm run lint:breaks`).
*/
describe('raw output, when the caller asks it to wrap or to fill', () => {
  it('`wrap` soft-wraps with a hanging indent read from `--raw-hang`', () => {
    const wrap = rule('wrap')
    expect(wrap).toMatch(/white-space:\s*pre-wrap/)
    expect(wrap).toMatch(/text-indent:\s*var\(--raw-hang[^;]*\)\s*hanging\s+each-line/)
  })

  /* `break-word` cuts only a piece wider than the whole box; `anywhere` and
     `break-all` would end lines inside words wherever the edge falls. */
  it('`wrap` breaks between words, never anywhere', () => {
    const wrap = rule('wrap')
    expect(wrap).toMatch(/overflow-wrap:\s*break-word/)
    expect(wrap).not.toMatch(/anywhere|break-all|word-break/)
  })

  it('on a phone the indent drops to two characters', () => {
    expect(css).toMatch(/@media \(max-width: 560px\)\s*\{\s*\.wrap\s*\{\s*text-indent:\s*2ch hanging each-line;/)
  })

  /* Out of flow, so the file adds nothing to the page's height; the box's
     `min-height` is the floor. */
  it('`fill` lays the text out of flow over a box with a floor', () => {
    expect(rule('fill')).toMatch(/min-height:\s*var\(--raw-height/)
    expect(rule('fill')).toMatch(/flex:\s*1 1 auto/)
    const inner = /\.fill\s*>\s*\.text\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(inner).toMatch(/position:\s*absolute/)
    expect(inner).toMatch(/inset:\s*0/)
    expect(inner).toMatch(/max-height:\s*none/)
  })
})
