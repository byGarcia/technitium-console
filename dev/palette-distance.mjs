#!/usr/bin/env node
/*
How far apart the chart colours actually are.

A series palette is not a matter of taste at the point where two series land in
the same doughnut: either the eye separates them or it does not. This measures
it, so the decision between the design drawing's palette and the code's is made
on numbers and not on which one was written last.

What it measures, for each palette:

  · CIEDE2000 between every pair of series that SHARE A CHART. Pairs that never
    appear together do not compete and are not counted.
  · The same, through protanopia and deuteranopia (Machado 2009, severity 1.0).
    A DNS console is read by whoever administers the server, and a palette that
    only works for trichromats is a palette that works for most people.
  · Every series against the interface's own text and line tokens. A series the
    exact colour of `--mute` is a series that reads as a label.
  · WCAG 1.4.11 contrast against the panel it is drawn on: a 2 px line and a 9 px
    legend chip are non-text graphical objects and want 3:1.

Thresholds, stated so they can be argued with:

  ΔE00 < 10  collision: the two read as the same colour at line and chip size
  ΔE00 < 15  at risk:   separable side by side, not separable across a chart

Every theme is measured, not only the dark one: the code's palette is read from
each theme block of `tokens.css` and reported against that theme's own panel and
text tokens. Light is held to two more rules, because dark is the palette these
thresholds were argued on and light has to answer to it pair by pair:

  · no series under ΔE00 10 from a text or line token of its theme;
  · no pair that shares a chart separates LESS in light than in dark, under any
    of the three visions, unless it is still at 15 or more. A pair that was at
    risk in dark may stay at risk in light, never sink further.

Exit code: 1 when a theme of the code fails its rules (every theme: each series
at 3:1 on its panel; light: also the two above), 0 otherwise. The drawn palette
and the proposal are history, printed for comparison and never gated.

Run: node dev/palette-distance.mjs
*/

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { themeTokens } from './check-colour-tokens.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

// ── The two palettes under comparison ────────────────────────────────────────

/*
The code's, read from the file so this cannot go stale: one palette per theme
block, with the six-digit hex tokens of that block and nothing else.
*/
export function codePalettes(css = readFileSync(join(ROOT, 'src/theme/tokens.css'), 'utf8')) {
  const out = {}
  for (const [theme, decls] of Object.entries(themeTokens(css))) {
    out[theme] = {}
    for (const [name, value] of decls)
      if (/^#[0-9a-f]{6}$/i.test(value)) out[theme][name.slice(2)] = value.toLowerCase()
  }
  return out
}

/*
The palette of the Dashboard design drawing, transcribed by hand on 2026-09-02.
Transcribed and not read: the drawing is not a file in this repository.
*/
const DRAWN = {
  'ch-total': '#60a5fa',
  'ch-ok': '#34d399',
  'ch-fail': '#f87171',
  'ch-nx': '#a3e635',
  'ch-refuse': '#22d3ee',
  'ch-auth': '#38bdf8',
  'ch-rec': '#fb923c',
  'ch-cache': '#f472b6',
  'ch-block': '#c084fc',
  'ch-drop': '#868e96',
  'ch-clients': '#f5a524',
  /* The open cycle, taken from the two doughnuts the drawing paints with it. */
  'ch-1': '#60a5fa',
  'ch-2': '#38bdf8',
  'ch-3': '#2dd4bf',
  'ch-4': '#f472b6',
  'ch-5': '#9aa1a8',
}

/*
The proposal this measurement argues for: the drawing's hues, which measure better
where it counts, with the two exact identities corrected back to the code's.
*/
const PROPOSED = {
  ...DRAWN,
  /* `#868e96` IS `--faint`, to the digit: a series cannot be the text colour. */
  'ch-drop': '#94a3b8',
  /* Eight and not five: the cycle feeds an unbounded set (StatsManager.cs:2544
     truncates nothing), so it runs out sooner than the doughnut does. */
  'ch-1': '#38bdf8', 'ch-2': '#34d399', 'ch-3': '#a78bfa', 'ch-4': '#fb923c',
  'ch-5': '#2dd4bf', 'ch-6': '#f472b6', 'ch-7': '#f87171', 'ch-8': '#facc15',
}

/*
Which series share a chart. Read from the server, not guessed:
WebServiceDashboardApi.cs:465-535 for the line, StatsManager.cs:2467 for the
response doughnut. The two remaining doughnuts are open sets and get the cycle.
*/
export const CHARTS = {
  'main line chart': ['ch-total', 'ch-ok', 'ch-fail', 'ch-nx', 'ch-refuse', 'ch-auth', 'ch-rec', 'ch-cache', 'ch-block', 'ch-drop', 'ch-clients'],
  'Query Response Types': ['ch-auth', 'ch-rec', 'ch-cache', 'ch-block', 'ch-drop'],
  'Blocking stacked bars': ['ch-ok', 'ch-block'],
  'open cycle (Query / Protocol Types)': ['ch-1', 'ch-2', 'ch-3', 'ch-4', 'ch-5', 'ch-6', 'ch-7', 'ch-8'],
}

/* The interface tokens a series must not be mistaken for. */
export const UI = ['ink', 'mute', 'faint', 'line']

// ── Colour ───────────────────────────────────────────────────────────────────

const srgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const fromLinear = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055)

function lab(hex) {
  const [r, g, b] = srgb(hex).map(toLinear)
  const X = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047
  const Y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b
  const Z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27) * t / 116 + 16 / 116)
  const [fx, fy, fz] = [f(X), f(Y), f(Z)]
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

export const luminance = (hex) => {
  const [r, g, b] = srgb(hex).map(toLinear)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}

/* CIEDE2000. Sharma, Wu & Dalal's formulation. */
export function deltaE00(hexA, hexB) {
  const [L1, a1, b1] = lab(hexA)
  const [L2, a2, b2] = lab(hexB)
  const rad = Math.PI / 180
  const C1 = Math.hypot(a1, b1)
  const C2 = Math.hypot(a2, b2)
  const Cb = (C1 + C2) / 2
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)))
  const ap1 = (1 + G) * a1
  const ap2 = (1 + G) * a2
  const Cp1 = Math.hypot(ap1, b1)
  const Cp2 = Math.hypot(ap2, b2)
  const hp = (b, ap) => {
    if (b === 0 && ap === 0) return 0
    const h = Math.atan2(b, ap) / rad
    return h < 0 ? h + 360 : h
  }
  const hp1 = hp(b1, ap1)
  const hp2 = hp(b2, ap2)
  const dL = L2 - L1
  const dC = Cp2 - Cp1
  let dh = 0
  if (Cp1 * Cp2 !== 0) {
    dh = hp2 - hp1
    if (dh > 180) dh -= 360
    else if (dh < -180) dh += 360
  }
  const dH = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin((dh * rad) / 2)
  const Lb = (L1 + L2) / 2
  const Cpb = (Cp1 + Cp2) / 2
  let hpb
  if (Cp1 * Cp2 === 0) hpb = hp1 + hp2
  else if (Math.abs(hp1 - hp2) <= 180) hpb = (hp1 + hp2) / 2
  else hpb = hp1 + hp2 < 360 ? (hp1 + hp2 + 360) / 2 : (hp1 + hp2 - 360) / 2
  const T =
    1 -
    0.17 * Math.cos((hpb - 30) * rad) +
    0.24 * Math.cos(2 * hpb * rad) +
    0.32 * Math.cos((3 * hpb + 6) * rad) -
    0.2 * Math.cos((4 * hpb - 63) * rad)
  const dTheta = 30 * Math.exp(-(((hpb - 275) / 25) ** 2))
  const Rc = 2 * Math.sqrt(Cpb ** 7 / (Cpb ** 7 + 25 ** 7))
  const Sl = 1 + (0.015 * (Lb - 50) ** 2) / Math.sqrt(20 + (Lb - 50) ** 2)
  const Sc = 1 + 0.045 * Cpb
  const Sh = 1 + 0.015 * Cpb * T
  const Rt = -Math.sin(2 * dTheta * rad) * Rc
  return Math.sqrt((dL / Sl) ** 2 + (dC / Sc) ** 2 + (dH / Sh) ** 2 + Rt * (dC / Sc) * (dH / Sh))
}

/* Machado, Oliveira & Fernandes 2009, severity 1.0, on linear RGB. */
const CVD = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
}

export function simulate(hex, kind) {
  if (!kind) return hex
  const m = CVD[kind]
  const lin = srgb(hex).map(toLinear)
  const out = m.map((row) => row.reduce((s, k, i) => s + k * lin[i], 0))
  return (
    '#' +
    out
      .map((c) => Math.round(Math.min(1, Math.max(0, fromLinear(c))) * 255).toString(16).padStart(2, '0'))
      .join('')
  )
}

// ── The report ───────────────────────────────────────────────────────────────

const NAME = {
  'ch-total': 'Total', 'ch-ok': 'No Error', 'ch-fail': 'Server Failure',
  'ch-nx': 'NX Domain', 'ch-refuse': 'Refused', 'ch-auth': 'Authoritative',
  'ch-rec': 'Recursive', 'ch-cache': 'Cached', 'ch-block': 'Blocked',
  'ch-drop': 'Dropped', 'ch-clients': 'Clients',
}
const label = (k) => NAME[k] ?? k

export function pairs(palette, keys, vision) {
  const present = keys.filter((k) => palette[k])
  const out = []
  for (let i = 0; i < present.length; i++)
    for (let j = i + 1; j < present.length; j++) {
      const [a, b] = [present[i], present[j]]
      out.push({ a, b, d: deltaE00(simulate(palette[a], vision), simulate(palette[b], vision)) })
    }
  return out.sort((x, y) => x.d - y.d)
}

export const VISIONS = [null, 'deuteranopia', 'protanopia']

function report(title, palette, ui) {
  console.log(`\n${'='.repeat(72)}\n${title}\n${'='.repeat(72)}`)

  for (const [chart, keys] of Object.entries(CHARTS)) {
    console.log(`\n── ${chart} ──`)
    for (const vision of VISIONS) {
      const p = pairs(palette, keys, vision)
      if (!p.length) continue
      const bad = p.filter((x) => x.d < 15)
      const head = vision ?? 'normal vision'
      if (!bad.length) {
        console.log(`  ${head.padEnd(14)} worst pair ΔE00 ${p[0].d.toFixed(1)}  ${label(p[0].a)} / ${label(p[0].b)}: clear`)
      } else {
        console.log(`  ${head}`)
        for (const x of bad)
          console.log(
            `    ΔE00 ${x.d.toFixed(1).padStart(5)}  ${x.d < 10 ? 'COLLISION' : 'at risk  '}  ${label(x.a)} ${palette[x.a]} / ${label(x.b)} ${palette[x.b]}`,
          )
      }
    }
  }

  console.log('\n── a series the colour of the interface ──')
  const clashes = uiClashes(palette, ui)
  for (const c of clashes)
    console.log(`    ΔE00 ${c.d.toFixed(1).padStart(5)}  ${c.d < 1 ? 'IDENTICAL' : 'COLLISION'}  ${label(c.k)} ${palette[c.k]} / --${c.t} ${ui[c.t]}`)
  if (!clashes.length) console.log('    none under ΔE00 10')

  console.log(`\n── contrast on the panel (WCAG 1.4.11 wants 3:1) ──`)
  const thin = thinSeries(palette, ui.pan)
  if (!thin.length) console.log(`    every series ≥ 3:1 on --pan ${ui.pan}`)
  else for (const k of thin) console.log(`    ${contrast(palette[k], ui.pan).toFixed(2)}:1  ${label(k)} ${palette[k]}`)
}

const seriesOf = (palette) => [...new Set(Object.values(CHARTS).flat())].filter((k) => palette[k])

/** The series under ΔE00 10 from a text or line token of the same theme. */
export function uiClashes(palette, ui) {
  const out = []
  for (const k of seriesOf(palette))
    for (const t of UI) {
      if (!ui[t]) continue
      const d = deltaE00(palette[k], ui[t])
      if (d < 10) out.push({ k, t, d })
    }
  return out
}

/** The series under 3:1 against the panel they are drawn on. */
export function thinSeries(palette, pan) {
  return seriesOf(palette).filter((k) => contrast(palette[k], pan) < 3)
}

/*
Every pair, chart and vision where `light` separates less than `dark` AND is
under 15. Pairs that do not share a chart are not compared, as everywhere else.
*/
export function regressions(dark, light) {
  const out = []
  for (const [chart, keys] of Object.entries(CHARTS))
    for (const vision of VISIONS) {
      const before = new Map(pairs(dark, keys, vision).map((x) => [`${x.a}|${x.b}`, x.d]))
      for (const x of pairs(light, keys, vision)) {
        const was = before.get(`${x.a}|${x.b}`)
        if (x.d < 15 && was != null && x.d < was) out.push({ chart, vision, a: x.a, b: x.b, dark: was, light: x.d })
      }
    }
  return out
}

const uiOf = (p) => ({ ink: p.ink, mute: p.mute, faint: p.faint, line: p.line, pan: p.pan })

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { dark, light } = codePalettes()

  report('CODE, dark: src/theme/tokens.css', dark, uiOf(dark))
  report('CODE, light: src/theme/tokens.css', light, uiOf(light))
  report('DRAWN: the Dashboard design drawing', DRAWN, uiOf(dark))
  report('PROPOSED: the drawing with the two identities corrected', PROPOSED, uiOf(dark))

  console.log(`\n${'='.repeat(72)}\nWhere the two disagree\n${'='.repeat(72)}`)
  for (const k of Object.keys(NAME)) {
    if (dark[k] !== DRAWN[k]) console.log(`  ${label(k).padEnd(15)} code ${dark[k]}   drawn ${DRAWN[k]}`)
  }

  console.log(`\n${'='.repeat(72)}\nLight against dark, pair by pair\n${'='.repeat(72)}`)
  const worse = regressions(dark, light)
  if (!worse.length) console.log('\n  no pair under 15 separates less in light than in dark')
  for (const r of worse)
    console.log(`  ${r.chart} · ${r.vision ?? 'normal'}: ${label(r.a)} / ${label(r.b)}  dark ${r.dark.toFixed(1)} → light ${r.light.toFixed(1)}`)

  const failures = [
    ...seriesOf(dark).filter((k) => !light[k]).map((k) => `light: ${label(k)} is not declared`),
    ...thinSeries(dark, dark.pan).map((k) => `dark: ${label(k)} under 3:1 on its panel`),
    ...thinSeries(light, light.pan).map((k) => `light: ${label(k)} under 3:1 on its panel`),
    ...uiClashes(light, uiOf(light)).map((c) => `light: ${label(c.k)} is ΔE00 ${c.d.toFixed(1)} from --${c.t}`),
    ...worse.map((r) => `light: ${label(r.a)} / ${label(r.b)} separates less than in dark (${r.chart}, ${r.vision ?? 'normal'})`),
  ]
  console.log(`\n${'='.repeat(72)}\nVerdict\n${'='.repeat(72)}`)
  if (!failures.length) console.log('\n  dark and light both pass\n')
  else {
    for (const f of failures) console.log(`  FAIL  ${f}`)
    console.log('')
    process.exitCode = 1
  }
}
