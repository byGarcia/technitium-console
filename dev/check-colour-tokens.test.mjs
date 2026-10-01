import { describe, expect, it } from 'vitest'
import { ALLOWED, check, findColours, findOutsideThemes, stripComments } from './check-colour-tokens.mjs'

/*
The gate behind "every colour is a token". It lives in `dev/` for the reason
`relative-paths.test.mjs` gives —`src/` compiles without node's types— and it
runs inside `npm test`, so the rule is checked wherever the suite is.
*/

const literals = (text, kind) => findColours(text, kind).map((f) => f.literal)

describe('colour tokens', () => {
  it('src/ has no colour literal outside the theme blocks of tokens.css', () => {
    expect(check()).toEqual([])
  })

  it('every allowed literal says why', () => {
    for (const a of ALLOWED) expect(a.reason.length).toBeGreaterThan(40)
  })

  it('finds a hex, a colour function and a named colour in a stylesheet', () => {
    const css = '.a { color: #3a465b; background: rgba(5, 7, 10, 0.6); border-color: White; }'
    expect(literals(css, 'css')).toEqual(['#3a465b', 'rgba(5, 7, 10, 0.6)', 'White'])
  })

  it('finds the colour baked into an inline SVG', () => {
    const css = `.a { background-image: url("data:image/svg+xml,%3Csvg stroke='%238b95a7'%3E"); }`
    expect(literals(css, 'css')).toEqual(['%238b95a7'])
  })

  it('does not take a property, a selector or a token for a colour', () => {
    const css = '#root .tan { white-space: nowrap; color: var(--ink); background: color-mix(in srgb, var(--acc) 14%, transparent); }'
    expect(literals(css, 'css')).toEqual([])
  })

  it('ignores a colour quoted in a comment, in either language', () => {
    expect(literals('/* white over `#f5a524` gives 2.04:1 */ .a { color: var(--ink); }', 'css')).toEqual([])
    expect(literals("// was '#94a3b8'\nconst a = 1 /* rgb(33,37,41) */", 'ts')).toEqual([])
  })

  it('finds a colour in an inline style, and a named one as a whole string', () => {
    expect(literals("<img style={{ background: '#fff' }} />", 'ts')).toEqual(['#fff'])
    expect(literals("const c = { color: 'black' }", 'ts')).toEqual(["'black'"])
  })

  it('keeps line numbers through a stripped comment and a URL in a string', () => {
    const ts = "const u = 'http://www.w3.org/2000/svg'\n/* one\n   two */\nconst c = '#123456'"
    expect(stripComments(ts, 'ts').split('\n')).toHaveLength(4)
    expect(findColours(ts, 'ts')).toEqual([{ line: 4, literal: '#123456' }])
  })

  it('in tokens.css, a colour is only allowed inside a theme block', () => {
    const tokens = [
      ":root,\n[data-theme='dark'] {\n  --bg: #111315;\n}",
      "[data-theme='light'] {\n  --bg: #ffffff;\n}",
      ':root {\n  --s-1: 2px;\n  --stray: #222222;\n}',
    ].join('\n')
    expect(findOutsideThemes(tokens)).toEqual([{ line: 10, literal: '#222222' }])
  })

  it('an allowed literal that is no longer there is a finding', () => {
    const stale = { file: 'src/ui/Button.module.css', literal: '#2f3846', reason: 'moved to a token' }
    expect(check(undefined, [...ALLOWED, stale])).toEqual([
      'src/ui/Button.module.css  #2f3846  is allowed but no longer found: remove the entry',
    ])
  })
})
