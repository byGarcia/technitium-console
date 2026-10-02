#!/usr/bin/env node
/*
Every text colour against every surface it is drawn on, per theme.

A palette is not legible in general: a token is legible on a surface. `--faint`
can be 5:1 on the panel and 4.2:1 on the same panel under a hovered row, and the
second is where it is read the moment the pointer is on it. So what is measured
here is not a list of tokens but a list of PAIRS, each one a place the console
really puts that colour on that ground. The pairs were read from the stylesheets
(`grep var(--token)` in `src/`), and each says where.

A surface may be a token, or a token under a translucent one (the hover veils,
the Query Logs row colours), composed the way the browser composes them: in sRGB,
source over. `color-mix(in srgb, X 30%, transparent)` is X at alpha 0.3.

Thresholds, WCAG 2.2:

  4.5  text (1.4.3). Every text here is under 18.66 px bold, so none is "large".
  3    a non-text object a user needs to see (1.4.11): a field's border, the focus
       ring, a checkbox's box, a switch's knob, a tick on its fill.

What it does not measure: the chart series (`dev/palette-distance.mjs` does, as
pairs that share a chart) and decorative dividers (`--line`, `--line2`), which
1.4.11 does not ask anything of: a panel is still a panel without its border.

Exit code: 1 when a pair in the LIGHT theme is under its threshold. Dark is
measured and printed with the same list, and it is not gated, on purpose: its
values are the ones shipped since 2026-08-25 and the light theme was designed
under a "dark stays pixel-identical" rule (2026-10-01). What it fails is listed
as a fact about dark, not excused.

Run: node dev/theme-contrast.mjs
*/
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { themeTokens } from './check-colour-tokens.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

// ── Colour ───────────────────────────────────────────────────────────────────

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)

/** `#rrggbb` or `rgb[a](r, g, b[, a])` → [r, g, b, a], channels 0-255. */
export function parse(value) {
  const hex = /^#([0-9a-f]{6})$/i.exec(value)
  if (hex) return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16)).concat(1)
  const fn = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(value)
  if (fn) return [Number(fn[1]), Number(fn[2]), Number(fn[3]), fn[4] == null ? 1 : Number(fn[4])]
  return null
}

/** `top` over an opaque `ground`, in sRGB: what the browser paints. */
export const over = (top, ground) => [0, 1, 2].map((i) => top[i] * top[3] + ground[i] * (1 - top[3])).concat(1)

const luminance = ([r, g, b]) => {
  const [R, G, B] = [r, g, b].map((c) => toLinear(c / 255))
  return 0.2126 * R + 0.7152 * G + 0.0722 * B
}

export const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}

const hex = (c) => '#' + c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')

// ── What is measured ─────────────────────────────────────────────────────────

/*
The surfaces. A name is a token; `a + b` is token `b` painted over surface `a`;
`a + b@0.3` is `b` at that alpha, which is how `color-mix(..., transparent)` and
the row colours are written.
*/
const PLAIN = ['bg', 'pan', 'pan2', 'field']
const HOVERED = ['pan + hover', 'pan + hover-strong', 'pan2 + hover-strong']
const EVERYWHERE = [...PLAIN, ...HOVERED]

/*
The `stroke` written inside a `--glyph-*` data URI, which is the only place that
colour exists. `%23` is `#`.
*/
const GLYPH = { 'glyph-chevron': 'glyph-chevron', 'glyph-tick': 'glyph-tick', 'glyph-tick-ok': 'glyph-tick-ok', 'glyph-dash': 'glyph-dash' }

export const PAIRS = [
  // Text: the three steps of ink, on every ground of the console.
  { fg: 'ink', on: [...EVERYWHERE, 'field-focus', 'acc-bg', 'dan-fill'], min: 4.5, where: 'all body text; the own-session row (`acc-bg`); Confirm armed (`dan-fill`)' },
  { fg: 'mute', on: [...EVERYWHERE, 'acc-bg'], min: 4.5, where: 'secondary text, labels, the small button, row data' },
  { fg: 'faint', on: [...EVERYWHERE, 'acc-bg'], min: 4.5, where: 'placeholders, TTL suffixes, timestamps, disabled row actions' },
  // Amber.
  { fg: 'on-acc', on: ['acc'], min: 4.5, where: 'primary button, active rail entry, current page, Segmented' },
  { fg: 'acc-ink', on: [...EVERYWHERE, 'acc-bg', 'pan + acc@0.14'], min: 4.5, where: 'links, current sub-tab, sorted arrow, `acc` pill, Versions mark' },
  // State tones, as pill or notice (`ui/tones`) and as loose text.
  { fg: 'ok', on: ['ok-bg', 'pan', 'pan2'], min: 4.5, where: '`ok` pill and notice; Blocking status mark' },
  { fg: 'warn', on: ['warn-bg', 'pan', 'pan + hover'], min: 4.5, where: '`warn` pill and notice; the Dashboard\'s limited rows' },
  { fg: 'dan', on: ['dan-bg', 'pan', 'pan2', 'pan + hover-strong'], min: 4.5, where: '`dan` pill and notice, validation text, Delete in a row or a menu' },
  { fg: 'info', on: ['info-bg', 'pan'], min: 4.5, where: '`info` pill and notice' },
  { fg: 'on-dan', on: ['dan-fill'], min: 4.5, where: 'the destructive button, filled' },
  { fg: 'chip-fg', on: ['chip-bg'], min: 4.5, where: 'record type and app class chips' },
  // The rule kind in Blocking › Rules and Lists: `Allow` takes `--ok`, `Block` a series colour.
  { fg: 'ok', on: ['pan + hover'], min: 4.5, where: '`Allow` in Blocking › Rules and Block Lists, under the row hover' },
  { fg: 'ch-block', on: ['pan', 'pan + hover'], min: 4.5, where: '`Block` in Blocking › Rules and Block Lists' },
  // Query Logs: the cell text on its row colour, 30 % over the panel.
  ...['ch-fail', 'ch-block', 'ch-nx', 'ch-refuse', 'ch-auth', 'ch-rec', 'ch-cache'].map((k) => ({
    fg: 'ink', on: [`pan + ${k}@0.3`], min: 4.5, where: `Query Logs row (${k})`,
  })),
  ...['ch-fail', 'ch-block', 'ch-nx', 'ch-refuse', 'ch-auth', 'ch-rec', 'ch-cache'].map((k) => ({
    fg: 'faint-on-tint', on: [`pan + ${k}@0.3`], min: 4.5, where: `Query Logs row, its response time (${k})`,
  })),
  // Non-text: what a user has to see to operate a control.
  { fg: 'faint-on-tint', on: ['pan', 'pan + hover'], min: 4.5, where: 'Query Logs, the response time on an uncoloured or hovered row' },
  { fg: 'line-field', on: ['bg', 'pan', 'field', 'pan2'], min: 3, where: 'a field\'s border at rest: it is what tells a field from the panel' },
  { fg: 'line-ctrl', on: ['pan', 'field', 'pan2'], min: 3, where: 'a checkbox\'s and a radio\'s box at rest; a field under the pointer' },
  { fg: 'acc-ink', on: ['bg', 'pan', 'pan2', 'field'], min: 3, where: 'the focus ring; a focused field\'s border; a ticked box\'s border' },
  { fg: 'dan', on: ['pan', 'field'], min: 3, where: 'the border of a field that failed validation' },
  { fg: 'mute', on: ['field'], min: 3, where: 'the switch\'s knob, off' },
  { fg: 'on-acc', on: ['acc'], min: 3, where: 'the switch\'s knob, on; the tick and the dash' },
  { fg: 'glyph-tick-ok', on: ['ok'], min: 3, where: 'a granted permission\'s tick, on its green' },
  { fg: 'ok', on: ['pan'], min: 3, where: 'a granted permission\'s box and pip' },
  { fg: 'glyph-chevron', on: ['field'], min: 3, where: 'the dropdown\'s chevron' },
]

// ── Resolution ───────────────────────────────────────────────────────────────

function resolver(decls) {
  const value = (name) => {
    let v = decls.get(`--${name}`)
    if (v == null) throw new Error(`--${name} is not declared`)
    if (GLYPH[name]) {
      const m = /stroke='%23([0-9a-f]{6})'/i.exec(v)
      if (!m) throw new Error(`--${name} has no stroke colour`)
      v = `#${m[1]}`
    }
    const ref = /^var\(--([\w-]+)\)$/.exec(v)
    if (ref) return value(ref[1])
    const c = parse(v)
    if (!c) throw new Error(`--${name}: cannot read ${v}`)
    return c
  }
  const surface = (spec) => {
    const [base, ...layers] = spec.split('+').map((s) => s.trim())
    let ground = value(base)
    if (ground[3] !== 1) throw new Error(`${base} is not opaque`)
    for (const layer of layers) {
      const [name, alpha] = layer.split('@')
      const top = value(name)
      ground = over(alpha == null ? top : [...top.slice(0, 3), Number(alpha)], ground)
    }
    return ground
  }
  return { value, surface }
}

/** Every pair of `PAIRS` measured in one theme. */
export function measure(decls) {
  const { value, surface } = resolver(decls)
  return PAIRS.flatMap((p) => p.on.map((on) => {
    const ratio = contrast(value(p.fg), surface(on))
    return { ...p, on, ratio, pass: ratio >= p.min, fgHex: hex(value(p.fg)), onHex: hex(surface(on)) }
  }))
}

// ── The report ───────────────────────────────────────────────────────────────

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const themes = themeTokens(readFileSync(join(ROOT, 'src/theme/tokens.css'), 'utf8'))
  let lightFails = 0
  for (const theme of ['light', 'dark']) {
    const rows = measure(themes[theme])
    console.log(`\n${'='.repeat(78)}\n${theme.toUpperCase()}${theme === 'dark' ? ': measured, not gated' : ''}\n${'='.repeat(78)}`)
    for (const p of PAIRS) {
      const mine = rows.filter((r) => r.fg === p.fg && r.where === p.where)
      const worst = mine.reduce((a, b) => (b.ratio < a.ratio ? b : a))
      console.log(`\n  --${p.fg} ${mine[0].fgHex}  ≥ ${p.min}  · ${p.where}`)
      console.log('    ' + mine.map((r) => `${r.on} ${r.ratio.toFixed(2)}${r.pass ? '' : ' ✗'}`).join(' · '))
      if (!worst.pass) console.log(`    UNDER ${p.min}: ${worst.on} ${worst.onHex} gives ${worst.ratio.toFixed(2)}:1`)
    }
    const fails = rows.filter((r) => !r.pass)
    console.log(`\n  ${theme}: ${rows.length - fails.length} of ${rows.length} pairs meet their threshold`)
    if (theme === 'light') lightFails = fails.length
  }
  console.log('')
  if (lightFails) process.exitCode = 1
}
