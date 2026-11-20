/*
The two forms of an internationalised domain name: the Unicode one a person types and
reads (`bücher.de`), and the ASCII one the server stores and most of its lists return
(`xn--bcher-kva.de`). Punycode is RFC 3492; each label is converted on its own.

The server accepts either form wherever it takes a name to look up or to add
(`zones/create`, `zones/records/add`, `blocked/add`, `dnsClient/resolve`,
`cache/list`) and answers with the ASCII form. Query Logs' `qname` is the exception:
it matches only the ASCII form (15.6.2 harness, 2026-11-20).

The mapping before encoding is the part of IDNA that matters for names people type:
lowercase, composed (NFC), and the ideographic full stops read as dots. Anything the
server would refuse is left for it to refuse.
*/

const BASE = 36
const T_MIN = 1
const T_MAX = 26
const SKEW = 38
const DAMP = 700
const INITIAL_BIAS = 72
const INITIAL_N = 128
const PREFIX = 'xn--'

function adapt(delta: number, points: number, first: boolean): number {
  let d = first ? Math.floor(delta / DAMP) : delta >> 1
  d += Math.floor(d / points)
  let k = 0
  while (d > ((BASE - T_MIN) * T_MAX) >> 1) {
    d = Math.floor(d / (BASE - T_MIN))
    k += BASE
  }
  return k + Math.floor(((BASE - T_MIN + 1) * d) / (d + SKEW))
}

const threshold = (k: number, bias: number) => (k <= bias ? T_MIN : k >= bias + T_MAX ? T_MAX : k - bias)

function digitOf(code: number): number {
  if (code >= 48 && code <= 57) return code - 22
  if (code >= 65 && code <= 90) return code - 65
  if (code >= 97 && code <= 122) return code - 97
  return BASE
}

const charOf = (digit: number) => String.fromCharCode(digit < 26 ? digit + 97 : digit + 22)

/** One label's Punycode (without `xn--`) back to Unicode, or `null` when it is not valid. */
function decodeLabel(input: string): string | null {
  const delimiter = input.lastIndexOf('-')
  const output = delimiter > 0 ? [...input.slice(0, delimiter)].map((c) => c.charCodeAt(0)) : []
  if (output.some((c) => c >= 0x80)) return null
  let n = INITIAL_N
  let i = 0
  let bias = INITIAL_BIAS
  for (let at = delimiter > 0 ? delimiter + 1 : 0; at < input.length; ) {
    const old = i
    let w = 1
    for (let k = BASE; ; k += BASE) {
      if (at >= input.length) return null
      const digit = digitOf(input.charCodeAt(at++))
      if (digit >= BASE) return null
      i += digit * w
      const t = threshold(k, bias)
      if (digit < t) break
      w *= BASE - t
      if (!Number.isSafeInteger(i) || !Number.isSafeInteger(w)) return null
    }
    const length = output.length + 1
    bias = adapt(i - old, length, old === 0)
    n += Math.floor(i / length)
    i %= length
    if (n > 0x10ffff) return null
    output.splice(i++, 0, n)
  }
  return String.fromCodePoint(...output)
}

/** One label's code points to Punycode (without `xn--`). */
function encodeLabel(label: string): string {
  const points = [...label].map((c) => c.codePointAt(0) as number)
  let output = points.filter((c) => c < 0x80).map((c) => String.fromCharCode(c)).join('')
  const basic = output.length
  let handled = basic
  if (basic > 0) output += '-'
  let n = INITIAL_N
  let delta = 0
  let bias = INITIAL_BIAS
  while (handled < points.length) {
    const m = Math.min(...points.filter((c) => c >= n))
    delta += (m - n) * (handled + 1)
    n = m
    for (const c of points) {
      if (c < n) delta++
      if (c !== n) continue
      let q = delta
      for (let k = BASE; ; k += BASE) {
        const t = threshold(k, bias)
        if (q < t) break
        output += charOf(t + ((q - t) % (BASE - t)))
        q = Math.floor((q - t) / (BASE - t))
      }
      output += charOf(q)
      bias = adapt(delta, handled + 1, handled === basic)
      delta = 0
      handled++
    }
    delta++
    n++
  }
  return output
}

/** The name in its ASCII form: every label with a non-ASCII character becomes `xn--…`. */
export function toAscii(name: string): string {
  return name
    .replace(/[。．｡]/g, '.')
    .split('.')
    .map((label) => {
      if (!/[^\x00-\x7f]/.test(label)) return label
      return PREFIX + encodeLabel(label.normalize('NFC').toLowerCase())
    })
    .join('.')
}

/** The name in its Unicode form: every `xn--…` label decoded, one that is not valid kept as it is. */
export function toUnicode(name: string): string {
  if (!/xn--/i.test(name)) return name
  return name
    .split('.')
    .map((label) => {
      if (label.slice(0, PREFIX.length).toLowerCase() !== PREFIX || label.length === PREFIX.length) return label
      /* Only a label that is the encoding of what it decodes to, and holds only
         letters, marks, digits and hyphens, is drawn decoded: `xn--google-`
         decodes to `google`, another name, `xn--a` to a control character, and
         a label can decode to `google．com`, one label that reads as two. */
      const encoded = label.slice(PREFIX.length).toLowerCase()
      const decoded = decodeLabel(encoded)
      if (
        decoded == null ||
        !/[^\x00-\x7f]/.test(decoded) ||
        !/^[\p{L}\p{M}\p{N}-]+$/u.test(decoded) ||
        encodeLabel(decoded) !== encoded
      )
        return label
      return decoded
    })
    .join('.')
}
