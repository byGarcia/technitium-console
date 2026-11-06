import { cleanList, listToText } from '../settings/model'
import { networkContains } from '../blocking/check-domain'

/*
THE CARD'S ACTIONS (CONVENTIONS.md, deviation 25, approved on 2026-11-06): two of
Settings' lists and one of DHCP's conversions, each sent as the console already
sends it elsewhere. Nothing here asks the server or writes words.

The two lists are Settings' own fields, `Blocking Bypass List`
(`blockingBypassList`, Settings › Blocking) and `QPM Limit Bypass List`
(`qpmLimitBypassList`, Settings › General). Both are CLUSTER-WIDE parameters
(`nodeScope`, settings/model.ts: the Blocking block and the EDNS, DNSSEC, ECS and
QPM block are sent only with the cluster or a standalone server), so they are read
and saved where Blocking › Lists reads and saves `blockListUrls`: the cluster when
there is one (`cluster`), this server when there is not (``). A save sends that
`node` and the one list, nothing else, through Settings' own cleaning (`cleanList`
over `listToText`, `false` for an empty list), as `list-lines.ts`' `saveBody`
does with `blockListUrls`.

An entry is an address or a network (`NetworkAddress.Parse`), so a client can be
in a list through a network that holds its address. Adding puts the address
alone; removing takes out the address alone, and a client covered by a network
entry is not offered a removal that would not change anything.
*/

/** Where the two lists are read and saved: Blocking › Lists' node for `blockListUrls`. */
export function settingsNode(clusterInitialised: boolean): string {
  return clusterInitialised ? 'cluster' : ''
}

export type BypassList = 'blockingBypassList' | 'qpmLimitBypassList'

export interface Membership {
  /** The entry that holds the address: the address itself, or a network. */
  entry: string | null
  /** The entry is the address itself, so taking it out takes the client out. */
  exact: boolean
}

/** Whether, and through which entry, `ip` is in `list`. The address itself wins over a network. */
export function membership(list: readonly string[] | null | undefined, ip: string): Membership {
  const entries = (list ?? []).map((e) => e.trim()).filter((e) => e !== '')
  const exact = entries.find((e) => e === ip)
  if (exact != null) return { entry: exact, exact: true }
  const network = entries.find((e) => networkContains(e, ip))
  return { entry: network ?? null, exact: false }
}

/** Settings' value for a list: commas, cleaned, `false` when empty. */
function asValue(list: readonly string[]): string {
  const v = cleanList(listToText(list))
  return v.length === 0 || v === ',' ? 'false' : v
}

/** The `settings/set` body that adds `ip` to one list. */
export function addBody(name: BypassList, list: readonly string[] | null | undefined, ip: string, node: string): Record<string, string> {
  return { node, [name]: asValue([...(list ?? []), ip]) }
}

/** The `settings/set` body that takes `ip` (the address itself) out of one list. */
export function removeBody(name: BypassList, list: readonly string[] | null | undefined, ip: string, node: string): Record<string, string> {
  const m = membership(list, ip)
  return { node, [name]: asValue((list ?? []).filter((e) => !(m.exact && e.trim() === m.entry))) }
}
