/**
 * The guard that keeps `src/` in English.
 *
 * `CONVENTIONS.md` has said since the first day that "everything is in ENGLISH —
 * the interface, the code, the comments and the tests", and the visual redesign
 * broke it from the inside over three weeks: the interface stayed English and the
 * code did not. By 2026-09-07 there were 60 files with Spanish comments, 19 with
 * Spanish names and eighteen Spanish identifiers, and **nothing was measuring
 * it**. This is what measures it.
 *
 * It looks at three things, and it looks at them in `src/` only:
 *
 *  - **File names.** A path segment that is not a word this project writes in
 *    English. It is a blacklist of Spanish stems and not a dictionary: it cannot
 *    catch a name nobody has thought of yet.
 *  - **Comments.** Any `/* *\/`, `//` or `{/* *\/}` that carries Spanish. Two
 *    signals: the characters `á é í ó ú ü ñ ¿ ¡`, which Spanish prose cannot
 *    avoid, and a list of accent-free words that are unambiguously Spanish —
 *    `porque`, `cuando`, `hay`, `del`… None of them is an English word, which is
 *    why the list can be short and still catch prose.
 *  - **Identifiers.** The same word list, outside comments and outside string
 *    literals, so a Spanish variable or a Spanish `describe()` is caught too.
 *
 * What it deliberately does NOT look at:
 *
 *  - `dev/`. The tools are ours and their family names —`campo-area-alto`,
 *    `aviso-info`— are **data**: they are compared against the evidence JSONs
 *    already stored, so renaming them would invalidate the baselines rather than
 *    translate anything.
 *  - Anything quoted inside a comment. A comment that quotes upstream's Spanish,
 *    or a value, is quoting data and not writing prose. Quoted text between a
 *    matched pair of backticks or `"` is stripped before the check.
 *
 * Exit code is the number of findings, so it can sit in the gate.
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), '..')
const SRC = path.join(ROOT, 'src')

const ACCENTS = /[áéíóúüñ¿¡]/i
/* Every one of these is a word Spanish prose can hardly avoid and English never
   uses. Short ones that ARE English —`no`, `es`, `la`, `se`— are left out on
   purpose: they would flag English paragraphs and a guard that cries wolf gets
   switched off. */
const WORDS = /\b(porque|cuando|pero|sino|para|hay|una|unos|unas|los|las|del|que|con|por|sin|entre|desde|cada|donde|como|aunque|mientras|siempre|nunca|tambien|entonces|segun|asi|solo|mas|esta|estan|habia|era|fue|tiene|hace|puede|debe|esto|este|eso|esa|ese|sus|nada|todo|toda|algo|otra|otro|misma|mismo|aqui|alli|ademas|ahora|antes|despues|dentro|fuera|arriba|abajo|encima|debajo)\b/i
const NAMES = /(ranura|caducado|crudo|senal|avisador|aviso|externo|boton|maestro|bloque|fallo|leyenda|interaccion|rotulo|pantalla|tarjeta|hueco|prueba|nodo|vacio|columna|fila|ayuda|derecha|izquierda)/i

/* Spanish that hides inside an identifier rather than in prose: `setTexto`,
   `compacto`, `nombreRelativo`, `.caja`. The word list above does not see these
   —they are not words on their own— so the stems go in a list of their own, and
   it is checked against identifiers and class names, never against comments,
   where an English sentence may legitimately quote one. */
const STEMS = /\b[A-Za-z]*(?:ranura|caducad|senal|avisad|externo|boton|maestro|bloque|fallo|leyenda|interaccion|rotulo|pantalla|tarjeta|hueco|vacio|columna|fila|ayuda|derecha|izquierda|texto|abiert|compacto|compacta|guardar|cargar|borrar|elegid|marcad|cerrad|nombre|caja|pastilla|salto|ultimo|arbol|secciones|orden(?![a-z])|prueba)[A-Za-z]*\b/

/*
Spanish that hides INSIDE an identifier: `esCache`, `pideTotp`, `firmaBase`.

Substring stems get this wrong in both directions —`firma` sits inside
`confirmation`, which is English, and `orden` misses `ordenar`— so the line is
broken into its camelCase pieces first and each piece is looked up WHOLE. That is
what catches `esCache` without flagging `confirmation`, and it is why `es` can be
on the list at all: as a whole word it is Spanish, as a substring it is in half
the English dictionary.

It runs alongside the stem list, not instead of it: the stems still catch the
inflections a whole-word lookup cannot see.
*/
/*
Two lists in one: the whole Spanish words of `WORDS` —which as camelCase pieces
are just as Spanish as they are in prose, and `setPorDesinstalar` proved it: `por`
is on that list and the regex missed it because there is no word boundary inside
an identifier— plus the nouns this codebase actually reached for.

It grows by finding, and that is the honest way to keep it: every entry below was
added because something got through. `por`, `desinstalar`, `hay`, `nota`, `tienda`
and `anotacion` are the batch of 2026-09-07, from Apps.
*/
const PIECES = new Set(
  (
    'porque cuando pero sino para hay una unos unas los las del que con por sin entre desde cada ' +
    'donde como aunque mientras siempre nunca tambien entonces segun asi solo mas esta estan habia ' +
    'era fue tiene hace puede debe esto este eso esa ese sus nada todo toda algo otra otro misma ' +
    'mismo aqui alli ademas ahora antes despues dentro fuera arriba abajo encima debajo ' +
    'es firma firmas firmar pedir pide piden confirmar desinstalar instalar texto nodo nodos arbol ' +
    'caja cajas vacio vacia senal senial aviso avisos rotulo rotulos pantalla pantallas prueba ' +
    'pruebas orden ultimo ultima salto hueco huecos fila filas columna columnas ayuda derecha ' +
    'izquierda abierto abierta compacto compacta guardar cargar borrar marcado cerrado nombre ' +
    'nombres pastilla boton maestro bloque fallo fallos leyenda caducado ranura externo nota notas ' +
    'tienda anotacion reemplazar reemplaza tabla ficha fichas ' +
    'fecha fechas hora horas dia dias mes meses tiempo valor valores clave claves llave lista listas ' +
    'listar buscar busca filtro filtros filtrar crear editar mostrar ocultar enviar recibir contar ' +
    'cuenta cuentas ancho anchos alto largo corto nuevo nueva viejo antiguo activo activa apagado ' +
    'encendido cerrar abrir volver seguir contiene devuelve llama espera ' +
    'carga cargas bloques cero dos tres cuatro cinco seis siete ocho nueve diez digito digitos ' +
    'usuario usuarios conserva pegado golpe flotante foco hueco fuerte medio cajon curso ajustes enlaces seccion contenido iteraciones mirar estado ' +
    /*
    2026-09-30, the fifth hole. The gate was green and a census —every identifier
    split into its camelCase pieces, each piece looked up in an English corpus and
    the leftovers read by hand— found about 140 Spanish identifiers in 90 files:
    `PropiedadesDnssec`, `EnElCromo`, `servidoresPrimariosObligatorios`, `setOlvido`,
    `.testigo`, `data-testid="hueco"`, a dozen Spanish test descriptions. None of
    them used a word on this list, and that is the whole lesson: a blacklist only
    sees the words someone has already met. It cannot be completed by thinking
    harder; the census is what finds the next batch, and its words come here.

    These are the pieces of that sweep, renamed and now refused. Left out on
    purpose, although they were Spanish where they appeared: `el` and `en`, which
    this code uses in English as the usual shorthand for an element and for the
    enablement rules, and the one-letter `a` / `o` of `aSlug` and `.oLogin`, which
    as whole pieces are in every English identifier.
    */
    'agente alta anadiendo apagada aplanar archivo automatico cambiar campo casilla casos catalogo ' +
    'catalogos celda clases coincidencias conteo cromo crudas cruda cuerpo cuerpos curvas datos depende ' +
    'dependiente descarte destino detalle dialogo dibujo disponibles ejemplo elemento elementos entero ' +
    'entrada escapar eventos explicadas fallar fallido fijo forma formulario hacer hola huellas icono ' +
    'ignorar inicial inicializar inicio instaladas interfaz inverso lanzar llamada llegar mandar manda ' +
    'marca miembros modo muestra obligatorio obligatorios observador ocultas ocultos olvido otras ' +
    'partido pestana pintadas pintar preparar previo previa primario primarios propiedades protocolo ' +
    'protocolos punto raiz recuento refrescar respuesta resultado roto salida secciones sectores ' +
    'selectores separados serie servidor servidores sobrescribir sujetos tamanos testigo tipo tira ' +
    'todos tono unico usos visibles visto fin ir ya de al par fase grafica ninguna lecturas transporte ' +
    'completos propaga tal cual vaciar importar exportar dominios unirse uno existente construir ' +
    'piezas puras sesiones activas modales sobra esperaba falta'
  ).split(' '),
)

/*
The description of a test is prose, and it was the one piece of prose this file
could not see: code lines have their single-quoted strings stripped —that is what
keeps a Spanish DATA literal from being reported— and a test description is a
single-quoted string like any other.

So it is read back on purpose, and only from the three functions that take one.
`AGENTS.md` says test descriptions are English; this is what enforces it.
*/
const DESCRIPTION = /\b(?:it|test|describe)(?:\.\w+)?\(\s*(?:'([^']*)'|`([^`]*)`|"([^"]*)")/g

/*
Names that live inside a string and are still names: a test id and a `data-`
attribute. Stripping string literals is what keeps Spanish DATA quiet, and it also
hid `data-testid="hueco"` and a selector for `[data-activa="true"]` that matched
nothing because the attribute had been renamed to `data-active` everywhere else
(2026-09-30, the fifth hole). These are read back from the raw line.
*/
const NAMED_IN_STRING = /(?:data-testid=\{?\s*|ByTestId\(\s*)['"`]([^'"`]*)['"`]|\bdata-([a-z][a-z-]*)/g

/** Every camelCase piece of every identifier on the line, lower-cased. */
function pieces(line) {
  const out = []
  for (const id of line.match(/[A-Za-z][A-Za-z0-9]*/g) ?? []) {
    for (const w of id.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/\s+/)) {
      if (w) out.push(w.toLowerCase())
    }
  }
  return out
}

/* Proper names are not prose: `Adrián` carries an accent and appears in a dozen
   decisions that are written in English around it. `Archivo` is the typeface the
   interface is set in (`theme/base.css`), capitalised as its foundry writes it; the
   lower-case `archivo` is Spanish and stays refused. */
const NAMES_ALLOWED = /Adri[áa]n|\bArchivo\b/g
function stripQuoted(s) {
  return s
    .replace(NAMES_ALLOWED, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .replace(/"[^"\n]*"/g, ' ')
    .replace(/«[^»\n]*»/g, ' ')
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx|css)$/.test(e.name)) out.push(p)
  }
  return out
}

/* Comments and code, told apart the cheap way: this is a linter for prose, not a
   parser. A `//` inside a string literal is the known false positive, and the
   quoted-text strip above is what keeps it quiet. */
function split(text) {
  const comments = []
  const code = []
  let i = 0
  const lines = text.split('\n')
  while (i < lines.length) {
    const l = lines[i]
    if (l.includes('/*')) {
      let j = i
      while (j < lines.length && !lines[j].includes('*/')) j++
      for (let k = i; k <= Math.min(j, lines.length - 1); k++) comments.push([k + 1, lines[k]])
      i = j + 1
    } else if (l.trim().startsWith('//') || l.trim().startsWith('*')) {
      comments.push([i + 1, l]); i++
    } else {
      const at = l.indexOf('//')
      if (at >= 0) { comments.push([i + 1, l.slice(at)]); code.push([i + 1, l.slice(0, at)]) }
      else code.push([i + 1, l])
      i++
    }
  }
  return { comments, code }
}

const findings = []
for (const file of walk(SRC)) {
  const rel = path.relative(ROOT, file)
  if (NAMES.test(path.basename(file))) findings.push(`${rel}  file name is not English`)

  const text = fs.readFileSync(file, 'utf8')
  const { comments, code } = split(text)

  for (const [n, line] of comments) {
    const clean = stripQuoted(line)
    /*
    The comments were checked against WORDS only, and prose without an accent or
    one of those connectives walked through: «Cuatro bloques.», «Tabla»,
    «/* Fechas *\/», «cerrar no avisa» (2026-09-30, the fourth hole). The whole-
    word PIECES lookup is applied here too; on the day it was added it flagged
    nothing that was not Spanish.
    */
    const spanishWord = (clean.toLowerCase().match(/[a-z]+/g) ?? []).find((w) => PIECES.has(w))
    if (ACCENTS.test(clean) || WORDS.test(clean) || spanishWord != null) findings.push(`${rel}:${n}  Spanish in a comment: ${line.trim().slice(0, 70)}`)
  }
  for (const [n, line] of code) {
    const clean = stripQuoted(line).replace(/'[^'\n]*'/g, ' ')
    const spanishPiece = pieces(clean).find((w) => PIECES.has(w))
    if (ACCENTS.test(clean) || WORDS.test(clean) || STEMS.test(clean) || spanishPiece != null)
      findings.push(`${rel}:${n}  Spanish in code: ${line.trim().slice(0, 70)}`)

    for (const m of line.matchAll(DESCRIPTION)) {
      const what = m[1] ?? m[2] ?? m[3] ?? ''
      const piece = pieces(what).find((w) => PIECES.has(w))
      if (ACCENTS.test(what) || WORDS.test(what) || piece != null)
        findings.push(`${rel}:${n}  Spanish in a test description: ${what.slice(0, 70)}`)
    }

    for (const m of line.matchAll(NAMED_IN_STRING)) {
      const name = m[1] ?? m[2] ?? ''
      const piece = pieces(name.replace(/-/g, ' ')).find((w) => PIECES.has(w))
      if (ACCENTS.test(name) || piece != null)
        findings.push(`${rel}:${n}  Spanish in a test id or data attribute: ${name.slice(0, 70)}`)
    }
  }
}

if (findings.length === 0) {
  console.log('\n  src/ is in English: no Spanish in names, comments or identifiers.\n')
} else {
  const byFile = new Map()
  for (const f of findings) {
    const k = f.split(':')[0].split('  ')[0]
    byFile.set(k, (byFile.get(k) ?? 0) + 1)
  }
  const sorted = [...byFile].sort((a, b) => b[1] - a[1])
  for (const [f, n] of sorted) console.log(`  ${String(n).padStart(4)}  ${f}`)
  console.log(`\n  ${findings.length} findings in ${byFile.size} files\n`)
  if (process.env.DETAIL) for (const f of findings) console.log('  ' + f)
}
process.exit(Math.min(findings.length, 250))
