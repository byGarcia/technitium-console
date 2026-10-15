/**
 * The guard against names cut letter by letter.
 *
 * Three declarations let the browser end a line inside a word wherever the edge
 * falls: `word-break: break-all`, `word-break: break-word` and `overflow-wrap:
 * anywhere`. The last two also tell a table, a flex row or a grid track sized by
 * its content that the word could break after ANY letter, so the column shrinks to
 * a few characters and every name in it comes out cut: `0.30.172.in-addr.arpa` in
 * four lines in Zones, `raw.githubuser` / `content.com` in Blocking › Lists. On
 * 2026-10-15 there were 23 of them in 17 stylesheets, found two or three at a time
 * by looking at screenshots. This is what finds the rest.
 *
 * What to write instead:
 *  - a DNS name goes through `ui/DomainName`, which breaks only after its dots;
 *  - a URL through `ui/UrlText`, which breaks after its separators;
 *  - other text through `overflow-wrap: break-word`, which ends lines between words
 *    and breaks a word only when it alone does not fit, without shrinking the column;
 *  - or one line cut with an ellipsis and the whole value in the text and `title`
 *    (`Clip` in Query Logs).
 *
 * What genuinely has no words (a public key, a signature, a hex string, raw output)
 * goes in `ALLOWED`, by file AND selector, with its reason. An entry that no longer
 * matches anything is a finding too, so the list cannot only grow.
 *
 * It reads every `.css` file under `src/`, with comments stripped. Exit code is the
 * number of findings, so it can sit in the gate.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

export const ALLOWED = [
  {
    file: 'src/ui/record.module.css',
    selector: '.key',
    reason: 'A public key or a hex string is one token with no words; it breaks by characters by design.',
  },
  {
    file: 'src/screens/lists/Lists.module.css',
    selector: '.key',
    reason: 'The same key as ui/record, composed: a DNSKEY or an RRSIG would otherwise walk out of its cell.',
  },
  {
    file: 'src/screens/lists/Lists.module.css',
    selector: '.signatures',
    reason: 'Preformatted DNSSEC and glue records: base64 signatures with no words, inside a box of fixed width.',
  },
  {
    file: 'src/screens/zones/Zones.module.css',
    selector: '.output',
    reason: 'Preformatted text the server returns (a record comment), in a scrolling box of fixed width.',
  },
  {
    file: 'src/screens/zones/Zones.module.css',
    selector: '.val',
    reason: 'A record value can be one token of hundreds of characters (a DKIM TXT, a hex SSHFP) '
      + 'and has to fit its table cell. Domain-valued records would read better through DomainName; not done yet.',
  },
  {
    file: 'src/ui/kv.module.css',
    selector: '.kv dd',
    reason: 'Key/value lists hold DNSSEC keys and hex digests inside table cells; without it they push the table out.',
  },
  {
    file: 'src/ui/SectionHeader.module.css',
    selector: '.title',
    reason: 'The h1 sits in a column of definite width (`min-width: 0`), so it only breaks a word that '
      + 'overflows it and never sizes anything; a zone name longer than the screen is the one case.',
  },
]

const RULE = /(?:word-break\s*:\s*(break-all|break-word)|overflow-wrap\s*:\s*(anywhere))/g

export function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
}

/** Each breaking declaration with the selector of the rule that holds it. */
export function findBreaks(css) {
  const text = stripComments(css)
  const out = []
  for (const m of text.matchAll(RULE)) {
    const open = text.lastIndexOf('{', m.index)
    const close = text.lastIndexOf('}', open)
    const selector = text.slice(close + 1, open).trim().replace(/\s+/g, ' ')
    out.push({ selector, value: m[1] ?? m[2], line: text.slice(0, m.index).split('\n').length })
  }
  return out
}

function cssFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) return cssFiles(p)
    return e.name.endsWith('.css') ? [p] : []
  })
}

export function check() {
  const findings = []
  const used = new Set()
  for (const abs of cssFiles(path.join(ROOT, 'src'))) {
    const file = path.relative(ROOT, abs).split(path.sep).join('/')
    for (const b of findBreaks(fs.readFileSync(abs, 'utf8'))) {
      const allowed = ALLOWED.findIndex((a) => a.file === file && a.selector === b.selector)
      if (allowed >= 0) used.add(allowed)
      else findings.push(`${file}:${b.line}  ${b.selector} { ${b.value} }`)
    }
  }
  ALLOWED.forEach((a, i) => {
    if (!used.has(i)) findings.push(`ALLOWED entry matches nothing: ${a.file} ${a.selector}`)
  })
  return findings
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const findings = check()
  for (const f of findings) console.log(f)
  console.log(findings.length === 0 ? 'Word breaks: none outside the allowed list.' : `${findings.length} finding(s).`)
  process.exit(findings.length)
}
