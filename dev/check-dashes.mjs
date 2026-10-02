/**
 * The guard that keeps the em dash (U+2014) out of the text people read on the
 * repository's front page and in what it prints or publishes: the Markdown at the
 * root, the installer, the Docker files, the hooks and the workflows (which write
 * the release pages), and, since the sweep of 2026-10-02, the Markdown under
 * `docs/`, `src/` and `dev/` too. The owner's call, on 2026-10-01: in prose it reads as
 * machine-written. A period, a colon, a comma or parentheses do the same job.
 *
 * One use stays: the interface's "no value" placeholder is an em dash on purpose
 * (the stock console draws the same), so in `docs/`, `src/` and `dev/` a dash
 * standing alone as a value is allowed: quoted ('—', "—", `—`, «—», **—**), in a
 * markup cell (>—<), as a Markdown table cell (| — |), as an item of a list
 * (actions: —, or Remove, —, Remove) or as the empty-cell signature `td —`. A dash between words is never a placeholder.
 *
 * Not checked: the code. The interface's texts, the comments and the strings in
 * `src/` and `dev/` keep theirs (the owner's call, also on 2026-10-02: the rule is
 * for what is read as a document or on GitHub). Nor the captured evidence
 * (`*.json`) and the four HTML drawings in `docs/`, which are records.
 *
 * Run by `npm test` through `check-dashes.test.mjs`, and on its own with
 * `npm run lint:dashes`.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const DASH = '\u2014'
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** Pathspecs of the checked files, as git understands them. */
export const CHECKED = [
  ':(glob)*.md',
  'public/fonts/README.md',
  'install.sh',
  'vite.config.ts',
  ':(glob)docker/**',
  ':(glob).githooks/**',
  ':(glob).github/**',
  ':(glob)docs/**/*.md',
  ':(glob)src/**/*.md',
  ':(glob)dev/**/*.md',
]

/** Folders where the "no value" placeholder may appear. */
const PLACEHOLDER_DIRS = ['docs/', 'src/', 'dev/']

const PLACEHOLDER = [
  /(['"`«>(]|\*\*)\u2014(['"`»<)]|\*\*)/g,
  /\|[ \t]*\u2014(?=[ \t]*\|)/g,
  /\btd \u2014/g,
  /(?<=[:,] )\u2014(?=[,)])/g,
]

/** The line with every placeholder use taken out. */
export function withoutPlaceholders(line) {
  return PLACEHOLDER.reduce((l, re) => l.replace(re, ''), line)
}

export function findDashes(text, { placeholders = false } = {}) {
  const found = []
  text.split('\n').forEach((line, i) => {
    const seen = placeholders ? withoutPlaceholders(line) : line
    if (seen.includes(DASH)) found.push({ line: i + 1, text: line.trim() })
  })
  return found
}

export function checkedFiles() {
  return execFileSync('git', ['ls-files', '-z', '--', ...CHECKED], { cwd: ROOT, encoding: 'utf8' })
    .split('\0')
    .filter(Boolean)
}

export function check() {
  const findings = []
  for (const rel of checkedFiles()) {
    const placeholders = PLACEHOLDER_DIRS.some((d) => rel.startsWith(d))
    for (const f of findDashes(readFileSync(path.join(ROOT, rel), 'utf8'), { placeholders }))
      findings.push(`${rel}:${f.line}  ${f.text}`)
  }
  return findings
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const findings = check()
  if (findings.length === 0) {
    console.log(`\n  No em dash in the ${checkedFiles().length} checked files, apart from the "no value" placeholder.\n`)
  } else {
    for (const f of findings) console.log('  ' + f)
    console.log(`\n  ${findings.length} lines with an em dash. Use a period, a colon, a comma or parentheses.\n`)
  }
  process.exit(Math.min(findings.length, 250))
}
