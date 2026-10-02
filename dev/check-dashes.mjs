/**
 * The guard that keeps the em dash (U+2014) out of the repository. The owner's
 * call, on 2026-10-01: in prose it reads as machine-written. A period, a colon, a
 * comma or parentheses do the same job. On 2026-10-02 the rule grew from the
 * Markdown and the GitHub-facing files to every text file in the repository: the
 * code, its comments, the strings it prints and the titles of its tests.
 *
 * Only tracked files are read (`git ls-files`), so a local, untracked file (a
 * note at the root, a symlink to an agent's instructions) is never part of the
 * check. A tracked file deleted in the working tree is skipped too.
 *
 * Not read at all:
 *
 *  - Binaries: a file with a NUL byte in it (fonts, images, the favicon).
 *  - `package-lock.json`, which npm writes.
 *  - `public/json/`, upstream's data files, shipped as they come.
 *
 * One use stays: the interface's "no value" placeholder is an em dash on purpose
 * (the stock console draws the same). In the code under `src/` a dash is let
 * through when it is the whole of a string literal (`'\u2014'`, in any of the three
 * quotes) or the whole of a JSX text (`>\u2014<`, or alone on its line), which also
 * covers a test asserting on it (`getByText('\u2014')`). Comments are not exempt:
 * they are found and blanked first, so a comment that quotes the placeholder is a
 * finding like any other. Anywhere else there is no exemption, so a tool that has
 * to match the dash as data writes it as the escape, as `DASH` does below.
 *
 * Run by `npm test` through `check-dashes.test.mjs`, and on its own with
 * `npm run lint:dashes`, which takes optional paths to narrow it
 * (`npm run lint:dashes -- dev .github`).
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { stripComments } from './check-colour-tokens.mjs'

export const DASH = '\u2014'
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** Tracked files that are never read. */
export const SKIPPED = [/^package-lock\.json$/, /^public\/json\//]

/** Where the placeholder may appear, and how each kind of file writes a comment. */
const PLACEHOLDER_DIR = 'src/'
const KINDS = { '.ts': 'ts', '.tsx': 'ts', '.js': 'ts', '.mjs': 'ts', '.css': 'css' }

const PLACEHOLDER = [
  /(['"`])\u2014\1/g,
  />\u2014</g,
  /^\s*\u2014\s*$/g,
]

/** The line with every placeholder use taken out. */
export function withoutPlaceholders(line) {
  return PLACEHOLDER.reduce((l, re) => l.replace(re, ''), line)
}

const count = (s) => s.split(DASH).length - 1

/**
 * The lines with an em dash. With `kind` ('ts' or 'css'), the text is code: a dash
 * in a comment is always a finding, and one in the code only when it is not the
 * placeholder.
 */
export function findDashes(text, { kind } = {}) {
  const lines = text.split('\n')
  const code = kind ? stripComments(text, kind).split('\n') : lines
  const found = []
  lines.forEach((line, i) => {
    if (!line.includes(DASH)) return
    const inComment = count(line) > count(code[i])
    if (!kind || inComment || withoutPlaceholders(code[i]).includes(DASH))
      found.push({ line: i + 1, text: line.trim() })
  })
  return found
}

/** The comment syntax of a file where the placeholder may appear; `undefined` elsewhere. */
export function kindOf(rel) {
  if (!rel.startsWith(PLACEHOLDER_DIR)) return undefined
  return KINDS[path.extname(rel)]
}

export function checkedFiles({ root = ROOT, paths = [] } = {}) {
  return execFileSync('git', ['ls-files', '-z', '--', ...paths], { cwd: root, encoding: 'utf8' })
    .split('\0')
    .filter((rel) => rel && !SKIPPED.some((re) => re.test(rel)) && existsSync(path.join(root, rel)))
}

export function check({ root = ROOT, paths = [] } = {}) {
  const findings = []
  for (const rel of checkedFiles({ root, paths })) {
    const bytes = readFileSync(path.join(root, rel))
    if (bytes.includes(0)) continue
    for (const f of findDashes(bytes.toString('utf8'), { kind: kindOf(rel) }))
      findings.push(`${rel}:${f.line}  ${f.text}`)
  }
  return findings
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const paths = process.argv.slice(2)
  const findings = check({ paths })
  if (findings.length === 0) {
    console.log(`\n  No em dash in the ${checkedFiles({ paths }).length} tracked files, apart from the "no value" placeholder.\n`)
  } else {
    for (const f of findings) console.log('  ' + f)
    console.log(`\n  ${findings.length} lines with an em dash. Use a period, a colon, a comma or parentheses.\n`)
  }
  process.exit(Math.min(findings.length, 250))
}
