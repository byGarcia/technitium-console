#!/usr/bin/env node
/*
How far apart the chart colours actually are.

A series palette is not a matter of taste at the point where two series land in
the same doughnut: either the eye separates them or it does not. This measures
it, so the decision between the design project's palette and the code's is made
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

  ΔE00 < 10  collision — the two read as the same colour at line and chip size
  ΔE00 < 15  at risk   — separable side by side, not separable across a chart

Run: node dev/palette-distance.mjs
*/

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

// ── The two palettes under comparison ────────────────────────────────────────

/* The code's, read from the file so this cannot go stale. */
function codePalette() {
  const css = readFileSync(join(ROOT, 'src/theme/tokens.css'), 'utf8')
  const out = {}
  for (const [, name, hex] of css.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\b/g)) out[name] = hex.toLowerCase()
  return out
}

/*
The pilot's, transcribed from `12-piloto-dashboard.dc.html` in the Claude Design
project «technitium-ui — consola DNS», the `.pil` rule, etag 1788332174231441
(2026-09-02 08:56). Transcribed and not read: the design project is not a file
on this disk.
*/
const PILOT = {
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
  /* The open cycle, taken from the two doughnuts the pilot draws with it. */
  'ch-1': '#60a5fa',
  'ch-2': '#38bdf8',
  'ch-3': '#2dd4bf',
  'ch-4': '#f472b6',
  'ch-5': '#9aa1a8',
}

/*
The proposal this measurement argues for: the pilot's hues, which measure better
where it counts, with the two exact identities corrected back to the code's.
*/
const PROPOSED = {
  ...PILOT,
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
const CHARTS = {
  'main line chart': ['ch-total', 'ch-ok', 'ch-fail', 'ch-nx', 'ch-refuse', 'ch-auth', 'ch-rec', 'ch-cache', 'ch-block', 'ch-drop', 'ch-clients'],
  'Query Response Types': ['ch-auth', 'ch-rec', 'ch-cache', 'ch-block', 'ch-drop'],
  'open cycle (Query / Protocol Types)': ['ch-1', 'ch-2', 'ch-3', 'ch-4', 'ch-5', 'ch-6', 'ch-7', 'ch-8'],
}

/* The interface tokens a series must not be mistaken for. */
const UI = ['ink', 'mute', 'faint', 'line']

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

const luminance = (hex) => {
  const [r, g, b] = srgb(hex).map(toLinear)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}

/* CIEDE2000. Sharma, Wu & Dalal's formulation. */
function deltaE00(hexA, hexB) {
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

function simulate(hex, kind) {
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

function pairs(palette, keys, vision) {
  const present = keys.filter((k) => palette[k])
  const out = []
  for (let i = 0; i < present.length; i++)
    for (let j = i + 1; j < present.length; j++) {
      const [a, b] = [present[i], present[j]]
      out.push({ a, b, d: deltaE00(simulate(palette[a], vision), simulate(palette[b], vision)) })
    }
  return out.sort((x, y) => x.d - y.d)
}

function report(title, palette, ui) {
  console.log(`\n${'='.repeat(72)}\n${title}\n${'='.repeat(72)}`)

  for (const [chart, keys] of Object.entries(CHARTS)) {
    console.log(`\n── ${chart} ──`)
    for (const vision of [null, 'deuteranopia', 'protanopia']) {
      const p = pairs(palette, keys, vision)
      if (!p.length) continue
      const bad = p.filter((x) => x.d < 15)
      const head = vision ?? 'normal vision'
      if (!bad.length) {
        console.log(`  ${head.padEnd(14)} worst pair ΔE00 ${p[0].d.toFixed(1)}  ${label(p[0].a)} / ${label(p[0].b)}  — clear`)
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
  const series = [...new Set(Object.values(CHARTS).flat())].filter((k) => palette[k])
  let clash = 0
  for (const k of series)
    for (const t of UI) {
      if (!ui[t]) continue
      const d = deltaE00(palette[k], ui[t])
      if (d < 10) {
        console.log(`    ΔE00 ${d.toFixed(1).padStart(5)}  ${d < 1 ? 'IDENTICAL' : 'COLLISION'}  ${label(k)} ${palette[k]} / --${t} ${ui[t]}`)
        clash++
      }
    }
  if (!clash) console.log('    none under ΔE00 10')

  console.log('\n── contrast on the panel (WCAG 1.4.11 wants 3:1) ──')
  const thin = series.filter((k) => contrast(palette[k], ui.pan) < 3)
  if (!thin.length) console.log(`    every series ≥ 3:1 on --pan ${ui.pan}`)
  else for (const k of thin) console.log(`    ${contrast(palette[k], ui.pan).toFixed(2)}:1  ${label(k)} ${palette[k]}`)
}

const code = codePalette()
const ui = { ink: code.ink, mute: code.mute, faint: code.faint, line: code.line, pan: code.pan }

report('CODE — src/theme/tokens.css', code, ui)
report('PILOT — 12-piloto-dashboard.dc.html', PILOT, ui)
report('PROPOSED — the pilot with the two identities corrected', PROPOSED, ui)

console.log(`\n${'='.repeat(72)}\nWhere the two disagree\n${'='.repeat(72)}`)
for (const k of Object.keys(NAME)) {
  if (code[k] !== PILOT[k]) console.log(`  ${label(k).padEnd(15)} code ${code[k]}   pilot ${PILOT[k]}`)
}
console.log('')
