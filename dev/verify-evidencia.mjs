/*
Proves that `docs/direction/evidencia/general-dom.json` still says what the screen
says.

## Why it exists

That file is the ATTACHMENT half of the pilot-3 contract: which help hangs off
which control, which section holds it, which suffix trails it, which master
switch greys it out. The AST cannot supply it — it sees a flat list of labels and
a flat list of help strings — so the evidence was read off the rendered page and
written by hand. Anything written by hand about 41 paragraphs of text is a
transcription risk, and a contract nobody can re-check is a contract nobody
should trust.

## Why it compares element by element

The first pass compared a SUM of character counts. That is not a proof: any
transposition collides. This hashes EACH string on its own — the WHOLE SHA-256,
not a prefix of it — and walks the two lists in step, so a mismatch names the
element that moved.

An earlier version truncated the digest to 16 hex characters and still called
itself SHA-256. Sixteen hex characters are 64 bits, which is a fine fingerprint
and is NOT what the name says. Either take the whole thing or rename it; this
takes the whole thing, because the only thing truncation was buying was shorter
lines in a file nobody reads by eye.

## What it does NOT re-check, and why

Eight things are compared: names, help, notices, suffixes, sections, GROUP
LABELS, lists and the bar. The group labels are the eighth because they were the
one thing this file was silent about while the contract counted them. Three facts of the contract are NOT:

  · the nine sub-tabs — they are not inside `<main>`. `Settings.tsx:38` says it
    plainly: the sub-navigation is mounted by the Shell's side panel and arrives
    through a prop, so a verifier scoped to the pane cannot see it;
  · the two master switches and their five dependants — establishing that needs
    the page CLICKED into another state, and a verifier that mutates what it is
    checking is a worse tool than one that admits a limit;
  · `Flush Cache`'s question, that `Save Settings` sends all nine panes and that
    validation jumps to the offending sub-tab — those are read from the source,
    where `static-contract.mjs` and its tests already cover them.

They are in the contract because they were verified once, by hand and in the
source. They are not in here because this file only claims what it actually
re-runs.

## DEUDA CONOCIDA — la rama de los rótulos de grupo, sin probar contra la página

`grupos` se añadió el 2026-09-02, después de que el piloto 3 destapara que el
contrato afirmaba seis `GroupRow` y la evidencia nombraba dos. Los seis nombres
salen del AST, que es la fuente autorizada y tiene tres pruebas de regresión
(`static-contract.test.mjs`), y el generador del contrato ya no deja pasar un
recuento sin su inventario.

Lo que NO se ha hecho: **pasar este verificador entero contra la consola viva con
la rama nueva dentro**. Hacía falta abrir sesión otra vez y se dejó fuera a
propósito, como deuda declarada y no como bloqueo. La primera vez que alguien
tenga sesión en el harness, esta es la orden que la salda:

    node dev/verify-evidencia.mjs --snippet    # → consola de Settings > General
    node dev/verify-evidencia.mjs captura.json

Si `grupos` no sale igual, el selector de esta rama es lo primero que hay que
mirar: `GroupRow` pinta su rótulo con la MISMA clase que los controles, que es
justamente por lo que se perdieron la primera vez.

Dos avisos prácticos, aprendidos el 2026-09-02:

  · **La sesión NO sobrevive a una recarga completa.** El token vive en memoria,
    así que un `page.goto` te devuelve al login. Para recorrer varias pantallas
    hay que navegar PULSANDO los enlaces —la consola es una SPA— y entonces una
    sola sesión da para todo el barrido.
  · **Una captura guardada de antes de esta rama falla, y debe fallar.** No trae
    `grupos`, así que el verificador dice que la evidencia ya no describe la
    pantalla. Es correcto: la captura se retoma entera, no se parchea.

## Why it needs you

`playwright` does not resolve in this repo, and adding a browser dependency for
one verifier is not a call this tool gets to make. So it works the way
`screen-contract.mjs` already does — half in the browser, half here:

    1. node dev/verify-evidencia.mjs --snippet
       Copy the printed function into the console of Settings > General on the
       dev harness (127.0.0.1:5380), or hand it to `browser_evaluate`.

    2. Save what it returns, then:
       node dev/verify-evidencia.mjs captura.json

Exit code 0 means the file and the screen agree on every element. Any other exit
code names what moved.
*/
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = dirname(fileURLToPath(import.meta.url))
const EVIDENCIA = join(AQUI, '../docs/direction/evidencia/general-dom.json')

/* The same canonicalisation on both sides, or the hashes are meaningless: the
   browser collapses whitespace when it reads `textContent`, so this does too. */
const canon = (s) => String(s).replace(/\s+/g, ' ').trim()
const h = (s) => createHash('sha256').update(canon(s)).digest('hex')

/*
The browser half. It is a string and not a function so that `--snippet` can print
it verbatim; there is no build step between what you read here and what runs.

It collects, in the order the page paints them:
  · the 39 comparable controls, by TAG AND BY ROLE — `ui/Select` is a
    `<button role="combobox">`, and the first version of the contract tool missed
    every select in the console by asking only for `select`;
  · their 39 help paragraphs and their inline suffixes;
  · THE TWO HELP PARAGRAPHS OF THE QPM LISTS. They are the reason this comment
    exists: the count is 41 and not 39, because a list carries help of its own and
    a reader that only walks controls loses it;
  · the 12 notices, the 10 section headings and the panel's chrome.

The 15 cells of the two QPM lists are skipped on purpose: they are rows of server
data, not surface, and with another configuration they are another number.
*/
export const SNIPPET = `async () => {
  const main = document.querySelector('main');
  const txt = e => e ? e.textContent.replace(/\\s+/g, ' ').trim() : null;
  const up = (e, p) => { for (let n = e; n; n = n.parentElement) if ([...n.classList].some(c => c.startsWith(p))) return n; return null; };
  const sha = async s => {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s).replace(/\\s+/g, ' ').trim()));
    return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
  };
  const esFila = n => /Queries Per Minute \\(QPM\\) Limits \\((IPv4|IPv6)\\) \\d/.test(n || '');
  const nombres = [], ayudas = [], sufijos = [];
  for (const e of [...main.querySelectorAll('input,textarea,select,[role=combobox]')]) {
    if (up(e, '_alert')) continue;
    const row = up(e, '_row_'), chk = up(e, '_check_');
    let n = e.getAttribute('aria-label');
    if (!n && chk) n = txt(chk.querySelector('[class*=_text_]'));
    if (!n && row) n = txt(row.querySelector('[class*=_rowLabel_]'));
    if (esFila(n)) continue;
    let a = null;
    if (chk) a = txt(chk.parentElement.querySelector('[class*=_help_]'));
    if (!a && row) a = txt(row.querySelector('[class*=_help_]'));
    const inl = row ? row.querySelector('[class*=_inline_]') : null;
    let suf = null;
    if (inl) { const c = [...inl.children].filter(x => !['INPUT','SELECT','TEXTAREA'].includes(x.tagName)); if (c.length) suf = txt(c[0]); }
    nombres.push(n); ayudas.push(a || '');
    if (suf) sufijos.push(n + ' :: ' + suf);
  }
  // Las dos listas traen ayuda propia: son las que hacen que sean 41 y no 39.
  const listas = [];
  for (const l of [...main.querySelectorAll('[class*=_editable_]')]) {
    const r = up(l, '_row_');
    if (!r) continue;
    listas.push({ n: txt(r.querySelector('[class*=_rowLabel_]')), h: txt(r.querySelector('[class*=_help_]')),
                  cols: [...l.querySelectorAll('th')].map(txt).filter(Boolean) });
  }
  // Los rotulos de grupo: una fila cuyo control es un <div class=_group_>. Pintan su
  // rotulo con la MISMA clase que los controles, y por eso el primer extractor los
  // perdio: para un control dentro del grupo ganaba el nombre del control.
  const grupos = [...main.querySelectorAll('[class*=_group_]')]
    .map(g => up(g, '_row_'))
    .filter(Boolean)
    .map(r => txt(r.querySelector('[class*=_rowLabel_]')))
    .filter(Boolean);
  const avisos = [...main.querySelectorAll('[class*=_alert_]')].map(txt);
  const secciones = [...main.querySelectorAll('h2')].map(txt);
  const barra = [...main.querySelectorAll('[class*=_bar_]')].pop();
  return {
    n: { controles: nombres.length, ayudas: ayudas.length + listas.length, avisos: avisos.length,
         secciones: secciones.length, sufijos: sufijos.length, listas: listas.length },
    nombres: await Promise.all(nombres.map(sha)),
    ayudas: await Promise.all([...ayudas, ...listas.map(l => l.h)].map(sha)),
    avisos: await Promise.all(avisos.map(sha)),
    sufijos: await Promise.all(sufijos.map(sha)),
    secciones,
    grupos,
    listas: listas.map(l => ({ n: l.n, cols: l.cols })),
    barra: barra ? { pos: getComputedStyle(barra).position, botones: [...barra.querySelectorAll('button')].map(txt) } : null,
  };
}`

function delFichero() {
  const ev = JSON.parse(readFileSync(EVIDENCIA, 'utf8'))
  const ctl = ev.secciones.flatMap((s) => s.ctl)
  const listas = ev.secciones.flatMap((s) => s.listas)
  return {
    nombres: ctl.map((c) => h(c.n)),
    /* 39 + 2: los controles Y las dos listas. Exigir 39 dejaría fuera dos
       párrafos que están en pantalla y en el contrato. */
    ayudas: [...ctl.map((c) => h(c.h)), ...listas.map((l) => h(l.h))],
    avisos: ev.secciones.flatMap((s) => s.av).map(h),
    sufijos: ctl.filter((c) => c.suf).map((c) => h(`${c.n} :: ${c.suf}`)),
    secciones: ev.secciones.map((s) => s.s),
    grupos: ev.secciones.flatMap((s) => s.grupos ?? []),
    listas: listas.map((l) => ({ n: l.n, cols: l.cols.filter(Boolean) })),
    barra: { pos: ev.cromo.barra.posicion, botones: ev.cromo.barra.botones },
  }
}

if (process.argv.includes('--snippet')) {
  console.log(SNIPPET)
  process.exit(0)
}

const captura = process.argv.slice(2).find((a) => !a.startsWith('--'))
if (!captura) {
  console.error('uso: node dev/verify-evidencia.mjs --snippet | node dev/verify-evidencia.mjs captura.json')
  process.exit(2)
}

const mio = delFichero()
const suyo = JSON.parse(readFileSync(captura, 'utf8'))
const fallos = []

for (const clave of ['nombres', 'ayudas', 'avisos', 'sufijos']) {
  const a = mio[clave]
  const b = suyo[clave] ?? []
  if (a.length !== b.length) {
    fallos.push(`${clave}: el fichero tiene ${a.length} y la pantalla ${b.length}`)
    continue
  }
  const malos = a.map((x, i) => (x === b[i] ? -1 : i)).filter((i) => i >= 0)
  if (malos.length) fallos.push(`${clave}: distintos en las posiciones ${malos.join(', ')}`)
  else console.log(`${clave.padEnd(10)} ${a.length.toString().padStart(3)} elementos — todos iguales`)
}

const igual = (a, b, q) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) fallos.push(`${q}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`)
  else console.log(`${q.padEnd(10)} igual`)
}
igual(mio.secciones, suyo.secciones, 'secciones')
igual(mio.grupos, suyo.grupos, 'grupos')
igual(mio.listas, suyo.listas, 'listas')
igual(mio.barra, suyo.barra, 'barra')

console.log()
if (fallos.length) {
  console.error('LA EVIDENCIA YA NO DESCRIBE LA PANTALLA:')
  for (const f of fallos) console.error('  · ' + f)
  process.exit(1)
}
console.log('La evidencia y la pantalla coinciden elemento a elemento.')
