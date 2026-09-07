import { readFileSync, writeFileSync } from 'node:fs'
import { EVIDENCE, VARIANT_EVIDENCE, reconcile } from './reconcile-contract.mjs'

const readJson = (path) => {
  let value = JSON.parse(readFileSync(path, 'utf8'))
  if (typeof value === 'string') value = JSON.parse(value)
  return value
}

const dom = readJson(EVIDENCE)
const variants = readJson(VARIANT_EVIDENCE)
const report = reconcile(dom, variants)
const rows = Object.entries(report)
const sourceOnly = rows.reduce((n, [, v]) => n + (v.inSourceNotOnScreen?.length ?? 0), 0)
const domOnly = rows.reduce((n, [, v]) => n + (v.onScreenNotInSource?.length ?? 0), 0)
const states = rows.reduce((n, [, v]) => n + (v.variantStates ?? 0), 0)

const o = []
const w = (s = '') => o.push(s)
w('# Piloto 2 — reconciliación de nombres fuente ↔ DOM')
w()
w('Generado por `dev/reconciliation-doc.mjs` el **2026-09-02** a partir de dos')
w('evidencias versionadas: `dialog-labels.json` (una apertura limpia por diálogo)')
w('y `dialog-variants.json` (las ramas de los cinco diálogos variables).')
w()
w('```')
w('node dev/reconcile-contract.mjs')
w('```')
w()
w('## Resultado y límite')
w()
w(`- **${states} estados variantes** capturados, además de las once aperturas limpias.`)
w(`- **${sourceOnly} nombres de control** del inventario sin observar en esas capturas.`)
w(`- **${domOnly} nombres observados** sin correspondencia en el inventario.`)
w()
w('Esto demuestra **cobertura de nombres en los estados capturados**. No demuestra')
w('que el analizador haya entendido toda la lógica de ramas, ni que no exista una')
w('forma de JSX que todavía no reconoce. Por eso no hay “ausencias explicadas por')
w('condición”: se hizo que las ramas aparecieran en el navegador y se comparó lo')
w('que apareció. Las etiquetas de grupo se enumeran aparte porque no son nombres')
w('accesibles de controles.')
w()
w('Tampoco hay coincidencia genérica por prefijo. La única composición admitida')
w('es explícita: `Secondary ROOT Zone` aparece como `Secondary ROOT Zone (RFC 8806)`.')
w()
w('## Estados capturados')
w()
for (const [dialog, entry] of Object.entries(variants)) {
  if (!entry || typeof entry !== 'object' || !entry.variants) continue
  const names = Object.keys(entry.variants)
  w(`- **${dialog} (${names.length}):** ${names.map((x) => `\`${x}\``).join(' · ')}`)
}
w()
w('## Los once, uno a uno')
w()
for (const [dialog, v] of rows) {
  w(`### \`${dialog}\` — \`${v.file}\``)
  w()
  w(`${v.variantStates} estados variantes; ${v.structural.length} etiquetas de grupo fuera de la comparación de controles.`)
  w()
  if (v.structural.length) {
    w(`Etiquetas de grupo: ${v.structural.map((x) => `\`${x}\``).join(' · ')}.`)
    w()
  }
  if (!v.inSourceNotOnScreen.length && !v.onScreenNotInSource.length) {
    w('Sin diferencias de nombres sin explicar.')
    w()
  }
  if (v.inSourceNotOnScreen.length) {
    w(`**En fuente, no observado (${v.inSourceNotOnScreen.length}):** ${v.inSourceNotOnScreen.map((x) => `\`${x}\``).join(' · ')}`)
    w()
  }
  if (v.onScreenNotInSource.length) {
    w(`**Observado, no inventariado (${v.onScreenNotInSource.length}):** ${v.onScreenNotInSource.map((x) => `\`${x}\``).join(' · ')}`)
    w()
  }
}

writeFileSync(new URL('../docs/direction/piloto-2-reconciliacion.md', import.meta.url), o.join('\n'))
console.log(`escrito: ${states} estados variantes | source-only ${sourceOnly} | dom-only ${domOnly}`)
