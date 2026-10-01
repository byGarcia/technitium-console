/**
 * The guard that keeps the em dash (U+2014) out of the text people read on the
 * repository's front page and in what it prints or publishes: the Markdown at the
 * root, the installer, the Docker files, the hooks and the workflows (which write
 * the release pages). The owner's call, on 2026-10-01: in prose it reads as
 * machine-written. A period, a colon, a comma or parentheses do the same job.
 *
 * What it does NOT look at, yet: `docs/`, `src/` and `dev/`, which still carry
 * thousands of them in comments and internal notes. The interface's own "no
 * value" placeholder is an em dash on purpose (the stock console draws the same),
 * and it lives in `src/`.
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
]

export function findDashes(text) {
  const found = []
  text.split('\n').forEach((line, i) => {
    if (line.includes(DASH)) found.push({ line: i + 1, text: line.trim() })
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
    for (const f of findDashes(readFileSync(path.join(ROOT, rel), 'utf8')))
      findings.push(`${rel}:${f.line}  ${f.text}`)
  }
  return findings
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const findings = check()
  if (findings.length === 0) {
    console.log(`\n  No em dash in the ${checkedFiles().length} files people read on the repository's front page.\n`)
  } else {
    for (const f of findings) console.log('  ' + f)
    console.log(`\n  ${findings.length} lines with an em dash. Use a period, a colon, a comma or parentheses.\n`)
  }
  process.exit(Math.min(findings.length, 250))
}
