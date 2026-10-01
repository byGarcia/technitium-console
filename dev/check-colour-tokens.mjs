/**
 * The guard that keeps every colour in `src/theme/tokens.css`.
 *
 * `CONVENTIONS.md` has said "colours always by token, not one `#hex` outside
 * `tokens.css`" since the first phase, and on 2026-10-01 there were 44 colour
 * literals outside it, in 14 files: the hover border of a button, the veil behind
 * a dialog, the shine on a ticked checkbox, eight fallbacks for the chart palette.
 * None of them was wrong for the one theme the console had. Every one of them is
 * a place a second theme cannot reach, which is why the rule stopped being a
 * preference the day a light theme was decided. This is what measures it.
 *
 * It looks at the `.css`, `.ts` and `.tsx` files in `src/`, with their comments
 * stripped —a comment that quotes a value is quoting, not painting— and finds:
 *
 *  - `#hex`, 3, 4, 6 or 8 digits, and its URL-encoded form `%23hex`, which is how
 *    a colour hides inside an inline SVG in a `data:` URI.
 *  - The colour functions: `rgb()`, `rgba()`, `hsl()`, `hsla()`, `hwb()`, `lab()`,
 *    `lch()`, `oklab()`, `oklch()`, `color()`.
 *  - The CSS named colours (`white`, `black`, `red`…): in a stylesheet, as a word
 *    in a declaration's value; in TypeScript, as a whole string literal, which is
 *    how an inline style writes one.
 *
 * And inside `tokens.css` itself it checks the other half of the rule: a colour
 * literal is only allowed in a THEME block (`:root, [data-theme='dark']` or
 * `[data-theme='light']`). A colour in the plain `:root` would be one no theme
 * can override.
 *
 * What it deliberately does NOT look at:
 *
 *  - Tests (`*.test.*`, `src/test/`). A test may write a colour as data.
 *  - `color-mix()` and `transparent`: they compose tokens, they are not colours of
 *    their own. A `color-mix()` with a literal inside is still caught, by the
 *    literal.
 *  - Named colours inside a longer TypeScript string (`'1px solid white'`). None
 *    exists today; a parser would be needed to tell them from interface text.
 *
 * A literal that has to stay where it is goes in `ALLOWED`, by file AND literal,
 * with its reason. An entry that no longer matches anything is a finding too: an
 * allow-list that only grows stops meaning anything.
 *
 * Exit code is the number of findings, so it can sit in the gate.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

export const TOKENS = 'src/theme/tokens.css'

/* The selectors a colour token may be declared under, whitespace removed. */
export const THEME_BLOCKS = [":root,[data-theme='dark']", "[data-theme='light']"]

export const ALLOWED = [
  {
    file: 'src/screens/modals/Configure2FA.tsx',
    literal: '#fff',
    reason:
      'The quiet zone around the QR code. A scanner needs dark modules on a light ground, '
      + 'so it is white in every theme: a token would invite a theme to change it.',
  },
]

const NAMED = new Set(
  (
    'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue '
    + 'blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk '
    + 'crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki '
    + 'darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen '
    + 'darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue '
    + 'dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite '
    + 'gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki '
    + 'lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan '
    + 'lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen '
    + 'lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen '
    + 'magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen '
    + 'mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream '
    + 'mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid '
    + 'palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum '
    + 'powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown '
    + 'seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen '
    + 'steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen'
  ).split(' '),
)

const HEX = /(?<![\w&%#-])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w-])/gi
const ENCODED = /%23(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w-])/gi
const FUNCTION = /(?<![\w.$-])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\([^)]*\)?/gi
const DECLARATION = /[a-z-]+\s*:\s*([^;{}]*)(?=[;}])/gi
const WORD = /(?<![\w-])[a-z]+(?![\w-])/gi
const STRING = /(['"])([a-z]+)\1/gi

/*
Comments out, everything else in place: each comment character becomes a space
and each newline stays, so a finding keeps its line number. Strings are walked
so that a `//` inside one —`http://www.w3.org/2000/svg` in every inline SVG— is
not taken for a comment. `'` and `"` cannot span a line, so a quote inside a
regex literal can derail at most the rest of its own line.
*/
export function stripComments(text, kind) {
  let out = ''
  let i = 0
  let quote = null
  const blank = (s) => s.replace(/[^\n]/g, ' ')
  while (i < text.length) {
    const c = text[i]
    if (quote) {
      out += c
      if (c === '\\') { out += text[i + 1] ?? ''; i += 2; continue }
      if (c === quote || (c === '\n' && quote !== '`')) quote = null
      i++
      continue
    }
    if (c === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2)
      const stop = end < 0 ? text.length : end + 2
      out += blank(text.slice(i, stop))
      i = stop
      continue
    }
    if (kind === 'ts' && c === '/' && text[i + 1] === '/') {
      const end = text.indexOf('\n', i)
      const stop = end < 0 ? text.length : end
      out += blank(text.slice(i, stop))
      i = stop
      continue
    }
    if (c === "'" || c === '"' || (kind === 'ts' && c === '`')) quote = c
    out += c
    i++
  }
  return out
}

const lineAt = (text, index) => text.slice(0, index).split('\n').length

/** The colour literals in a file's text, with their line. `kind` is `css` or `ts`. */
export function findColours(text, kind) {
  const code = stripComments(text, kind)
  const found = []
  const add = (index, literal) => found.push({ line: lineAt(code, index), literal })
  for (const re of [HEX, ENCODED, FUNCTION]) for (const m of code.matchAll(re)) add(m.index, m[0])
  if (kind === 'css') {
    for (const d of code.matchAll(DECLARATION)) {
      const at = d.index + d[0].length - d[1].length
      for (const w of d[1].matchAll(WORD)) if (NAMED.has(w[0].toLowerCase())) add(at + w.index, w[0])
    }
  } else {
    for (const s of code.matchAll(STRING)) if (NAMED.has(s[2].toLowerCase())) add(s.index, s[0])
  }
  return found.sort((a, b) => a.line - b.line)
}

/*
The top-level blocks of a stylesheet, with the selector each one hangs from.
`tokens.css` has no nesting except inside a block's own value, so counting
braces is enough.
*/
function blocks(code) {
  const out = []
  let depth = 0
  let start = 0
  for (let i = 0; i < code.length; i++) {
    if (code[i] === '{') {
      if (depth === 0) out.push({ selector: code.slice(start, i), from: i })
      depth++
    } else if (code[i] === '}') {
      depth--
      if (depth === 0) { out[out.length - 1].to = i; start = i + 1 }
    }
  }
  return out.map((b) => ({ ...b, selector: b.selector.replace(/\s+/g, '') }))
}

/** The colour literals in `tokens.css` that are outside every theme block. */
export function findOutsideThemes(text) {
  const code = stripComments(text, 'css')
  const inside = blocks(code).filter((b) => THEME_BLOCKS.includes(b.selector))
  return findColours(text, 'css').filter(({ line }) => {
    return !inside.some((b) => line >= lineAt(code, b.from) && line <= lineAt(code, b.to))
  })
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) return e.name === 'test' ? [] : walk(p)
    return /\.(css|tsx?)$/.test(e.name) && !/\.test\./.test(e.name) ? [p] : []
  })
}

/** Every finding under `root`, and the allow-list entries that matched nothing. */
export function check(root = ROOT, allowed = ALLOWED) {
  const findings = []
  const used = new Set()
  for (const file of walk(path.join(root, 'src'))) {
    const rel = path.relative(root, file).split(path.sep).join('/')
    const text = fs.readFileSync(file, 'utf8')
    if (rel === TOKENS) {
      for (const f of findOutsideThemes(text))
        findings.push(`${rel}:${f.line}  ${f.literal}  is outside every theme block`)
      continue
    }
    for (const f of findColours(text, file.endsWith('.css') ? 'css' : 'ts')) {
      const entry = allowed.find((a) => a.file === rel && a.literal.toLowerCase() === f.literal.toLowerCase())
      if (entry) { used.add(entry); continue }
      findings.push(`${rel}:${f.line}  ${f.literal}  is a colour outside ${TOKENS}`)
    }
  }
  for (const a of allowed) if (!used.has(a)) findings.push(`${a.file}  ${a.literal}  is allowed but no longer found: remove the entry`)
  return findings
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const findings = check()
  if (findings.length === 0) {
    console.log(`\n  Every colour is a token: no colour literal in src/ outside the theme blocks of ${TOKENS} (${ALLOWED.length} allowed, each with its reason).\n`)
  } else {
    for (const f of findings) console.log('  ' + f)
    console.log(`\n  ${findings.length} findings. A colour belongs in a theme block of ${TOKENS}; if one really cannot, ALLOWED in dev/check-colour-tokens.mjs takes it with its reason.\n`)
  }
  process.exit(Math.min(findings.length, 250))
}
