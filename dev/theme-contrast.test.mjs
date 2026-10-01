import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { themeTokens } from './check-colour-tokens.mjs'
import { codePalettes, regressions, thinSeries, uiClashes } from './palette-distance.mjs'
import { measure } from './theme-contrast.mjs'

/*
The light theme's two measurements, inside `npm test`: a value tuned by hand in
`tokens.css` that breaks a pair breaks the suite, not only the script nobody ran.
Dark is measured by the same scripts and not gated here; see their headers.
*/
const here = dirname(fileURLToPath(import.meta.url))
const themes = themeTokens(readFileSync(resolve(here, '../src/theme/tokens.css'), 'utf8'))

describe('the light theme, measured', () => {
  it('every text and control colour meets its threshold on every surface it is drawn on', () => {
    const under = measure(themes.light).filter((r) => !r.pass).map((r) => `--${r.fg} on ${r.on}: ${r.ratio.toFixed(2)}`)
    expect(under).toEqual([])
  })

  it('every chart series holds 3:1 on the panel and is not the colour of the interface', () => {
    const { light } = codePalettes()
    expect(thinSeries(light, light.pan)).toEqual([])
    expect(uiClashes(light, { ink: light.ink, mute: light.mute, faint: light.faint, line: light.line })).toEqual([])
  })

  it('no pair of series separates less in light than in dark, unless both are past 15', () => {
    const { dark, light } = codePalettes()
    expect(regressions(dark, light)).toEqual([])
  })
})
