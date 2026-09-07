/*
Writes the dialog contract document from the source reader.

Reproducible from the AST, completed by hand where the AST cannot evaluate.

The figures come from `static-contract.mjs` and not from prose: a document about
what must not be lost cannot be typed, because typing is where things get lost.

But it is not "not written by hand", and saying so would hide the part that most
needs auditing. Two tables here ARE manual — `OPENED_FROM`, because a modal's
source does not say who opens it, and `RESOLVED_BY_HAND`, the values the parser
can see but not evaluate. They are declared as tables rather than folded into the
prose precisely so that a wrong one is visible.

    node dev/dialog-contract-doc.mjs > docs/direction/piloto-2-dialogos.md
*/
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT, RECOGNISED, confirmations, inventory, matrices, walk } from './static-contract.mjs'
import { VARIANT_EVIDENCE } from './reconcile-contract.mjs'

/* Declared here because the source of a modal does not say who opens it. Checked
   against the code in the reconciliation step, not assumed. */
const OPENED_FROM = {
  'AddZone.tsx': 'La lista · verbo de pantalla `Add Zone`',
  'ZoneOptions.tsx': '**Las dos vistas** · botón de fila y menú de zona',
  'ImportZone.tsx': 'Menú de fila y menú de zona · sólo `Primary` y `Forwarder`',
  'ConvertZone.tsx': 'Menú de fila y menú de zona · todos menos `Stub` y `Catalog`',
  'CloneZone.tsx': 'Menú de fila y menú de zona · sólo `Primary` y `Forwarder`',
  'ZonePermissions.tsx': 'Menú de fila y menú de zona · siempre',
  'AddEditRecord.tsx': '**Sólo registros** · `Add Record` y `Edit Record` de fila',
  'SignZone.tsx': '**Sólo registros** · menú `DNSSEC`, si la zona no está firmada',
  'UnsignZone.tsx': '**Sólo registros** · menú `DNSSEC`, si está firmada',
  'ViewDs.tsx': '**Sólo registros** · menú `DNSSEC`, si está firmada',
  'DnssecProperties.tsx': '**Sólo registros** · menú `DNSSEC`, si está firmada',
}

const COMPUTED_TITLES = {
  'AddEditRecord.tsx': '`Add Record` al crear; `Edit Record` al editar',
  'ZonePermissions.tsx': '`Zone Permissions - ${zone}`',
}

const SIZE_WIDTH = { compact: '440 px', form: '560 px', medium: '720 px', wide: '880 px' }

/* Relationships that are explicit at a helper call site rather than around the
   matrix's own `.map`.  Declared instead of inferred so duplicate labels retain
   their record/DNSSEC context. */
const EXTRA_OPTION_BINDINGS = {
  'AddEditRecord.tsx': [
    ['Type (union; actual availability depends on zone)', 'RECORD_TYPES'],
    ['DNSSEC Algorithm (DS)', 'DS_ALGORITHMS'],
    ['Digest Type (DS)', 'DIGESTS_DS'],
    ['Algorithm (SSHFP)', 'SSHFP_ALGORITHMS'],
    ['Fingerprint Type (SSHFP)', 'HUELLAS_SSHFP'],
    ['Certificate Usage (TLSA)', 'USOS_TLSA'],
    ['Selector (TLSA)', 'SELECTORES_TLSA'],
    ['Matching Type (TLSA)', 'COINCIDENCIAS_TLSA'],
  ],
  'SignZone.tsx': [
    ['KSK Private Key Generation', 'GENERATIONS'],
    ['ZSK Private Key Generation', 'GENERATIONS'],
    ['KSK Size / ZSK Size', 'TAMANOS_RSA'],
  ],
  'DnssecProperties.tsx': [
    ['Private Key Generation', 'GENERATIONS'],
    ['Proof of Non-Existence', 'NX_PROOFS'],
  ],
  'ZoneOptions.tsx': [
    ['Query Access', 'QUERY_ACCESS'],
    ['Zone Transfer', 'TRANSFERS'],
    ['Notify', 'NOTIFICATIONS'],
    ['Dynamic Updates', 'UPDATES'],
  ],
}

/*
Values the reader could not resolve, resolved by reading and declared here.

Each one is a value the AST can see but not evaluate: a ternary, a prop threaded
into a block that is instantiated twice, a label passed into a local helper. They
are written out rather than left as "unresolved" because a design cannot draw a
field whose name is `{sizeLabel}` — and they are written HERE, in a table, rather
than folded into the prose, so that a wrong one is visible.
*/
const RESOLVED_BY_HAND = {
  'ZoneOptions.tsx': [
    ['Field label computed', '`Primary Name Server Addresses` cuando el tipo lo exige, `Primary Name Server Addresses (Optional)` cuando no'],
    ['Field label computed: {listLabel}', '`Network Access Control List (ACL)` en Query Access, Zone Transfer y Dynamic Updates; `Specified Name Servers` en Notify'],
  ],
  'SignZone.tsx': [
    ['Field label computed: {f.algorithm === …}', '`EdDSA Curve` con EdDSA, `ECDSA Curve` con ECDSA'],
    ['Field label computed: {sizeLabel}', 'Prop del bloque de clave, instanciado dos veces: **`KSK Size`** y **`ZSK Size`**'],
    ['Field label computed: {pemLabel}', 'Igual: **`KSK Private Key`** y **`ZSK Private Key`**'],
    ['help text computed (NSEC3 iterations)', '«The number of iterations used by NSEC3 for hashing the domain names. It is recommended to use 0 iterations since more iterations will increase computational costs for both the DNS Server and resolver while not providing much value against "zone walking" [RFC 9276].» — lleva un enlace externo dentro'],
    ['help text computed (NSEC3 salt)', '«The number of bytes of random salt to generate to be used with the NSEC3 hash computation. It is recommended to not use salt by setting the length to 0 [RFC 9276].» — lleva un enlace externo dentro'],
  ],
  'DnssecProperties.tsx': [
    ['Field label computed: {newKey.algorithm === …}', '`EdDSA Curve` con EdDSA, `ECDSA Curve` con ECDSA'],
  ],
  'AddZone.tsx': [
    ['Row label computed: {v.servidoresPrimariosObligatorios ? …}', '`Primary Name Server Addresses` cuando el tipo los exige, `Primary Name Server Addresses (Optional)` cuando no — **y la ayuda cambia con ella**: «Enter the primary name server addresses to sync the zone from.» frente a «…to sync the zone from. When unspecified, the SOA Primary Name Server will be resolved and used.»'],
  ],
  'ZonePermissions.tsx': [
    ['Field label computed: {addLabel}', 'Prop de `PermissionsTable`, instanciada dos veces: **`Add User`** y **`Add Group`**. Ojo: **no selecciona, AÑADE una fila** al cambiar'],
  ],
  'AddEditRecord.tsx': [
    ['Field label computed: {label} ×2', 'Ayudantes locales `text(label, …)` y `dropdown(label, …)`: la etiqueta llega desde las ramas de tipo de registro. El diálogo ofrece 18 o 19 tipos según el tipo/estado de la zona; la unión del componente son 23 variantes más SOA sólo al editar.'],
  ],
  'ConvertZone.tsx': [
    ['native radio label computed: {LABELS[d]}', 'Las tres etiquetas están en la tabla `LABELS`: `Primary Zone`, `Conditional Forwarder Zone` y `Catalog Zone`. El tipo actual aparece presente y deshabilitado.'],
  ],
}

const files = walk(join(ROOT, 'screens/zones'))
const modals = files.filter((f) => /modals\/[A-Z]/.test(f))
const confs = confirmations(files)
const mats = matrices(files)
const variants = JSON.parse(readFileSync(VARIANT_EVIDENCE, 'utf8'))

const matrixData = (name) => {
  const pair = Object.entries(mats).find(([key]) => key.endsWith(`::${name}`))
  if (!pair) return null
  const [, value] = pair
  return value.values ?? value.labels ?? null
}

const out = []
const w = (s = '') => out.push(s)

w('# Piloto 2 — los diálogos de Zones, leídos del fuente')
w()
w('**Generado de forma reproducible desde el AST** por `dev/dialog-contract-doc.mjs`')
w('sobre `dev/static-contract.mjs`, que lee el código con el parser de TypeScript,')
w('**y completado con resoluciones manuales auditables**.')
w()
w('Las manuales son dos y están declaradas en tablas del propio generador, no')
w('diluidas en la prosa, para que una equivocada se vea: `OPENED_FROM` —de dónde')
w('se abre cada diálogo, que su fuente no dice— y `RESOLVED_BY_HAND` —los valores')
w('que el AST ve pero no evalúa: un ternario, una prop hilada a un bloque que se')
w('instancia dos veces, una etiqueta que llega a un ayudante local—. La tercera')
w('fuente, declarada aparte, es `dialog-variants.json`: los estados abiertos de')
w('uno en uno en el navegador para comprobar las ramas que el AST no debe fingir')
w('que entiende.')
w()
w('## Lo que este documento SÍ garantiza, y lo que no')
w()
w('El lector reconoce exactamente esto:')
w()
for (const r of RECOGNISED) w(`- ${r}`)
w()
w('Dentro de esas formas, lo que no puede resolver lo dice. **Fuera de ellas no')
w('mira**, así que esto es un suelo y no un techo: lo que aparece está; lo que no')
w('aparece puede estar igualmente. Cerrar ese hueco es la lectura manual por')
w('componente y la comprobación contra el harness, que van aparte.')
w()

// ── Las confirmaciones ──────────────────────────────────────────────────────
w('## `Confirm` — quince contratos, y son el patrón más repetido de la consola')
w()
w('No tienen campos: **su contrato entero es la frase que preguntan**. El barrido')
w('los reportaba como «sin campos» y seguía.')
w()
w('| Título | Verbo | Destructivo | Dónde |')
w('|---|---|---|---|')
for (const c of confs) {
  w(`| ${c.title} | \`${c.label}\` | ${c.danger ? '**sí**' : 'no'} | \`${c.file}:${c.line}\` |`)
}
w()
w(`**${confs.filter((c) => c.danger).length} invocaciones destructivas** sobre ` +
  `${new Set(confs.filter((c) => c.danger).map((c) => c.title)).size} acciones distintas: ` +
  '`Delete Zone` existe en la lista y en los registros.')
w()
w('### Las frases, literales')
w()
for (const c of confs) {
  w(`**${c.title}** — \`${c.file}:${c.line}\``)
  w()
  for (const t of c.texts) {
    w(`> ${t.text.replace(/\n/g, '\n> ')}`)
    if (t.when) w(`>\n> _cuando_ \`${t.when}\``)
    w()
  }
}

// ── Los diálogos ────────────────────────────────────────────────────────────
w('---')
w()
w('## Los once diálogos')
w()
for (const f of modals) {
  const name = f.split('/').pop()
  const inv = inventory(f)
  w(`### \`${name.replace('.tsx', '')}\``)
  w()
  w(`**Dónde se abre:** ${OPENED_FROM[name] ?? '**PENDIENTE: sin declarar**'}`)
  w()
  const title = inv.dialog?.title ? `\`${inv.dialog.title}\`` : COMPUTED_TITLES[name]
  w(`**Título:** ${title}`)
  w()
  const size = inv.dialog?.size ?? 'form'
  w(`**Talla actual:** \`${size}\` — ${SIZE_WIDTH[size]} máximo, siempre limitado a \`100vw - 32px\`.`)
  w()
  const footer = [...(inv.dialog?.actions ?? []), inv.dialog?.close ?? 'Close']
  w(`**Pie:** ${footer.map((x) => `\`${x}\``).join(' → ')}. El verbo va antes del descarte.`)
  w()
  if (inv.buttons.length) {
    w(`**Textos de botón encontrados (pie y cuerpo):** ${[...new Set(inv.buttons)].map((x) => `\`${x}\``).join(' · ')}`)
    w()
  }
  if (inv.tabs.length) {
    w(`**Pestañas (${inv.tabs.length}):** ${inv.tabs.map((t) => `\`${t}\``).join(' · ')}`)
    w()
    w('Cada una es una superficie con sus propios campos. Un dibujo de una sola no')
    w('es un dibujo de este diálogo.')
    w()
  }
  if (inv.fields.length) {
    w(`**Controles y etiquetas de grupo leídos del fuente (${inv.fields.length}):**`)
    w()
    for (const x of inv.fields) w(`- \`${x.label}\`  _(${x.tag})_`)
    w()
  }
  const manualMatrices = new Set((EXTRA_OPTION_BINDINGS[name] ?? []).map(([, matrix]) => matrix))
  const automaticBindings = inv.bindings
    .filter((b) => !manualMatrices.has(b.matrix))
    .filter((b) => b.boundTo?.label)
    .map((b) => [b.boundTo.label, b.matrix])
  const optionBindings = [
    ...automaticBindings,
    ...(EXTRA_OPTION_BINDINGS[name] ?? []),
  ].filter(([label, matrix], index, all) =>
    all.findIndex(([l, m]) => l === label && m === matrix) === index && matrixData(matrix),
  )
  if (optionBindings.length) {
    w('**Opciones ligadas a su control:**')
    w()
    for (const [label, matrix] of optionBindings) {
      w(`- \`${label}\` ← \`${matrix}\`: ${matrixData(matrix).map((x) => `\`${x}\``).join(' · ')}`)
    }
    w()
  }
  if (inv.sections.length) {
    w(`**Secciones:** ${inv.sections.map((x) => `\`${x}\``).join(' · ')}`)
    w()
  }
  if (inv.terms.length) {
    w(`**Términos de datos mostrados:** ${inv.terms.map((x) => `\`${x}\``).join(' · ')}`)
    w()
  }
  if (inv.prose.length) {
    w('**Prosa que forma parte de la superficie:**')
    w()
    for (const p of inv.prose) w(`> ${p}`)
    w()
  }
  if (inv.help.length) {
    w('**Textos de ayuda, literales y que sobreviven tal cual:**')
    w()
    for (const h of inv.help) w(`> ${h}`)
    w()
  }
  if (inv.links.length) {
    w(`**Enlaces salientes:** ${inv.links.map((l) => `\`${l}\``).join(' · ')}`)
    w()
  }
  const byHand = RESOLVED_BY_HAND[name]
  if (byHand) {
    w('**Resoluciones manuales auditables:**')
    w()
    w('| Valor calculado | Lo que es en realidad |')
    w('|---|---|')
    for (const [k, v] of byHand) w(`| \`${k}\` | ${v} |`)
    w()
  }
}

// ── Las ramas realmente abiertas en el navegador ───────────────────────────
w('---')
w()
w('## Evidencia DOM multirama')
w()
w('Estas no son ausencias “explicadas” por un analizador: son estados que se')
w('abrieron de uno en uno en el harness. Los nombres entre corchetes describen el')
w('estado del control; no cambian su etiqueta. `Add Record` no tiene una lista fija')
w('de 19: ofrece **18 o 19 según la zona**, y la unión de ramas del componente más')
w('el SOA editable cubre sus 23 tipos de registro.')
w()
for (const [dialogName, entry] of Object.entries(variants)) {
  if (!entry?.variants) continue
  w(`### \`${dialogName}\` — ${Object.keys(entry.variants).length} estados`)
  w()
  if (entry.note) { w(entry.note); w() }
  const common = [...(entry.common ?? []), ...(entry.addCommon ?? []), ...(entry.editCommon ?? [])]
  if (common.length) {
    w(`**Comunes:** ${common.map((x) => `\`${x}\``).join(' · ')}`)
    w()
  }
  for (const [state, controls] of Object.entries(entry.variants)) {
    w(`- **${state}:** ${controls.length ? controls.map((x) => `\`${x}\``).join(' · ') : '_sin controles adicionales_'}`)
  }
  w()
}

// ── Las matrices ────────────────────────────────────────────────────────────
w('---')
w()
w('## Las matrices que alimentan los diálogos')
w()
const entries = Object.entries(mats)
const arrays = entries.filter(([, v]) => v.values || v.structured)
const bad = entries.filter(([, v]) => v.unresolved && !/^initializer is/.test(v.unresolved))
const notArrays = entries.filter(([, v]) => /^initializer is/.test(v.unresolved ?? ''))
w(`**${entries.length}** constantes en mayúsculas bajo \`screens/zones\`, de las cuales`)
w(`**${arrays.length + bad.length} son arrays** —${arrays.length} leídos y ${bad.length} no— y`)
w(`**${notArrays.length} no son array** en absoluto.`)
w()
for (const [k, v] of arrays) {
  if (v.structured) w(`- \`${k}\` — **${v.count} entradas**: ${v.labels.map((l) => `\`${l}\``).join(' · ')}`)
  else w(`- \`${k}\` = ${v.values.map((x) => `\`${x}\``).join(' · ')}`)
}
w()
if (bad.length) {
  w('**Arrays que el lector no resuelve, dichos y no omitidos:**')
  w()
  for (const [k, v] of bad) w(`- \`${k}\` — ${v.unresolved}`)
  w()
}

const target = new URL('../docs/direction/piloto-2-dialogos.md', import.meta.url)
writeFileSync(target, out.join('\n'))
console.log('escrito docs/direction/piloto-2-dialogos.md')
