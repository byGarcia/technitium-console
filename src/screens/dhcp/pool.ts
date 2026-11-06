import type { DhcpLease, DhcpScopeRow } from '../../api/dhcp'

/*
WHAT THE SECTION HOLDS (deviation 19 in CONVENTIONS.md, 2026-11-06). The figures
the DHCP cards and the scope table's Leases column draw, worked out from what
`dhcp/scopes/list` and `dhcp/leases/list` return and from nothing else.

  · A scope's addresses are its range, `endingAddress - startingAddress + 1`. The
    exclusions are not in `scopes/list`, so they are not taken off: the figure is
    the range, and the cards and the column say "addresses in range", never "free".
  · A lease counts in the scope whose name it carries (`lease.scope`). The server
    lists only the leases a client holds (`Scope.Leases`, WebServiceDhcpApi.cs
    ListDhcpLeases); a reserved lease no client has taken yet is not in the list,
    so it is not counted either.
  · A count is a fact of the server, so a zero is drawn as 0.
*/

/** An IPv4 address as a number, or `null` when it is not one. */
export function ipv4(text: string): number | null {
  const parts = text.trim().split('.')
  if (parts.length !== 4) return null
  let n = 0
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null
    const v = Number(p)
    if (v > 255) return null
    n = n * 256 + v
  }
  return n
}

/** How many addresses a range holds, ends included; `null` when either end is
 *  not an IPv4 address or the range runs backwards. */
export function rangeSize(start: string, end: string): number | null {
  const a = ipv4(start)
  const b = ipv4(end)
  if (a == null || b == null || b < a) return null
  return b - a + 1
}

/** The leases each scope holds, by scope name. */
export function leasesPerScope(leases: DhcpLease[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const l of leases) out.set(l.scope, (out.get(l.scope) ?? 0) + 1)
  return out
}

export interface PoolTotals {
  /** Addresses in the ranges of the ENABLED scopes: the ones that can lease. */
  addresses: number
  /** Leases held in those scopes. */
  leased: number
}

/** The pool of the scopes that are serving: a disabled scope leases nothing. */
export function poolTotals(scopes: DhcpScopeRow[], leases: DhcpLease[]): PoolTotals {
  const per = leasesPerScope(leases)
  let addresses = 0
  let leased = 0
  for (const s of scopes) {
    if (!s.enabled) continue
    addresses += rangeSize(s.startingAddress, s.endingAddress) ?? 0
    leased += per.get(s.name) ?? 0
  }
  return { addresses, leased }
}

/** One hour: what "expiring soon" means on the Leases cards. */
export const SOON_MS = 60 * 60 * 1000

/** The leases that run out within the next hour, soonest first. One already
 *  past its time is not counted: the server drops it on its next sweep. */
export function expiringSoon(leases: DhcpLease[], now: number): DhcpLease[] {
  return leases
    .filter((l) => {
      const t = Date.parse(l.leaseExpires)
      return Number.isFinite(t) && t > now && t - now <= SOON_MS
    })
    .sort((a, b) => Date.parse(a.leaseExpires) - Date.parse(b.leaseExpires))
}

/** The lease obtained most recently, or `null` with none. */
export function newest(leases: DhcpLease[]): DhcpLease | null {
  let best: DhcpLease | null = null
  let bestAt = -Infinity
  for (const l of leases) {
    const t = Date.parse(l.leaseObtained)
    if (Number.isFinite(t) && t > bestAt) {
      best = l
      bestAt = t
    }
  }
  return best
}

/*
The Leases table's search: what the user typed, found in the IP address, the MAC
address or the host name, ignoring case. A MAC typed with colons finds the
server's dashes (`A4:83:E7` finds `A4-83-E7-…`), since both are how a MAC is
written.
*/
export function matchesSearch(l: DhcpLease, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (q === '') return true
  const mac = q.replace(/:/g, '-')
  return (
    l.address.toLowerCase().includes(q) ||
    l.hardwareAddress.toLowerCase().includes(mac) ||
    (l.hostName ?? '').toLowerCase().includes(q)
  )
}

/** A lease's identity in the list: the pair every action on it sends. */
export function leaseKey(l: DhcpLease): string {
  return `${l.scope}\n${l.clientIdentifier}`
}

/*
The scope list's search (deviation 19): the name, ignoring case, or an address.
Typed whole, an IPv4 address finds the scopes whose range holds it, so "which scope
hands out 172.31.10.42" has an answer; typed in part, it finds the scopes whose
starting, ending, network or interface address carries it.
*/
export function matchesScope(s: DhcpScopeRow, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (q === '') return true
  if (s.name.toLowerCase().includes(q)) return true
  const at = ipv4(q)
  if (at != null) {
    const a = ipv4(s.startingAddress)
    const b = ipv4(s.endingAddress)
    if (a != null && b != null && at >= a && at <= b) return true
  }
  return [s.startingAddress, s.endingAddress, s.networkAddress, s.interfaceAddress ?? ''].some((x) =>
    x.includes(q),
  )
}

/** A lease time as the console writes a TTL's human part: `1d`, `4h 30m`. */
export function leaseTime(days: number, hours: number, minutes: number): string {
  const parts = [days > 0 && `${days}d`, hours > 0 && `${hours}h`, minutes > 0 && `${minutes}m`].filter(Boolean)
  return parts.length === 0 ? '0m' : parts.join(' ')
}
