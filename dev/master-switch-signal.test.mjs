/*
The two guards of the master-switch signal that are checked against the SOURCE
CODE, not against a render.

They live here and not next to `master.test.tsx` for a mechanical reason: they
read files, and everything under `src/` compiles with `types: ["vite/client"]`
(without node's types), so a `node:fs` in there passes the suite and **breaks the
build**. That is exactly what happened: 1039 tests green and `tsc -b` red with four
errors. It is the same hole as the time `grep -cE "^error"` said "build 0" while
the build was failing, and that is why the gate is read by its exit code.

What they check is not a render matter either: jsdom does not apply CSS modules and
there is no screen on which to see either of the two things.
*/
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const src = resolve(here, '../src')

/*
The rule mark must not take grid space.

With `border-left: 2px solid var(--acc)` the five dependent rows of
`/settings/general/` measured `210px 540px 360px` against the `210px 542px 360px`
of the other 34: the border eats two pixels of the box and **shifts the control**.
In a dense form that is a column that stops being aligned, and `dev/uniformity.js`
caught it as a third `grid-panel` signature that existed only on that route. A
state signal must not move the content it marks.
*/
describe('the master rule mark does not shift the grid', () => {
  const css = readFileSync(resolve(src, 'ui/Form.module.css'), 'utf8')
  const rule = /\.dependent\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''

  it('the rule exists and paints the amber mark', () => {
    expect(rule).toMatch(/var\(--acc(-ink)?\)/)
  })

  it('and paints it with an inset shadow, not with a border that takes box space', () => {
    expect(rule).toMatch(/box-shadow:\s*inset/)
    expect(rule).not.toMatch(/border/)
    expect(rule).not.toMatch(/padding/)
  })
})

/*
The amber pill and the `warn` pill must never meet on one screen.

Measured on 2026-09-03 with the function in `dev/palette-distance.mjs`: against
`warn`, the `acc` tone gives ΔE00 **8.8** on the text, **8.9** on the border and
**0.0** on the background. That same tool's collision threshold is 10, so by the
project's own criterion **they are the same colour**. And it has to be: the pill
goes with the amber mark of the row and the two are ONE signal; giving it another
amber would split it.

That this costs nothing depends on a fact, not on luck: today the two families do
not meet (the seven `warn` pills live in cluster, sessions, apps and zones; the
`acc` one only in the `Settings` forms). If a screen ever painted both, the user
would see two identical pills meaning "you can" and "careful".
*/
describe('the amber of "you can" never meets the amber of "careful"', () => {
  const files = (pattern) => {
    const found = []
    const walk = (dir) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = resolve(dir, e.name)
        if (e.isDirectory()) walk(p)
        else if (e.name.endsWith('.tsx') && !e.name.includes('.test.')) {
          if (pattern.test(readFileSync(p, 'utf8'))) found.push(p.slice(src.length + 1))
        }
      }
    }
    walk(src)
    return found.sort()
  }

  it('no file paints both', () => {
    const withAcc = files(/dependsOn=|tone="acc"/)
    const withWarn = files(/tone="warn"/)

    expect(withAcc.length).toBeGreaterThan(0)
    expect(withWarn.length).toBeGreaterThan(0)
    expect(withAcc.filter((f) => withWarn.includes(f))).toEqual([])
  })
})
