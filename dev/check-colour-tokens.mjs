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
 * can override. And the light block declares every property the dark block
 * does: one it forgets falls back to `:root`, which carries dark, and paints a
 * dark value on a light page without anything else noticing.
 *
 * `color-scheme` follows the same rule, because it is colour too: it decides the
 * browser's own parts —scrollbars, date pickers, form controls—, and an element
 * that pins it draws them dark on a light page or the other way round. So a
 * `color-scheme` declaration is only allowed in a theme block of `tokens.css`;
 * anywhere else, a stylesheet declaration of it, or an inline style that sets it
 * to a fixed string, is a finding. Setting it from the resolved theme
 * (`root.style.colorScheme = resolved` in `theme/theme.ts`) is not pinning it, and
 * `prefers-color-scheme` is a media query, not a declaration. There is no
 * allow-list for it: an element that needs its own scheme needs a theme to say so.
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
const SCHEME_CSS = /(?<![\w-])color-scheme\s*:\s*[^;{}]*[^;{}\s]/gi
const SCHEME_TS = /(?<![\w$-])colorScheme\s*[:=]\s*(['"`])[^'"`]*\1|setProperty\(\s*(['"`])color-scheme\2/g

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

/** The `color-scheme` declarations in a file's text, with their line. */
export function findColourSchemes(text, kind) {
  const code = stripComments(text, kind)
  const re = kind === 'css' ? SCHEME_CSS : SCHEME_TS
  return [...code.matchAll(re)].map((m) => ({ line: lineAt(code, m.index), literal: m[0] }))
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

/*
What each theme block declares, as `{ dark, light }`, each a `Map` from the
property (`--bg`, `color-scheme`) to its value as written. Shared with the tools
that measure a theme —`palette-distance.mjs`, `theme-contrast.mjs`— so the three
read the file the same way.
*/
export function themeTokens(text) {
  const code = stripComments(text, 'css')
  const out = {}
  for (const b of blocks(code)) {
    const theme = b.selector === THEME_BLOCKS[0] ? 'dark' : b.selector === THEME_BLOCKS[1] ? 'light' : null
    if (!theme) continue
    const decls = new Map()
    for (const [, name, value] of code.slice(b.from + 1, b.to).matchAll(/(--[\w-]+|color-scheme)\s*:\s*([^;]+);/g))
      decls.set(name, value.trim().replace(/\s+/g, ' '))
    out[theme] = decls
  }
  return out
}

/*
Every property the dark block declares, the light block declares too. A token
light forgot is not an error anybody would see: `:root` carries the dark value,
so it quietly paints dark on a light page.
*/
export function findMissingInLight(text) {
  const { dark = new Map(), light = new Map() } = themeTokens(text)
  return [...dark.keys()].filter((name) => !light.has(name))
}

/** The colour literals and `color-scheme` declarations in `tokens.css` that are outside every theme block. */
export function findOutsideThemes(text) {
  const code = stripComments(text, 'css')
  const inside = blocks(code).filter((b) => THEME_BLOCKS.includes(b.selector))
  return [...findColours(text, 'css'), ...findColourSchemes(text, 'css')]
    .filter(({ line }) => !inside.some((b) => line >= lineAt(code, b.from) && line <= lineAt(code, b.to)))
    .sort((a, b) => a.line - b.line)
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
      for (const name of findMissingInLight(text))
        findings.push(`${rel}  ${name}  is declared for dark and not for light`)
      continue
    }
    const kind = file.endsWith('.css') ? 'css' : 'ts'
    for (const f of findColourSchemes(text, kind))
      findings.push(`${rel}:${f.line}  ${f.literal}  pins color-scheme outside the theme blocks of ${TOKENS}`)
    for (const f of findColours(text, kind)) {
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
    console.log(`\n  Every colour is a token: no colour literal and no color-scheme in src/ outside the theme blocks of ${TOKENS} (${ALLOWED.length} allowed, each with its reason).\n`)
  } else {
    for (const f of findings) console.log('  ' + f)
    console.log(`\n  ${findings.length} findings. A colour, and color-scheme, belong in a theme block of ${TOKENS}; if a colour literal really cannot, ALLOWED in dev/check-colour-tokens.mjs takes it with its reason.\n`)
  }
  process.exit(Math.min(findings.length, 250))
}
