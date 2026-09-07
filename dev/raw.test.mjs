/*
The raw-output rules that live only in the CSS.

jsdom does not apply CSS modules, so no render test can see `white-space` or
`max-height` — and those are the two decisions this primitive exists to take. It
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
const regla = (n) => /* la declaración de esa clase */ new RegExp(`\\.${n}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? ''

describe('raw output does not wrap', () => {
  const text = regla('text')

  /*
  Es LA decisión del patrón 1. Los dos sitios donde estaba escrito antes usaban
  `pre-wrap` con `word-break`, y eso rompe lo único que hace legible un JSON
  largo: la indentación. Se paga con barra horizontal.
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

  /* El panel no crece con el contenido: medido, el visor cargó 1.073.928
     caracteres. */
  it('tiene tope de altura, y por variable para poder fijarlo por caso', () => {
    expect(text).toMatch(/max-height:\s*var\(--raw-height/)
  })

  /* El borde va en la caja: en el elemento que se desplaza, se iría con el
     scroll horizontal. */
  it('the border lives on the box and not on the text', () => {
    expect(regla('box')).toMatch(/border:/)
    expect(text).not.toMatch(/border:/)
  })
})
