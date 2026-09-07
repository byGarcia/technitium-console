/*
Las dos guardas de la señal del interruptor maestro que se comprueban sobre el
CÓDIGO FUENTE, no sobre un render.

Viven aquí y no junto a `maestro.test.tsx` por una razón mecánica: leen ficheros,
y todo lo que hay bajo `src/` compila con `types: ["vite/client"]` — sin los tipos
de node—, así que un `node:fs` ahí adentro pasa la suite y **rompe el build**. Fue
exactamente lo que pasó: 1039 pruebas en verde y `tsc -b` en rojo con cuatro
errores. Es el mismo agujero de la vez que el `grep -cE "^error"` decía «build 0»
mientras el build fallaba, y por eso el portón se mira por código de salida.

Lo que comprueban tampoco es de render: jsdom no aplica los módulos CSS y no hay
pantalla donde ver ninguna de las dos cosas.
*/
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const aqui = dirname(fileURLToPath(import.meta.url))
const src = resolve(aqui, '../src')

/*
El filete no puede ocupar retícula.

Con `border-left: 2px solid var(--acc)` las cinco filas dependientes de
`/settings/general/` medían `210px 540px 360px` contra el `210px 542px 360px` de
las otras 34: el borde se come dos píxeles de la caja y **desplaza el control**.
En un formulario denso eso es una columna que deja de estar alineada, y lo cazó
`dev/uniformity.js` como una tercera firma de `reticula-panel` que sólo existía en
esa ruta. Una señal de estado no puede mover el contenido que señala.
*/
describe('el filete del maestro no desplaza la retícula', () => {
  const css = readFileSync(resolve(src, 'ui/Form.module.css'), 'utf8')
  const regla = /\.dependiente\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''

  it('existe la regla y pinta el filete ámbar', () => {
    expect(regla).toMatch(/var\(--acc\)/)
  })

  it('y lo pinta con sombra interior, no con un borde que ocupe caja', () => {
    expect(regla).toMatch(/box-shadow:\s*inset/)
    expect(regla).not.toMatch(/border/)
    expect(regla).not.toMatch(/padding/)
  })
})

/*
La pastilla ámbar y la pastilla `warn` no pueden coincidir en una pantalla.

Medido el 2026-09-03 con la función de `dev/palette-distance.mjs`: contra `warn`,
el tono `acc` da ΔE00 **8,8** en el texto, **8,9** en el borde y **0,0** en el
fondo. El umbral de colisión de esa misma herramienta es 10, así que por el
criterio del proyecto **son el mismo color**. Y debe serlo: la pastilla acompaña
al filete ámbar de la fila y las dos son UNA señal; darle otro ámbar la partiría.

Que eso no cueste nada depende de un hecho, no de suerte: hoy las dos familias no
se cruzan —las siete `warn` viven en cluster, sesiones, apps y zonas; la `acc`,
sólo en los formularios de `Settings`—. Si algún día una pantalla pintara las dos,
el usuario vería dos pastillas idénticas queriendo decir «puedes» y «cuidado».
*/
describe('el ámbar de «puedes» no se cruza con el de «cuidado»', () => {
  const ficheros = (patron) => {
    const encontrados = []
    const recorrer = (dir) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const ruta = resolve(dir, e.name)
        if (e.isDirectory()) recorrer(ruta)
        else if (e.name.endsWith('.tsx') && !e.name.includes('.test.')) {
          if (patron.test(readFileSync(ruta, 'utf8'))) encontrados.push(ruta.slice(src.length + 1))
        }
      }
    }
    recorrer(src)
    return encontrados.sort()
  }

  it('ningún fichero pinta las dos', () => {
    const conAcc = ficheros(/dependeDe=|tone="acc"/)
    const conWarn = ficheros(/tone="warn"/)

    expect(conAcc.length).toBeGreaterThan(0)
    expect(conWarn.length).toBeGreaterThan(0)
    expect(conAcc.filter((f) => conWarn.includes(f))).toEqual([])
  })
})
