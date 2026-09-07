/*
Source against DOM, in both directions.

The source is the specification and the harness is the evidence, and the point of
having both is that neither is trusted alone:

  · **In the source and not on screen** — the reader found a label that never
    renders. Either it is behind a branch the harness cannot reach (a zone type
    the instance does not have, a cluster it is not part of) and that has to be
    said, or the reader is reporting something that is not really there.
  · **On screen and not in the source** — worse, and the reason this runs at all.
    It means the reader's `RECOGNISED` list has a hole: a control built in a shape
    it does not look for. Every one of these is a fact the document would have
    been missing without a word.

Neither list is a defect by itself. Both are questions that must be answered
before the document is used as a contract.

    node dev/reconcile-contract.mjs          the evidence kept in the repo
    node dev/reconcile-contract.mjs other.json

The DOM side lives in `docs/direction/evidencia/dialog-labels.json`, committed on
purpose: evidence that only exists in `/tmp` is not evidence, and a report nobody
else can reproduce is an opinion with numbers in it.
*/
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT, decode, inventory, matrices, walk } from './static-contract.mjs'

/** The evidence, in the repository rather than in a temporary directory. */
export const EVIDENCE = join(ROOT, '../docs/direction/evidencia/dialog-labels.json')
export const VARIANT_EVIDENCE = join(ROOT, '../docs/direction/evidencia/dialog-variants.json')

/* The harness knows dialogs by what you click; the source knows them by file. */
export const FILE_OF = {
  AddZone: 'AddZone.tsx',
  ZoneOptions: 'ZoneOptions.tsx',
  ImportZone: 'ImportZone.tsx',
  ConvertZone: 'ConvertZone.tsx',
  CloneZone: 'CloneZone.tsx',
  ZonePermissions: 'ZonePermissions.tsx',
  AddEditRecord: 'AddEditRecord.tsx',
  SignZone: 'SignZone.tsx',
  UnsignZone: 'UnsignZone.tsx',
  ViewDs: 'ViewDs.tsx',
  DnssecProperties: 'DnssecProperties.tsx',
}

/*
Labels the reader resolves by hand, so the comparison does not report them as
missing from a source it cannot evaluate. Kept in step with the generator's
`RESOLVED_BY_HAND` — if these two ever disagree, the reconciliation lies.
*/
export const RESOLVED = {
  'SignZone.tsx': [
    ['KSK Size', 'bloque de clave KSK con generacion automatica'],
    ['ZSK Size', 'bloque de clave ZSK con generacion automatica'],
    ['KSK Private Key', "generation === 'UseSpecified'"],
    ['ZSK Private Key', "generation === 'UseSpecified'"],
    ['ECDSA Curve', "f.algorithm === 'ECDSA'"],
    ['EdDSA Curve', "f.algorithm === 'EDDSA'"],
  ],
  'DnssecProperties.tsx': [
    ['ECDSA Curve', "newKey.algorithm === 'ECDSA', con Add Private Key desplegado"],
    ['EdDSA Curve', "newKey.algorithm === 'EDDSA', con Add Private Key desplegado"],
  ],
  'ZonePermissions.tsx': [['Add User', null], ['Add Group', null]],
  'AddZone.tsx': [
    ['Primary Name Server Addresses', 'tipos que los exigen: Secondary, SecondaryForwarder, SecondaryCatalog'],
    ['Primary Name Server Addresses (Optional)', 'tipos que los admiten sin exigirlos: Stub'],
  ],
  'ZoneOptions.tsx': [
    ['Primary Name Server Addresses', 'pestana Zone Transfer, tipos que los exigen'],
    ['Primary Name Server Addresses (Optional)', 'pestana Zone Transfer, tipos que los admiten'],
    ['Network Access Control List (ACL)', 'listLabel de Criterion en Query Access, Zone Transfer y Dynamic Updates'],
    ['Specified Name Servers', 'listLabel de Criterion en Notify'],
  ],
}

/* Composed accessible names are explicit, never accepted by a generic prefix.
   A prefix rule made `Zone` capable of accounting for any invented name that
   started with Zone; that is another fabricated zero. */
const COMPOSED_LABELS = {
  'AddZone.tsx': {
    'Secondary ROOT Zone (RFC 8806)': 'Secondary ROOT Zone',
  },
}

const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim()

/* Notes in square brackets describe the captured state; they are not part of
   the accessible name (`Type [disabled]`, for example). */
const evidenceName = (s) => norm(s).replace(/ \[[^\]]+\]$/, '')

export function namesFromVariants(entry) {
  if (!entry) return []
  const out = []
  for (const key of ['common', 'addCommon', 'editCommon']) out.push(...(entry[key] ?? []))
  for (const names of Object.values(entry.variants ?? {})) out.push(...names)
  return out.map(evidenceName)
}

export function reconcile(domByDialog, variantEvidence = {}) {
  const files = walk(join(ROOT, 'screens/zones'))
  const byName = Object.fromEntries(files.map((f) => [f.split('/').pop(), f]))
  const mats = matrices(files)
  const report = {}

  for (const [dialog, seenRaw] of Object.entries(domByDialog)) {
    const file = FILE_OF[dialog]
    if (!file) {
      report[dialog] = { error: 'no source file declared for this dialog' }
      continue
    }
    const inv = inventory(byName[file])
    /*
    The options a matrix paints ARE the control's labels on screen. Without this,
    every radio fed from `ADD_TYPES` or `ALGORITHMS` showed up as "on screen, not
    in source" while sitting in the document with nobody to belong to.
    */
    const fromMatrices = []
    for (const b of inv.bindings) {
      const key = Object.keys(mats).find((k) => k.endsWith(`::${b.matrix}`))
      const m = key ? mats[key] : null
      if (!m) continue
      if (m.values) fromMatrices.push(...m.values)
      if (m.labels) fromMatrices.push(...m.labels)
    }
    const declared = new Set([
      ...inv.fields.map((f) => norm(decode(f.label))),
      ...(RESOLVED[file] ?? []).map(([l]) => norm(l)),
      ...fromMatrices.map((x) => norm(decode(x))),
    ])
    const seen = new Set([
      ...seenRaw.map(norm),
      ...namesFromVariants(variantEvidence[dialog]),
    ].filter(Boolean))

    /*
    A template is one source label and many screen ones. `${key} for ${f.name}`
    renders as nine checkboxes in Zone Permissions, and counting those nine as
    nine missing facts would be counting one fact nine times. A hole is turned
    into a pattern, and a screen label that matches a pattern is accounted for.
    */
    const patterns = [...declared]
      .filter((l) => l.includes('${'))
      .map((l) => new RegExp('^' + l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\$\\\{[^}]*\\\}/g, '.+') + '$'))
    const canonical = (l) => COMPOSED_LABELS[file]?.[l] ?? l
    const matched = (l) =>
      declared.has(canonical(l)) ||
      patterns.some((re) => re.test(l))

    /* This is label coverage, not a proof of branch logic.  A finite set of DOM
       captures can prove that a rendered name exists in the source inventory;
       it cannot prove why an unrendered branch was absent.  Group headings are
       intentionally outside the control-name comparison. */
    const structural = inv.fields
      .filter((f) => f.tag === 'GroupRow')
      .map((f) => norm(decode(f.label)))
    const controls = inv.fields
      .filter((f) => f.tag !== 'GroupRow')
      .map((f) => norm(decode(f.label)))
      .concat((RESOLVED[file] ?? []).map(([l]) => norm(l)))
    const sourcePatterns = controls
      .filter((l) => l.includes('${'))
      .map((l) => new RegExp('^' + l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\$\\\{[^}]*\\\}/g, '.+') + '$'))
    const observed = (l) =>
      [...seen].some((s) => canonical(s) === l) ||
      sourcePatterns.some((re) => [...seen].some((s) => re.test(s)))
    const unobserved = [...new Set(controls.filter((l) => !observed(l)))]

    report[dialog] = {
      file,
      structural,
      inSourceNotOnScreen: unobserved,
      onScreenNotInSource: [...seen].filter((l) => !matched(l)),
      declared: declared.size,
      seen: seen.size,
      variantStates: Object.keys(variantEvidence[dialog]?.variants ?? {}).length,
    }
  }
  return report
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const path = process.argv[2] ?? EVIDENCE
  let dom = JSON.parse(readFileSync(path, 'utf8'))
  if (typeof dom === 'string') dom = JSON.parse(dom)
  const variants = JSON.parse(readFileSync(VARIANT_EVIDENCE, 'utf8'))
  const report = reconcile(dom, variants)

  let questions = 0
  for (const [dialog, r] of Object.entries(report)) {
    if (r.error) {
      console.log(`\n${dialog}: ${r.error}`)
      questions++
      continue
    }
    const a = r.inSourceNotOnScreen
    const b = r.onScreenNotInSource
    console.log(`  ${r.variantStates} captured variant states; ${r.structural.length} group labels compared separately`)
    if (!a.length && !b.length) console.log('  nothing unexplained')
    if (a.length) console.log(`  UNEXPLAINED - in source, not on screen (${a.length}): ${a.join(' · ')}`)
    if (b.length) console.log(`  UNEXPLAINED - on screen, not in source (${b.length}): ${b.join(' · ')}`)
    questions += a.length + b.length
  }
  console.log(
    questions === 0
      ? '\nZERO unexplained label-coverage differences across the captured variants.'
      : `\n${questions} UNEXPLAINED differences. Not a contract until they are zero.`,
  )
  process.exitCode = questions === 0 ? 0 : 1
}
