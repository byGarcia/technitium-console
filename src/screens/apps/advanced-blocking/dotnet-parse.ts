/*
  The address and name rules of the Advanced Blocking app, as the server reads them.

  Values the server accepts, the console has to accept, so each function copies the
  parser it stands for, quirks included. Where the source is in TechnitiumLibrary the
  line is cited. IPAddress.TryParse, IPEndPoint.TryParse, new Uri and the integer
  TryParse family belong to .NET: the table in the tests is what a v11.2.1 server
  answered, and it outranks the documentation. Beyond that table these lean to
  accepting: a value wrongly accepted is refused by the server on
  save, with its own message and nothing written (DnsApplication.cs:235-248); a value
  wrongly refused would be a config nobody can save.

  A canonical string is only ever compared, never shown or written.
*/

const HEX_GROUP = /^[0-9a-fA-F]{1,4}$/

/** IPAddress.TryParse: one to four parts, each decimal, 0-octal or 0x-hexadecimal,
    the last part filling the bytes left. */
function ipv4Value(s: string): number | null {
  const parts = s.split('.')
  if (parts.length > 4) return null
  const values: number[] = []
  for (const part of parts) {
    let v: number
    if (/^0[xX][0-9a-fA-F]+$/.test(part)) v = parseInt(part.slice(2), 16)
    else if (/^0[0-7]*$/.test(part)) v = parseInt(part, 8)
    else if (/^[1-9][0-9]*$/.test(part)) v = parseInt(part, 10)
    else return null
    if (v > 0xffffffff) return null
    values.push(v)
  }
  const last = values.pop() as number
  if (values.some((v) => v > 0xff)) return null
  const lastBytes = 4 - values.length
  if (lastBytes < 4 && last >= 2 ** (8 * lastBytes)) return null
  return values.reduce((sum, v, i) => sum + v * 2 ** (8 * (3 - i)), 0) + last
}

function ipv4Text(v: number): string {
  return [24, 16, 8, 0].map((shift) => Math.floor(v / 2 ** shift) & 0xff).join('.')
}

/** One side of a `::`. The last group of the address may be a dotted quad. */
function ipv6Groups(s: string, allowV4: boolean): number[] | null {
  if (s === '') return []
  const out: number[] = []
  const pieces = s.split(':')
  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i]
    if (HEX_GROUP.test(piece)) {
      out.push(parseInt(piece, 16))
    } else if (allowV4 && i === pieces.length - 1 && /^\d{1,3}(\.\d{1,3}){3}$/.test(piece)) {
      const bytes = piece.split('.').map(Number)
      if (bytes.some((b) => b > 255)) return null
      out.push(bytes[0] * 256 + bytes[1], bytes[2] * 256 + bytes[3])
    } else {
      return null
    }
  }
  return out
}

/** The eight groups and the scope of an IPv6 address. Brackets are optional, and
    after a closing bracket .NET reads a port and drops it. */
function ipv6Value(text: string): { groups: number[]; scope: string } | null {
  let s = text
  if (s.startsWith('[')) {
    const close = s.indexOf(']')
    if (close === -1) return null
    if (!/^(?::(?:0[xX][0-9a-fA-F]*|[0-9]*))?$/.test(s.slice(close + 1))) return null
    s = s.slice(1, close)
  } else if (s.includes(']')) {
    return null
  }
  let scope = ''
  const percent = s.indexOf('%')
  if (percent !== -1) {
    scope = s.slice(percent)
    s = s.slice(0, percent)
  }
  const halves = s.split('::')
  if (halves.length > 2) return null
  const head = ipv6Groups(halves[0], halves.length === 1)
  const tail = halves.length === 2 ? ipv6Groups(halves[1], true) : []
  if (head === null || tail === null) return null
  const count = head.length + tail.length
  if (halves.length === 1 ? count !== 8 : count >= 8) return null
  return { groups: [...head, ...new Array<number>(8 - count).fill(0), ...tail], scope }
}

type Address =
  | { family: 4; value: number }
  | { family: 6; groups: number[]; scope: string }

/* IPAddress.TryParse tries IPv6 if and only if the text has a colon. */
function readAddress(s: string): Address | null {
  if (s.includes(':')) {
    const v6 = ipv6Value(s)
    return v6 === null ? null : { family: 6, ...v6 }
  }
  const value = ipv4Value(s)
  return value === null ? null : { family: 4, value }
}

function addressText(a: Address): string {
  if (a.family === 4) return ipv4Text(a.value)
  return a.groups.map((g) => g.toString(16)).join(':') + a.scope
}

export function parseIp(s: string): { family: 4 | 6; canonical: string } | null {
  const a = readAddress(s)
  return a === null ? null : { family: a.family, canonical: addressText(a) }
}

/** byte.TryParse and ushort.TryParse with their default style: surrounding spaces,
    a sign (a minus only on zero) and leading zeros are fine. */
function lenientUnsigned(s: string, max: number): number | null {
  const m = /^[\t\n\v\f\r ]*([+-]?)([0-9]+)[\t\n\v\f\r ]*$/.exec(s)
  if (m === null) return null
  const v = Number(m[2])
  if (v > max || (m[1] === '-' && v !== 0)) return null
  return v
}

/** NetworkAddress.cs:67: address.GetNetworkAddress(prefixLength). */
function maskAddress(a: Address, prefix: number): Address {
  if (a.family === 4) {
    const size = 2 ** (32 - prefix)
    return { family: 4, value: Math.floor(a.value / size) * size }
  }
  const groups = a.groups.map((g, i) => {
    const keep = Math.max(0, Math.min(16, prefix - 16 * i))
    return keep === 0 ? 0 : g & (0xffff << (16 - keep)) & 0xffff
  })
  return { ...a, groups }
}

/** NetworkAddress.cs:87-140. The canonical form is the masked address and the
    prefix, which is what NetworkAddress.Equals compares (NetworkAddress.cs:219-234). */
export function parseNetwork(s: string): { canonical: string } | null {
  const slash = s.indexOf('/') // Split with a count of 2: the rest stays in one part
  const address = readAddress(slash === -1 ? s : s.slice(0, slash))
  if (address === null) return null
  let prefix = 255
  if (slash !== -1) {
    const read = lenientUnsigned(s.slice(slash + 1), 255)
    if (read === null) return null
    prefix = read
  }
  /* NetworkAddress.cs:108 and :121: 255 is the "no prefix" marker, so a typed 255
     counts as none. */
  const bits = address.family === 4 ? 32 : 128
  if (prefix === 255) prefix = bits
  else if (prefix > bits) return null
  return { canonical: `${addressText(maskAddress(address, prefix))}/${prefix}` }
}

/** DnsClient.cs:2539-2624. */
export function isDomainNameValid(s: string): boolean {
  if (s.length === 0) return true // the root
  if (s.length > 255) return false
  return s.split('.').every((label) => {
    if (label.length === 0 || label.length > 63) return false
    return label === '*' || /^[a-zA-Z0-9\-_/]+$/.test(label)
  })
}

/** IPEndPoint.TryParse: a port only after `]`, or after the single colon of an IPv4,
    in plain digits. */
function ipEndpoint(s: string): { address: Address; port: number } | null {
  let addressEnd = s.length
  const colon = s.lastIndexOf(':')
  if (colon > 0 && (s[colon - 1] === ']' || s.lastIndexOf(':', colon - 1) === -1)) addressEnd = colon
  const address = readAddress(s.slice(0, addressEnd))
  if (address === null) return null
  if (addressEnd === s.length) return { address, port: 0 }
  const digits = s.slice(addressEnd + 1)
  if (!/^[0-9]+$/.test(digits) || Number(digits) > 65535) return null
  return { address, port: Number(digits) }
}

/** DomainEndPoint.cs:77 runs IdnMapping.GetAscii. The URL parser does the same job
    here; what it cannot read is left for the server to judge. */
function nameToAscii(name: string): string | null {
  try {
    return new URL(`http://${name}/`).hostname
  } catch {
    return null
  }
}

/**
 * EndPointExtensions.cs:246-262 and DomainEndPoint.cs:62-100.
 *
 * The canonical form keeps the case of a name. DomainEndPoint.Equals ignores it
 * (DomainEndPoint.cs:127) but GetHashCode does not (DomainEndPoint.cs:141), so the
 * Dictionary of the app takes `A.example` and `a.example` as two keys: measured on a
 * v11.2.1 server, that config loads.
 */
export function parseEndpoint(s: string): { canonical: string } | null {
  const ip = ipEndpoint(s)
  if (ip !== null) {
    const text = addressText(ip.address)
    return { canonical: ip.address.family === 6 ? `[${text}]:${ip.port}` : `${text}:${ip.port}` }
  }
  const parts = s.split(':')
  if (parts.length > 2) return null
  if (readAddress(parts[0]) !== null) return null
  let name = parts[0]
  if ([...name].some((c) => c.charCodeAt(0) > 127)) {
    const ascii = nameToAscii(name)
    if (ascii === null) return { canonical: `${name}:0` }
    name = ascii
  }
  if (!isDomainNameValid(name)) return null
  let port = 0
  if (parts.length === 2) {
    const read = lenientUnsigned(parts[1], 65535)
    if (read === null) return null
    port = read
  }
  return { canonical: `${name}:${port}` }
}

/** new Uri(string), which trims, wants a scheme, and also takes a rooted path, a
    drive (matched by the scheme pattern) or a UNC path. */
export function isAbsoluteUri(s: string): boolean {
  const t = s.trim()
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(t) || t.startsWith('/') || t.startsWith('\\\\')
}
