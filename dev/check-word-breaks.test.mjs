import { describe, expect, it } from 'vitest'
import { ALLOWED, check, findBreaks } from './check-word-breaks.mjs'

/*
The gate behind "a name is never cut letter by letter". It runs inside `npm test`,
as the colour gate does, so the rule is checked wherever the suite is.
*/

describe('word breaks', () => {
  it('src/ breaks inside words only where the allowed list says why', () => {
    expect(check()).toEqual([])
  })

  it('every allowed entry says why', () => {
    for (const a of ALLOWED) expect(a.reason.length).toBeGreaterThan(40)
  })

  it('finds the three declarations, with the selector that holds each', () => {
    const css = '.a { word-break: break-all; }\ntd .b, .c { color: var(--ink); overflow-wrap: anywhere; }\n.d{word-break:break-word}'
    expect(findBreaks(css).map((b) => [b.selector, b.value])).toEqual([
      ['.a', 'break-all'], ['td .b, .c', 'anywhere'], ['.d', 'break-word'],
    ])
  })

  it('lets through the wrap that keeps words whole, and a rule quoted in a comment', () => {
    expect(findBreaks('/* was `word-break: break-all` */ .a { overflow-wrap: break-word; word-break: normal; }')).toEqual([])
  })
})
