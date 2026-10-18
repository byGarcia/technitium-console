/*
Builds the DNS query a client would POST, for the tests. With `arcount` 1 it
appends an empty OPT record, because Technitium sends one with every query.
*/
export function encodeQuery(name: string, type: number, id = 0, rd = true, arcount = 0): Uint8Array {
  const labels = name.split('.').filter((l) => l.length > 0)
  const qname = labels.reduce((n, l) => n + 1 + l.length, 1)
  const opt = arcount === 1 ? 11 : 0
  const out = new Uint8Array(12 + qname + 4 + opt)
  const view = new DataView(out.buffer)
  view.setUint16(0, id)
  view.setUint16(2, rd ? 0x0100 : 0)
  view.setUint16(4, 1)
  view.setUint16(10, arcount)
  let at = 12
  for (const label of labels) {
    out[at++] = label.length
    for (const ch of label) out[at++] = ch.charCodeAt(0)
  }
  out[at++] = 0
  view.setUint16(at, type)
  view.setUint16(at + 2, 1)
  at += 4
  if (opt) {
    out[at] = 0
    view.setUint16(at + 1, 41)
    view.setUint16(at + 3, 1232)
  }
  return out
}
