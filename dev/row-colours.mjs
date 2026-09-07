/*
Los siete colores de fila de Query Logs, medidos donde de verdad se usan.

Existe porque `dev/palette-distance.mjs` mide la paleta de SERIES —líneas y chips a
color pleno— y el código de color de las filas es otra cosa: el mismo token puesto
como fondo translúcido detrás de texto. La reconciliación del arquetipo herramienta
lo demostró: con los siete tokens de serie, el chip separa —0 de 21 pares por
debajo del umbral— y **la fila no** —5 de 21—. Medir una superficie y decidir sobre
la otra es el error que este fichero impide.

Las tres comprobaciones, y las tres tienen que pasar a la vez:

  · ΔE00 entre pares como FONDO, a la opacidad real, sobre el panel.
  · Contraste del texto de la celda sobre el fondo más claro — AA pide 4,5:1.
  · Contraste de la LÍNEA sobre el panel — WCAG 1.4.11 pide 3:1 para un objeto
    gráfico no textual, y es la que tumbó el primer retoque propuesto: oscurecer el
    cian arreglaba la deuteranopia y dejaba la línea en 2,35:1.

    node dev/row-colours.mjs

Medido el 2026-09-03. El valor que pasa las tres es `tok('ch-refuse')` (teal-600): hay que
mover el TONO además de la claridad, porque en la familia cian no hay ninguno que
cumpla las tres.
*/
import { readFileSync } from 'node:fs'
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


/*
Los siete se LEEN de `tokens.css`, no se escriben aquí.

Escritos a mano, esta herramienta diría una cosa y el producto pintaría otra en
cuanto alguien tocara un token — y es justo lo que pasó durante el retoque de
`--ch-refuse`: la primera versión llevaba el valor a mano y seguía informando del
viejo después de cambiarlo. Una herramienta de deriva que puede derivar no sirve.
*/
const CSS = readFileSync(new URL('../src/theme/tokens.css', import.meta.url), 'utf8')
const tok = (n) => {
  const m = new RegExp(`--${n}:\\s*(#[0-9a-fA-F]{6})`).exec(CSS)
  if (m == null) throw new Error(`falta el token --${n} en tokens.css`)
  return m[1].toLowerCase()
}

const PAN = tok('pan')
const INK = tok('ink')
const mez = (h, a) => '#' + [1, 3, 5].map((i) =>
  Math.round(parseInt(h.slice(i, i + 2), 16) * a + parseInt(PAN.slice(i, i + 2), 16) * (1 - a))
    .toString(16).padStart(2, '0')).join('')
const lum = (h) => {
  const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }

/* Los siete del código de color de Query Logs, y las cuatro series con las que
   `Refused` comparte la gráfica de líneas del Dashboard. */
const FILA = {
  'Server Failure': tok('ch-fail'), 'Blocked': tok('ch-block'), 'NX Domain': tok('ch-nx'),
  'Refused': tok('ch-refuse'), 'Authoritative': tok('ch-auth'), 'Recursive': tok('ch-rec'),
  'Cached': tok('ch-cache'),
}
const SERIES = {
  ...FILA, 'Total': tok('ch-total'), 'No Error': tok('ch-ok'),
  'Dropped': tok('ch-drop'), 'Clients': tok('ch-clients'),
}
const ALFA = 0.30
const ks = Object.keys(FILA)

console.log('tokens leídos de tokens.css:', JSON.stringify(FILA))

console.log(`\n== FONDO DE FILA al ${ALFA * 100} % sobre ${PAN} ==`)
const pares = []
for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++)
  pares.push([deltaE00(mez(FILA[ks[i]], ALFA), mez(FILA[ks[j]], ALFA)), ks[i], ks[j]])
pares.sort((a, b) => a[0] - b[0])
const malos = pares.filter((p) => p[0] < 10)
for (const [d, a, b] of pares.slice(0, 6))
  console.log(`   ${d.toFixed(1).padStart(5)}  ${d < 10 ? 'COLISIÓN ' : 'en riesgo'}  ${a} / ${b}`)
console.log(`   --> ${malos.length} de ${pares.length} por debajo del umbral de colisión (10)`)

const peorTexto = Math.min(...ks.map((k) => ratio(INK, mez(FILA[k], ALFA))))
console.log(`\n== TEXTO de la celda sobre el fondo más claro ==`)
console.log(`   ${peorTexto.toFixed(1)}:1  ${peorTexto >= 4.5 ? 'ok (AA)' : 'POR DEBAJO de 4.5'}`)

console.log(`\n== LÍNEA sobre el panel — WCAG 1.4.11 pide 3:1 ==`)
for (const [n, h] of Object.entries(FILA)) {
  const c = ratio(h, PAN)
  console.log(`   ${n.padEnd(15)} ${c.toFixed(2).padStart(5)}:1  ${c >= 3 ? 'ok' : 'POR DEBAJO'}`)
}

console.log(`\n== LAS ONCE SERIES, por visión, peor par de cada una con Refused ==`)
for (const v of ['normal', 'protanopia', 'deuteranopia']) {
  const r = Object.entries(SERIES).filter(([n]) => n !== 'Refused').map(([n, h]) => {
    const A = v === 'normal' ? FILA['Refused'] : simulate(FILA['Refused'], v)
    const B = v === 'normal' ? h : simulate(h, v)
    return [deltaE00(A, B), n]
  }).sort((a, b) => a[0] - b[0])
  const [d, n] = r[0]
  console.log(`   ${v.padEnd(13)} peor: ${n} ${d.toFixed(1)}  ${d < 10 ? 'COLISIÓN' : d < 15 ? 'en riesgo' : 'separa'}`)
}
