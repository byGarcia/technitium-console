/*
Every `<Th field="x">` has to name a key that exists in its `Keys` object.

## What this catches, and how it got through everything else

`useSort` looks the field up and gives up quietly when it is not there:

    function toggle(field) {
      const read = keys[field]
      if (read == null) return          // <- the column simply does not sort
      ...

So a header whose `field` does not match a key is a header you can click for ever.
Nothing else in this project sees it: `field` is a string, so TypeScript has
nothing to check; the column renders, so no test that looks for the header fails;
and no gate reads the pair.

It was found on 2026-09-07 in the Edit Permissions modal, where `field="nombre"`
had been left behind by the English sweep of 2026-08-31 —the sweep renamed the
`Keys` object's key and not the string inside the attribute, because a string in
double quotes is where you put data, not identifiers—. The column had been dead
for a week with every gate green.

## How it measures

Per file: the keys declared in any `Keys<...> = { ... }` object or passed inline to
`useSort`, against every `field="..."` in the same file. Both sides are read from
the source, so there is no list to keep in sync.

Files with no `field=` are not looked at. Exit code is the number of findings.
*/
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src')

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.tsx?$/.test(e.name)) out.push(p)
  }
  return out
}

const findings = []
let checked = 0
let columns = 0

for (const file of walk(SRC)) {
  const text = fs.readFileSync(file, 'utf8')
  const fields = [...text.matchAll(/<Th[^>]*?\bfield="([^"]+)"/g)].map((m) => m[1])
  if (fields.length === 0) continue
  checked++
  columns += fields.length

  /* The keys of every `Keys` object in the file, however it is written: a named
     `const KEYS: Keys<Row> = { … }`, or the object handed straight to `useSort`.
     Reading them by brace-matching keeps this a linter and not a parser. */
  const keys = new Set()
  for (const m of text.matchAll(/(?:Keys<[^>]*>\s*=|useSort(?:<[^>]*>)?\s*\()\s*\{/g)) {
    let i = m.index + m[0].length - 1
    let depth = 0
    let end = i
    for (; end < text.length; end++) {
      if (text[end] === '{') depth++
      else if (text[end] === '}') { depth--; if (depth === 0) break }
    }
    const body = text.slice(i + 1, end)
    for (const k of body.matchAll(/(?:^|[,{])\s*(?:'([^']+)'|"([^"]+)"|([A-Za-z_$][\w$]*))\s*:/g)) {
      keys.add(k[1] ?? k[2] ?? k[3])
    }
  }

  if (keys.size === 0) {
    findings.push(`${path.relative(SRC, file)}: ${fields.length} sortable columns and no Keys object in sight`)
    continue
  }
  for (const f of new Set(fields)) {
    if (!keys.has(f)) {
      findings.push(
        `${path.relative(SRC, file)}: field="${f}" names no key — that column does not sort. Keys: ${[...keys].join(', ')}`,
      )
    }
  }
}

if (findings.length === 0) {
  console.log(`\n  SORT FIELDS: the ${columns} sortable columns of ${checked} files all name a key that exists.\n`)
} else {
  console.log('')
  for (const f of findings) console.log(`  ${f}`)
  console.log(`\n  ${findings.length} findings\n`)
}
process.exit(Math.min(findings.length, 250))
