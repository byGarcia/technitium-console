/*
The contract of a Settings pane, generated and not written.

`dialog-contract-doc.mjs` did this for the eleven dialogs of pilot 2, and the
reason is the same one: a document whose whole value is that its figures match
the code must not have those figures typed in by hand. Here the point is sharper,
because a dense form is mostly TEXT — 39 controls carry 39 help paragraphs, 19
inline suffixes and 12 notices — and text is exactly what gets summarised away.

## Two sources, on purpose

  · `static-contract.mjs` on `screens/settings` — the CENSUS. What exists,
    read from the source with TypeScript's parser.
  · `docs/direction/evidencia/general-dom.json` — the ATTACHMENT. Which help
    hangs off which control, which section holds it, which suffix trails it, and
    which master switch greys it out. The AST sees a flat list of labels and a
    flat list of help strings; only the rendered page says they belong together.

Pilot 2 learnt this the expensive way in the other direction: a contract taken
from the screen alone missed the cluster selector, because a standalone instance
never draws it. Neither reading is enough. The evidence file is verified against
the live DOM element by element (SHA-256 per string, not a checksum over the
whole: a sum collides with any transposition).

## What this does NOT decide

Order. The sections come out in the order the page paints them because that is a
fact about today, not a recommendation — the pilot is being asked to decide
order, and it is told so in as many words.
*/
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT, inventory } from './static-contract.mjs'

const ev = JSON.parse(readFileSync(join(ROOT, '../docs/direction/evidencia/general-dom.json'), 'utf8'))
const ast = inventory(join(ROOT, 'screens/settings/panes/General.tsx'))

const out = []
const w = (s = '') => out.push(s)

/*
El guardián que faltaba, y que costó un hallazgo del piloto 3.

El contrato afirmaba «seis GroupRow» y la evidencia sólo nombraba dos, porque el
extractor del DOM emitía el nombre del control y, dentro de un grupo, ganaba el
del control. Una cifra sin su inventario: el mismo error que ya se había corregido
con los sufijos, en otro sitio.

Así que no se vuelve a afirmar un recuento que no se pueda enumerar: **toda
etiqueta estructural que el AST ve tiene que estar nombrada en la evidencia**, o
esto revienta en vez de generar un contrato que dice un número y no dice cuáles.
*/
const estructurales = ast.fields.filter((f) => f.tag === 'GroupRow' || f.tag === 'EditableList')
const nombradas = new Set([
  ...ev.secciones.flatMap((s) => s.grupos ?? []),
  ...ev.secciones.flatMap((s) => s.listas.map((l) => l.n)),
])
const faltan = estructurales.filter((f) => !nombradas.has(f.label))
if (faltan.length) {
  throw new Error(
    `la evidencia no nombra ${faltan.length} de las ${estructurales.length} etiquetas estructurales que el AST ve: ` +
      faltan.map((f) => `${f.tag} «${f.label}»`).join(' · '),
  )
}

const ctl = ev.secciones.flatMap((s) => s.ctl)
const listas = ev.secciones.flatMap((s) => s.listas)
const avisos = ev.secciones.flatMap((s) => s.av)
const sufijos = ctl.filter((c) => c.suf)
const apagados = ctl.filter((c) => c.off)

w('# Piloto 3 — el contrato de `Settings › General`')
w()
w(`Generado por \`dev/pane-contract-doc.mjs\` el **2026-09-02**, de dos fuentes y no de una:`)
w('el **censo** lo da `static-contract.mjs` leyendo el fuente con el parser de TypeScript, y')
w('la **atadura** —qué ayuda cuelga de qué control, en qué sección, con qué sufijo y qué lo')
w('apaga— la da `evidencia/general-dom.json`, verificado contra el DOM vivo **elemento a')
w('elemento** con SHA-256 por cadena.')
w()
w('> Un contrato tomado sólo de la pantalla no ve lo que el harness no puede dibujar; uno tomado')
w('> sólo del fuente no sabe qué va con qué. El piloto 2 pagó la primera mitad de esa lección.')
w()
w('## Las tres poblaciones, que no son una suma')
w()
w('El AST cuenta 47 y el DOM 54, y **no hay una coincidencia que celebrar**: hay tres cosas de')
w('naturaleza distinta, y sólo la primera es lo que el diseño no puede perder.')
w()
w('| Población | Cuántos | Qué es |')
w('|---|---|---|')
w(`| **Controles comparables** | **${ctl.length}** | En el fuente y en la pantalla. **Lo innegociable.** |`)
w(`| Etiquetas estructurales | ${estructurales.length} | Sólo en el AST, y **nombradas una a una más abajo**: ${estructurales.filter((f) => f.tag === 'GroupRow').length} \`GroupRow\` y ${estructurales.filter((f) => f.tag === 'EditableList').length} \`EditableList\`. La pantalla las pinta como encabezado o como rótulo de lista, nunca como control |`)
w('| Celdas de filas de datos | 15 | Sólo en el DOM: las celdas de las dos listas QPM. Son **dato del servidor** — con otra configuración son otro número |')
w()
w('## El cromo del panel')
w()
w(`- **Título:** \`${ev.cromo.titulo}\`. Migas: \`${ev.cromo.migas}\`.`)
w(`- **Nueve subpestañas**, y \`General\` es una de ellas: ${ev.cromo.subpestanas.map((t) => `\`${t}\``).join(' · ')}.`)
w(`  La activa se marca con \`${ev.cromo.subpestana_activa.marca}\` y es un enlace real`)
w(`  (\`${ev.cromo.subpestana_activa.href}\`), no una pestaña de JavaScript: cada panel tiene su URL.`)
w(`- **Barra pegajosa** (\`position: ${ev.cromo.barra.posicion}\`) con **${ev.cromo.barra.botones.length} botones**:`)
w(`  ${ev.cromo.barra.botones.map((b) => `\`${b}\``).join(' · ')}.`)
w()
w('  **La barra no es de este panel: es de los nueve**, y eso cambia lo que significa cada botón.')
w('  Tres cosas de `Settings.tsx:38-53`, las tres verificadas en el fuente y ninguna deducible del')
w('  dibujo:')
w()
w('  1. **`Save Settings` envía SIEMPRE los campos de los nueve paneles**, se esté donde se esté.')
w('     No hay nueve formularios: hay uno con nueve pestañas. Trocearlo por pestaña cambiaría qué')
w('     se guarda.')
w('  2. **Los tres permisos de la barra son distintos**: guardar pide `Settings.canModify`, vaciar')
w('     la caché `Cache.canDelete`, y copia y restauración `Settings.canDelete`. Los botones')
w('     aparecen o no según eso. Son **tres puertas independientes** —copia y restauración')
w('     comparten una— y por tanto hasta **ocho combinaciones de visibilidad**, no cuatro.')
w('  3. **Un fallo de validación puede estar en otra subpestaña.** Upstream enfoca el campo aunque')
w('     su pestaña esté oculta y el usuario no ve nada; aquí el aviso dice qué falta y **la')
w('     pantalla salta a la subpestaña de ese campo**. Está resuelto en el código: el piloto no')
w('     tiene que inventarlo, y no puede perderlo.')
w()
w('  Y **`Flush Cache` pregunta antes de actuar**, con un `Confirm` cuyo contrato entero es su')
w('  frase — el mismo patrón que el piloto 2 cerró:')
w()
w('  > Are you sure to flush the DNS Server cache?')
w()
w('  Título `Flush Cache`, verbo `Flush`, **no destructivo** (`variant="primary"`).')
w('  `Settings.tsx:375`. Es la única confirmación alcanzable desde este panel; las otras dos de la')
w('  pantalla —`Temporary Disable Blocking` y `Update Block Lists`— viven en el panel `Blocking`.')
w()
w('## Los interruptores maestros y lo que apagan')
w()
w('`General` **no tiene ni un condicional de render**: nada aparece y desaparece. Lo que tiene son')
w(`**dos interruptores** y **${apagados.length} controles que se deshabilitan** con ellos. Comprobado abriendo los dos`)
w('estados en el harness, no leído de una captura: encendidos los dos, no queda ni un control gris.')
w()
for (const d of ev.dependencias) {
  w(`- **\`${d.maestro}\`** apaga ${d.apaga.map((x) => `\`${x}\``).join(' · ')}`)
}
w()
w('Un campo gris porque su maestro está apagado y uno gris porque no hay permiso **se ven igual y no')
w('son lo mismo**. Es una de las cosas que este piloto tiene que resolver.')
w()
w('## Las 8 etiquetas estructurales, nombradas')
w()
w('Se enumeran porque **un recuento sin inventario no es un contrato**: el piloto 3 declaró abierto')
w('«cuatro rótulos de grupo» precisamente porque la primera versión decía seis y nombraba dos.')
w()
w('| Rótulo | Tipo | Dónde |')
w('|---|---|---|')
for (const s of ev.secciones) {
  for (const g of s.grupos ?? []) w(`| \`${g}\` | \`GroupRow\` | sección **${s.s}** |`)
  for (const l of s.listas) w(`| \`${l.n}\` | \`EditableList\` | sección **${s.s}** |`)
}
w()
w('**Y aquí hay una decisión que tomar, que el contrato anterior escondía**: cinco de los seis')
w('`GroupRow` **repiten el título de su sección** —`Software Update` bajo la sección `Software')
w('Update`, `DNSSEC` bajo `DNSSEC`, `UDP Socket Pool` bajo `UDP Socket Pool`, `IPv6 Support` bajo')
w('`IPv6`, `EDNS Client Subnet (ECS)` bajo `EDNS Client Subnet`—. Hoy la pantalla los pinta los dos,')
w('uno debajo del otro. **Sólo `Zone Defaults` dice algo que su sección no dice.** Si esa repetición')
w('se dibuja dos veces, una, o la sección se queda con el rótulo del grupo, es decisión de diseño.')
w()
w(`## Los ${sufijos.length} sufijos en línea`)
w()
w('Van pegados al control, en la misma línea, y **no son decoración**: la mayoría es el único sitio')
w('de la pantalla donde se lee el rango admitido y el valor por defecto. Un dibujo que los pierda')
w('convierte un campo con reglas en una caja vacía.')
w()
w('| Control | Sufijo, literal |')
w('|---|---|')
for (const c of sufijos) w(`| \`${c.n}\` | \`${c.suf}\` |`)
w()
w(`## Las ${ev.secciones.length} secciones, con todo lo que llevan dentro`)
w()
w('Cada control con **su** ayuda, no cerca de ella. Los textos van literales y enteros: es un')
w('formulario denso, y aquí la ayuda **es** la superficie — resumirla es perderla.')
w()
for (const s of ev.secciones) {
  w(`### ${s.s}`)
  w()
  if (s.grupo) w(`Rótulo de grupo dentro de la sección: **\`${s.grupo}\`**.`)
  if (s.grupo) w()
  for (const c of s.ctl) {
    const marcas = [`_${c.t}_`]
    if (c.suf) marcas.push(`sufijo \`${c.suf}\``)
    if (c.off) marcas.push('**apagado por su maestro**')
    w(`- **\`${c.n}\`** — ${marcas.join(' · ')}`)
    w(`  > ${c.h}`)
  }
  for (const l of s.listas) {
    w(`- **\`${l.n}\`** — _lista editable_, columnas ${l.cols.filter(Boolean).map((x) => `\`${x}\``).join(' · ')}`)
    w(`  (más la columna de borrado). En el harness trae ${l.filas_en_el_harness} filas; **el número es dato, no superficie**.`)
    w(`  > ${l.h}`)
  }
  if (s.av.length) {
    w()
    w(`**Avisos de esta sección (${s.av.length}), literales:**`)
    w()
    for (const a of s.av) w(`> ${a}`)
    w()
  }
  w()
}
w('## Lo que este contrato NO dice')
w()
w('- **El orden.** Las secciones salen en el orden en que la página las pinta hoy. Es un hecho, no')
w('  una recomendación: decidir el orden es parte de lo que se le pide al piloto.')
w('- **Nada visual.** Ni color, ni espaciado, ni tipografía. Eso es lo que se está pidiendo cambiar.')
w('- **Los otros ocho paneles.** `General` es el más denso de los nueve, y el que trae el vocabulario')
w('  entero de una vez. Lo que se decida aquí lo heredan los otros ocho **y DHCP**, porque el kit de')
w('  formulario (`ui/PanelForm.tsx`) es de las dos pantallas: son los dos formularios grandes de la')
w('  consola.')
w()
w('## Lo que el lector no resuelve, dicho y no escondido')
w()
w(`En \`General\`, **nada**: ${ast.unresolved.length} sin resolver.`)
w()
w('En los nueve paneles hay **uno**, y está en `Tsig.tsx`: el `aria-label={name}` del `<Select>` de')
w('algoritmo dentro de `EditableList`, que la lista pone por fila. Es la misma familia que')
w('`TSIG key name ${i+1}`, y su patrón —la fila repetible— **ya lo decidió el piloto 2**.')
w()
w('## Contra qué se comprueba al volver')
w()
w(`- Los **${ctl.length} controles**, por nombre.`)
w(`- Sus **${ctl.length + listas.length} ayudas**: las ${ctl.length} de los controles **y las ${listas.length} de las listas**, que tienen`)
w('  la suya propia. Exigir sólo las de los controles dejaría fuera dos párrafos que están en')
w('  pantalla y en este contrato.')
w(`- Los **${sufijos.length} sufijos**, literales.`)
w(`- Los **${avisos.length} avisos**, literales, en su sección.`)
w(`- Las **${ev.secciones.length} secciones** y las **${listas.length} listas** con sus columnas.`)
w(`- Las **nueve subpestañas** y la **barra pegajosa** con sus cuatro botones.`)
w(`- La relación de los **dos maestros** con sus **${apagados.length} dependientes**.`)
w('- La **confirmación de `Flush Cache`** con su frase literal.')
w('- Que `Save Settings` **guarda los nueve paneles** y que la validación **salta a la subpestaña**')
w('  del campo que falla.')
w()
w('**Siete de esas cosas son re-comprobables con una orden**, y las demás no: `verify-evidencia.mjs`')
w('compara contra la página, elemento a elemento y con el SHA-256 entero de cada cadena, los')
w('**nombres, las ayudas, los avisos, los sufijos, las secciones, las listas y la barra**. Si el')
w('panel cambia antes de que vuelva el piloto, eso lo dice en vez de dejarlo pasar:')
w()
w('```')
w('node dev/verify-evidencia.mjs --snippet      # la función que se ejecuta en la consola del panel')
w('node dev/verify-evidencia.mjs captura.json   # compara lo que devolvió')
w('```')
w()
w('**Lo que no re-comprueba, y por qué** —dicho aquí para que nadie lea la lista de arriba como si')
w('saliera entera de una orden—: las **nueve subpestañas** no están dentro de `<main>`, porque las')
w('monta el panel lateral del Shell y llegan por prop (`Settings.tsx:38`); los **dos maestros y sus')
w('cinco dependientes** exigirían pulsar la página, y un verificador que altera lo que comprueba es')
w('peor que uno que declara un límite; y la **confirmación de `Flush Cache`**, el alcance de')
w('`Save Settings` y el salto de validación se leen del fuente, donde `static-contract.mjs` y sus')
w('pruebas ya los cubren. Están en el contrato porque se verificaron una vez, a mano y en el código.')

process.stdout.write(out.join('\n') + '\n')
