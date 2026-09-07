/*
Assembles the domain-tree round's prompt —Cache, Allowed and Blocked— with the
direction, the contract and the acceptance bar INSIDE.

Same shape as the assemblers of the pilots and of phase 3, and for the same reason:
the prompt that goes to the design tool has to carry the contract WHOLE. Summarising
it is how a control, a help or a paragraph stops coming back. And there is an extra
reason: **Claude Design does not see the repository**, so a `[link](path)` is not a
reference, it is a hole.

The guards at the end check that the figures the prompt states are still the ones the
source says: if the screens change and the prompt is not regenerated, assembling
**fails** instead of sending a stale number.
*/
import { readFileSync, writeFileSync } from 'node:fs'

const here = (p) => new URL(p, import.meta.url)
const read = (p) => readFileSync(here(p), 'utf8').trim()

const frame = read('../docs/prompts/fase3-arbol-de-dominios.md')
const direction = read('../DESIGN.md')
const contract = read('../docs/direction/fase3-contrato-arbol-de-dominios.md')
const bar = read('../docs/direction/fase3-barra-aceptacion-arbol-de-dominios.md')
const source = read('../src/screens/lists/Lists.tsx')

const withoutPaths = (md) =>
  md.replace(/\[([^\]]+)\]\((?!https?:)[^)]+\)/g, '$1').replace(/^Referencia: .*$/m, '')

/*
The guards. Each one is a claim the prompt makes, checked against the source it was
taken from — not against the contract, which is what the prompt says of itself.
*/
const verbs = ['Flush Cache', 'Allow', 'Block', 'Import', 'Export', 'Flush', 'Browse', 'Refresh', 'Delete']
const literals = [
  'Are you sure to flush the DNS Server cache?',
  'Are you sure you want to delete the allowed zone',
  'Are you sure you want to flush the entire Blocked zone?',
  'This node only contains sub-domains. Open one in the tree to see its records.',
  'This node has no records and no sub-domains.',
  'Domain names were imported into blocked zone successfully.',
  'Enter domain names one below other to import into Allowed Zone:',
]
const missing = [
  /* A verb travels as a JSX child —`>\n  Import\n<`— or as a literal in an
     object, so the check has to allow for the whitespace JSX leaves behind. */
  ...verbs.filter((v) => !new RegExp(`>\\s*${v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*<|['"\`]${v}['"\`]`).test(source)),
  ...literals.filter((l) => !source.includes(l)),
]
if (missing.length > 0) {
  console.error('\n  The prompt claims things the source no longer has:\n')
  for (const m of missing) console.error('   · ' + m)
  console.error('\n  Regenerate the contract before assembling.\n')
  process.exit(missing.length)
}

const out = [
  withoutPaths(frame),
  '\n\n---\n\n# Anexo A — la dirección (fase 1)\n\n' + withoutPaths(direction),
  '\n\n---\n\n# Anexo B — el contrato, entero\n\n' + withoutPaths(contract),
  '\n\n---\n\n# Anexo C — la barra de aceptación\n\n' + withoutPaths(bar),
].join('')

writeFileSync(here('../docs/prompts/fase3-arbol-de-dominios-ready.md'), out + '\n')
console.log(`\n  Assembled: ${out.length} characters, ${verbs.length} verbs and ${literals.length} literals checked against the source.\n`)
