import { zoneHasSvcbAutoHint } from '../../api/records'
import { typeLabel, type Zone } from '../../api/zones'
import { buildRecordBody, emptyForm } from './record-form'
import type { Notice } from './types'

/*
QUICK ADD OF A HOST RECORD (deviation 34 in CONVENTIONS.md): a name and an
address in the zone list's toolbar, and an `A` or `AAAA` added to the zone the
name belongs to. Upstream adds a record only from inside a zone, through the
Add Record dialog; this finds the zone and then sends exactly what that dialog
sends for the same record (`buildRecordBody`, `zones/records/add`).

What it decides by itself, and nothing more:

  · **the zone**: the longest of the zones the list knows that the name ends in,
    whole labels only (`a.example.lan` is in `example.lan`, `myexample.lan` is
    not). The root zone holds every name. A name no zone holds is refused before
    anything is sent;
  · **the type**, by the address's family: `A` for IPv4, `AAAA` for IPv6. An
    address of neither is refused before anything is sent;
  · **the TTL**: the server's default record TTL, the value the dialog shows
    as its placeholder.

The zone must take records from here: upstream offers Add Record only in a zone
it lets you edit (`Primary` and `Forwarder`, the same list as the row's "Edit
Zone"), and never in one of the server's internal zones.

Its words, OURS: `Invalid!` and the texts of three refusals below (an address of
neither family, a name no zone holds, a zone that takes no records from here). The
way out of the second is upstream's own `Add Zone`. The rest is upstream's too: "Please enter a domain name to add the
record.", "Please enter an IP address to add the record.", "Record Added!" and
"Resource record was added successfully.", "Add reverse (PTR) record" and
"Create reverse zone if it does not exists".
*/

/** The types whose records upstream lets you add (`EDITABLE` in ZoneList). */
const TAKES_RECORDS = ['Primary', 'Forwarder']

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/

/** `A`, `AAAA`, or `null` for text that is neither address. */
export function addressFamily(address: string): 'A' | 'AAAA' | null {
  if (IPV4.test(address)) return 'A'
  if (!address.includes(':') || /[^0-9a-fA-F:.]/.test(address)) return null
  try {
    // The URL parser is the platform's own IPv6 grammar, `::ffff:1.2.3.4` included.
    new URL(`http://[${address}]/`)
    return 'AAAA'
  } catch {
    return null
  }
}

/** The name as it is compared: trimmed, lowercase, without the closing dot. */
export function normaliseName(name: string): string {
  return name.trim().replace(/\.$/, '').toLowerCase()
}

/** The zone that holds this name: the longest match among `zones`, or `null`. */
export function zoneForName(name: string, zones: Zone[]): Zone | null {
  const host = normaliseName(name)
  let best: Zone | null = null
  let bestLength = -1
  for (const z of zones) {
    const zone = z.name.toLowerCase()
    const holds = zone === '' || host === zone || host.endsWith(`.${zone}`)
    if (holds && zone.length > bestLength) {
      best = z
      bestLength = zone.length
    }
  }
  return best
}

/** The name relative to its zone, as the dialog's Name field takes it. */
export function subDomainOf(name: string, zone: string): string {
  const host = normaliseName(name)
  if (zone === '') return host
  if (host === zone.toLowerCase()) return '@'
  return host.substring(0, host.length - zone.length - 1)
}

export interface QuickAddInput {
  name: string
  address: string
  ptr: boolean
  createPtrZone: boolean
}

export type QuickAddResult =
  | { ok: true; zone: string; body: Record<string, string> }
  /** `noZone` offers Add Zone. */
  | { ok: false; notice: Notice; field: 'name' | 'address'; noZone?: boolean }

const missing = (text: string, field: 'name' | 'address'): QuickAddResult => ({
  ok: false,
  notice: { type: 'warning', title: 'Missing!', text },
  field,
})

/**
 * What to send, or why not, in this order: the name, the address, the address's
 * family, the zone, and whether that zone takes records.
 */
export function planQuickAdd(input: QuickAddInput, zones: Zone[], defaultRecordTtl: number): QuickAddResult {
  const host = normaliseName(input.name)
  const address = input.address.trim()
  if (host === '') return missing('Please enter a domain name to add the record.', 'name')
  if (address === '') return missing('Please enter an IP address to add the record.', 'address')

  const type = addressFamily(address)
  if (type == null) {
    return {
      ok: false,
      notice: { type: 'warning', title: 'Invalid!', text: `'${address}' is not an IPv4 or IPv6 address.` },
      field: 'address',
    }
  }

  const zone = zoneForName(host, zones)
  if (zone == null) {
    return {
      ok: false,
      notice: {
        type: 'warning',
        title: 'Missing!',
        text: `No zone on this node holds '${host}'. Add the zone first, then the record.`,
      },
      field: 'name',
      noZone: true,
    }
  }

  const zoneName = zone.name === '' ? '.' : zone.name
  if (!TAKES_RECORDS.includes(zone.type) || zone.internal === true) {
    return {
      ok: false,
      notice: {
        type: 'warning',
        title: 'Invalid!',
        text: `'${host}' belongs to the zone '${zoneName}' (${typeLabel(zone.type)}), which takes no records from here.`,
      },
      field: 'name',
    }
  }

  const r = buildRecordBody(
    {
      ...emptyForm(),
      name: subDomainOf(host, zone.name),
      type,
      ttl: String(defaultRecordTtl),
      value: address,
      ptr: input.ptr,
      createPtrZone: input.createPtrZone,
    },
    /* Without the zone's records upstream's own rule asks the server to redo
       the SVCB hints (`zoneHasSvcbAutoHint` with no list is `true`). */
    { zone: zoneName, mode: 'add', updateSvcbHints: zoneHasSvcbAutoHint(null, type === 'A', type === 'AAAA') },
  )
  if ('error' in r) return missing(r.error.text, 'address')
  return { ok: true, zone: zoneName, body: r.body }
}
