/*
Regression tests for the uniformity tool.

It had none, and that is why `_sinFilas_` survived the August translation to
English for weeks: the class the filter looked for stopped existing, and nothing
said so until the phase-2 baseline was taken and `/dhcp/leases/` — an empty table
on a fresh harness — handed over its "No Lease Found" cell as the density sample
and produced a FOURTH table signature that does not exist.

A tool that measures drift and is not itself measured is a tool that will drift.
*/
import { describe, expect, it, beforeEach } from 'vitest'
import { screenSignatures, merge } from './uniformity.js'

/** A table like the console's: a header, and whatever rows are given. */
function table(rows) {
  const main = document.createElement('main')
  main.innerHTML = `
    <table>
      <thead><tr><th style="font-size:10.5px;font-weight:600">Zone</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`
  document.body.replaceChildren(main)
  return main
}

const CON_FILAS = '<tr><td class="_celda_abc" style="padding:9px 10px">casa.test</td></tr>'
/* The empty row. The class carries its hash suffix exactly as CSS modules emit
   it, because that is what the filter has to survive. */
const SIN_FILAS = '<tr><td class="_noRows_1arwr" style="padding:24px 10px">No Lease Found</td></tr>'

describe('la fila vacía no es una muestra de densidad', () => {
  beforeEach(() => document.body.replaceChildren())

  /*
  THE ONE THIS FILE EXISTS FOR, and its contract changed on 2026-09-07: an empty
  table used to sign `td —`, and `td —` is not "nothing" — it is a signature of
  its own, and `/dhcp/leases/` on a fresh harness handed it over as a third table
  look for months. A table with no data cell now contributes NO signature at all.

  The other half of the guard stays the same: if the `_noRows_` filter ever stops
  recognising the class, the padding of the empty row leaks in and invents one.
  */
  it('una tabla vacía no aporta ninguna firma, ni siquiera «td —»', () => {
    table(SIN_FILAS)
    expect(screenSignatures().tabla).toBeUndefined()
  })

  it('una tabla con filas sí aporta la suya', () => {
    table(CON_FILAS)
    expect(screenSignatures().tabla[0]).toContain('td 9px 10px')
  })

  /* La mezcla, que es el caso de `/dhcp/leases/` cuando SÍ tiene arrendamientos:
     la celda buena está detrás de la vacía y no puede ganarle. */
  it('con las dos, gana la celda de datos y no la vacía', () => {
    table(SIN_FILAS + CON_FILAS)
    const [firma] = screenSignatures().tabla
    expect(firma).toContain('td 9px 10px')
    expect(firma).not.toContain('24px')
  })

  /*
  Y la prueba que de verdad cierra el agujero: la clase se lee del CÓDIGO, no de
  esta constante. Si alguien vuelve a renombrarla —como pasó al traducir— esto se
  cae aquí y no en una foto base tomada seis semanas después.
  */
  it('la clase que salta el filtro es la que el código usa hoy', async () => {
    /* Desde la raíz del proyecto y no desde `import.meta.url`: bajo jsdom esa URL
       no es `file:` y `fileURLToPath` revienta. */
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const raiz = process.cwd()
    const tabla = readFileSync(join(raiz, 'src/ui/Table.tsx'), 'utf8')
    const herramienta = readFileSync(join(raiz, 'dev/uniformity.js'), 'utf8')

    const clase = tabla.match(/className=\{styles\.(\w*[Nn]o[Rr]ows\w*)\}/)?.[1]
    expect(clase, 'Table.tsx ya no pinta una clase de fila vacía reconocible').toBeTruthy()

    /*
    Contra la LÍNEA DEL FILTRO, no contra el fichero entero. La primera versión de
    esta prueba miraba todo `uniformity.js` y pasaba aunque el filtro estuviera
    roto, porque el nombre bueno aparecía en un comentario. Una prueba que se
    satisface con un comentario no prueba nada — y la única razón de que se viera
    es que se probó en negativo.
    */
    const filtro = herramienta.match(/const td = .*\n?.*!\/(\S+?)\/\.test/)?.[1]
      ?? herramienta.split('\n').find((l) => l.includes('.find((c) =>'))
    expect(
      filtro,
      `el filtro de fila vacía no salta la clase que Table.tsx usa hoy («${clase}»)`,
    ).toContain(`_${clase}_`)
  })
})

describe('merge agrupa por familia sin perder de qué ruta viene cada firma', () => {
  it('junta la misma firma de dos rutas y las nombra', () => {
    const informe = merge([
      { ruta: '/zones/', firmas: { tabla: ['A'] } },
      { ruta: '/cache/', firmas: { tabla: ['A'] } },
      { ruta: '/dhcp/leases/', firmas: { tabla: ['B'] } },
    ])
    const t = informe.find((f) => f.familia === 'tabla')
    expect(t.cuantas).toBe(2)
    expect(t.firmas).toContain('A  →  /zones/, /cache/')
    expect(t.firmas).toContain('B  →  /dhcp/leases/')
  })
})

/*
La ampliación de la fase 2: portales y avisos por tipo.

Dos agujeros a la vez. `Dialog` monta por portal, fuera de `<main>`, así que
durante toda la fase 1 esta herramienta **no vio ni un contenido de diálogo** —y el
piloto 2 decidió el sistema modal entero—. Y la familia `aviso` medía
`borderRadius | inset`, con lo que se podía pasar un aviso de relleno a contorno
**sin que ninguna familia se moviera**: justo la decisión que la fase 2 tiene que
tomar era invisible para la guardia que debía protegerla.
*/
function alerta({ tipo, fondo, icono = false, enDialogo = false }) {
  const main = document.createElement('main')
  const caja = `<div class="_alert_x _${tipo}_y" style="background:${fondo};border-radius:8px">
      ${icono ? '<svg aria-hidden="true"></svg>' : ''}<b>${tipo}!</b> texto
    </div>`
  if (enDialogo) {
    main.innerHTML = ''
    const d = document.createElement('div')
    d.setAttribute('role', 'dialog')
    d.innerHTML = caja
    document.body.replaceChildren(main, d)
  } else {
    main.innerHTML = caja
    document.body.replaceChildren(main)
  }
}

describe('la guardia ve los portales y separa los avisos por tipo', () => {
  beforeEach(() => document.body.replaceChildren())

  /*
  LA INVARIANTE. Ampliar la herramienta no puede mover lo que ya se midió: la foto
  base se tomó sin ningún diálogo abierto, y tiene que seguir valiendo.
  */
  it('sin diálogo abierto sólo mira <main>, como antes', () => {
    const main = document.createElement('main')
    main.innerHTML = '<div class="_alert_x _info_y" style="background:#123">a</div>'
    const fuera = document.createElement('div')
    fuera.innerHTML = '<div class="_alert_x _warning_y" style="background:#456">b</div>'
    document.body.replaceChildren(main, fuera)

    const f = screenSignatures()
    expect(Object.keys(f)).toContain('aviso-info')
    expect(Object.keys(f)).not.toContain('aviso-warning')
  })

  it('un aviso dentro de un diálogo YA se mide', () => {
    alerta({ tipo: 'warning', fondo: '#456', enDialogo: true })
    expect(screenSignatures()['aviso-warning']).toHaveLength(1)
  })

  it('info y warning caen en familias distintas, no en una sola', () => {
    const main = document.createElement('main')
    main.innerHTML =
      '<div class="_alert_x _info_y" style="background:#123">a</div>' +
      '<div class="_alert_x _warning_y" style="background:#456">b</div>'
    document.body.replaceChildren(main)

    const f = screenSignatures()
    expect(f['aviso-info']).toHaveLength(1)
    expect(f['aviso-warning']).toHaveLength(1)
    expect(f.aviso).toBeUndefined()
  })

  /* La medida que faltaba: con la firma anterior se podía pasar de relleno a
     contorno sin que nada se moviera. */
  it('distingue relleno de contorno', () => {
    alerta({ tipo: 'info', fondo: '#123' })
    expect(screenSignatures()['aviso-info'][0]).toContain('relleno')

    alerta({ tipo: 'info', fondo: 'transparent' })
    expect(screenSignatures()['aviso-info'][0]).toContain('contorno')
  })

  /* El tope de ancho: la tercera cosa que la firma no veía. Sin esto,
     `--notice-max` se podría aplicar —o dejar de aplicar— sin que nada se moviera. */
  it('la firma incluye el ancho pintado', () => {
    const main = document.createElement('main')
    main.innerHTML = '<div class="_alert_x _info_y" style="background:#123;max-width:880px">a</div>'
    document.body.replaceChildren(main)
    /* jsdom no hace layout, así que el ancho sale 0: lo que esta prueba fija es
       que la firma LLEVA el ancho, no cuánto mide. El número se comprueba en el
       barrido, contra la página real y a 1440. */
    expect(screenSignatures()['aviso-info'][0]).toMatch(/ancho \d+px/)

    main.innerHTML = '<div class="_alert_x _info_y" style="background:#123">a</div>'
    document.body.replaceChildren(main)
    expect(screenSignatures()['aviso-info'][0]).toMatch(/ancho \d+px/)
  })

  it('y detecta el icono', () => {
    alerta({ tipo: 'warning', fondo: '#456', icono: true })
    expect(screenSignatures()['aviso-warning'][0]).toContain('con-icono')

    alerta({ tipo: 'warning', fondo: '#456', icono: false })
    expect(screenSignatures()['aviso-warning'][0]).toContain('sin-icono')
  })
})

/*
Las dos familias del bloque de anchos de control. Miden lo RENDERIZADO —no lo
declarado— porque es la lección que ya costó dos correcciones en un mismo día: el
tope de los avisos vivía en el contenedor, y el relleno lo decidía el orden del
bundle. Mirar la declaración habría dado verde las dos veces.
*/
describe('anchos de control', () => {
  beforeEach(() => document.body.replaceChildren())

  const conCampos = (html) => {
    const main = document.createElement('main')
    main.innerHTML = html
    document.body.replaceChildren(main)
  }

  /* El campo numérico de un FORMULARIO y el de una CELDA son dos objetos: el
     primero tiene el ancho que le da la retícula de su rótulo y el segundo llena
     su columna. Juntos daban 104 px y 151 px en Settings y parecían deriva. */
  it('separa el campo numérico de formulario del de celda, y no mide los de texto', () => {
    conCampos('<input type="number"><input type="text">')
    const f = screenSignatures()
    expect(f['campo-num-ancho-form']).toHaveLength(1)
    expect(f['campo-num-ancho-form'][0]).toMatch(/^\d+px$/)
    expect(f['campo-num-ancho-celda']).toBeUndefined()
  })

  it('el numérico dentro de una celda cae en la otra familia', () => {
    conCampos('<table><tbody><tr><td><input type="number"></td></tr></tbody></table>')
    const f = screenSignatures()
    expect(f['campo-num-ancho-celda']).toHaveLength(1)
    expect(f['campo-num-ancho-form']).toBeUndefined()
  })

  /* La altura de un área es `rows` por la línea más el marco, así que medir la
     altura convertía en deriva que alguien pidiera cinco filas en vez de tres.
     Lo que se mide es la fórmula, y `rows` desaparece. */
  it('mide la fórmula del área de texto y no su altura', () => {
    conCampos('<textarea rows="3"></textarea><textarea rows="5"></textarea>')
    const f = screenSignatures()['campo-area-alto']
    expect(f).toHaveLength(1)
    expect(f[0]).toMatch(/^line .* \+ frame \d+px$/)
  })
})

/*
La retícula de la fila, panel y modal APARTE.

`Form` distingue los dos a propósito —210 px en el formulario denso, 180 en el
espacio reducido del diálogo— y está escrito en `Form.module.css:23`. La auditoría
2.1 lo llamó deriva desde un grep, sin abrir el fichero, y hubo que corregirlo.
Medirlos juntos habría dejado esa confusión metida en el instrumento.
*/
describe('la retícula de la fila se mide por contexto', () => {
  beforeEach(() => document.body.replaceChildren())

  it('separa la fila de panel de la de modal', () => {
    const main = document.createElement('main')
    main.innerHTML =
      '<div class="_row_a" style="grid-template-columns:210px 1fr">' +
      '<span class="_rowLabel_a"></span></div>' +
      '<div class="_mrow_b" style="grid-template-columns:180px 1fr">' +
      '<span class="_mrowLabel_b"></span></div>'
    document.body.replaceChildren(main)

    const f = screenSignatures()
    expect(f['reticula-panel']).toHaveLength(1)
    expect(f['reticula-modal']).toHaveLength(1)
  })

  /* `_mrow_` contiene la subcadena `row`: si se preguntara al revés, toda fila de
     modal se contaría como de panel y las dos familias se mezclarían. */
  it('no confunde una fila de modal con una de panel', () => {
    const main = document.createElement('main')
    main.innerHTML =
      '<div class="_mrow_b" style="grid-template-columns:180px 1fr">' +
      '<span class="_mrowLabel_b"></span></div>'
    document.body.replaceChildren(main)

    const f = screenSignatures()
    expect(f['reticula-modal']).toHaveLength(1)
    expect(f['reticula-panel']).toBeUndefined()
  })

  /*
  Y el `.row` de OTRO módulo no es una fila de formulario.

  Medido en la consola: Cache, Allowed, Blocked y View Logs tienen su propio
  `.row`, que no es una retícula, y la familia salía con una firma `none` que no
  es la retícula de ningún formulario. Lo que separa a los dos es el rótulo, que
  toda fila de `Form` pinta como hijo directo.
  */
  it('ignora el `.row` de otro módulo, que no es una fila de formulario', () => {
    const main = document.createElement('main')
    main.innerHTML =
      '<div class="_row_a" style="grid-template-columns:210px 1fr">' +
      '<span class="_rowLabel_a"></span></div>' +
      '<div class="_row_zzz" style="display:flex"></div>'
    document.body.replaceChildren(main)

    const f = screenSignatures()
    expect(f['reticula-panel']).toEqual(['210px 1fr'])
  })
})
