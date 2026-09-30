/*
Which of the API endpoints the stock console calls does this one call too?

The README carried a figure for it —"114 of 114"— that no script produced, and a
figure nobody can reproduce is an opinion. This produces it.

Upstream's side is every `"api/…"` literal in its `www/js/*.js` at the release
being matched (`UPSTREAM_REF`, default v15.5.1), read from the fork checked out
beside this repository (`../technitium-ui`).

This console's side is every string or template literal under `src/` that looks
like an API path. A template's `${…}` becomes a wildcard for ONE path segment,
which is how the three list screens share one component (`${kind}/list` serves
`allowed/list`, `blocked/list` and `cache/list`). A wildcard alone is not
proof, so a covered endpoint whose only match is a wildcard is printed as such:
look at those by eye.

    node dev/check-endpoints.mjs
    UPSTREAM_REF=v15.4.0 node dev/check-endpoints.mjs

Exit code is the number of upstream endpoints not covered.
*/
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const SRC = resolve(here, '../src')
const FORK = resolve(here, '../../technitium-ui')
const REF = process.env.UPSTREAM_REF ?? 'v15.5.1'

const git = (...args) => execFileSync('git', ['-C', FORK, ...args], { encoding: 'utf8', maxBuffer: 1 << 26 })

const theirs = new Set()
for (const f of git('ls-tree', '--name-only', REF, 'DnsServerCore/www/js/').split('\n').filter(Boolean)) {
  for (const m of git('show', `${REF}:${f}`).matchAll(/["']api\/([A-Za-z0-9/]+)/g)) {
    theirs.add(m[1].replace(/\/$/, ''))
  }
}

function files(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) return files(p)
    return /\.tsx?$/.test(n) && !/\.test\.|fixture/.test(n) ? [p] : []
  })
}

/* Literal paths, and templates turned into one-segment wildcards. */
const exact = new Set()
const patterns = []
for (const f of files(SRC)) {
  const text = readFileSync(f, 'utf8')
  for (const m of text.matchAll(/(['"])((?:api\/)?[a-z][A-Za-z0-9]*(?:\/[A-Za-z0-9]+)+)\1/g)) {
    exact.add(m[2].replace(/^api\//, ''))
  }
  for (const m of text.matchAll(/`((?:api\/)?(?:[A-Za-z0-9]+|\$\{[^}]+\})(?:\/(?:[A-Za-z0-9]+|\$\{[^}]+\}))+)[`?]/g)) {
    const path = m[1].replace(/^api\//, '')
    if (!path.includes('${')) {
      exact.add(path)
      continue
    }
    const rx = '^' + path.split('/').map((s) => (s.startsWith('${') ? '[A-Za-z0-9]+' : s)).join('/') + '$'
    patterns.push({ rx: new RegExp(rx), source: path, file: f.slice(SRC.length + 1) })
  }
}

const missing = []
const byWildcard = []
for (const e of [...theirs].sort()) {
  if (exact.has(e)) continue
  const p = patterns.find((q) => q.rx.test(e))
  if (p) byWildcard.push(`${e}   ← ${p.source}  (${p.file})`)
  else missing.push(e)
}

for (const w of byWildcard) console.log(`  WILDCARD  ${w}`)
for (const m of missing) console.log(`  MISSING   ${m}`)
console.log(
  `\nENDPOINTS (${REF}): ${theirs.size - missing.length} of ${theirs.size} covered` +
    (byWildcard.length ? `, ${byWildcard.length} of them only through a wildcard — check those by eye.` : '.'),
)
process.exit(Math.min(missing.length, 250))
