/*
Just enough of the DNS wire format (RFC 1035) to answer one question.

The DNS server asks this endpoint over DNS-over-HTTPS (RFC 8484), so what comes
in is a binary DNS message and what goes out must be one too. Technitium checks
that the answer carries the query's ID and question (`ValidateResponse` in
TechnitiumLibrary's `HttpsClientConnection.cs`), and nothing else: it accepts an
answer without an OPT record even when the query had one.

Web APIs only (`Uint8Array`, `DataView`): `Buffer` does not exist in a Cloudflare
Function.
*/

export const TYPE_TXT = 16

export interface DnsQuery {
  id: number
  rd: boolean
  /** Lower-cased, without the trailing dot. */
  name: string
  type: number
  /** The question section as it came: QNAME, QTYPE and QCLASS. */
  question: Uint8Array
}

export function parseQuery(message: Uint8Array): DnsQuery | null {
  if (message.length < 12) return null
  const view = new DataView(message.buffer, message.byteOffset, message.byteLength)
  if (view.getUint16(4) !== 1) return null

  const labels: string[] = []
  let at = 12
  for (;;) {
    if (at >= message.length) return null
    const length = message[at]
    if (length === 0) break
    // A query has no earlier name to point to, so compression is malformed here.
    if (length > 63) return null
    if (at + 1 + length > message.length) return null
    labels.push(String.fromCharCode(...message.subarray(at + 1, at + 1 + length)))
    at += 1 + length
  }
  at += 1
  if (at + 4 > message.length) return null

  return {
    id: view.getUint16(0),
    rd: (view.getUint16(2) & 0x0100) !== 0,
    name: labels.join('.').toLowerCase(),
    type: view.getUint16(at),
    question: message.slice(12, at + 4),
  }
}

/* rcode: 0 NOERROR, 1 FORMERR, 2 SERVFAIL, 3 NXDOMAIN. */
export function buildResponse(
  query: DnsQuery,
  rcode: 0 | 1 | 2 | 3,
  txt?: { text: string; ttl: number },
): Uint8Array {
  const strings: Uint8Array[] = []
  if (txt) {
    const bytes = new TextEncoder().encode(txt.text)
    for (let i = 0; i < bytes.length; i += 255) strings.push(bytes.subarray(i, i + 255))
    if (strings.length === 0) strings.push(new Uint8Array(0))
  }
  const rdlength = strings.reduce((n, s) => n + 1 + s.length, 0)
  const answer = txt ? 12 + rdlength : 0

  const out = new Uint8Array(12 + query.question.length + answer)
  const view = new DataView(out.buffer)
  view.setUint16(0, query.id)
  // QR, AA and RA set; RD copied from the query.
  view.setUint16(2, 0x8000 | 0x0400 | (query.rd ? 0x0100 : 0) | 0x0080 | rcode)
  view.setUint16(4, 1)
  view.setUint16(6, txt ? 1 : 0)
  out.set(query.question, 12)

  if (txt) {
    let at = 12 + query.question.length
    // The answer's name points back to the question's (offset 12).
    view.setUint16(at, 0xc00c)
    view.setUint16(at + 2, TYPE_TXT)
    view.setUint16(at + 4, 1)
    view.setUint32(at + 6, txt.ttl)
    view.setUint16(at + 10, rdlength)
    at += 12
    for (const s of strings) {
      out[at++] = s.length
      out.set(s, at)
      at += s.length
    }
  }
  return out
}
